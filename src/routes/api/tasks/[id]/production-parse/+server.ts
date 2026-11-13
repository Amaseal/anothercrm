import { error, isHttpError, json } from '@sveltejs/kit';
import { assertProductionStaff, productionId } from '$lib/server/production';
import { parsingContext, prepareParsingSource } from '$lib/server/production-sources';
import { parseStructuredOrders, draftWarnings } from '$lib/server/production-parsing';
import { parseWithGemini } from '$lib/server/production-ai';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
	assertProductionStaff(locals);
	return json(await parsingContext(locals, productionId(params.id)), {
		headers: { 'Cache-Control': 'private, no-store' }
	});
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	assertProductionStaff(locals);
	const form = await request.formData();
	const engine = form.get('engine');
	if (engine !== 'local' && engine !== 'ai')
		error(400, 'Choose local table parsing or explicit AI parsing.');
	if (engine === 'ai' && form.get('paidConsent') !== 'true')
		error(
			400,
			'Explicit consent is required before sending customer content to Gemini and making a paid request.'
		);
	try {
		const source = await prepareParsingSource(locals, productionId(params.id), form);
		if (form.get('sourceRevision') !== source.revision)
			error(
				409,
				'The source changed. Check the current selection and click Generate again; no paid call was made.'
			);
		if (engine === 'local' && !source.text)
			error(
				400,
				'Local parsing requires CSV/TSV text or a worksheet; images/PDF require explicit AI consent.'
			);
		const orders =
			engine === 'local'
				? parseStructuredOrders(source.text!)
				: await parseWithGemini(source, request.signal, form.get('aiRevision'));
		return json(
			{
				orders,
				warnings: draftWarnings(orders),
				sourceName: source.sheet ? `${source.name} · ${source.sheet}` : source.name,
				sourceRevision: source.revision,
				engine
			},
			{ headers: { 'Cache-Control': 'private, no-store' } }
		);
	} catch (cause) {
		if (isHttpError(cause)) throw cause;
		error(400, 'Could not parse the selected source. No stored workbook was changed.');
	}
};
