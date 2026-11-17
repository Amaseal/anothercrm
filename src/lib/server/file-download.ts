import { stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { UPLOADS_DIR, getUploadPath } from './upload-storage';
import { error, isHttpError } from '@sveltejs/kit';

export function isProductionStoragePath(path: string) {
	let root = resolve(UPLOADS_DIR, 'production');
	let target = resolve(path);
	if (process.platform === 'win32') {
		root = root.toLowerCase();
		target = target.toLowerCase();
	}
	return target === root || target.startsWith(root + sep);
}

export function uploadUrlPath(value: unknown, allowProduction = false) {
	if (typeof value !== 'string' || !value.startsWith('/uploads/') || /[\\\0?#]/.test(value))
		error(400, 'Invalid upload URL.');
	let relative = value.slice('/uploads/'.length);
	try {
		relative = decodeURIComponent(relative);
	} catch {
		/* Legacy literal percent filenames. */
	}
	if (relative.split(/[\\/]/).some((part) => !part || part === '.' || part === '..'))
		error(400, 'Invalid upload path.');
	const path = getUploadPath(relative);
	if (!allowProduction && isProductionStoragePath(path))
		error(409, 'Use the task production project to manage this workbook.');
	return path;
}

export function ordinaryTaskFilePaths(item: {
	preview?: string | null;
	files?: { downloadUrl: string }[];
}) {
	const urls = [
		...(item.preview ? [item.preview] : []),
		...(item.files ?? []).map((file) => file.downloadUrl)
	];
	// Validate managed references before deleting; external links are not local files.
	return [
		...new Set(
			urls.filter((url) => url.startsWith('/uploads/')).map((url) => uploadUrlPath(url, true))
		)
	].filter((path) => !isProductionStoragePath(path));
}

export async function resolveUpload(path: string, allowProduction = false) {
	const trimmed = path.trimEnd();
	for (const candidate of new Set([path, trimmed, `${trimmed} `])) {
		let fullPath: string;
		try {
			fullPath = getUploadPath(candidate);
		} catch (cause) {
			if (isHttpError(cause)) return null;
			throw cause;
		}
		if (!allowProduction && isProductionStoragePath(fullPath)) return null;
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
