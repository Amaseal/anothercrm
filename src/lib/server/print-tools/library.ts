import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	productionProduct as products,
	productionSize as sizes,
	productionPart as parts,
	productionCapture as captures
} from '$lib/server/db/schema';
import { productionId } from '$lib/server/production';
import { nativeCapture, printToolsText } from './validation';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function withProduct<T>(id: number, operation: (tx: Tx) => Promise<T>) {
	return db.transaction(async (tx) => {
		const [product] = await tx
			.select({ id: products.id })
			.from(products)
			.where(eq(products.id, id))
			.for('update');
		if (!product) error(404, 'Production product not found.');
		return operation(tx);
	});
}
const empty = () => new Response(null, { status: 204 });
const captureFields = {
	id: captures.id,
	sizeLabel: sizes.label,
	svgContent: captures.payload,
	capturedAt: captures.capturedAt
};

export async function libraryRoute(
	method: string,
	path: string[],
	query: URLSearchParams,
	body: Record<string, unknown>
) {
	if (path[0] === 'library' && path.length === 2) {
		const id = productionId(path[1]);
		const [record] = await db
			.select({ productId: sizes.productId })
			.from(captures)
			.innerJoin(sizes, eq(sizes.id, captures.sizeId))
			.where(eq(captures.id, id));
		if (!record) error(404, 'Capture not found.');
		return withProduct(record.productId, async (tx) => {
			if (method === 'GET') {
				const [row] = await tx
					.select(captureFields)
					.from(captures)
					.innerJoin(sizes, eq(sizes.id, captures.sizeId))
					.where(eq(captures.id, id));
				if (!row) error(404, 'Capture not found.');
				return json(row);
			}
			if (method === 'DELETE') {
				await tx.delete(captures).where(eq(captures.id, id));
				return empty();
			}
			error(405, 'Method not allowed.');
		});
	}
	if (path[0] !== 'products') return null;
	if (path.length === 1) {
		if (method === 'GET')
			return json(
				await db
					.select({ id: products.id, name: products.name })
					.from(products)
					.orderBy(asc(products.name), asc(products.id))
			);
		if (method === 'POST') {
			const [created] = await db
				.insert(products)
				.values({ name: printToolsText(body.name, 120) })
				.onConflictDoNothing()
				.returning();
			if (!created) error(409, 'A production product with this name already exists.');
			return json(created, { status: 201 });
		}
		error(405, 'Method not allowed.');
	}
	const productId = productionId(path[1]);
	return withProduct(productId, async (tx) => {
		if (path.length === 2 && method === 'DELETE') {
			await tx.delete(products).where(eq(products.id, productId));
			return empty();
		}
		const endpoint = path[2];
		if (endpoint === 'parts') {
			if (path.length === 3 && method === 'GET')
				return json(
					await tx
						.select({ name: parts.name, isBase: parts.isBase })
						.from(parts)
						.where(eq(parts.productId, productId))
						.orderBy(asc(parts.name))
				);
			if (path.length === 3 && method === 'POST') {
				await tx
					.insert(parts)
					.values({ productId, name: printToolsText(body.name, 120) })
					.onConflictDoNothing();
				return new Response(null, { status: 201 });
			}
			if (path.length >= 4) {
				const name = printToolsText(path[3], 120);
				const condition = and(eq(parts.productId, productId), eq(parts.name, name));
				const [part] = await tx.select({ id: parts.id }).from(parts).where(condition);
				if (!part) error(404, 'Part not found.');
				if (path.length === 4 && method === 'DELETE') {
					await tx.delete(parts).where(condition);
					return empty();
				}
				if (path.length === 5 && path[4] === 'base' && method === 'PATCH') {
					if (typeof body.isBase !== 'boolean') error(400, 'isBase must be boolean.');
					const existing = await tx
						.select({ id: parts.id })
						.from(parts)
						.where(and(eq(parts.productId, productId), eq(parts.isBase, true)));
					if (body.isBase && existing.some((row) => row.id !== part.id))
						error(409, 'Unset the existing base part first.');
					await tx.update(parts).set({ isBase: body.isBase }).where(condition);
					return empty();
				}
			}
		}
		if (
			(endpoint === 'sizes' || endpoint === 'sizes-with-base') &&
			path.length === 3 &&
			method === 'GET'
		) {
			const rows = await tx
				.select({ label: sizes.label, isBase: sizes.isBase })
				.from(sizes)
				.where(eq(sizes.productId, productId))
				.orderBy(asc(sizes.label));
			return json(endpoint === 'sizes' ? rows.map((row) => row.label) : rows);
		}
		if (endpoint === 'sizes') {
			if (path.length === 3 && method === 'POST') {
				await tx
					.insert(sizes)
					.values({ productId, label: printToolsText(body.label, 40) })
					.onConflictDoNothing();
				return new Response(null, { status: 201 });
			}
			if (path.length >= 4) {
				const label = printToolsText(path[3], 40);
				const condition = and(eq(sizes.productId, productId), eq(sizes.label, label));
				const [size] = await tx.select({ id: sizes.id }).from(sizes).where(condition);
				if (!size) error(404, 'Size not found.');
				if (path.length === 4 && method === 'DELETE') {
					await tx.delete(sizes).where(condition);
					return empty();
				}
				if (path.length === 5 && path[4] === 'base' && method === 'PATCH') {
					if (typeof body.isBase !== 'boolean') error(400, 'isBase must be boolean.');
					if (body.isBase)
						await tx.update(sizes).set({ isBase: false }).where(eq(sizes.productId, productId));
					await tx.update(sizes).set({ isBase: body.isBase }).where(condition);
					return empty();
				}
			}
		}
		if (endpoint === 'library' && path.length === 3) {
			if (method === 'GET')
				return json(
					await tx
						.select({
							id: captures.id,
							sizeLabel: sizes.label,
							capturedAt: captures.capturedAt,
							hasSvg: sql<boolean>`length(${captures.payload}) > 0`
						})
						.from(captures)
						.innerJoin(sizes, eq(sizes.id, captures.sizeId))
						.where(eq(sizes.productId, productId))
						.orderBy(asc(sizes.label))
				);
			if (method === 'POST') {
				const label = printToolsText(body.size, 40);
				const payload = nativeCapture(body.svg);
				const [size] = await tx
					.select({ id: sizes.id })
					.from(sizes)
					.where(and(eq(sizes.productId, productId), eq(sizes.label, label)));
				if (!size) error(404, 'Register this size before capturing it.');
				await tx
					.insert(captures)
					.values({ sizeId: size.id, payload })
					.onConflictDoUpdate({
						target: captures.sizeId,
						set: { payload, capturedAt: new Date() }
					});
				return new Response(null, { status: 201 });
			}
		}
		if (endpoint === 'captured-sizes' && path.length === 3 && method === 'GET')
			return json(
				(
					await tx
						.select({ label: sizes.label })
						.from(captures)
						.innerJoin(sizes, eq(sizes.id, captures.sizeId))
						.where(eq(sizes.productId, productId))
				).map((row) => row.label)
			);
		if (
			method === 'GET' &&
			((endpoint === 'size-shapes' && path.length === 3) ||
				(endpoint === 'library' && path[3] === 'shapes' && path.length === 4))
		) {
			const labels =
				endpoint === 'size-shapes'
					? [printToolsText(query.get('size'), 40)]
					: query.has('size')
						? query.getAll('size')
						: (query.get('sizes') ?? '').split(',');
			if (!labels.length || labels.length > 200) error(400, 'Request 1–200 sizes.');
			const requested = [...new Set(labels.map((label) => printToolsText(label, 40)))];
			const condition = and(eq(sizes.productId, productId), inArray(sizes.label, requested));
			const lengths = await tx
				.select({ bytes: sql<number>`octet_length(${captures.payload})` })
				.from(captures)
				.innerJoin(sizes, eq(sizes.id, captures.sizeId))
				.where(condition);
			if (lengths.reduce((sum, row) => sum + Number(row.bytes), 0) > 60 * 1024 * 1024)
				error(413, 'Capture batch exceeds 60 MiB. Request individual sizes.');
			return json(
				await tx
					.select(captureFields)
					.from(captures)
					.innerJoin(sizes, eq(sizes.id, captures.sizeId))
					.where(condition)
					.orderBy(asc(sizes.label))
			);
		}
		error(404, 'Print Tools endpoint not found.');
	});
}
