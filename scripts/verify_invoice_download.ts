import assert from 'node:assert/strict';
import { createServer } from 'vite';

// Run with: pnpm exec tsx scripts/verify_invoice_download.ts
// Database calls are replaced before the route or edit action is invoked.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
	const { db } = await server.ssrLoadModule('/src/lib/server/db/index.ts');
	const schema = await server.ssrLoadModule('/src/lib/server/db/schema.ts');
	const { GET } = await server.ssrLoadModule('/src/routes/api/invoices/[id]/+server.ts');
	const { actions } = await server.ssrLoadModule(
		'/src/routes/(app)/rekini/labot/[id]/+page.server.ts'
	);
	const { buildInvoiceDocDefinition } = await server.ssrLoadModule('/src/lib/server/pdfmake.ts');
	let invoice = {
		id: 1,
		clientId: 1,
		invoiceNumber: 'TEST-1',
		language: 'en',
		isElectronic: true,
		issueDate: '2026-01-02',
		dueDate: '2026-01-09',
		client: { name: 'Test client' }
	};
	let items = [{ description: 'Original item', unit: 'pcs', quantity: 1, price: 100 }];
	const company = { name: 'Configured Company SIA' };
	let invoiceReads = 0;
	db.query.invoice.findFirst = async () => {
		invoiceReads++;
		return invoice;
	};
	db.query.invoiceItems.findMany = async () => items;
	db.query.companySettings.findFirst = async () => company;
	db.transaction = async (run: (tx: unknown) => Promise<unknown>) =>
		run({
			select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ clientId: 1 }] }) }) }),
			update: (table: unknown) => ({
				set: (values: object) => ({
					where: async () => {
						if (table === schema.invoice) invoice = { ...invoice, ...values };
					}
				})
			}),
			delete: () => ({
				where: async () => {
					items = [];
				}
			}),
			insert: () => ({
				values: async (values: typeof items) => {
					items = values;
				}
			})
		});

	for (const isPrinted of [false, true, false]) {
		const form = new FormData();
		for (const [key, value] of Object.entries({
			clientId: '1',
			issueDate: '2026-01-02',
			dueDate: '2026-01-09',
			language: 'en',
			isPrinted: String(isPrinted),
			items: JSON.stringify([{ description: 'Edited item', unit: 'pcs', quantity: 2, price: 250 }])
		}))
			form.set(key, value);
		await assert.rejects(
			() => actions.default({ params: { id: '1' }, request: { formData: async () => form } }),
			{ status: 303, location: '/rekini' }
		);
		const response = await GET({ params: { id: '1' } });
		assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
		assert.equal(response.headers.get('Content-Type'), 'application/pdf');
		assert.equal(
			Buffer.from(await response.arrayBuffer())
				.subarray(0, 5)
				.toString(),
			'%PDF-'
		);
		assert.equal(invoice.isElectronic, !isPrinted);
		const definition = buildInvoiceDocDefinition(invoice, items, company);
		assert.equal(JSON.stringify(definition).includes('Edited item'), true);
		assert.equal(
			definition.content.some((node: { unbreakable?: boolean }) => node.unbreakable),
			isPrinted
		);
	}
	assert.equal(invoiceReads, 3);
} finally {
	await server.close();
}
console.log(
	'Edited invoice download checks passed (digital → printed → digital; no DB mutations).'
);
