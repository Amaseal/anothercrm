import { json } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import { assertProductionStaff, productionId } from '$lib/server/production';
import { previousProductionProject } from '$lib/server/production-projects';
import { saveDocument } from '$lib/server/documents';
import { attachment } from '$lib/server/file-download';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
	assertProductionStaff(locals);
	const { document, bytes } = await previousProductionProject(
		locals,
		productionId(params.id),
		productionId(params.project)
	);
	return new Response(new Uint8Array(bytes), {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': attachment(`previous-${document.filename}`),
			'Cache-Control': 'private, no-store',
			'X-Content-Type-Options': 'nosniff',
			'X-Document-Revision': createHash('sha256').update(bytes).digest('hex')
		}
	});
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	assertProductionStaff(locals);
	const { document, bytes } = await previousProductionProject(
		locals,
		productionId(params.id),
		productionId(params.project)
	);
	const form = await request.formData();
	return json(await saveDocument(document.id, bytes, form.get('revision')));
};
