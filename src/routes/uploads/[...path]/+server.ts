import type { RequestHandler } from '@sveltejs/kit';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import mime from 'mime-types';
import { attachment, resolveUpload } from '$lib/server/file-download';

export const GET: RequestHandler = async ({ params, request, url }) => {
	if (!params.path) return new Response('Not found', { status: 404 });
	let path = params.path;
	try {
		path = decodeURIComponent(path);
	} catch {
		/* Preserve legacy literal percent characters. */
	}
	const file = await resolveUpload(path);
	if (!file) return new Response('Not found', { status: 404 });
	const headers = new Headers({
		'Content-Type': mime.lookup(file.path) || 'application/octet-stream',
		'Cache-Control': 'public, max-age=3600',
		'Accept-Ranges': 'bytes',
		'Last-Modified': file.mtime.toUTCString()
	});
	const name = url.searchParams.get('download');
	if (name) headers.set('Content-Disposition', attachment(name));
	let start = 0;
	let end = file.size - 1;
	let status = 200;
	const range = request.headers.get('range');
	const ifRange = request.headers.get('if-range');
	if (range && (!ifRange || ifRange === file.mtime.toUTCString())) {
		const match = /^bytes=(\d*)-(\d*)$/.exec(range);
		if (match && (match[1] || match[2])) {
			start = match[1] ? Number(match[1]) : Math.max(0, file.size - Number(match[2]));
			end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
			if (
				!Number.isSafeInteger(start) ||
				!Number.isSafeInteger(end) ||
				start > end ||
				start >= file.size
			) {
				headers.set('Content-Range', `bytes */${file.size}`);
				return new Response(null, { status: 416, headers });
			}
			status = 206;
			headers.set('Content-Range', `bytes ${start}-${end}/${file.size}`);
		}
	}
	headers.set('Content-Length', String(Math.max(0, end - start + 1)));
	if (request.method === 'HEAD' || file.size === 0) return new Response(null, { status, headers });
	const stream = createReadStream(file.path, { start, end });
	return new Response(
		Readable.toWeb(stream, {
			strategy: { highWaterMark: 256 * 1024, size: (chunk: Uint8Array) => chunk.byteLength }
		}) as ReadableStream<Uint8Array>,
		{ status, headers }
	);
};
export const HEAD = GET;
