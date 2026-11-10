import * as m from './paraglide/messages.js';

export function getInvoiceSignatures(language: string, companyName: string, today = new Date()) {
	const options = { locale: language === 'en' ? ('en' as const) : ('lv' as const) };
	const date = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;
	return [
		{
			title: m['invoices.signature_issuer']({}, options),
			fields: [
				{ label: m['invoices.signature_name']({}, options), value: companyName },
				{ label: m['invoices.signature_date']({}, options), value: date },
				{ label: m['invoices.signature']({}, options), value: '' }
			]
		},
		{
			title: m['invoices.signature_receiver']({}, options),
			fields: [
				{ label: m['invoices.signature_name']({}, options), value: '' },
				{ label: m['invoices.signature_date']({}, options), value: '' },
				{ label: m['invoices.signature']({}, options), value: '' }
			]
		}
	];
}

export function getInvoiceSignatureBlock(language: string, companyName: string) {
	return {
		unbreakable: true,
		columnGap: 40,
		margin: [0, 20, 0, 8],
		columns: getInvoiceSignatures(language, companyName).map((column) => ({
			width: '*',
			stack: [
				{ text: column.title, bold: true, fontSize: 10, margin: [0, 0, 0, 8] },
				...column.fields.flatMap((field) => [
					{ text: field.value || ' ', fontSize: 10, margin: [0, 8, 0, 2] },
					{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.5 }] },
					{ text: field.label, fontSize: 8, margin: [0, 2, 0, 4] }
				])
			]
		}))
	};
}
