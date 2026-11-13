import { error } from '@sveltejs/kit';
import { and, eq, notInArray } from 'drizzle-orm';
import { mkdir, open, rm, readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { db } from '$lib/server/db';
import { file, productionProject, task } from '$lib/server/db/schema';
import { assertProductionStaff } from '$lib/server/production';
import { isProductionStoragePath } from '$lib/server/file-download';
import { UPLOADS_DIR } from '$lib/server/upload-storage';
import { loadDocument, saveDocument } from '$lib/server/documents';
import { readProductionWorkbook } from '$lib/server/production-workbook';

export function ordinaryFileCondition() {
	return notInArray(file.id, db.select({ id: productionProject.fileId }).from(productionProject));
}

export function assertOrdinaryStoragePath(path: string) {
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
		const document = await loadDocument(String(project.fileId));
		results.push({
			id: project.id,
			fileId: project.fileId,
			filename: document.filename,
			size: document.size,
			revision: document.revision
		});
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
