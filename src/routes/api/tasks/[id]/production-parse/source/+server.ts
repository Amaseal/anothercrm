import { error, isHttpError, json } from '@sveltejs/kit';
import { assertProductionStaff, productionId } from '$lib/server/production';
import { prepareParsingSource } from '$lib/server/production-sources';
import { parseStructuredOrders } from '$lib/server/production-parsing';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	assertProductionStaff(locals);
	try {
		const source = await prepareParsingSource(
			locals,
			productionId(params.id),
			await request.formData()
		);
		let engine: 'local' | 'ai' = 'ai';
		if (source.text) {
			try {
				parseStructuredOrders(source.text);
				engine = 'local';
			} catch (cause) {
				if (!isHttpError(cause) || cause.status !== 400) throw cause;
			}
		}
		return json({ ...source, engine }, { headers: { 'Cache-Control': 'private, no-store' } });
	} catch (cause) {
		if (isHttpError(cause)) throw cause;
		error(400, 'Could not preview this source. Use a supported file or paste an excerpt.');
	}
};
