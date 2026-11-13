import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as XLSX from 'xlsx';
import { db } from '$lib/server/db';
import { file, task } from '$lib/server/db/schema';
import { assertProductionStaff, productionId } from './production';
import { assertTaskAccess } from './task-access';
import { ordinaryFileCondition } from './production-projects';
import { resolveUpload } from './file-download';
import { checkSpreadsheetArchive } from './production-workbook';
import { MAX_SOURCE_BYTES, MAX_SOURCE_TEXT } from './production-parsing';
import { productionAiStatus } from './production-ai';

const extensions = /\.(txt|csv|tsv|xlsx|pdf|png|jpe?g)$/i;
export type PreparedSource = {
	name: string;
	mime: string;
	revision: string;
	text?: string;
	base64?: string;
	sheets?: string[];
	sheet?: string;
};

export function editorImages(html: string) {
	// Tiptap stores quoted src attributes. Only local flat upload paths are eligible; never fetch URLs.
	return [
		...new Set(
			[...html.matchAll(/<img\b[^>]*?\bsrc\s*=\s*(["'])(.*?)\1/gi)].map((match) => match[2])
		)
	]
		.filter((src) => /^\/uploads\/[^/\\?&#]+\.(png|jpe?g)$/i.test(src) && !src.includes('\0'))
		.slice(0, 100);
}

export async function parsingTask(locals: App.Locals, taskId: number) {
	assertProductionStaff(locals);
	await assertTaskAccess(locals, taskId);
	const item = await db.query.task.findFirst({
		where: eq(task.id, taskId),
		columns: { id: true, title: true, description: true }
	});
	if (!item) error(404, 'Task not found');
	return item;
}

export async function parsingContext(locals: App.Locals, taskId: number) {
	const item = await parsingTask(locals, taskId);
	const attachments = await db.query.file.findMany({
		where: and(eq(file.taskId, taskId), ordinaryFileCondition()),
		columns: { id: true, filename: true }
	});
	return {
		attachments: attachments.filter((entry) => extensions.test(entry.filename)),
		images: editorImages(item.description || '').map((src, index) => ({ index, src })),
		ai: await productionAiStatus()
	};
}

async function localFile(url: string, name: string) {
	if (!url.startsWith('/uploads/')) error(400, 'Only authorized local attachments are supported.');
	let stored: string;
	try {
		stored = decodeURIComponent(url.slice('/uploads/'.length));
	} catch {
		error(400, 'Invalid local file path.');
	}
	if (!stored || /[/\\]/.test(stored) || stored.includes('\0') || stored === '.' || stored === '..')
		error(400, 'Invalid local file path.');
	const source = await resolveUpload(stored);
	if (!source) error(404, 'Source file not found.');
	if (source.size > MAX_SOURCE_BYTES) error(413, 'Source file exceeds 8 MiB.');
	const bytes = await readFile(source.path);
	if (bytes.length > MAX_SOURCE_BYTES) error(413, 'Source file exceeds 8 MiB.');
	return new File([new Uint8Array(bytes)], name);
}

function sourceText(value: unknown) {
	if (
		typeof value !== 'string' ||
		!value.trim() ||
		value.length > MAX_SOURCE_TEXT ||
		value.includes('\0')
	)
		error(400, 'Select nonempty text of at most 128,000 characters.');
	return value;
}

export async function prepareParsingSource(
	locals: App.Locals,
	taskId: number,
	form: FormData
): Promise<PreparedSource> {
	const item = await parsingTask(locals, taskId);
	const kind = form.get('kind');
	let upload: File;
	if (kind === 'text') {
		const text = sourceText(form.get('text'));
		return {
			name: 'Selected text',
			mime: 'text/plain',
			text,
			revision: createHash('sha256').update(text).digest('hex')
		};
	} else if (kind === 'file') {
		const selected = form.get('file');
		if (!(selected instanceof File)) error(400, 'Select one source file.');
		upload = selected;
	} else if (kind === 'attachment') {
		const record = await db.query.file.findFirst({
			where: and(
				eq(file.id, productionId(form.get('fileId'))),
				eq(file.taskId, taskId),
				ordinaryFileCondition()
			)
		});
		if (!record) error(404, 'Attachment does not belong to this task.');
		upload = await localFile(record.downloadUrl, record.filename);
	} else if (kind === 'editor-image') {
		const index = form.get('imageIndex');
		if (typeof index !== 'string' || !/^(0|[1-9]\d{0,2})$/.test(index))
			error(400, 'Select one saved editor image.');
		const src = editorImages(item.description || '')[Number(index)];
		if (!src)
			error(
				404,
				'The selected saved editor image no longer exists. Save task edits first, or paste the screenshot directly.'
			);
		upload = await localFile(src, src.slice('/uploads/'.length));
	} else error(400, 'Choose text, a source file, an attachment or one saved editor image.');
	if (!extensions.test(upload.name) || upload.name.length > 255)
		error(400, 'Supported source files: TXT, CSV, TSV, XLSX, PDF, PNG and JPEG.');
	if (!upload.size || upload.size > MAX_SOURCE_BYTES)
		error(413, 'Select a source file between 1 byte and 8 MiB.');
	const bytes = Buffer.from(await upload.arrayBuffer());
	const extension = upload.name.split('.').at(-1)!.toLowerCase();
	let text: string | undefined;
	let base64: string | undefined;
	let mime = 'text/plain';
	let sheets: string[] | undefined;
	let sheet: string | undefined;
	if (extension === 'xlsx') {
		try {
			await checkSpreadsheetArchive(bytes);
		} catch {
			error(
				400,
				'Unsupported or oversized XLSX source. Remove formulas/objects or use an explicit PDF/image/text excerpt.'
			);
		}
		const book = XLSX.read(Buffer.from(bytes), { type: 'buffer', cellFormula: true });
		sheets = book.SheetNames.filter((_, index) => !book.Workbook?.Sheets?.[index]?.Hidden);
		const selected = form.get('sheet');
		sheet = typeof selected === 'string' && selected ? selected : sheets[0];
		if (!sheet || !sheets.includes(sheet)) error(400, 'Select a visible worksheet.');
		const values = book.Sheets[sheet];
		const range = XLSX.utils.decode_range(values['!ref'] || 'A1');
		if (range.e.r > 10000 || range.e.c > 19)
			error(400, 'Source worksheet exceeds 10,000 rows or 20 columns.');
		for (const [address, cell] of Object.entries(values)) {
			if (address.startsWith('!')) continue;
			if (cell.f !== undefined || cell.F !== undefined)
				error(400, 'Source formulas are not supported; provide values instead.');
		}
		text = sourceText(XLSX.utils.sheet_to_csv(values, { FS: '\t', blankrows: false }));
	} else if (['txt', 'csv', 'tsv'].includes(extension)) {
		try {
			text = sourceText(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
		} catch {
			error(400, 'Text files must be nonempty UTF-8, at most 128,000 characters.');
		}
	} else {
		const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
		const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
		const pdf = bytes.subarray(0, 5).toString() === '%PDF-';
		if (extension === 'pdf' ? !pdf : extension === 'png' ? !png : !jpeg)
			error(400, 'Source bytes do not match the selected file type.');
		// shortcut: PDFs are byte-bounded, not page-counted; add page selection if large-document costs need tighter limits.
		mime = pdf ? 'application/pdf' : png ? 'image/png' : 'image/jpeg';
		base64 = bytes.toString('base64');
	}
	const revision = createHash('sha256')
		.update(JSON.stringify({ name: upload.name, mime, sheet, text, base64 }))
		.digest('hex');
	return { name: upload.name, mime, revision, text, base64, sheets, sheet };
}
