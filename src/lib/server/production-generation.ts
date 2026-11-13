import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { productionId } from './production';
import { parsingTask } from './production-sources';
import { draftOrders } from './production-parsing';
import { readProductionWorkbook, writeProductionWorkbook } from './production-workbook';
import { createProductionProject } from './production-projects';

export async function saveGeneratedProduction(locals: App.Locals, taskId: number, input: unknown) {
	const item = await parsingTask(locals, taskId);
	if (!input || typeof input !== 'object' || !('orders' in input))
		error(400, 'Generated garment rows are required.');
	const orders = draftOrders(input.orders);
	if (!orders.length) error(400, 'No garment rows to save.');
	const selectedProduct = 'defaultProductId' in input ? input.defaultProductId : '';
	const productId = selectedProduct === '' ? null : productionId(selectedProduct);
	const products = await db.query.productionProduct.findMany({ columns: { id: true, name: true } });
	if (productId !== null && !products.some((product) => product.id === productId))
		error(400, 'Select an existing default production product.');
	const name = 'filename' in input ? input.filename : 'production.xlsx';
	if (typeof name !== 'string' || !name.trim()) error(400, 'Enter a workbook filename.');
	const filename = name.trim().toLowerCase().endsWith('.xlsx')
		? name.trim()
		: `${name.trim()}.xlsx`;
	const setup: Record<string, string> = {
		FormatVersion: '1',
		Draft: 'true',
		UsableRollWidthMm: '1600',
		SheetWidthMm: '1500',
		SheetHeightMm: '1000',
		GapMm: '5',
		PackingProfileResolutionMm: '2',
		DefaultProduct: productId === null ? '' : `crm-production:${productId}`,
		TaskReference: String(taskId),
		ProjectTitleSnapshot: item.title.slice(0, 1000)
	};
	const references = new Set([
		setup.DefaultProduct,
		...orders.map((row) => row.product).filter(Boolean)
	]);
	for (const product of products) {
		const reference = `crm-production:${product.id}`;
		if (references.has(reference)) setup[`Product.${reference}`] = product.name;
	}
	let bytes: Buffer;
	try {
		bytes = await writeProductionWorkbook(orders, setup);
	} catch (cause) {
		error(400, cause instanceof Error ? cause.message : 'Invalid production workbook.');
	}
	const workbook = await readProductionWorkbook(bytes);
	const project = await createProductionProject(
		locals,
		taskId,
		new File([new Uint8Array(bytes)], filename)
	);
	return { ...project, workbook };
}

export type GeneratedProduction = Awaited<ReturnType<typeof saveGeneratedProduction>>;
