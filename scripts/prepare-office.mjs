import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { gunzipSync, gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

// Static /public layer from ghcr.io/ranuts/document, source d1c9b03263aabe14789297f5c717fefff2fe4f0d.
// Pin the bytes, not the moving "latest" tag; no editor server/container is run.
export const OFFICE_LAYER = 'fcd18951bcfec469c95defc213a12fb20e1e18318dc7551a95832f0db3d7b25b';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const CACHE = join(ROOT, '.cache/office');
const OUTPUT = join(ROOT, '.office');
const assetPaths =
	/(["'`(=])\/(assets|sdkjs|web-apps|fonts|libs|icons|licenses|ran-fonts|ranui-iife|theme-presentation\.js|app-tokens\.css|ran-tokens(?:\.[a-f0-9]+)?\.css|document_editor_service_worker\.js|sw\.js|LICENSE|NOTICE)(?=[/"'`)?#])/g;

export function relocateOfficeAsset(source) {
	return source
		.replace(assetPaths, '$1/office/$2')
		.replace(/(["'`])serviceWorker\1\s*in\s*navigator/g, 'false')
		.replaceAll('x2t.wasm.br', 'x2t.wasm');
}

async function downloadBundle() {
	await mkdir(CACHE, { recursive: true });
	const archive = join(CACHE, 'editor.tar.gz');
	let hash = createHash('sha256');
	try {
		for await (const chunk of createReadStream(archive)) hash.update(chunk);
		if (hash.digest('hex') === OFFICE_LAYER) return archive;
	} catch {
		/* Download a missing or interrupted cache entry again. */
	}
	const tokenResponse = await fetch(
		'https://ghcr.io/token?service=ghcr.io&scope=repository:ranuts/document:pull'
	);
	if (!tokenResponse.ok)
		throw new Error(`Office registry authentication failed: ${tokenResponse.status}`);
	const { token } = await tokenResponse.json();
	const response = await fetch(`https://ghcr.io/v2/ranuts/document/blobs/sha256:${OFFICE_LAYER}`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (!response.ok) throw new Error(`Office download failed: ${response.status}`);
	console.log('Downloading pinned office editor assets (~217 MB)...');
	hash = createHash('sha256');
	await pipeline(
		response.body,
		new Transform({
			transform(chunk, _encoding, callback) {
				hash.update(chunk);
				callback(null, chunk);
			}
		}),
		createWriteStream(archive)
	);
	if (hash.digest('hex') !== OFFICE_LAYER) {
		await rm(archive);
		throw new Error('Office download checksum mismatch');
	}
	return archive;
}

async function prepare() {
	let source = process.argv[2] ? resolve(process.argv[2]) : join(CACHE, 'public');
	if (!process.argv[2]) {
		await downloadBundle();
		const extraction = spawnSync('tar', ['-xzf', 'editor.tar.gz', 'public'], {
			cwd: CACHE,
			stdio: 'inherit'
		});
		if (extraction.status !== 0)
			throw new Error('Could not extract office assets (tar is required)');
	}
	// A missing/wrong input must not erase a previously prepared editor.
	await readFile(join(source, 'editor.html'));
	await rm(OUTPUT, { recursive: true, force: true });
	await cp(source, OUTPUT, {
		recursive: true,
		filter: (path) =>
			!path.endsWith('.gz') && (!path.endsWith('.br') || path.endsWith('x2t.wasm.br'))
	});
	let scriptsPatched = 0;
	async function patch(directory) {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) {
				await patch(path);
				continue;
			}
			if (entry.name.endsWith('.br') || entry.name.endsWith('.gz')) {
				// Serve raw WASM with the normal .wasm MIME type; no special proxy headers.
				if (entry.name === 'x2t.wasm.br') {
					const compressed = await readFile(path);
					const wasm = gunzipSync(compressed);
					if (wasm.subarray(0, 4).toString('hex') !== '0061736d')
						throw new Error('Invalid office WASM');
					await writeFile(path.slice(0, -3), wasm);
					await writeFile(`${path.slice(0, -3)}.gz`, compressed);
				}
				// Precompressed copies would bypass our patched JavaScript in adapter-node.
				await rm(path);
				continue;
			}
			if (!['.html', '.js', '.css'].includes(extname(path))) continue;
			const original = await readFile(path, 'utf8');
			const updated = relocateOfficeAsset(original);
			await writeFile(`${path}.gz`, gzipSync(updated));
			if (updated !== original) {
				await writeFile(path, updated);
				if (entry.name.startsWith('editor-') && entry.name.endsWith('.js')) scriptsPatched++;
			}
		}
	}
	await patch(OUTPUT);
	if (!scriptsPatched) throw new Error('Office editor entry changed; review the integration patch');
	// Keep the upstream service worker away from the CRM. Offline/PWA mode is not needed in an embed.
	const disabledWorker = '// Service worker disabled in the CRM integration.\n';
	await writeFile(join(OUTPUT, 'sw.js'), disabledWorker);
	await writeFile(join(OUTPUT, 'sw.js.gz'), gzipSync(disabledWorker));
	await writeFile(
		join(OUTPUT, 'CRM-INTEGRATION.txt'),
		'ranuts/document source: https://github.com/ranuts/document/tree/d1c9b03263aabe14789297f5c717fefff2fe4f0d\n' +
			'Modified for CRM embedding: local asset URLs prefixed with /office/, automatic service worker registration disabled, x2t WASM decompressed.\n' +
			'Reproducible modifications: scripts/prepare-office.mjs in the CRM source. Upstream LICENSE and NOTICE are retained.\n'
	);
	console.log('Office editor ready at /office/editor.html (same CRM server).');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await prepare();
