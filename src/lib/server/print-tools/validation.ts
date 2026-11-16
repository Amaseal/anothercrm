import { error } from '@sveltejs/kit';

export async function readPrintToolsBody(
	request: Request,
	limit = 64 * 1024
): Promise<Record<string, unknown>> {
	if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
		error(415, 'Send application/json.');
	const reader = request.body?.getReader();
	if (!reader) error(400, 'Missing JSON body.');
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		while (true) {
			const part = await reader.read();
			if (part.done) break;
			size += part.value.length;
			if (size > limit) error(413, 'Request exceeds the Print Tools byte limit.');
			chunks.push(part.value);
		}
	} finally {
		await reader.cancel().catch(() => {});
	}
	try {
		const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
		if (value && typeof value === 'object' && !Array.isArray(value))
			return value as Record<string, unknown>;
	} catch {
		/* Report a safe validation error, not source content. */
	}
	error(400, 'Expected a JSON object.');
}

export function printToolsText(value: unknown, max: number) {
	if (
		typeof value !== 'string' ||
		!value.trim() ||
		value.trim().length > max ||
		/\p{Cc}/u.test(value)
	)
		error(400, 'Invalid or oversized text field.');
	return value.trim();
}

export function nativeCapture(value: unknown) {
	if (typeof value !== 'string' || value.length > 50 * 1024 * 1024)
		error(400, 'Invalid native capture.');
	const parts = value.split('|');
	if (parts.length !== 4 || parts[0] !== 'cdrole')
		error(
			400,
			'Recapture using the native OLE plugin. Legacy CDR/CMX and SVG captures are not accepted.'
		);
	let total = 0;
	const decoded = parts.slice(1).map((part, index) => {
		const limit = index === 0 ? 36 * 1024 * 1024 : 64 * 1024;
		if (
			part.length > Math.ceil(limit / 3) * 4 ||
			part.length % 4 ||
			!/^[A-Za-z0-9+/]*={0,2}$/.test(part)
		)
			error(400, 'Invalid capture base64 or descriptor size.');
		const bytes = Buffer.from(part, 'base64');
		total += bytes.length;
		if (bytes.length > limit || bytes.toString('base64') !== part || total > 36 * 1024 * 1024)
			error(400, 'Native capture exceeds 36 MiB.');
		return bytes;
	});
	if (decoded[0].length < 512 || decoded[0].subarray(0, 8).toString('hex') !== 'd0cf11e0a1b11ae1')
		error(400, 'Expected native OLE compound storage.');
	const descriptor = decoded[1];
	if (
		descriptor.length < 52 ||
		descriptor.readUInt32LE(0) < 52 ||
		descriptor.readUInt32LE(0) > descriptor.length ||
		descriptor.readUInt32LE(20) !== 1
	)
		error(400, 'Invalid Object Descriptor.');
	for (const position of [44, 48]) {
		const offset = descriptor.readUInt32LE(position),
			end = descriptor.readUInt32LE(0);
		if (!offset) continue;
		if (offset < 52 || offset >= end || offset % 2)
			error(400, 'Invalid Object Descriptor string offset.');
		let terminated = false;
		for (let i = offset; i + 1 < end; i += 2)
			if (descriptor[i] === 0 && descriptor[i + 1] === 0) {
				terminated = true;
				break;
			}
		if (!terminated) error(400, 'Unterminated Object Descriptor string.');
	}
	// OLE bytes stay opaque here; the native plugin validates storage trees/streams again before paste.
	return value;
}
