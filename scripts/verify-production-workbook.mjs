import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

// Offline acceptance fixture only: not a validator for untrusted production uploads.
const fixtureUrl = new URL('../docs/fixtures/production-v1.xlsx', import.meta.url);
const headers = ['Name', 'Size', 'Number', 'Artwork', 'Product'];
const orders = [
	['OZOLS', 'L', '07', 'Home', 'crm-production:101'],
	['BĒRZIŅŠ', 'M', '', 'Away', 'crm-production:202'],
	['', 'XL', '00', '', ''],
	['Žanete Ābele', 'S', '12', 'Home', 'crm-production:101']
];
const setup = [
	['FormatVersion', '1'],
	['UsableRollWidthMm', '1700'],
	['SheetWidthMm', '1400'],
	['SheetHeightMm', '900'],
	['GapMm', '7'],
	['PackingProfileResolutionMm', '1.5'],
	['DefaultProduct', 'crm-production:101'],
	['Product.crm-production:101', 'Spēļu krekls'],
	['Product.crm-production:202', 'Šorti'],
	['TaskReference', 'fixture:task-42'],
	['ProjectTitleSnapshot', 'Ādažu komanda'],
	['SeamstressSnapshot', 'Līga'],
	['Material.crm-production:101.1', 'crm-material:301'],
	['Material.crm-production:202.1', 'crm-material:302']
];

function createFixture() {
	const book = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([headers, ...orders]), 'Orders');
	XLSX.utils.book_append_sheet(
		book,
		XLSX.utils.aoa_to_sheet([['Key', 'Value'], ...setup]),
		'Setup'
	);
	book.Sheets.Orders['!cols'] = [24, 10, 10, 18, 28].map((wch) => ({ wch }));
	book.Sheets.Setup['!cols'] = [{ wch: 40 }, { wch: 32 }];
	for (let row = 2; row <= orders.length + 1; row++) book.Sheets.Orders[`C${row}`].z = '@';
	return book;
}

function readValues(book, name, columns, maxRows) {
	const sheet = book.Sheets[name];
	assert.ok(sheet, `Missing ${name} sheet`);
	const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
	assert.equal(range.s.r, 0, `${name} must start at A1`);
	assert.equal(range.s.c, 0, `${name} must start at A1`);
	assert.ok(range.e.r < maxRows, `${name} exceeds the row limit`);
	assert.ok(range.e.c < columns, `${name} has unsupported columns`);
	for (const [address, cell] of Object.entries(sheet)) {
		if (address.startsWith('!')) continue;
		assert.ok(!cell.f && !cell.F, `${name}!${address}: formulas are not supported`);
		assert.ok(!cell.l, `${name}!${address}: hyperlinks are not supported`);
		assert.ok(cell.t === 's' || cell.t === 'z', `${name}!${address}: use text cells`);
	}
	return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
}

function snapshot(book) {
	assert.deepEqual(book.SheetNames, ['Orders', 'Setup'], 'Unsupported sheet structure');
	assert.ok(!book.vbaraw, 'Macros are not supported');
	const rows = readValues(book, 'Orders', 5, 10001);
	assert.deepEqual(rows.shift(), headers, 'Orders headers changed');
	while (rows.length && rows.at(-1).every((value) => value === '')) rows.pop();
	for (const [index, row] of rows.entries()) {
		assert.ok(row[1].trim(), `Orders row ${index + 2}: Size is required`);
		assert.ok(!row[4] || row[3].trim(), `Orders row ${index + 2}: Product requires Artwork`);
	}
	const entries = readValues(book, 'Setup', 2, 1001);
	assert.deepEqual(entries.shift(), ['Key', 'Value'], 'Setup headers changed');
	const values = new Map();
	for (const [key, value] of entries) {
		if (!key && !value) continue;
		assert.ok(key && !values.has(key), `Duplicate or empty Setup key: ${key}`);
		values.set(key, value);
	}
	assert.equal(values.get('FormatVersion'), '1', 'Unsupported workbook format');
	for (const [key, min, max] of [
		['UsableRollWidthMm', 100, 5000],
		['SheetWidthMm', 100, 30000],
		['SheetHeightMm', 100, 30000],
		['GapMm', 0, 100],
		['PackingProfileResolutionMm', 0.5, 20]
	]) {
		const value = values.get(key);
		assert.ok(value && /^\d+(\.\d+)?$/.test(value), `${key}: expected decimal text`);
		assert.ok(Number(value) >= min && Number(value) <= max, `${key}: out of range`);
	}
	assert.ok(
		Math.min(Number(values.get('SheetWidthMm')), Number(values.get('SheetHeightMm'))) <=
			Number(values.get('UsableRollWidthMm')),
		'Sheet cannot fit the usable roll width'
	);
	assert.ok(values.get('DefaultProduct'), 'DefaultProduct is required');
	return {
		orders: rows,
		setup: Object.fromEntries([...values].sort(([a], [b]) => a.localeCompare(b)))
	};
}

const expected = snapshot(createFixture());
// The check itself must catch the regressions this fixture is intended to expose.
for (const mutate of [
	(book) => (book.Sheets.Orders.C2 = { t: 'n', v: 7 }),
	(book) => (book.Sheets.Orders.C2.f = '7'),
	(book) => (book.Sheets.Orders.C2.F = 'C2:C3'),
	(book) => (book.Sheets.Orders.B2.v = ''),
	(book) => (book.Sheets.Orders.D2.v = ''),
	(book) => (book.Sheets.Setup.B2.v = '2'),
	(book) => (book.Sheets.Setup.B3.v = 'NaN'),
	(book) => (book.Sheets.Setup.B6.v = '101'),
	(book) => (book.Sheets.Orders.A1.v = 'Changed'),
	(book) => book.SheetNames.push('Unsupported')
]) {
	const book = createFixture();
	mutate(book);
	assert.throws(() => snapshot(book));
}
const changed = createFixture();
changed.Sheets.Orders.C2.v = '7';
assert.notDeepEqual(snapshot(changed), expected, 'Leading-zero loss must be detected');

const args = process.argv.slice(2);
if (args[0] === '--write-fixture') {
	assert.equal(args.length, 1, '--write-fixture cannot be combined with candidate files');
	await mkdir(new URL('../docs/fixtures/', import.meta.url), { recursive: true });
	await writeFile(fixtureUrl, XLSX.write(createFixture(), { type: 'buffer', bookType: 'xlsx' }));
}
const paths = args.length && args[0] !== '--write-fixture' ? args : [fileURLToPath(fixtureUrl)];
for (const path of paths) {
	const bytes = await readFile(path);
	assert.ok(bytes.length <= 25 * 1024 * 1024, 'Workbook exceeds document upload limit');
	const actual = snapshot(XLSX.read(bytes, { type: 'buffer', cellFormula: true, bookVBA: true }));
	assert.deepEqual(actual, expected, `${path}: fixture values changed during roundtrip`);
	console.log(`Production fixture values preserved: ${path}`);
}
console.log('Offline checks passed; this does not prove the office or plugin roundtrip.');
