import { error, json } from '@sveltejs/kit';
import { assertProductionStaff, productionId } from '$lib/server/production';
import { createProductionProject, listProductionProjects } from '$lib/server/production-projects';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
	assertProductionStaff(locals);
	return json(
		{ projects: await listProductionProjects(locals, productionId(params.id)) },
		{ headers: { 'Cache-Control': 'private, no-store' } }
	);
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	assertProductionStaff(locals);
	const form = await request.formData();
	const upload = form.get('file');
	if (!(upload instanceof File)) error(400, 'A production workbook is required.');
	return json(await createProductionProject(locals, productionId(params.id), upload), {
		status: 201
	});
};
