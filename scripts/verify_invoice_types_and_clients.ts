import assert from 'node:assert/strict';
import { PgDialect } from 'drizzle-orm/pg-core';
import { formatInvoiceNumber } from '../src/lib/invoice-number';
import { invoiceExportFilter } from '../src/lib/server/invoice-export';
import { getNewInvoiceClient } from '../src/lib/server/invoice-client';
import { buildInvoiceDocDefinition, generateInvoicePdfBuffer } from '../src/lib/server/pdfmake';

// Run with: pnpm exec tsx scripts/verify_invoice_types_and_clients.ts
const form = new FormData();
form.set('clientId', '12');
assert.equal(getNewInvoiceClient(form), null);
form.set('isNewClient', 'true');
assert.equal(getNewInvoiceClient(form)?.error, 'Client Name is required');
form.set('newClientName', ' New client ');
form.set('newClientEmail', '   ');
assert.equal(getNewInvoiceClient(form)?.error, 'Email or phone is required for new clients');
form.set('newClientPhone', '12345678');
const phoneClient = getNewInvoiceClient(form);
assert.equal(phoneClient?.values?.name, 'New client');
assert.equal(phoneClient?.values?.phone, '12345678');
assert.equal(phoneClient?.values?.email, null);
form.delete('clientId');
form.delete('newClientPhone');
form.set('newClientEmail', ' client@example.com ');
form.set('newClientBankAccount', 'LV123');
const emailClient = getNewInvoiceClient(form);
assert.equal(emailClient?.values?.email, 'client@example.com');
assert.equal(emailClient?.values?.bankAccount, 'LV123');
assert.equal(emailClient?.values?.phone, null);
form.set('isNewClient', 'false');
assert.equal(getNewInvoiceClient(form), null);

for (const language of ['lv', 'en']) {
	for (const documentType of [
		'invoice',
		'proforma',
		'delivery_note',
		'invoice_delivery',
		undefined
	]) {
		const invoice = {
			language,
			documentType,
			invoiceNumber: 'TEST-1',
			issueDate: '2026-01-02',
			dueDate: '2026-01-09',
			client: { name: 'New client' }
		};
		const company = { name: 'Test company' };
		const definition = buildInvoiceDocDefinition(invoice, [], company);
		const text = JSON.stringify(definition);
		const proformaTitle = language === 'en' ? 'Proforma Invoice' : 'Priekšapmaksas rēķins';
		const standardTitle = language === 'en' ? 'Commercial Invoice' : 'Rēķins/Pavadzīme';
		assert.equal(text.includes(proformaTitle), documentType === 'proforma');
		if (documentType !== 'proforma') assert.equal(text.includes(standardTitle), true);
		if (documentType === 'proforma') {
			const pdf = await generateInvoicePdfBuffer(invoice, [], company);
			assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
		}
	}
}
for (const documentType of ['invoice', 'proforma', 'delivery_note', 'invoice_delivery']) {
	assert.equal(
		formatInvoiceNumber('02012026', 7, 'K', documentType),
		documentType === 'proforma' ? '02012026-7KA' : '02012026-7K'
	);
}
assert.equal(formatInvoiceNumber('02012026', 8, '', 'proforma'), '02012026-8A');
assert.equal(formatInvoiceNumber('02012026', 9, 'A', 'proforma'), '02012026-9AA');
assert.equal(invoiceExportFilter('all'), undefined);
const dialect = new PgDialect();
for (const [type, operator] of [
	['invoice', '<>'],
	['proforma', '=']
]) {
	const filter = invoiceExportFilter(type);
	assert.ok(filter);
	const query = dialect.sqlToQuery(filter);
	assert.equal(query.sql, `"invoices"."document_type" ${operator} $1`);
	assert.deepEqual(query.params, ['proforma']);
}
assert.throws(() => invoiceExportFilter('invalid'), /Invalid invoice export type/);
assert.throws(() => invoiceExportFilter(''), /Invalid invoice export type/);
console.log('Invoice client, numbering, export filter, and LV/EN invoice-type/PDF checks passed.');
