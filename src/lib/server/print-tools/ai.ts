import { error, json } from '@sveltejs/kit';
import { readGeminiSettings, saveGeminiSettings } from '$lib/server/production-ai-settings';
import { discoverGeminiModels, parseWithGemini } from '$lib/server/production-ai';
import { db } from '$lib/server/db';
import { productionProduct } from '$lib/server/db/schema';
import { inspectSize, validateInspection } from './inspection';

export async function aiRoute(
	method: string,
	path: string[],
	body: Record<string, unknown>,
	signal: AbortSignal
) {
	const endpoint = path.join('/');
	if (endpoint.startsWith('settings/ai')) {
		const config = await readGeminiSettings();
		if (method === 'GET' && endpoint === 'settings/ai')
			return json({
				keyConfigured: config.keyConfigured,
				ready: config.ready,
				migrationRequired: false,
				modelId: config.model,
				revision: config.revision
			});
		if (method === 'GET' && endpoint === 'settings/ai/models')
			return json(
				(await discoverGeminiModels(config.key, signal)).map((model) => ({
					...model,
					description: 'Shared CRM Gemini model. Saving makes no paid compatibility request.'
				}))
			);
		if (method === 'PUT' && (endpoint === 'settings/ai/key' || endpoint === 'settings/ai/model')) {
			if (endpoint.endsWith('/key') && (typeof body.key !== 'string' || !body.key.trim()))
				error(400, 'Enter a Gemini key. Remove keys explicitly in CRM Settings.');
			if (endpoint.endsWith('/model') && typeof body.modelId !== 'string')
				error(400, 'Enter a model ID.');
			const form = new FormData();
			form.set('apiKey', endpoint.endsWith('/key') ? (body.key as string) : '');
			form.set('model', endpoint.endsWith('/model') ? (body.modelId as string) : config.model);
			await saveGeminiSettings(form);
			return new Response(null, { status: 204 });
		}
	}
	if (method === 'POST' && (endpoint === 'orders/parse' || endpoint === 'reports/inspect')) {
		if (body.paidConsent !== true) error(400, 'Explicit paid AI consent is required.');
		const config = await readGeminiSettings();
		if (!config.ready) error(503, 'Configure Gemini in CRM Settings.');
		if (body.aiRevision !== config.revision)
			error(
				409,
				'Shared Gemini settings changed. Refresh settings and explicitly retry. No paid request was made.'
			);
		if (endpoint === 'reports/inspect') {
			const input = validateInspection(body);
			if (input.modelId !== config.model)
				error(409, 'The selected model changed. Refresh settings before confirming review.');
			return json(await inspectSize(config.key, input, signal));
		}
		const ext = typeof body.ext === 'string' ? body.ext.toLowerCase() : '';
		let source: { text?: string; base64?: string; mime?: string };
		if (['png', 'jpg', 'jpeg', 'pdf'].includes(ext)) {
			const base64 = body.imageBase64;
			if (
				typeof base64 !== 'string' ||
				base64.length > 16 * 1024 * 1024 ||
				base64.length % 4 ||
				!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)
			)
				error(400, 'Provide bounded base64 image/PDF data.');
			const bytes = Buffer.from(base64, 'base64');
			if (
				bytes.length === 0 ||
				bytes.length > 12 * 1024 * 1024 ||
				bytes.toString('base64') !== base64
			)
				error(400, 'Image/PDF exceeds 12 MiB or is invalid base64.');
			const valid =
				ext === 'pdf'
					? bytes.subarray(0, 5).toString() === '%PDF-'
					: ext === 'png'
						? bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
						: bytes.subarray(0, 3).toString('hex') === 'ffd8ff';
			if (!valid) error(400, 'File signature does not match its format.');
			source = {
				base64,
				mime: ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : 'image/jpeg'
			};
		} else {
			if (
				!['txt', 'csv', 'tsv', 'xlsx', 'docx'].includes(ext) ||
				typeof body.text !== 'string' ||
				!body.text.trim() ||
				body.text.length > 128000
			)
				error(400, 'Provide at most 128,000 characters of extracted/pasted text.');
			source = { text: body.text };
		}
		const orders = await parseWithGemini(source, signal, body.aiRevision);
		const products = new Set(
			(await db.select({ id: productionProduct.id }).from(productionProduct)).map((row) => row.id)
		);
		return json(
			orders.map((row) => {
				const match = /^crm-production:([1-9]\d*)$/.exec(row.product);
				const id =
					match && Number.isSafeInteger(Number(match[1])) && products.has(Number(match[1]))
						? Number(match[1])
						: null;
				return {
					raw: '',
					name: row.name,
					size: row.size,
					numberText: row.number,
					number: row.number,
					artwork: row.artwork,
					productId: id,
					unresolvedProduct: row.product && !id ? row.product : null
				};
			})
		);
	}
	return null;
}
