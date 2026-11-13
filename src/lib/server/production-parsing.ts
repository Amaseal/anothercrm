import { error } from '@sveltejs/kit';
import * as XLSX from 'xlsx';
import type { ProductionOrder } from './production-workbook';

export const MAX_SOURCE_TEXT = 128_000;
export const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
export const ORDER_FIELDS = ['name', 'size', 'number', 'artwork', 'product'] as const;

export function draftOrders(value: unknown): ProductionOrder[] {
	if (!Array.isArray(value) || value.length > 10000)
		error(400, 'Expected at most 10,000 garment rows.');
	return value.map((item) => {
		if (!item || typeof item !== 'object' || Array.isArray(item))
			error(400, 'Invalid garment row.');
		const row = {} as ProductionOrder;
		for (const field of ORDER_FIELDS) {
			const text = item[field];
			if (text !== null && (typeof text !== 'string' || text.length > 1000 || text.includes('\0')))
				error(400, `Invalid ${field}: use text of at most 1,000 characters.`);
			row[field] = text ?? '';
		}
		return row;
	});
}

export function draftWarnings(orders: ProductionOrder[]) {
	const warnings: string[] = [];
	if (!orders.length) warnings.push('No garments found. Check the source and parse again.');
	const missingSize = orders.filter((row) => !row.size.trim()).length;
	const missingArtwork = orders.filter((row) => row.product && !row.artwork.trim()).length;
	if (missingSize)
		warnings.push(`${missingSize} row(s) need a size. Correct them in Edit before production.`);
	if (missingArtwork)
		warnings.push(
			`${missingArtwork} row(s) need Artwork for their explicit product. Correct them in Edit before production.`
		);
	if (orders.some((row) => row.product && !/^crm-production:[1-9]\d*$/.test(row.product)))
		warnings.push(
			'Source product names require explicit mappings; they are never matched to catalog entries automatically.'
		);
	return warnings;
}

export function parseStructuredOrders(text: string) {
	if (!text.trim() || text.length > MAX_SOURCE_TEXT) error(400, 'The table is empty or too large.');
	const book = XLSX.read(text, { type: 'string', raw: true });
	const sheet = book.Sheets[book.SheetNames[0]];
	const range = XLSX.utils.decode_range(sheet?.['!ref'] || 'A1');
	if (range.e.r > 10000 || range.e.c > 4)
		error(400, 'Expected Name, Size, Number, optional Artwork and Product; at most 10,000 rows.');
	for (const [address, cell] of Object.entries(sheet)) {
		if (!address.startsWith('!') && (cell.f !== undefined || cell.F !== undefined))
			error(400, 'Formulas are not supported.');
	}
	const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
		header: 1,
		raw: false,
		defval: '',
		blankrows: false
	});
	const headers = rows.shift()?.map((value) => value.trim().toLowerCase());
	if (
		!headers ||
		headers.length < 3 ||
		headers.some((header, index) => header !== ORDER_FIELDS[index])
	)
		error(400, 'Use headers Name, Size, Number, optional Artwork and Product for local parsing.');
	return draftOrders(
		rows.map(([name = '', size = '', number = '', artwork = '', product = '']) => ({
			name,
			size,
			number,
			artwork,
			product
		}))
	);
}
