import { error } from '@sveltejs/kit';
import { isGeminiModel } from '$lib/server/production-ai-settings';
import { responseJson } from '$lib/server/production-ai';

export class AiError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
	}
}
export function requireModelId(value: unknown): string {
	if (typeof value !== 'string' || !isGeminiModel(value))
		throw new AiError(400, 'Select a Gemini model.');
	return value;
}

export async function generateStructured(
	key: string,
	model: string,
	parts: unknown[],
	schema: unknown,
	context: string,
	timeout = 60000,
	maxOutputTokens = 8192,
	signal?: AbortSignal
) {
	requireModelId(model);
	const started = performance.now();
	let response: Response;
	try {
		response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
			{
				method: 'POST',
				redirect: 'error',
				signal: AbortSignal.any([AbortSignal.timeout(timeout), ...(signal ? [signal] : [])]),
				headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
				body: JSON.stringify({
					contents: [{ role: 'user', parts }],
					generationConfig: {
						responseMimeType: 'application/json',
						responseSchema: schema,
						maxOutputTokens
					}
				})
			}
		);
	} catch {
		error(
			502,
			'Gemini request cancelled, unreachable or timed out. An already-started request may be billed.'
		);
	}
	if (!response.ok) {
		await response.body?.cancel();
		error(
			502,
			`Gemini request failed (HTTP ${response.status}). Check the model, key, quota and billing.`
		);
	}
	const data = await responseJson(response);
	const candidate = data?.candidates?.[0];
	if (candidate?.finishReason !== 'STOP' || !Array.isArray(candidate.content?.parts))
		error(502, `Gemini did not complete the ${context} response. No result was accepted.`);
	const text = candidate.content.parts
		.filter(
			(part: { text?: unknown; thought?: boolean }) =>
				part?.thought !== true && typeof part?.text === 'string'
		)
		.map((part: { text: string }) => part.text)
		.join('');
	const usage = data?.usageMetadata;
	const tokens = (field: string) =>
		Number.isSafeInteger(usage?.[field]) && usage[field] >= 0 ? (usage[field] as number) : null;
	return {
		text,
		googleMs: Math.round(performance.now() - started),
		usage: {
			inputTokens: tokens('promptTokenCount'),
			outputTokens: tokens('candidatesTokenCount'),
			thinkingTokens: tokens('thoughtsTokenCount')
		}
	};
}
