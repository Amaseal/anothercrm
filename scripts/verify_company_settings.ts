import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { parseCompanySettings } from '../src/lib/server/company-settings';

// Run with: pnpm exec tsx scripts/verify_company_settings.ts
const values = {
	name: 'Example SIA',
	registrationNumber: '12345678901',
	vatNumber: 'LV12345678901',
	address: 'Example street 1',
	bankName: 'Example Bank',
	bankCode: 'EXAMPLE',
	bankAccount: 'LV00EXAMPLE',
	email: 'hello@example.com',
	phone: '+371 12345678',
	website: 'https://example.com'
};
const form = () => {
	const data = new FormData();
	for (const [key, value] of Object.entries(values)) data.set(key, ` ${value} `);
	return data;
};
assert.deepEqual(parseCompanySettings(form()), values);
for (const field of [
	'name',
	'registrationNumber',
	'vatNumber',
	'address',
	'bankName',
	'bankCode',
	'bankAccount'
]) {
	const data = form();
	data.set(field, ' ');
	assert.equal(parseCompanySettings(data), null, `${field} must be required`);
}
for (const [field, value] of [
	['email', 'invalid'],
	['website', 'not a URL'],
	['website', 'javascript:alert(1)']
]) {
	const data = form();
	data.set(field, value);
	assert.equal(parseCompanySettings(data), null);
}
const optional = form();
for (const field of ['email', 'phone', 'website']) optional.delete(field);
assert.equal(parseCompanySettings(optional)?.email, null);
const extra = form();
extra.set('id', '999');
extra.set('isActive', 'false');
assert.deepEqual(parseCompanySettings(extra), values);

// Exercise the real action's guards without making any database calls.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
	const { actions } = await server.ssrLoadModule('/src/routes/(app)/iestatijumi/+page.server.ts');
	const request = {
		formData: () => {
			throw new Error('Unauthorized request body was read');
		}
	};
	for (const user of [null, { id: 'test-client', type: 'client' }]) {
		const result = await actions.updateCompany({ locals: { user }, request });
		assert.equal(result.status, 403);
	}
	const result = await actions.updateCompany({
		locals: { user: { id: 'test-admin', type: 'admin' } },
		request: { formData: async () => new FormData() }
	});
	assert.equal(result.status, 400);

	// Replace the database methods before testing successful saves.
	const { db } = await server.ssrLoadModule('/src/lib/server/db/index.ts');
	db.query.companySettings.findFirst = async () => ({ id: 7 });
	let saved = null;
	db.update = () => ({
		set: (company: unknown) => ({
			where: async () => {
				saved = company;
			}
		})
	});
	const event = {
		locals: { user: { id: 'test-admin', type: 'admin' } },
		request: { formData: async () => form() }
	};
	assert.deepEqual(await actions.updateCompany(event), { success: true });
	assert.deepEqual(saved, values);

	db.query.companySettings.findFirst = async () => null;
	db.insert = () => ({
		values: async (company: unknown) => {
			saved = company;
		}
	});
	saved = null;
	assert.deepEqual(await actions.updateCompany(event), { success: true });
	assert.deepEqual(saved, values);
} finally {
	await server.close();
}
console.log(
	'Company settings checks passed (validation and server authorization; no DB mutations).'
);
