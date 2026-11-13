import { db } from '$lib/server/db';
import { file as fileTable } from '$lib/server/db/schema';
import { fail } from '@sveltejs/kit';
import {
	assertDocumentStaff,
	DOCUMENT_EXTENSIONS,
	documentExtension,
	validateDocumentUpload
} from '$lib/server/documents';
import * as m from '$lib/paraglide/messages';
import { asc, isNull } from 'drizzle-orm';
import { mkdir, readdir, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import type { Actions, PageServerLoad } from './$types';

const uploadDir = 'uploads';
const allowedExtensions = DOCUMENT_EXTENSIONS;
const extension = documentExtension;

function safeFilename(filename: string) {
	return filename.replace(/[^\p{L}\p{N}._ -]/gu, '_');
}

const assertStaff = assertDocumentStaff;

async function saveDocument(filename: string, bytes: Buffer) {
	await mkdir(uploadDir, { recursive: true });
	const storedName = `${randomUUID()}-${safeFilename(filename)}`;
	const path = join(uploadDir, storedName);
	await writeFile(path, bytes);

	const [record] = await db
		.insert(fileTable)
		.values({
			filename,
			downloadUrl: `/uploads/${storedName}`,
			size: bytes.byteLength
		})
		.returning();

	return record;
}

async function blankDocx() {
	const zip = new JSZip();
	zip.file(
		'[Content_Types].xml',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
	);
	zip
		.folder('_rels')
		?.file(
			'.rels',
			`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
		);
	zip
		.folder('word')
		?.file(
			'document.xml',
			`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p/><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`
		);
	return Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
}

function blankXlsx() {
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[]]), 'Sheet1');
	return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export const load: PageServerLoad = async ({ locals }) => {
	assertStaff(locals);

	const [dbFiles, fsFiles] = await Promise.all([
		db.query.file.findMany({ where: isNull(fileTable.taskId), orderBy: asc(fileTable.filename) }),
		readdir(uploadDir).catch(() => [] as string[])
	]);

	const byName = new Map<
		string,
		{
			id: number | string;
			filename: string;
			downloadUrl: string;
			size: number;
			created_at: Date;
			source: 'fs' | 'db' | 'both';
		}
	>();

	for (const filename of fsFiles) {
		if (filename === '.gitkeep' || !allowedExtensions.has(extension(filename))) continue;
		const stats = await stat(join(uploadDir, filename)).catch(() => null);
		if (!stats?.isFile()) continue;
		byName.set(filename, {
			id: `fs:${filename}`,
			filename,
			downloadUrl: `/uploads/${filename}`,
			size: stats.size,
			created_at: stats.birthtime,
			source: 'fs'
		});
	}

	for (const document of dbFiles) {
		if (!allowedExtensions.has(extension(document.filename))) continue;
		const storedName = document.downloadUrl.split('/uploads/')[1] || document.filename;
		byName.set(storedName, {
			...document,
			source: byName.has(storedName) ? 'both' : 'db'
		});
	}

	return { documents: [...byName.values()].sort((a, b) => a.filename.localeCompare(b.filename)) };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		assertStaff(locals);
		const formData = await request.formData();
		const rawName = formData.get('name');
		const type = formData.get('type');
		const name = typeof rawName === 'string' ? rawName.trim() : '';
		if (!name || (type !== 'docx' && type !== 'xlsx')) {
			return fail(400, { message: m['documents.create_required']() });
		}
		if (Buffer.byteLength(name, 'utf8') > 180) {
			return fail(400, { message: m['documents.name_too_long']() });
		}

		const filename = `${name}.${type}`;
		const document = await saveDocument(
			filename,
			type === 'xlsx' ? blankXlsx() : await blankDocx()
		);
		return { id: document.id };
	},
	upload: async ({ request, locals }) => {
		assertStaff(locals);
		const formData = await request.formData();
		const upload = formData.get('file');
		if (!(upload instanceof File) || upload.size === 0)
			return fail(400, { message: 'Missing file' });
		const bytes = await validateDocumentUpload(upload);
		if (!bytes) return fail(400, { message: m['documents.invalid_file']() });

		const document = await saveDocument(upload.name, bytes);
		return { id: document.id };
	}
};
