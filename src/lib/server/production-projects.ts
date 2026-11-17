import { error, isHttpError } from '@sveltejs/kit';
import { and, eq, notInArray } from 'drizzle-orm';
import { mkdir, open, rm, readFile, rename } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { db } from '$lib/server/db';
import { file, productionProject, task } from '$lib/server/db/schema';
import { assertProductionStaff } from '$lib/server/production';
import { isProductionStoragePath } from '$lib/server/file-download';
import { UPLOADS_DIR, assertUploadStoragePath } from '$lib/server/upload-storage';
import { loadDocument, saveDocument } from '$lib/server/documents';
import { readProductionWorkbook } from '$lib/server/production-workbook';

export function ordinaryFileCondition() {
	return notInArray(file.id, db.select({ id: productionProject.fileId }).from(productionProject));
}

export function assertOrdinaryStoragePath(path: string) {
	assertUploadStoragePath(path);
	if (isProductionStoragePath(path))
		error(409, 'Production workbooks must be managed through their task production project.');
}

export async function assertTaskHasNoProductionProjects(
	taskId: number,
	database: Pick<typeof db, 'query'> = db
) {
	const project = await database.query.productionProject.findFirst({
		where: eq(productionProject.taskId, taskId)
	});
	if (project)
		error(
			409,
			'This task has saved production workbooks. Task deletion is blocked to preserve them; completion is supported.'
		);
}

export async function productionFileIds(taskId: number) {
	const projects = await db.query.productionProject.findMany({
		where: eq(productionProject.taskId, taskId)
	});
	return new Set(projects.map((project) => project.fileId));
}

async function assertTask(locals: App.Locals, taskId: number) {
	// Client workbook access is not approved yet: snapshots may contain staff-only context.
	assertProductionStaff(locals);
	const item = await db.query.task.findFirst({ where: eq(task.id, taskId), columns: { id: true } });
	if (!item) error(404, 'Task not found');
}

export async function listProductionProjects(locals: App.Locals, taskId: number) {
	await assertTask(locals, taskId);
	const projects = await db.query.productionProject.findMany({
		where: eq(productionProject.taskId, taskId),
		orderBy: productionProject.id
	});
	const results = [];
	for (const project of projects) {
		try {
			const document = await loadDocument(String(project.fileId));
			results.push({
				id: project.id,
				fileId: project.fileId,
				filename: document.filename,
				size: document.size,
				revision: document.revision
			});
		} catch (cause) {
			if (!isHttpError(cause, 404)) throw cause;
			const record = await db.query.file.findFirst({ where: eq(file.id, project.fileId) });
			if (!record || record.taskId !== taskId) throw cause;
			// Keep unavailable files visible for recovery without blocking intact workbooks.
			results.push({
				id: project.id,
				fileId: project.fileId,
				filename: record.filename,
				size: record.size,
				revision: null
			});
		}
	}
	return results;
}

export async function openProductionProject(locals: App.Locals, taskId: number, projectId: number) {
	await assertTask(locals, taskId);
	const project = await db.query.productionProject.findFirst({
		where: and(eq(productionProject.taskId, taskId), eq(productionProject.id, projectId))
	});
	if (!project) error(404, 'Production project not found');
	const document = await loadDocument(String(project.fileId));
	if (document.projectId !== project.id) error(404, 'Production project not found');
	return document;
}

export async function validateProductionBytes(bytes: Buffer) {
	try {
		return await readProductionWorkbook(bytes);
	} catch (cause) {
		error(400, cause instanceof Error ? cause.message : 'Invalid production workbook');
	}
}

export async function createProductionProject(locals: App.Locals, taskId: number, upload: File) {
	await assertTask(locals, taskId);
	if (
		!upload.name.toLowerCase().endsWith('.xlsx') ||
		upload.name.length > 180 ||
		/[/\\\p{Cc}]/u.test(upload.name)
	)
		error(400, 'Use an XLSX filename of at most 180 characters.');
	if (!upload.size || upload.size > 25 * 1024 * 1024)
		error(413, 'Workbook exceeds the file size limit.');
	const bytes = Buffer.from(await upload.arrayBuffer());
	await validateProductionBytes(bytes);
	const storedName = `${randomUUID()}.xlsx`;
	const directory = resolve(UPLOADS_DIR, 'production');
	await mkdir(directory, { recursive: true });
	const path = resolve(directory, storedName);
	// shortcut: a crash before DB commit can leave an unreferenced private file; reconcile during backup restore/maintenance.
	try {
		const handle = await open(path, 'wx');
		try {
			await handle.writeFile(bytes);
			await handle.sync();
		} finally {
			await handle.close();
		}
		return await db.transaction(async (tx) => {
			const [parent] = await tx
				.select({ id: task.id })
				.from(task)
				.where(eq(task.id, taskId))
				.for('update');
			if (!parent) error(404, 'Task not found');
			const [record] = await tx
				.insert(file)
				.values({
					filename: upload.name,
					downloadUrl: `/uploads/production/${storedName}`,
					size: bytes.length,
					taskId
				})
				.returning();
			const [project] = await tx
				.insert(productionProject)
				.values({ taskId, fileId: record.id })
				.returning();
			return {
				id: project.id,
				fileId: record.id,
				filename: record.filename,
				size: bytes.length,
				revision: createHash('sha256').update(bytes).digest('hex')
			};
		});
	} catch (cause) {
		await rm(path, { force: true });
		throw cause;
	}
}

export async function deleteProductionProject(
	locals: App.Locals,
	taskId: number,
	projectId: number,
	revision: unknown
) {
	await assertTask(locals, taskId);
	if (revision !== null && (typeof revision !== 'string' || !/^[a-f0-9]{64}$/.test(revision)))
		error(400, 'A saved workbook revision is required.');
	const condition = and(eq(productionProject.taskId, taskId), eq(productionProject.id, projectId));
	const project = await db.query.productionProject.findFirst({ where: condition });
	if (!project) error(404, 'Production project not found');
	const record = await db.query.file.findFirst({ where: eq(file.id, project.fileId) });
	if (
		!record ||
		record.taskId !== taskId ||
		!/^\/uploads\/production\/[a-f0-9-]{36}\.xlsx$/.test(record.downloadUrl)
	)
		error(404, 'Production workbook not found');
	const directory = resolve(UPLOADS_DIR, 'production');
	await mkdir(directory, { recursive: true });
	const path = resolve(UPLOADS_DIR, record.downloadUrl.slice('/uploads/'.length));
	const lockPath = `${path}.lock`;
	const lock = await open(lockPath, 'wx').catch((cause: NodeJS.ErrnoException) => {
		if (cause.code === 'EEXIST')
			error(409, 'Workbook is being saved or deleted. Refresh and try again.');
		throw cause;
	});
	const moved: { source: string; temporary: string }[] = [];
	try {
		let currentRevision: string | null = null;
		try {
			currentRevision = (await loadDocument(String(record.id))).revision;
		} catch (cause) {
			if (!isHttpError(cause, 404)) throw cause;
		}
		if (revision !== currentRevision) error(409, 'Workbook changed. Refresh before deleting.');
		try {
			await db.transaction(async (tx) => {
				const [current] = await tx
					.select({ id: productionProject.id })
					.from(productionProject)
					.where(condition)
					.for('update');
				if (!current) error(404, 'Production project not found');
				// Stage bytes first so a failed database transaction can restore both copies.
				for (const source of [path, `${path}.previous`]) {
					const temporary = `${source}.${randomUUID()}.deleted`;
					try {
						await rename(source, temporary);
						moved.push({ source, temporary });
					} catch (cause) {
						if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause;
					}
				}
				await tx.delete(productionProject).where(condition);
				await tx.delete(file).where(and(eq(file.id, record.id), eq(file.taskId, taskId)));
			});
		} catch (cause) {
			const failures: unknown[] = [cause];
			for (const { source, temporary } of moved) {
				try {
					await rename(temporary, source);
				} catch (restoreError) {
					failures.push(restoreError);
				}
			}
			if (failures.length > 1)
				throw new AggregateError(
					failures,
					`Deletion rollback failed; inspect recovery files for ${path}`
				);
			throw cause;
		}
		let cleanupPending = false;
		// shortcut: a crash/cleanup failure after commit can leave staged files; reconcile these during storage maintenance.
		for (const { temporary } of moved) {
			try {
				await rm(temporary, { force: true });
			} catch (cause) {
				cleanupPending = true;
				console.error(`Could not remove deleted workbook recovery file ${temporary}`, cause);
			}
		}
		return { success: true, cleanupPending };
	} finally {
		await lock.close();
		await rm(lockPath, { force: true });
	}
}

export async function saveProductionProject(
	locals: App.Locals,
	taskId: number,
	projectId: number,
	upload: File,
	revision: unknown
) {
	const document = await openProductionProject(locals, taskId, projectId);
	if (!upload.size || upload.size > 25 * 1024 * 1024)
		error(413, 'Workbook exceeds the file size limit.');
	return saveDocument(document.id, Buffer.from(await upload.arrayBuffer()), revision);
}

export async function previousProductionProject(
	locals: App.Locals,
	taskId: number,
	projectId: number
) {
	const document = await openProductionProject(locals, taskId, projectId);
	const bytes = await readFile(`${document.path}.previous`).catch(
		(cause: NodeJS.ErrnoException) => {
			if (cause.code === 'ENOENT') error(404, 'No previous successful revision is available.');
			throw cause;
		}
	);
	return { document, bytes };
}
