import { error } from '@sveltejs/kit';

// Native captures need a larger adapter limit; retain the previous 26 MiB cap everywhere else.
const CRM_BODY_LIMIT = 26 * 1024 * 1024;
export function limitCrmRequest(request: Request) {
	if (Number(request.headers.get('content-length')) > CRM_BODY_LIMIT)
		error(413, 'Request exceeds 26 MiB.');
	if (!request.body) return request;
	let size = 0;
	const body = request.body.pipeThrough(
		new TransformStream<Uint8Array, Uint8Array>({
			transform(chunk, controller) {
				size += chunk.byteLength;
				if (size > CRM_BODY_LIMIT) error(413, 'Request exceeds 26 MiB.');
				controller.enqueue(chunk);
			}
		})
	);
	const init: RequestInit & { duplex: 'half' } = { body, duplex: 'half' };
	return new Request(request, init);
}
