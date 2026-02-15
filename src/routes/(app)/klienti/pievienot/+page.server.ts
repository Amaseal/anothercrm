import { db } from '$lib/server/db';
import { client } from '$lib/server/db/schema';
import { fail, redirect } from '@sveltejs/kit';
import * as m from '$lib/paraglide/messages';
import type { Actions } from './$types';

export const load = async () => { };

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const name = formData.get('name') as string;
		const type = formData.get('type') as string;
		const reg_number = formData.get('reg_number') as string;
		const vat_number = formData.get('vat_number') as string;
		const address = formData.get('address') as string;
		const bank = formData.get('bank') as string;
		const swift = formData.get('swift') as string;
		const bank_account = formData.get('bank_account') as string;
		const email = formData.get('email') as string;
		const phone = formData.get('phone') as string;
		const description = formData.get('description') as string;
		const sport_type = formData.get('sport_type') as string;

		if (!name) {
			return fail(400, { message: m['clients.errors.name_required']() });
		}

		if (!email && !phone) {
			return fail(400, { message: m['clients.errors.contacts_invalid']() });
		}
		try {
			const payload = {
				name: name || undefined,
				type: type === 'BTC' || type === 'BTB' ? (type as 'BTC' | 'BTB') : undefined,
				registrationNumber: reg_number || null,
				vatNumber: vat_number || null,
				address: address || null,
				bankName: bank || null,
				bankCode: swift || null,
				bankAccount: bank_account || null,
				email: email || undefined,
				phone: phone || undefined,
				description: description || null,
				sportType: sport_type || null
			};
			await db.insert(client).values(payload as any);
		} catch (error) {
			return fail(500, { message: m['clients.errors.something_went_wrong']() });
		}
		redirect(303, '/klienti');
	}
};
