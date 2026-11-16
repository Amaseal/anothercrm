import { error, json } from '@sveltejs/kit';
import { assertProductionStaff, productionId } from '$lib/server/production';
import {
	openProductionProject,
	deleteProductionProject,
	saveProductionProject,
	validateProductionBytes
} from '$lib/server/production-projects';
import { attachment } from '$lib/server/file-download';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	assertProductionStaff(locals);
	const document = await openProductionProject(
		locals,
		productionId(params.id),
		productionId(params.project)
	);
	const headers = {
		'Cache-Control': 'private, no-store',
		'X-Document-Revision': document.revision
	};
	if (url.searchParams.has('download'))
		return new Response(new Uint8Array(document.bytes), {
			headers: {
				...headers,
				'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				'Content-Disposition': attachment(document.filename),
				'X-Content-Type-Options': 'nosniff'
			}
		});
	return json(
		{ revision: document.revision, workbook: await validateProductionBytes(document.bytes) },
		{ headers }
	);
};

export const DELETE: RequestHandler = async ({ locals, params, request }) => {
	assertProductionStaff(locals);
	const input: unknown = await request.json().catch(() => error(400, 'Invalid deletion request.'));
	if (!input || typeof input !== 'object' || !('revision' in input))
		error(400, 'A saved workbook revision is required.');
	return json(
		await deleteProductionProject(
			locals,
			productionId(params.id),
			productionId(params.project),
			input.revision
		)
	);
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	assertProductionStaff(locals);
	const form = await request.formData();
	const upload = form.get('file');
	if (!(upload instanceof File)) error(400, 'A production workbook is required.');
	return json(
		await saveProductionProject(
			locals,
			productionId(params.id),
			productionId(params.project),
			upload,
			form.get('revision')
		)
	);
};
