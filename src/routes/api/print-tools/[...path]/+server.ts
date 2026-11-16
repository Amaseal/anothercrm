import { error, isHttpError, json, type RequestHandler } from '@sveltejs/kit';
import { authenticatePrintTools } from '$lib/server/print-tools/auth';
import { readPrintToolsBody } from '$lib/server/print-tools/validation';
import { libraryRoute } from '$lib/server/print-tools/library';
import { aiRoute } from '$lib/server/print-tools/ai';
import { AiError } from '$lib/server/print-tools/gemini';

const handle: RequestHandler = async ({ request, url }) => {
	try {
		await authenticatePrintTools(request);
		let path: string[];
		try {
			path = (url.pathname.split('/api/print-tools/')[1] ?? '')
				.split('/')
				.filter(Boolean)
				.map(decodeURIComponent);
		} catch {
			error(400, 'Invalid endpoint path.');
		}
		if (request.method === 'GET' && path.join('/') === 'health')
			return json(
				{ backend: 'crm-print-tools', version: 1 },
				{ headers: { 'Cache-Control': 'no-store' } }
			);
		const capture =
			request.method === 'POST' &&
			path[0] === 'products' &&
			path[2] === 'library' &&
			path.length === 3;
		const ai = path.join('/') === 'orders/parse' || path.join('/') === 'reports/inspect';
		const body = ['POST', 'PUT', 'PATCH'].includes(request.method)
			? await readPrintToolsBody(
					request,
					capture ? 50 * 1024 * 1024 : ai ? 18 * 1024 * 1024 : 64 * 1024
				)
			: {};
		const response =
			(await libraryRoute(request.method, path, url.searchParams, body)) ??
			(await aiRoute(request.method, path, body, request.signal));
		if (!response) error(404, 'Print Tools endpoint not found.');
		response.headers.set('Cache-Control', 'no-store');
		return response;
	} catch (cause) {
		if (isHttpError(cause))
			return json(
				{ error: cause.body.message },
				{ status: cause.status, headers: { 'Cache-Control': 'no-store' } }
			);
		if (cause instanceof AiError)
			return json(
				{ error: cause.message },
				{ status: cause.status, headers: { 'Cache-Control': 'no-store' } }
			);
		// Driver errors can contain credentials or native artwork. Never serialize/log them.
		return json(
			{
				error:
					'CRM Print Tools request failed. Check deployment/migrations or contact the administrator.'
			},
			{ status: 500, headers: { 'Cache-Control': 'no-store' } }
		);
	}
};
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
export const PATCH = handle;
export const PUT = handle;
