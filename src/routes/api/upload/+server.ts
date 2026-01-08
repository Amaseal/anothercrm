import type { RequestHandler } from '@sveltejs/kit';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const file = formData.get('file') as File | null;
	if (!file) {
		return new Response(JSON.stringify({ success: false, error: 'No file uploaded' }), {
			status: 400
		});
	}
	const buffer = Buffer.from(await file.arrayBuffer());
	
	// Always use uploads folder at project root in both dev and production
	const uploadDir = 'uploads';
	const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
	const filePath = path.join(uploadDir, fileName);

	try {
		// Ensure upload directory exists
		await mkdir(uploadDir, { recursive: true });
		await writeFile(filePath, buffer);
		// Return URL that will be served by our uploads endpoint
		const publicUrl = `/uploads/${fileName}`;
		return new Response(JSON.stringify({ success: true, path: publicUrl }), { status: 200 });
	} catch (e) {
		return new Response(JSON.stringify({ success: false, error: e }), { status: 500 });
	}
};
