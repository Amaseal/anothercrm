export function getNewInvoiceClient(formData: FormData) {
	if (formData.get('isNewClient') !== 'true') return null;

	const field = (name: string) => {
		const value = formData.get(name);
		return typeof value === 'string' ? value.trim() : '';
	};
	const name = field('newClientName');
	const email = field('newClientEmail') || null;
	const phone = field('newClientPhone') || null;

	if (!name) return { error: 'Client Name is required' };
	if (!email && !phone) return { error: 'Email or phone is required for new clients' };

	return {
		values: {
			name,
			email,
			phone,
			address: field('newClientAddress'),
			registrationNumber: field('newClientRegNo'),
			vatNumber: field('newClientVatNo'),
			bankName: field('newClientBankName') || null,
			bankCode: field('newClientBankCode') || null,
			bankAccount: field('newClientBankAccount') || null
		}
	};
}
