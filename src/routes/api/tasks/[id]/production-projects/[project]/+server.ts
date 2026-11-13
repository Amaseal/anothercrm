import { error, json } from '@sveltejs/kit';
import { assertProductionStaff, productionId } from '$lib/server/production';
import {
	openProductionProject,
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
