import { db } from '$lib/server/db';
import { client, task, taskProduct, product, invoice, invoiceItems } from '$lib/server/db/schema';
import { eq, sql, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const clientId = Number(params.id);
	if (isNaN(clientId)) error(404, 'Not found');

	const clientRecord = await db.query.client.findFirst({
		where: eq(client.id, clientId)
	});
	if (!clientRecord) error(404, 'Client not found');

	// All tasks for this client with their product costs
	const taskRows = await db
		.select({
			taskId: task.id,
			taskTitle: task.title,
			taskPrice: task.price,
			taskCreatedAt: task.created_at,
			isDone: task.isDone,
			// Invoice linked to this task (if any)
			invoiceId: invoice.id,
			invoiceNumber: invoice.invoiceNumber,
			invoiceSubtotal: invoice.subtotal,
			// Product aggregates
			productCost: sql<number>`COALESCE(SUM(${taskProduct.count} * ${product.cost}), 0)`,
			productRevenue: sql<number>`COALESCE(SUM(${taskProduct.count} * ${product.price}), 0)`
		})
		.from(task)
		.leftJoin(invoice, eq(invoice.taskId, task.id))
		.leftJoin(taskProduct, eq(taskProduct.taskId, task.id))
		.leftJoin(product, eq(product.id, taskProduct.productId))
		.where(eq(task.clientId, clientId))
		.groupBy(task.id, task.title, task.price, task.created_at, task.isDone, invoice.id, invoice.invoiceNumber, invoice.subtotal)
		.orderBy(task.created_at);

	// Products per task (for the detail breakdown)
	const taskProductRows = await db
		.select({
			taskId: taskProduct.taskId,
			productId: product.id,
			productTitle: product.title,
			count: taskProduct.count,
			cost: product.cost,
			price: product.price
		})
		.from(taskProduct)
		.innerJoin(product, eq(product.id, taskProduct.productId))
		.innerJoin(task, eq(task.id, taskProduct.taskId))
		.where(eq(task.clientId, clientId));

	// Standalone invoices (no task) for this client
	const standaloneInvoices = await db
		.select({
			id: invoice.id,
			invoiceNumber: invoice.invoiceNumber,
			subtotal: invoice.subtotal,
			total: invoice.total,
			status: invoice.status,
			issueDate: invoice.issueDate
		})
		.from(invoice)
		.where(sql`${invoice.clientId} = ${clientId} AND ${invoice.taskId} IS NULL`);

	// Combine per-task data with product detail list
	const productsByTask = taskProductRows.reduce(
		(acc, row) => {
			if (!acc[row.taskId]) acc[row.taskId] = [];
			acc[row.taskId].push(row);
			return acc;
		},
		{} as Record<number, typeof taskProductRows>
	);

	const tasks = taskRows.map((row) => {
		const revenue =
			row.invoiceSubtotal != null ? row.invoiceSubtotal : (row.taskPrice ?? 0);
		const cost = Number(row.productCost);
		const profit = revenue - cost;
		return {
			taskId: row.taskId,
			taskTitle: row.taskTitle,
			taskPrice: row.taskPrice,
			taskCreatedAt: row.taskCreatedAt,
			isDone: row.isDone,
			invoiceId: row.invoiceId,
			invoiceNumber: row.invoiceNumber,
			invoiceSubtotal: row.invoiceSubtotal,
			productCost: cost,
			revenue,
			profit,
			isProblematic: profit < 0 || (revenue === 0 && cost > 0),
			products: productsByTask[row.taskId] ?? []
		};
	});

	const totalRevenue = tasks.reduce((s, t) => s + t.revenue, 0)
		+ standaloneInvoices.reduce((s, i) => s + (i.subtotal ?? 0), 0);
	const totalCost = tasks.reduce((s, t) => s + t.productCost, 0);
	const totalProfit = totalRevenue - totalCost;

	return {
		client: clientRecord,
		tasks,
		standaloneInvoices,
		totalRevenue,
		totalCost,
		totalProfit
	};
};
