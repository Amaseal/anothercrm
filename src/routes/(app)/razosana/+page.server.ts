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
import {
	listPrintToolsTokens,
	createPrintToolsToken,
	revokePrintToolsToken
} from '$lib/server/print-tools/auth';

export const load: PageServerLoad = async ({ locals, url, setHeaders, request }) => {
	assertProductionStaff(locals);
	if (request.method === 'GET') setHeaders({ 'Cache-Control': 'private, no-store' });
	const products = await listProductionProducts();
	const selected = url.searchParams.get('product');
	const id = selected === null ? products[0]?.id : productionId(selected);
	return {
		products,
		selectedProduct: id ? await loadProductionProduct(id) : null,
		printToolsTokens: await listPrintToolsTokens(locals),
		printToolsUrl: `${url.origin}/api/print-tools`
	};
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
	createPrintToolsToken: async ({ locals, setHeaders }) => {
		assertProductionStaff(locals);
		setHeaders({ 'Cache-Control': 'private, no-store' });
		try {
			return { printToolsToken: await createPrintToolsToken(locals) };
		} catch (cause) {
			return fail(isHttpError(cause) ? cause.status : 500, {
				message: isHttpError(cause) ? cause.body.message : m['production.save_failed']()
			});
		}
	},
	revokePrintToolsToken: async ({ locals, request }) => {
		assertProductionStaff(locals);
		try {
			await revokePrintToolsToken(locals, (await request.formData()).get('tokenId'));
			return { success: true };
		} catch (cause) {
			return fail(isHttpError(cause) ? cause.status : 500, {
				message: isHttpError(cause) ? cause.body.message : m['production.save_failed']()
			});
		}
	},
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
