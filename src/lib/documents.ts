export const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024;
export const DOCUMENT_EXTENSIONS = new Set(['docx', 'xlsx', 'pptx', 'csv']);

export function documentExtension(filename: string) {
	return filename.split('.').pop()?.toLowerCase() ?? '';
}

export function getDocumentEditorId(file: {
	id?: number | null;
	name: string;
	path: string;
	size?: number | null;
}): string | null {
	if (
		!DOCUMENT_EXTENSIONS.has(documentExtension(file.name)) ||
		(file.size != null && (file.size <= 0 || file.size > MAX_DOCUMENT_SIZE)) ||
		!file.path.startsWith('/uploads/')
	)
		return null;
	let storedName: string;
	try {
		storedName = decodeURIComponent(file.path.slice('/uploads/'.length));
	} catch {
		return null;
	}
	if (
		!storedName ||
		storedName === '.' ||
		storedName === '..' ||
		/[/\\]/.test(storedName) ||
		storedName.includes('\0')
	)
		return null;
	if (file.id != null && Number.isInteger(file.id) && file.id > 0 && file.id <= 2_147_483_647)
		return String(file.id);
	return `fs:${storedName}`;
}
