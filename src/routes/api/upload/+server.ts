import type { RequestHandler } from '@sveltejs/kit';
import { writeFile } from 'fs/promises';
import {
	ensureUploadsDir,
	getUploadPath,
	makeTimestampFilename,
	toUploadsUrl
} from '$lib/server/upload-storage';

export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const file = formData.get('file') as File | null;
	if (!file) {
		return new Response(JSON.stringify({ success: false, error: 'No file uploaded' }), {
			status: 400
		});
	}
	const buffer = Buffer.from(await file.arrayBuffer());
	const fileName = makeTimestampFilename(file.name);
	const filePath = getUploadPath(fileName);

	try {
		await ensureUploadsDir();
		await writeFile(filePath, buffer);
		const publicUrl = toUploadsUrl(fileName);
		return new Response(JSON.stringify({ success: true, path: publicUrl }), { status: 200 });
	} catch (e) {
		return new Response(JSON.stringify({ success: false, error: e }), { status: 500 });
	}
};
