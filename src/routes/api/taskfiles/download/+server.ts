import { error } from '@sveltejs/kit';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import JSZip from 'jszip';
import { attachment, resolveUpload } from '$lib/server/file-download';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');
	const form = await request.formData();
	let files: unknown;
	try {
		files = JSON.parse(String(form.get('files')));
	} catch {
		error(400, 'Invalid file list');
	}
	if (!Array.isArray(files) || files.length === 0 || files.length > 1000)
		error(400, 'Select between 1 and 1000 files');
	const sources = [];
	const names = new Set<string>();
	for (const file of files) {
		if (
			typeof file?.path !== 'string' ||
			typeof file?.name !== 'string' ||
			!file.path.startsWith('/uploads/')
		)
			error(400, 'Invalid file');
		let path: string;
		try {
			path = decodeURIComponent(file.path.slice('/uploads/'.length));
		} catch {
			error(400, 'Invalid file path');
		}
		const source = await resolveUpload(path);
		if (!source) error(404, `File not found: ${file.name}`);
		const sanitized = Array.from(file.name as string, (char) =>
			char === '/' || char === '\\' || char.charCodeAt(0) < 32 ? '_' : char
		).join('');
		const original = sanitized && sanitized !== '.' && sanitized !== '..' ? sanitized : 'file';
		let name = original;
		let suffix = 1;
		while (names.has(name.toLowerCase())) name = `${++suffix}-${original}`;
		names.add(name.toLowerCase());
		sources.push({ ...source, name });
	}
	const zip = new JSZip();
	const inputs: Readable[] = [];
	for (const source of sources) {
		// Open files lazily, keeping only the current file open while generating the ZIP.
		const input = Readable.from(
			(async function* () {
				yield* createReadStream(source.path);
			})()
		);
		inputs.push(input);
		zip.file(`files/${source.name}`, input, { date: source.mtime });
	}
	const stream = zip.generateNodeStream({ streamFiles: true, compression: 'STORE' });
	stream.once('close', () => {
		for (const input of inputs) input.destroy();
	});
	return new Response(
		Readable.toWeb(stream as Readable, {
			strategy: { highWaterMark: 256 * 1024, size: (chunk: Uint8Array) => chunk.byteLength }
		}) as ReadableStream<Uint8Array>,
		{
			headers: {
				'Content-Type': 'application/zip',
				'Content-Disposition': attachment(`${String(form.get('filename') || 'files')}.zip`),
				'Cache-Control': 'no-store',
				'X-Accel-Buffering': 'no'
			}
		}
	);
};
