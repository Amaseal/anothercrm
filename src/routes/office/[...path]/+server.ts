import { error } from '@sveltejs/kit';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { lookup } from 'mime-types';
import type { RequestHandler } from './$types';

// Keep the large third-party bundle out of SvelteKit's build/precompression pipeline.
// These are public editor assets only; document bytes use the authenticated API.
export const GET: RequestHandler = async ({ params, request }) => {
	const root = resolve('.office');
	const name = params.path;
	if (!name || name.includes('\\') || name.includes('\0')) error(404, 'Office asset not found');
	const path = resolve(root, name);
	if (!path.startsWith(root + sep)) error(404, 'Office asset not found');
	const original = await stat(path).catch(() => null);
	if (!original?.isFile()) error(404, 'Office asset not found');
	const acceptsGzip = (request.headers.get('accept-encoding') ?? '').split(',').some((part) => {
		const [encoding, quality] = part.trim().split(';');
		return encoding === 'gzip' && (!quality || Number(quality.trim().replace(/^q=/, '')) > 0);
	});
	const compressed = acceptsGzip ? await stat(`${path}.gz`).catch(() => null) : null;
	const headers = new Headers({
		'Content-Type': lookup(name) || 'application/octet-stream',
		'Content-Length': String(compressed?.size ?? original.size),
		'Cache-Control': 'public, max-age=0, must-revalidate',
		ETag: `"${original.size}-${original.mtimeMs}${compressed ? '-gz' : ''}"`,
		Vary: 'Accept-Encoding',
		'X-Content-Type-Options': 'nosniff'
	});
	if (compressed) headers.set('Content-Encoding', 'gzip');
	if (request.headers.get('if-none-match') === headers.get('ETag')) {
		headers.delete('Content-Length');
		return new Response(null, { status: 304, headers });
	}
	return new Response(
		Readable.toWeb(createReadStream(compressed ? `${path}.gz` : path)) as ReadableStream,
		{ headers }
	);
};
