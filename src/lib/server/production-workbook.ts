import JSZip from 'jszip';
import { Readable } from 'node:stream';
import * as XLSX from 'xlsx';
import { MAX_DOCUMENT_SIZE } from '$lib/documents';

export const ORDER_HEADERS = ['Name', 'Size', 'Number', 'Artwork', 'Product'] as const;
export type ProductionOrder = {
	name: string;
	size: string;
	number: string;
	artwork: string;
	product: string;
};
export type ProductionWorkbook = {
	orders: ProductionOrder[];
	setup: Record<string, string>;
	warnings: string[];
};
const settings: Record<string, [number, number]> = {
	UsableRollWidthMm: [100, 5000],
	SheetWidthMm: [100, 30000],
	SheetHeightMm: [100, 30000],
	GapMm: [0, 100],
	PackingProfileResolutionMm: [0.5, 20]
};
const reference = /^crm-production:[1-9]\d*$/;

function requireValue(valid: unknown, message: string): asserts valid {
	if (!valid) throw new Error(message);
}

// Bound actual streamed expansion before handing the ZIP to SheetJS, including hidden ZIP parts.
export async function checkSpreadsheetArchive(bytes: Buffer) {
	requireValue(
		bytes.length > 0 && bytes.length <= MAX_DOCUMENT_SIZE,
		'Workbook must be between 1 byte and 25 MiB.'
	);
	const zip = await JSZip.loadAsync(bytes);
	const entries = Object.values(zip.files);
	requireValue(entries.length <= 1000, 'Workbook contains too many ZIP entries.');
	requireValue(
		zip.file('xl/workbook.xml') && zip.file('[Content_Types].xml'),
		'Expected an XLSX workbook.'
	);
	let total = 0;
	for (const entry of entries) {
		requireValue(
			!/(?:^|\/)(?:vbaProject\.bin|externalLinks|embeddings|connections\.xml|activeX|macrosheets|dialogsheets|media|drawings)(?:\/|$)/i.test(
				entry.name
			),
			'Macros, external data, images and embedded objects are not supported.'
		);
		if (entry.dir) continue;
		let size = 0;
		const chunks: Buffer[] = [];
		for await (const data of new Readable().wrap(entry.nodeStream())) {
			const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);
			size += chunk.length;
			total += chunk.length;
			requireValue(
				size <= 16 * 1024 * 1024 && total <= 64 * 1024 * 1024,
				'Workbook ZIP expansion limit exceeded.'
			);
			if (/\.(xml|rels)$/i.test(entry.name)) chunks.push(chunk);
		}
		if (chunks.length) {
			const xml = Buffer.concat(chunks).toString('utf8');
			requireValue(
				!/<!DOCTYPE|<!ENTITY|TargetMode\s*=\s*['"]External['"]/i.test(xml),
				'External relationships and XML entities are not supported.'
			);
		}
	}
}

function sheetRows(book: XLSX.WorkBook, name: string, headers: readonly string[], limit: number) {
	const sheet = book.Sheets[name];
	requireValue(sheet && sheet['!ref'], `Missing ${name} sheet.`);
	const range = XLSX.utils.decode_range(sheet['!ref']);
	requireValue(
		range.s.r === 0 && range.s.c === 0 && range.e.r <= limit && range.e.c < headers.length,
		`${name}: unsupported range or too many rows/columns.`
	);
	requireValue(!sheet['!merges']?.length, `${name}: merged cells are not supported.`);
	for (const [address, cell] of Object.entries(sheet)) {
		if (address.startsWith('!')) continue;
		requireValue(
			cell.f === undefined && cell.F === undefined && !cell.l && (cell.t === 's' || cell.t === 'z'),
			`${name}!${address}: use text cells, without formulas or hyperlinks.`
		);
		requireValue(
			typeof cell.v !== 'string' || cell.v.length <= 1000,
			`${name}!${address}: text exceeds 1000 characters.`
		);
	}
	const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: true, defval: '' });
	requireValue(
		JSON.stringify(rows.shift()) === JSON.stringify(headers),
		`${name}: invalid headers.`
	);
	while (rows.length && rows.at(-1)!.every((value) => value === '')) rows.pop();
	return rows;
}

export async function readProductionWorkbook(bytes: Buffer): Promise<ProductionWorkbook> {
	await checkSpreadsheetArchive(bytes);
	const book = XLSX.read(Buffer.from(bytes), { type: 'buffer', cellFormula: true, bookVBA: true });
	requireValue(
		JSON.stringify(book.SheetNames) === '["Orders","Setup"]' && !book.vbaraw,
		'Expected only Orders and Setup sheets, without macros.'
	);
	requireValue(
		!book.Workbook?.Sheets?.some((sheet) => sheet.Hidden),
		'Both sheets must be visible.'
	);
	const rows = sheetRows(book, 'Orders', ORDER_HEADERS, 10000);
	const entries = sheetRows(book, 'Setup', ['Key', 'Value'], 1000);
	const setup: Record<string, string> = Object.create(null);
	for (const [key, value] of entries) {
		requireValue(key && !(key in setup), 'Setup keys must be nonempty and unique.');
		requireValue(
			key === 'FormatVersion' ||
				Object.hasOwn(settings, key) ||
				[
					'DefaultProduct',
					'TaskReference',
					'ProjectTitleSnapshot',
					'SeamstressSnapshot',
					'Draft'
				].includes(key) ||
				/^Product\.crm-production:[1-9]\d*$/.test(key) ||
				/^Material\.crm-production:[1-9]\d*\.[1-9]\d*$/.test(key),
			`Unsupported Setup key: ${key}`
		);
		if (key.startsWith('Material.'))
			requireValue(/^crm-material:[1-9]\d*$/.test(value), `${key}: invalid material reference.`);
		setup[key] = value;
	}
	requireValue(setup.FormatVersion === '1', 'Unsupported workbook format version.');
	requireValue(
		setup.Draft === undefined || setup.Draft === 'true' || setup.Draft === 'false',
		'Draft must be text true or false.'
	);
	const draft = setup.Draft === 'true';
	for (const [key, [min, max]] of Object.entries(settings)) {
		const value = setup[key];
		requireValue(
			value && /^\d+(\.\d+)?$/.test(value) && Number(value) >= min && Number(value) <= max,
			`${key}: expected decimal text between ${min} and ${max}.`
		);
	}
	requireValue(
		Math.min(Number(setup.SheetWidthMm), Number(setup.SheetHeightMm)) <=
			Number(setup.UsableRollWidthMm),
		'Neither sheet dimension fits the usable roll width.'
	);
	requireValue(
		typeof setup.DefaultProduct === 'string' &&
			(reference.test(setup.DefaultProduct) || (draft && setup.DefaultProduct === '')),
		'DefaultProduct must be a stable production reference (or blank in a draft).'
	);
	const warnings = new Set<string>();
	const checkProduct = (product: string) => {
		if (!setup[`Product.${product}`])
			warnings.add(`Missing product snapshot: ${product}. Resolve it before generation.`);
	};
	if (setup.DefaultProduct) checkProduct(setup.DefaultProduct);
	else
		warnings.add('Choose a default production product in Edit or Print Tools before production.');
	let missingSizes = 0;
	let missingArtwork = 0;
	let unresolvedProducts = false;
	const orders = rows.map(([name, size, number, artwork, product], index) => {
		if (!draft) {
			requireValue(size?.trim(), `Orders row ${index + 2}: Size is required.`);
			requireValue(
				!product || (reference.test(product) && artwork?.trim()),
				`Orders row ${index + 2}: explicit Product needs a stable reference and Artwork.`
			);
		}
		if (!size?.trim()) missingSizes++;
		if (product && !artwork?.trim()) missingArtwork++;
		if (product && reference.test(product)) checkProduct(product);
		else if (product) unresolvedProducts = true;
		return { name, size, number, artwork, product };
	});
	if (missingSizes) warnings.add(`${missingSizes} garment(s) need a size before production.`);
	if (missingArtwork)
		warnings.add(`${missingArtwork} explicit product row(s) need Artwork before production.`);
	if (unresolvedProducts)
		warnings.add(
			'Source product values are unresolved. Assign stable CRM product references before production; no product was guessed.'
		);
	return { orders, setup, warnings: [...warnings] };
}

export async function writeProductionWorkbook(
	orders: ProductionOrder[],
	setup: Record<string, string>
) {
	const book = XLSX.utils.book_new();
	const sheet = XLSX.utils.aoa_to_sheet([
		[...ORDER_HEADERS],
		...orders.map((row) => [row.name, row.size, row.number, row.artwork, row.product])
	]);
	for (let index = 0; index < orders.length; index++) sheet[`C${index + 2}`].z = '@';
	XLSX.utils.book_append_sheet(book, sheet, 'Orders');
	XLSX.utils.book_append_sheet(
		book,
		XLSX.utils.aoa_to_sheet([['Key', 'Value'], ...Object.entries(setup)]),
		'Setup'
	);
	const bytes = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
	await readProductionWorkbook(bytes);
	return bytes;
}
