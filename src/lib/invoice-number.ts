export function formatInvoiceNumber(
	date: string,
	sequence: number,
	userInitial: string,
	documentType: string
) {
	return `${date}-${sequence}${userInitial}${documentType === 'proforma' ? 'A' : ''}`;
}
