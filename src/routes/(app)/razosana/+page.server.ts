import { fail, isHttpError, redirect, type Action } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	assertProductionStaff,
	productionId,
	listProductionProducts,
	loadProductionProduct,
	createProductionProduct,
	deleteProductionProduct,
	changeProductionSize
} from '$lib/server/production';
import * as m from '$lib/paraglide/messages';

export const load: PageServerLoad = async ({ locals, url }) => {
	assertProductionStaff(locals);
	const products = await listProductionProducts();
	const selected = url.searchParams.get('product');
	const id = selected === null ? products[0]?.id : productionId(selected);
	return { products, selectedProduct: id ? await loadProductionProduct(id) : null };
};

function mutation(operation: (form: FormData) => Promise<string | void>): Action {
	return async ({ locals, request }) => {
		assertProductionStaff(locals);
		let destination: string | void;
		try {
			destination = await operation(await request.formData());
		} catch (cause) {
			if (isHttpError(cause)) return fail(cause.status, { message: cause.body.message });
			console.error('Production library mutation failed', cause);
			return fail(500, { message: m['production.save_failed']() });
		}
		if (destination) redirect(303, destination);
		return { success: true };
	};
}

export const actions: Actions = {
	createProduct: mutation(
		async (form) => `/razosana?product=${await createProductionProduct(form)}`
	),
	deleteProduct: mutation(async (form) => {
		await deleteProductionProduct(form);
		return '/razosana';
	}),
	addSize: mutation((form) => changeProductionSize(form, 'add')),
	deleteSize: mutation((form) => changeProductionSize(form, 'delete')),
	setBase: mutation((form) => changeProductionSize(form, 'base'))
};
