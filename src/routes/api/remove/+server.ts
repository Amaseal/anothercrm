import type { RequestHandler } from '@sveltejs/kit';
import { unlink } from 'fs/promises';
import { uploadUrlPath } from '$lib/server/file-download';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
	}
	const { path: fileName } = await request.json();
	if (!fileName) {
		return new Response(JSON.stringify({ success: false, error: 'No file path provided' }), {
			status: 400
		});
	}

	const filePath = uploadUrlPath(fileName);
	try {
		await unlink(filePath);
		return new Response(JSON.stringify({ success: true }), { status: 200 });
	} catch (e) {
		// If file does not exist, treat as success (idempotent delete)
		if (typeof e === 'object' && e !== null && 'code' in e && e.code === 'ENOENT') {
			return new Response(
				JSON.stringify({ success: true, info: 'File not found, nothing to delete' }),
				{ status: 200 }
			);
		}
		return new Response(JSON.stringify({ success: false, error: 'Failed to remove file' }), {
			status: 500
		});
	}
};
