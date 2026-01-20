import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { client, invoice, task, invoiceItems } from '$lib/server/db/schema';
import { desc, eq, sql } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params }) => {
    // Fetch the invoice to edit
    const item = await db.query.invoice.findFirst({
        where: eq(invoice.id, Number(params.id)),
        with: {
            client: true,
            task: true,
            items: true // Fetch items
        }
    });

    if (!item) {
        throw redirect(303, '/rekini');
    }

    // Fetch clients for dropdown
	const clients = await db.query.client.findMany({
		orderBy: desc(client.id)
	});
    
    // Fetch products
    const products = await db.query.product.findMany();
    
    // Fetch company settings
    const company = await db.query.companySettings.findFirst();

    // Fetch tasks
	const tasks = await db.query.task.findMany({
		with: {
			client: true
		},
		orderBy: desc(task.id),
        limit: 100
	});

	return {
        item,
		clients,
		tasks,
        products,
        company
	};
};

export const actions: Actions = {
	default: async ({ request, params }) => {
		const formData = await request.formData();
        const invoiceId = Number(params.id);
        
		const taskId = formData.get('taskId') ? parseInt(formData.get('taskId') as string) : null;
		const clientId = formData.get('clientId') ? parseInt(formData.get('clientId') as string) : null;
        
        // Handle new client creation if needed (though usually distinct for edit)
        // ... Assuming for now we pick from existing or just use the ID provided.
        // If we want to support "New Client" in edit mode, copy logic from create.
        
		const issueDate = formData.get('issueDate') as string;
		const dueDate = formData.get('dueDate') as string;
        const notes = formData.get('notes') as string;
        // Status might be editable, or inferred. Let's keep it if passed
        const status = formData.get('status') as "draft" | "sent" | "paid" | "overdue" | "cancelled" || 'draft';
        
        const itemsRaw = formData.get('items');
        let items: any[] = [];
        try {
            items = itemsRaw ? JSON.parse(itemsRaw as string) : [];
        } catch (e) {
            return fail(400, { message: 'Invalid items data' });
        }
        
        if (!clientId) return fail(400, { message: 'Client is required' });
        if (items.length === 0) return fail(400, { message: 'At least one item is required' });

        // Recalculate totals
        let subtotal = 0;
        const processedItems = items.map((item: any) => {
            const qty = Number(item.quantity) || 1;
            const price = Number(item.price) || 0; // In cents
            const total = qty * price;
            subtotal += total;
            return {
                description: item.description,
                unit: item.unit,
                quantity: qty,
                price: price,
                total: total
            };
        });

        const taxRate = 21.0; 
        const taxAmount = Math.round(subtotal * (taxRate / 100));
        const total = subtotal + taxAmount;

		try {
            // Get existing invoice to handle totalOrdered changes
            const existingInvoice = await db.query.invoice.findFirst({
                where: eq(invoice.id, invoiceId)
            });

            if (existingInvoice) {
                // If client changed
                if (existingInvoice.clientId !== clientId) {
                     // Subtract from old client
                     await db.update(client)
                        .set({ totalOrdered: sql`COALESCE(${client.totalOrdered}, 0) - ${existingInvoice.total}` })
                        .where(eq(client.id, existingInvoice.clientId));
                     
                     // Add to new client
                     await db.update(client)
                        .set({ totalOrdered: sql`COALESCE(${client.totalOrdered}, 0) + ${total}` })
                        .where(eq(client.id, clientId));
                } else {
                    // Update same client with difference
                    const diff = total - existingInvoice.total;
                    if (diff !== 0) {
                        await db.update(client)
                            .set({ totalOrdered: sql`COALESCE(${client.totalOrdered}, 0) + ${diff}` })
                            .where(eq(client.id, clientId));
                    }
                }
            }

            // Update Invoice
			await db.update(invoice)
                .set({
                    taskId,
                    clientId,
                    status,
                    issueDate,
                    dueDate,
                    subtotal,
                    taxRate,
                    taxAmount,
                    total,
                    notes
                })
                .where(eq(invoice.id, invoiceId));
            
            // Handle Items: Delete all and re-insert
            await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
            
            if (processedItems.length > 0) {
                await db.insert(invoiceItems).values(
                    processedItems.map((item: any) => ({
                        invoiceId: invoiceId,
                        ...item
                    }))
                );
            }

		} catch (e) {
			console.error(e);
			return fail(500, { message: 'Failed to update invoice' });
		}

		return redirect(303, '/rekini');
	}
};
