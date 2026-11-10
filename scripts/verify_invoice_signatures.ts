import assert from 'node:assert/strict';
import { getInvoiceSignatures } from '../src/lib/invoice-signatures';
import { buildInvoiceDocDefinition, generateInvoicePdfBuffer } from '../src/lib/server/pdfmake';

// Run with: pnpm exec tsx scripts/verify_invoice_signatures.ts
for (const language of ['lv', 'en']) {
	const columns = getInvoiceSignatures(language, 'Configured Company SIA', new Date(2026, 0, 2));
	assert.equal(columns.length, 2);
	assert.deepEqual(
		columns.map((column) => column.fields.map((field) => field.value)),
		[
			['Configured Company SIA', '02.01.2026', ''],
			['', '', '']
		]
	);
	assert.equal(columns[0].title, language === 'en' ? 'Issuer' : 'Izsniedzējs');
	assert.equal(columns[1].title, language === 'en' ? 'Receiver' : 'Saņēmējs');
	assert.equal(columns[0].fields[2].label, language === 'en' ? 'Signature' : 'Paraksts');

	const invoice = {
		language,
		invoiceNumber: 'TEST-1',
		issueDate: '2026-01-02',
		dueDate: '2026-01-09',
		client: { name: 'Test client' }
	};
	const company = {
		name: 'Configured Company SIA',
		registrationNumber: '123',
		vatNumber: 'LV123',
		address: 'Test address',
		bankName: 'Test bank',
		bankCode: 'TEST',
		bankAccount: 'LV123'
	};
	for (const isElectronic of [true, false, undefined]) {
		const data = { ...invoice, isElectronic };
		const definition = buildInvoiceDocDefinition(data, [], company);
		const signatureBlock = definition.content.find(
			(node: { unbreakable?: boolean }) => node.unbreakable
		);
		assert.equal(Boolean(signatureBlock), isElectronic === false);
		const text = JSON.stringify(definition);
		assert.equal(text.includes(company.name), true);
		assert.equal(text.includes('SIA Fastbreak'), false);
		assert.equal(
			text.includes(language === 'en' ? 'valid without signature' : 'derīgs bez paraksta'),
			isElectronic !== false
		);
		if (signatureBlock) {
			assert.equal(signatureBlock.columns[0].stack[1].text, company.name);
			assert.equal(signatureBlock.columns.length, 2);
			assert.equal(
				signatureBlock.columns[0].stack.filter((node: { canvas?: unknown }) => node.canvas).length,
				3
			);
		}
		const pdf = await generateInvoicePdfBuffer(data, [], company);
		assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
	}
}
console.log('Invoice signature checks passed (LV/EN, printed/digital/default, PDF generation).');
