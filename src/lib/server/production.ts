import { error } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { productionProduct, productionSize } from '$lib/server/db/schema';
import * as m from '$lib/paraglide/messages';

export function assertProductionStaff(locals: App.Locals) {
	if (!locals.user) error(401, 'Unauthorized');
	if (locals.user.type !== 'admin') error(403, 'Forbidden');
}

export function productionId(value: unknown) {
	if (typeof value !== 'string' || !/^[1-9]\d{0,9}$/.test(value) || Number(value) > 2_147_483_647)
		error(400, m['production.invalid_input']());
	return Number(value);
}

function textField(form: FormData, key: string, max: number) {
	const value = form.get(key);
	if (
		typeof value !== 'string' ||
		!value.trim() ||
		value.trim().length > max ||
		/\p{Cc}/u.test(value)
	)
		error(400, m['production.invalid_input']());
	return value.trim();
}

export async function listProductionProducts() {
	return db
		.select()
		.from(productionProduct)
		.orderBy(asc(productionProduct.name), asc(productionProduct.id));
}

export async function loadProductionProduct(id: number) {
	const product = await db.query.productionProduct.findFirst({
		where: eq(productionProduct.id, id),
		with: { sizes: { orderBy: [asc(productionSize.label), asc(productionSize.id)] } }
	});
	if (!product) error(404, m['production.not_found']());
	return product;
}

export async function createProductionProduct(form: FormData) {
	const name = textField(form, 'name', 120);
	const [created] = await db
		.insert(productionProduct)
		.values({ name })
		.onConflictDoNothing()
		.returning();
	if (!created) error(409, m['production.duplicate_product']());
	return created.id;
}

export async function deleteProductionProduct(form: FormData) {
	const id = productionId(form.get('productId'));
	const [deleted] = await db
		.delete(productionProduct)
		.where(eq(productionProduct.id, id))
		.returning({ id: productionProduct.id });
	if (!deleted) error(404, m['production.not_found']());
}

// Serialize size mutations on the parent so switching the base size cannot race.
export async function changeProductionSize(form: FormData, operation: 'add' | 'delete' | 'base') {
	const productId = productionId(form.get('productId'));
	const label = operation === 'add' ? textField(form, 'label', 40) : null;
	const sizeId = operation !== 'add' ? productionId(form.get('sizeId')) : null;
	const isBase = form.get('isBase');
	if (operation === 'base' && isBase !== 'true' && isBase !== 'false')
		error(400, m['production.invalid_input']());
	await db.transaction(async (tx) => {
		const [parent] = await tx
			.select({ id: productionProduct.id })
			.from(productionProduct)
			.where(eq(productionProduct.id, productId))
			.for('update');
		if (!parent) error(404, m['production.not_found']());
		if (operation === 'add') {
			const [created] = await tx
				.insert(productionSize)
				.values({ productId, label: label! })
				.onConflictDoNothing()
				.returning({ id: productionSize.id });
			if (!created) error(409, m['production.duplicate_size']());
			return;
		}
		const condition = and(eq(productionSize.productId, productId), eq(productionSize.id, sizeId!));
		const [size] = await tx.select({ id: productionSize.id }).from(productionSize).where(condition);
		if (!size) error(404, m['production.not_found']());
		if (operation === 'delete') {
			await tx.delete(productionSize).where(condition);
			return;
		}
		if (isBase === 'true') {
			await tx
				.update(productionSize)
				.set({ isBase: false })
				.where(eq(productionSize.productId, productId));
		}
		await tx
			.update(productionSize)
			.set({ isBase: isBase === 'true' })
			.where(condition);
	});
}
