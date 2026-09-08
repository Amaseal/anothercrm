import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { open, unlink } from 'node:fs/promises';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { pipeline } from 'node:stream/promises';
import {
	ensureUploadsDir,
	getUploadPath,
	makeTaskFileFilename,
	toUploadsUrl
} from '$lib/server/upload-storage';

export const POST: RequestHandler = async ({ request, locals, url }) => {
	if (!locals.user) error(401, 'Unauthorized');
	let name = url.searchParams.get('filename');
	let body = request.body;
	// Keep compatibility with existing multipart upload callers.
	if (!name) {
		const form = await request.formData();
		const file = form.get('file');
		if (!(file instanceof File)) error(400, 'No file uploaded');
		name = file.name;
		body = file.stream();
	}
	if (!body || !name || name.length > 255) error(400, 'Invalid file');
	await ensureUploadsDir();
	const filename = makeTaskFileFilename(name);
	const path = getUploadPath(filename);
	const destination = await open(path, 'wx');
	try {
		await pipeline(
			Readable.fromWeb(body as NodeReadableStream<Uint8Array>),
			destination.createWriteStream()
		);
		return json({ success: true, path: toUploadsUrl(filename) });
	} catch (cause) {
		await unlink(path).catch(() => {});
		console.error('File upload failed:', cause);
		return json({ success: false, error: 'Upload failed' }, { status: 500 });
	}
};
