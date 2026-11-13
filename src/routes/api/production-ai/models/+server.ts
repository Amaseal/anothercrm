import { json } from '@sveltejs/kit';
import { assertProductionStaff } from '$lib/server/production';
import { discoverGeminiModels } from '$lib/server/production-ai';
import { geminiKey, readGeminiSettings } from '$lib/server/production-ai-settings';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
	assertProductionStaff(locals);
	const form = await request.formData();
	const entered = geminiKey(form.get('apiKey') ?? '');
	const key = entered || (await readGeminiSettings()).key;
	return json(
		{ models: await discoverGeminiModels(key, request.signal) },
		{ headers: { 'Cache-Control': 'private, no-store' } }
	);
};
