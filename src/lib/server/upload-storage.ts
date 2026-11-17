import { mkdir } from 'fs/promises';
import { resolve, sep } from 'path';
import { error } from '@sveltejs/kit';
import { randomUUID } from 'crypto';

export const UPLOADS_DIR = 'uploads';

export async function ensureUploadsDir(): Promise<string> {
	await mkdir(UPLOADS_DIR, { recursive: true });
	return UPLOADS_DIR;
}

export function assertUploadStoragePath(path: string): string {
	if (typeof path !== 'string' || path.includes('\0')) error(400, 'Invalid upload path.');
	const root = resolve(UPLOADS_DIR);
	const target = resolve(path);
	const normalizedRoot = process.platform === 'win32' ? root.toLowerCase() : root;
	const normalizedTarget = process.platform === 'win32' ? target.toLowerCase() : target;
	if (!normalizedTarget.startsWith(normalizedRoot + sep))
		error(400, 'Path must stay inside uploads.');
	return target;
}

export function getUploadPath(fileName: string): string {
	return assertUploadStoragePath(resolve(UPLOADS_DIR, fileName));
}

export function toUploadsUrl(fileName: string): string {
	return `/uploads/${fileName}`;
}

export function makeTimestampFilename(originalName: string): string {
	const sanitizedName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, '');
	return `${Date.now()}-${sanitizedName}`;
}

export function makeTaskFileFilename(originalName: string): string {
	const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
	const lastDotIndex = sanitizedName.lastIndexOf('.');

	let fileName = sanitizedName;
	let fileExt = '';

	if (lastDotIndex > 0) {
		fileName = sanitizedName.substring(0, lastDotIndex);
		fileExt = sanitizedName.substring(lastDotIndex);
	}

	const now = new Date();
	const day = String(now.getDate()).padStart(2, '0');
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const year = String(now.getFullYear()).slice(-2);
	const dateString = `${day}.${month}.${year}`;
	const uniqueSuffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;

	return `${fileName}-${dateString}-${uniqueSuffix}${fileExt}`;
}
