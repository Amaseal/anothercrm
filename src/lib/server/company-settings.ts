export function parseCompanySettings(form: FormData) {
	const text = (name: string) => {
		const value = form.get(name);
		return typeof value === 'string' ? value.trim() : '';
	};
	const company = {
		name: text('name'),
		registrationNumber: text('registrationNumber'),
		vatNumber: text('vatNumber'),
		address: text('address'),
		bankName: text('bankName'),
		bankCode: text('bankCode'),
		bankAccount: text('bankAccount'),
		email: text('email') || null,
		phone: text('phone') || null,
		website: text('website') || null
	};
	if (
		!company.name ||
		!company.registrationNumber ||
		!company.vatNumber ||
		!company.address ||
		!company.bankName ||
		!company.bankCode ||
		!company.bankAccount
	)
		return null;
	if (company.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company.email)) return null;
	if (company.website) {
		try {
			const url = new URL(company.website);
			if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
		} catch {
			return null;
		}
	}
	return company;
}
