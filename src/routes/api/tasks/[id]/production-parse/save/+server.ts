import { error, json } from '@sveltejs/kit';
import { assertProductionStaff, productionId } from '$lib/server/production';
import { saveGeneratedProduction } from '$lib/server/production-generation';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	assertProductionStaff(locals);
	// Bound JSON independently of multipart limits before parsing customer-controlled rows.
	const reader = request.body?.getReader();
	if (!reader) error(400, 'Generated rows are required.');
	let size = 0;
	const chunks: Uint8Array[] = [];
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.length;
			if (size > 4 * 1024 * 1024) error(413, 'Generated rows exceed the save request limit.');
			chunks.push(value);
		}
	} finally {
		await reader.cancel().catch(() => {});
	}
	let input: unknown;
	try {
		input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
	} catch {
		error(400, 'Invalid generated rows JSON.');
	}
	return json(await saveGeneratedProduction(locals, productionId(params.id), input), {
		status: 201
	});
};
