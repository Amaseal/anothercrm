import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { geminiSettings } from '$lib/server/db/schema';

const modelPattern = /^gemini-[a-z0-9][a-z0-9._-]{0,119}$/;
const specialized = /(?:^|-)(?:embed(?:ding)?|image|tts|audio|live|robotics|computer-use)(?:-|$)/i;
export function isGeminiModel(model: string) {
	return modelPattern.test(model) && !specialized.test(model);
}

export function geminiKey(value: unknown) {
	if (typeof value !== 'string') error(400, 'Enter a Gemini API key as text.');
	const key = value.trim();
	if (key && (key.length > 512 || !/^[!-~]+$/.test(key)))
		error(400, 'The Gemini API key must contain at most 512 printable characters without spaces.');
	return key;
}

export async function readGeminiSettings() {
	const row = await db.query.geminiSettings.findFirst({ where: eq(geminiSettings.id, 1) });
	// Saved settings, including an explicitly removed key, always override legacy env values.
	const key = row ? row.apiKey : env.GEMINI_API_KEY?.trim() || '';
	const model = row ? row.model : env.GEMINI_MODEL?.trim() || '';
	const revision = createHash('sha256')
		.update(JSON.stringify([key, model]))
		.digest('hex');
	const keyConfigured = !!key && key.length <= 512 && /^[!-~]+$/.test(key);
	return {
		key,
		model,
		revision,
		keyConfigured,
		ready: keyConfigured && isGeminiModel(model),
		source: row ? 'database' : 'environment'
	};
}

export async function saveGeminiSettings(form: FormData) {
	const key = geminiKey(form.get('apiKey') ?? '');
	const model = form.get('model');
	if (typeof model !== 'string' || (model.trim() && !isGeminiModel(model.trim())))
		error(400, 'Enter a Gemini generateContent model ID, or leave it blank to disable AI parsing.');
	const remove = form.get('removeKey');
	if (remove !== null && remove !== 'on') error(400, 'Invalid key-removal option.');
	if (remove && key) error(400, 'Choose either replacing or removing the key, not both.');
	const current = await readGeminiSettings();
	await db
		.insert(geminiSettings)
		.values({ id: 1, apiKey: remove ? '' : key || current.key, model: model.trim() })
		.onConflictDoUpdate({
			target: geminiSettings.id,
			set: {
				// Preserve the latest stored key on a blank submission, even if another admin rotates it.
				apiKey: remove ? '' : key || geminiSettings.apiKey,
				model: model.trim()
			}
		});
}
