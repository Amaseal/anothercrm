import { stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { UPLOADS_DIR } from './upload-storage';

export async function resolveUpload(path: string) {
	const root = resolve(UPLOADS_DIR);
	const trimmed = path.trimEnd();
	for (const candidate of new Set([path, trimmed, `${trimmed} `])) {
		const fullPath = resolve(root, candidate);
		if (!fullPath.startsWith(root + sep)) return null;
		try {
			const info = await stat(fullPath);
			if (info.isFile()) return { path: fullPath, size: info.size, mtime: info.mtime };
		} catch {
			/* Try legacy trailing-space filenames. */
		}
	}
	return null;
}

export function attachment(name: string) {
	return `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16)}`)}`;
}
