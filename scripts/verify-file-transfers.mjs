import assert from 'node:assert/strict';
import { writeFile, unlink, readFile, mkdir, open } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import JSZip from 'jszip';

// Exercise the real route handlers with synthetic files; no database is required.
const server = await createServer({
	configFile: false,
	server: { middlewareMode: true },
	resolve: { alias: { $lib: resolve('src/lib') } }
});
const cleanup = [];
const locals = { user: { id: 'transfer-test' } };
const name = `transfer-test-${randomUUID()}.bin`;
const content = Buffer.alloc(1024 * 1024, 42);
try {
	await mkdir('uploads', { recursive: true });
	await writeFile(`uploads/${name}`, content);
	cleanup.push(`uploads/${name}`);
	const downloads = await server.ssrLoadModule('/src/routes/uploads/[...path]/+server.ts');
	const upload = await server.ssrLoadModule('/src/routes/api/upload/+server.ts');
	const zipRoute = await server.ssrLoadModule('/src/routes/api/taskfiles/download/+server.ts');
	const get = (headers = {}, method = 'GET', path = name) =>
		downloads.GET({
			params: { path },
			request: new Request('http://localhost/uploads/file', { headers, method }),
			url: new URL('http://localhost/uploads/file?download=original.bin')
		});
	let response = await get();
	assert.equal(response.status, 200);
	assert.equal(response.headers.get('Content-Length'), String(content.length));
	assert.deepEqual(Buffer.from(await response.arrayBuffer()), content);
	for (const [range, start, end] of [
		['bytes=10-19', 10, 20],
		['bytes=-10', content.length - 10, content.length],
		['bytes=100-', 100, content.length]
	]) {
		response = await get({ range });
		assert.equal(response.status, 206);
		assert.deepEqual(Buffer.from(await response.arrayBuffer()), content.subarray(start, end));
	}
	assert.equal((await get({ range: `bytes=${content.length}-` })).status, 416);
	assert.equal((await get({}, 'HEAD')).body, null);
	assert.equal((await get({}, 'GET', '../package.json')).status, 404);
	response = await get();
	const reader = response.body.getReader();
	await reader.read();
	await reader.cancel();
	const postZip = (files, user = locals) => {
		const body = new FormData();
		body.set('files', JSON.stringify(files));
		body.set('filename', 'Test ?');
		return zipRoute.POST({
			locals: user,
			request: new Request('http://localhost/api/taskfiles/download', { method: 'POST', body })
		});
	};
	const files = [
		{ path: `/uploads/${name}`, name: '?.bin' },
		{ path: `/uploads/${name}`, name: '?.bin' }
	];
	response = await postZip(files);
	const archive = await JSZip.loadAsync(await response.arrayBuffer(), { checkCRC32: true });
	assert.deepEqual(await archive.file('files/?.bin').async('nodebuffer'), content);
	assert.deepEqual(await archive.file('files/2-?.bin').async('nodebuffer'), content);
	await assert.rejects(postZip(files, { user: null }), (e) => e.status === 401);
	await assert.rejects(
		postZip([{ path: '/uploads/../package.json', name: 'bad' }]),
		(e) => e.status === 404
	);
	await assert.rejects(
		postZip([{ path: '/uploads/missing-test-file', name: 'missing' }]),
		(e) => e.status === 404
	);
	response = await postZip(files);
	const zipReader = response.body.getReader();
	await zipReader.read();
	await zipReader.cancel();
	for (const multipart of [false, true]) {
		const url = new URL(`http://localhost/api/upload${multipart ? '' : '?filename=test.bin'}`);
		const form = new FormData();
		form.set('file', new File([content], 'test.bin'));
		response = await upload.POST({
			locals,
			url,
			request: new Request(url, { method: 'POST', body: multipart ? form : content })
		});
		assert.equal(response.status, 200);
		const result = await response.json();
		const path = result.path.slice(1);
		cleanup.push(path);
		assert.deepEqual(await readFile(path), content);
	}
	await assert.rejects(
		upload.POST({
			locals: { user: null },
			url: new URL('http://localhost/api/upload'),
			request: new Request('http://localhost/api/upload', { method: 'POST' })
		}),
		(e) => e.status === 401
	);
	// Verify a 100 MiB source without accumulating the ZIP in memory.
	const largeName = `transfer-test-${randomUUID()}-large.bin`;
	const largePath = `uploads/${largeName}`;
	const handle = await open(largePath, 'wx');
	cleanup.push(largePath);
	await handle.truncate(100 * 1024 * 1024);
	await handle.close();
	const started = performance.now();
	response = await postZip([{ path: `/uploads/${largeName}`, name: 'large.bin' }]);
	const largeReader = response.body.getReader();
	const first = await largeReader.read();
	const firstChunkMs = performance.now() - started;
	let bytes = first.value.byteLength;
	while (true) {
		const chunk = await largeReader.read();
		if (chunk.done) break;
		bytes += chunk.value.byteLength;
	}
	assert(bytes > 100 * 1024 * 1024 && bytes < 100 * 1024 * 1024 + 1024);
	console.log(
		`100 MiB ZIP: first chunk ${firstChunkMs.toFixed(0)} ms, complete ${(performance.now() - started).toFixed(0)} ms`
	);

	console.log(
		'PASS: full/range/HEAD downloads, cancellation, ZIP CRC and duplicate names, missing files, traversal, raw/multipart uploads, authentication'
	);
} finally {
	await server.close();
	for (const path of cleanup) await unlink(path);
}
