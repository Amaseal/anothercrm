import { fail, isHttpError } from '@sveltejs/kit';
import {
	assertDocumentStaff,
	documentExtension,
	loadDocument,
	saveDocument,
	validateDocumentUpload
} from '$lib/server/documents';
import * as m from '$lib/paraglide/messages';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	assertDocumentStaff(locals);
	const document = await loadDocument(params.id);
	return {
		document: {
			id: document.id,
			filename: document.filename,
			size: document.size,
			revision: document.revision,
			downloadUrl: `/api/documents/${encodeURIComponent(document.id)}`
		}
	};
};

export const actions: Actions = {
	save: async ({ request, locals, params }) => {
		assertDocumentStaff(locals);
		const document = await loadDocument(params.id);
		const form = await request.formData();
		const upload = form.get('file');
		if (!(upload instanceof File)) return fail(400, { message: m['documents.invalid_file']() });
		const bytes = await validateDocumentUpload(upload, documentExtension(document.filename));
		if (!bytes) return fail(400, { message: m['documents.invalid_file']() });

		try {
			return await saveDocument(params.id, bytes, form.get('revision'));
		} catch (cause) {
			if (isHttpError(cause))
				return fail(cause.status, {
					message: cause.status === 409 ? m['documents.save_conflict']() : cause.body.message
				});
			console.error('Could not save document', cause);
			return fail(500, { message: m['documents.save_failed']() });
		}
	}
};
