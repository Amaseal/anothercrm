import { assertDocumentStaff, loadDocument } from '$lib/server/documents';
import { attachment } from '$lib/server/file-download';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
	assertDocumentStaff(locals);
	const document = await loadDocument(params.id);
	return new Response(new Uint8Array(document.bytes), {
		headers: {
			'Content-Type': 'application/octet-stream',
			'Content-Disposition': attachment(document.filename),
			'Content-Length': String(document.size),
			'Cache-Control': 'private, no-store',
			'X-Content-Type-Options': 'nosniff',
			'X-Document-Revision': document.revision
		}
	});
};
