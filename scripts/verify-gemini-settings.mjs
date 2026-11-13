import assert from 'node:assert/strict';
import { createServer } from 'vite';

// In-memory DB and mocked provider only; never store a live key or make paid/network calls.
const oldKey = process.env.GEMINI_API_KEY;
const oldModel = process.env.GEMINI_MODEL;
process.env.GEMINI_API_KEY = 'selfcheck-env-key';
process.env.GEMINI_MODEL = 'gemini-environment';
const originalFetch = globalThis.fetch;
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
	const { db } = await server.ssrLoadModule('/src/lib/server/db/index.ts');
	const settings = await server.ssrLoadModule('/src/lib/server/production-ai-settings.ts');
	const ai = await server.ssrLoadModule('/src/lib/server/production-ai.ts');
	const page = await server.ssrLoadModule('/src/routes/(app)/iestatijumi/+page.server.ts');
	const discovery = await server.ssrLoadModule('/src/routes/api/production-ai/models/+server.ts');
	let row;
	let reads = 0;
	let writes = 0;
	let beforeWrite;
	let failWrite = false;
	db.query.geminiSettings.findFirst = async () => {
		reads++;
		return row ? { ...row } : undefined;
	};
	db.query.settings.findFirst = async () => undefined;
	db.query.client.findMany = async () => [];
	db.query.userClient.findFirst = async () => undefined;
	db.query.companySettings.findFirst = async () => undefined;
	db.insert = () => ({
		values: (values) => ({
			onConflictDoUpdate: async ({ set }) => {
				if (failWrite) throw new Error('SQL parameters include selfcheck-replacement-key');
				beforeWrite?.();
				row = row
					? {
							id: 1,
							apiKey: typeof set.apiKey === 'string' ? set.apiKey : row.apiKey,
							model: set.model
						}
					: { ...values };
				writes++;
			}
		})
	});
	const staff = { user: { id: 'staff', type: 'admin' } };
	const client = { user: { id: 'client', type: 'client' } };
	const event = (values = {}, locals = staff, signal = new AbortController().signal) => {
		const form = new FormData();
		for (const [key, value] of Object.entries(values)) form.set(key, value);
		return { locals, request: { formData: async () => form, signal } };
	};
	let generationCalls = 0;
	let discoveryCalls = 0;
	let expectedKey = 'selfcheck-new-key';
	let replies = [];
	let provider = async (url) => {
		if (url.includes(':generateContent'))
			return new Response(
				JSON.stringify({
					candidates: [
						{
							finishReason: 'STOP',
							content: {
								parts: [
									{
										text: '[{"name":"TEST","size":"L","number":"007","artwork":null,"product":null}]'
									}
								]
							}
						}
					]
				})
			);
		return new Response(JSON.stringify(replies.shift()));
	};
	globalThis.fetch = async (url, options) => {
		assert.equal(options.headers['x-goog-api-key'], expectedKey);
		assert.equal(options.redirect, 'error');
		if (url.includes(':generateContent')) {
			generationCalls++;
			assert.equal(
				url,
				`https://generativelanguage.googleapis.com/v1beta/models/${row.model}:generateContent`
			);
			assert.equal(options.method, 'POST');
		} else {
			discoveryCalls++;
			assert.equal(new URL(url).origin, 'https://generativelanguage.googleapis.com');
			assert.equal(options.body, undefined);
			assert.ok(!options.method || options.method === 'GET');
		}
		return provider(url, options);
	};
	for (const [locals, status] of [
		[{ user: null }, 401],
		[client, 403]
	]) {
		await assert.rejects(
			() =>
				page.actions.updateGemini(event({ apiKey: 'not-written', model: 'gemini-test' }, locals)),
			{ status }
		);
		await assert.rejects(() => discovery.POST(event({}, locals)), { status });
	}
	assert.equal(writes, 0);
	assert.equal(discoveryCalls, 0);
	assert.equal(generationCalls, 0);
	const initial = await ai.productionAiStatus();
	assert.equal(initial.source, 'environment');
	assert.equal(initial.ready, true);
	assert.ok(!JSON.stringify(initial).includes('selfcheck-env-key'));
	const beforeClient = reads;
	const clientData = await page.load({ locals: client });
	assert.equal(clientData.gemini, null);
	assert.equal(reads, beforeClient);
	assert.ok(!JSON.stringify(clientData).includes('selfcheck-env-key'));
	assert.ok(!JSON.stringify(await page.load({ locals: staff })).includes('selfcheck-env-key'));

	// Saving makes no provider call. A first blank key explicitly adopts legacy env values.
	assert.equal(
		(await page.actions.updateGemini(event({ model: 'gemini-first-database', apiKey: '' })))
			.success,
		true
	);
	assert.equal(row.apiKey, 'selfcheck-env-key');
	assert.equal(row.model, 'gemini-first-database');
	assert.equal((await ai.productionAiStatus()).source, 'database');
	assert.equal(discoveryCalls, 0);
	assert.equal(generationCalls, 0);
	await assert.rejects(
		() =>
			ai.parseWithGemini({ text: 'TEST,L,007' }, new AbortController().signal, initial.revision),
		{ status: 409 }
	);
	assert.equal(
		generationCalls,
		0,
		'A settings change must reject old paid consent before contacting the provider'
	);
	assert.equal(
		(
			await page.actions.updateGemini(
				event({ apiKey: '  selfcheck-new-key  ', model: 'gemini-current' })
			)
		).success,
		true
	);
	assert.equal(row.apiKey, 'selfcheck-new-key');
	const current = await ai.productionAiStatus();
	assert.equal(current.keyConfigured, true);
	assert.ok(!JSON.stringify(current).includes('selfcheck-new-key'));
	assert.equal(
		(
			await ai.parseWithGemini(
				{ text: 'TEST,L,007' },
				new AbortController().signal,
				current.revision
			)
		)[0].number,
		'007'
	);
	assert.equal(generationCalls, 1);
	const generationBaseline = generationCalls;
	await page.actions.updateGemini(event({ apiKey: '', model: 'gemini-updated' }));
	assert.equal(row.apiKey, 'selfcheck-new-key');
	assert.equal(row.model, 'gemini-updated');
	const beforeRotation = await ai.productionAiStatus();
	await page.actions.updateGemini(
		event({ apiKey: 'selfcheck-key-only-rotation', model: row.model })
	);
	assert.equal((await ai.productionAiStatus()).model, beforeRotation.model);
	await assert.rejects(
		() =>
			ai.parseWithGemini({ text: 'TEST' }, new AbortController().signal, beforeRotation.revision),
		{ status: 409 }
	);
	assert.equal(generationCalls, generationBaseline);
	beforeWrite = () => {
		row.apiKey = 'selfcheck-concurrent-key';
	};
	await page.actions.updateGemini(event({ apiKey: '', model: 'gemini-model-only' }));
	beforeWrite = undefined;
	assert.equal(
		row.apiKey,
		'selfcheck-concurrent-key',
		'Blank input must not restore a key rotated by another admin'
	);
	assert.equal(generationCalls, generationBaseline);
	for (const fields of [
		{ apiKey: 'bad key', model: 'gemini-valid' },
		{ apiKey: 'a'.repeat(513), model: 'gemini-valid' },
		{ apiKey: new File(['no'], 'key.txt'), model: 'gemini-valid' },
		{ apiKey: '', model: 'https://attacker.invalid/model' },
		{ apiKey: '', model: 'gemini-image-only' },
		{ apiKey: '', model: 'gemini-audio-preview' },
		{ apiKey: 'replacement', model: 'gemini-valid', removeKey: 'on' },
		{ apiKey: '', model: 'gemini-valid', removeKey: 'true' }
	]) {
		const before = { ...row };
		assert.equal((await page.actions.updateGemini(event(fields))).status, 400);
		assert.deepEqual(row, before);
	}
	const errorLogs = [];
	const originalError = console.error;
	try {
		console.error = (...args) => errorLogs.push(args);
		failWrite = true;
		const failed = await page.actions.updateGemini(
			event({ apiKey: 'selfcheck-replacement-key', model: 'gemini-valid' })
		);
		assert.equal(failed.status, 500);
		assert.ok(!JSON.stringify(failed).includes('selfcheck-replacement-key'));
		assert.deepEqual(
			errorLogs,
			[],
			'SQL errors containing credential parameters must not be logged'
		);
	} finally {
		failWrite = false;
		console.error = originalError;
	}

	const model = (id, displayName, methods = ['generateContent']) => ({
		name: `models/${id}`,
		displayName,
		supportedGenerationMethods: methods
	});
	replies = [
		{
			models: [
				model('gemini-b', 'B'),
				model('text-embedding-004', 'Embedding'),
				model('gemini-image-only', 'Image'),
				model('gemini-no-generation', 'No generation', ['embedContent'])
			],
			nextPageToken: 'next /?'
		},
		{ models: [model('gemini-a', 'A'), model('gemini-b', 'B')] }
	];
	expectedKey = 'selfcheck-entered-but-unsaved-key';
	const writeCount = writes;
	const catalog = await (await discovery.POST(event({ apiKey: expectedKey }))).json();
	assert.deepEqual(
		catalog.models.map((entry) => entry.id),
		['gemini-a', 'gemini-b']
	);
	assert.equal(writes, writeCount);
	assert.equal(row.apiKey, 'selfcheck-concurrent-key');
	assert.equal(
		generationCalls,
		generationBaseline,
		'Discovery must never make a generation request'
	);
	expectedKey = row.apiKey;
	replies = [{ models: [model('gemini-current-catalog', 'Current')] }];
	assert.equal((await (await discovery.POST(event({ apiKey: '' }))).json()).models.length, 1);
	replies = [
		{ models: [], nextPageToken: 'repeat' },
		{ models: [], nextPageToken: 'repeat' }
	];
	await assert.rejects(() => discovery.POST(event()), { status: 502 });
	replies = [{ models: [], nextPageToken: 123 }];
	await assert.rejects(() => discovery.POST(event()), { status: 502 });
	provider = async () =>
		new Response('secret provider body selfcheck-concurrent-key', { status: 403 });
	await assert.rejects(
		() => discovery.POST(event()),
		(cause) => cause.status === 502 && !cause.body.message.includes('selfcheck-concurrent-key')
	);
	provider = async () => {
		throw new Error('credential selfcheck-concurrent-key');
	};
	await assert.rejects(
		() => discovery.POST(event()),
		(cause) => cause.status === 502 && !cause.body.message.includes('selfcheck-concurrent-key')
	);
	assert.equal(generationCalls, generationBaseline);

	const beforeRemoval = await ai.productionAiStatus();
	await page.actions.updateGemini(event({ apiKey: '', model: row.model, removeKey: 'on' }));
	assert.equal(row.apiKey, '');
	const removed = await ai.productionAiStatus();
	assert.equal(removed.source, 'database');
	assert.equal(removed.ready, false);
	assert.equal(removed.keyConfigured, false);
	assert.equal(
		(await settings.readGeminiSettings()).key,
		'',
		'Removing a key must not revive legacy environment credentials'
	);
	await assert.rejects(() => discovery.POST(event()), { status: 409 });
	await assert.rejects(
		() =>
			ai.parseWithGemini({ text: 'TEST' }, new AbortController().signal, beforeRemoval.revision),
		{ status: 409 }
	);
	await assert.rejects(
		() => ai.parseWithGemini({ text: 'TEST' }, new AbortController().signal, removed.revision),
		{ status: 503 }
	);
	assert.equal(generationCalls, generationBaseline);
	console.log(
		'Gemini settings checks passed: admin-only shared settings, write-only keys, env adoption/override, blank-key preservation, removal, model discovery without generation, safe errors and stale paid-consent rejection.'
	);
} finally {
	globalThis.fetch = originalFetch;
	await server.close();
	if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
	else process.env.GEMINI_API_KEY = oldKey;
	if (oldModel === undefined) delete process.env.GEMINI_MODEL;
	else process.env.GEMINI_MODEL = oldModel;
}
