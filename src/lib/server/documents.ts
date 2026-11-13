import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { file as fileTable, productionProject } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { resolveUpload } from '$lib/server/file-download';
import JSZip from 'jszip';
import { readFile, open, rename, rm } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { readProductionWorkbook } from '$lib/server/production-workbook';

import { MAX_DOCUMENT_SIZE, DOCUMENT_EXTENSIONS, documentExtension } from '$lib/documents';
export { MAX_DOCUMENT_SIZE, DOCUMENT_EXTENSIONS, documentExtension } from '$lib/documents';

export function assertDocumentStaff(locals: App.Locals) {
	if (!locals.user) error(401, 'Unauthorized');
	if (locals.user.type === 'client') error(403, 'Forbidden');
}

export async function loadDocument(id: string) {
	let filename: string;
	let storedName: string;
	let projectId: number | null = null;
	if (id.startsWith('fs:')) {
		filename = storedName = id.slice(3);
	} else {
		if (!/^[1-9]\d*$/.test(id) || Number(id) > 2_147_483_647) error(404, 'Document not found');
		const record = await db.query.file.findFirst({ where: eq(fileTable.id, Number(id)) });
		if (!record || !record.downloadUrl.startsWith('/uploads/')) {
			error(404, 'Document not found');
		}
		filename = record.filename;
		storedName = record.downloadUrl.slice('/uploads/'.length);
		if (storedName.startsWith('production/')) {
			const project = await db.query.productionProject.findFirst({
				where: eq(productionProject.fileId, record.id)
			});
			if (!project || project.taskId !== record.taskId) error(404, 'Production project not found');
			projectId = project.id;
		}
	}
	if (
		!storedName ||
		storedName === '.' ||
		storedName === '..' ||
		(projectId
			? !/^production\/[a-f0-9-]{36}\.xlsx$/.test(storedName)
			: /[/\\]/.test(storedName)) ||
		storedName.includes('\0') ||
		!DOCUMENT_EXTENSIONS.has(documentExtension(filename))
	)
		error(404, 'Document not found');
	const source = await resolveUpload(storedName, projectId !== null);
	if (!source) error(404, 'Document not found');
	if (source.size > MAX_DOCUMENT_SIZE) error(413, 'Document is too large');
	const bytes = await readFile(source.path);
	if (bytes.length > MAX_DOCUMENT_SIZE) error(413, 'Document is too large');
	return {
		id,
		filename,
		...source,
		size: bytes.length,
		bytes,
		projectId,
		revision: createHash('sha256').update(bytes).digest('hex')
	};
}

export async function validateDocumentUpload(upload: File, expectedExtension?: string) {
	const extension = documentExtension(upload.name);
	if (
		upload.size === 0 ||
		upload.size > MAX_DOCUMENT_SIZE ||
		!DOCUMENT_EXTENSIONS.has(extension) ||
		(expectedExtension && extension !== expectedExtension)
	)
		return null;
	const bytes = Buffer.from(await upload.arrayBuffer());
	if (extension !== 'csv') {
		try {
			const archive = await JSZip.loadAsync(bytes);
			const parts: Record<string, string> = {
				docx: 'word/document.xml',
				xlsx: 'xl/workbook.xml',
				pptx: 'ppt/presentation.xml'
			};
			const part = parts[extension];
			if (!archive.file('[Content_Types].xml') || !part || !archive.file(part)) return null;
		} catch {
			return null;
		}
	}
	return bytes;
}

async function flushedWrite(path: string, bytes: Buffer) {
	const handle = await open(path, 'wx');
	try {
		await handle.writeFile(bytes);
		await handle.sync();
	} finally {
		await handle.close();
	}
}

export async function saveDocument(id: string, bytes: Buffer, revision: unknown) {
	const document = await loadDocument(id);
	if (document.projectId) {
		try {
			await readProductionWorkbook(bytes);
		} catch (cause) {
			error(400, cause instanceof Error ? cause.message : 'Invalid production workbook');
		}
	}
	// shortcut: a process crash can leave a .lock file; remove it only after confirming no save is active.
	const lockPath = `${document.path}.lock`;
	const lock = await open(lockPath, 'wx').catch((cause: NodeJS.ErrnoException) => {
		if (cause.code === 'EEXIST') return null;
		throw cause;
	});
	if (!lock) error(409, 'Document changed or another save is in progress. Reload or Save As.');
	const temporaryPath = `${document.path}.${randomUUID()}.tmp`;
	const rollbackPath = `${document.path}.${randomUUID()}.rollback`;
	let replaced = false;
	let metadataUpdated = false;
	let preserveRollback = false;
	let current = document;
	try {
		current = await loadDocument(id);
		if (revision !== current.revision) error(409, 'Document changed. Reload or Save As.');
		await flushedWrite(temporaryPath, bytes);
		await flushedWrite(rollbackPath, current.bytes);
		await rename(temporaryPath, current.path);
		replaced = true;
		if (!id.startsWith('fs:')) {
			await db
				.update(fileTable)
				.set({ size: bytes.length, updated_at: new Date() })
				.where(eq(fileTable.id, Number(id)));
			metadataUpdated = true;
		}
		if (current.projectId) await rename(rollbackPath, `${current.path}.previous`);
		return { success: true, revision: createHash('sha256').update(bytes).digest('hex') };
	} catch (cause) {
		if (replaced) {
			try {
				await rename(rollbackPath, document.path);
				if (metadataUpdated)
					await db
						.update(fileTable)
						.set({ size: current.size })
						.where(eq(fileTable.id, Number(id)));
			} catch (restoreError) {
				preserveRollback = true;
				throw new AggregateError(
					[cause, restoreError],
					`Save/rollback failed; inspect ${document.path} and recovery copy ${rollbackPath}`
				);
			}
		}
		throw cause;
	} finally {
		await rm(temporaryPath, { force: true });
		if (!preserveRollback) await rm(rollbackPath, { force: true });
		await lock.close();
		await rm(lockPath, { force: true });
	}
}
