import { db } from '$lib/server/db';

import { product } from '$lib/server/db/schema';
import { and, desc, asc, sql, count, or } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';
import { handleListParams } from '$lib/server/paramState';
import { ilikeNormalize } from '$lib/server/dbUtils';

export const load: LayoutServerLoad = async ({ url, cookies }) => {
	const activeParams = handleListParams(url, cookies, '/produkti', 'produkti_filters');

	const page = parseInt(activeParams.get('page') || '0');
	const pageSize = parseInt(activeParams.get('pageSize') || '50');
	const search = activeParams.get('search') || '';
	const sortColumn = activeParams.get('sortColumn') || 'id';
	const sortDirection = activeParams.get('sortDirection') || 'asc';

	// Calculate offset for pagination
	const offset = page * pageSize;

	// Build the filter conditions
	let filterConditions = [];

	if (search) {
		filterConditions.push(
			or(
				ilikeNormalize(product.title, search),
				ilikeNormalize(product.description, search)
			)
		);
	}

	const [{ value: totalCount }] = await db
		.select({ value: count() })
		.from(product)
		.where(filterConditions.length > 0 ? and(...filterConditions) : sql`1=1`);

	const sortableColumns = {
		title: product.title,
		cost: product.cost,
		price: product.price
	};

	const columnToSort =
		sortColumn in sortableColumns
			? sortableColumns[sortColumn as keyof typeof sortableColumns]
			: product.id; // Default to id

	const productData = await db.query.product.findMany({
		where: filterConditions.length > 0 ? and(...filterConditions) : undefined,
		orderBy: sortDirection === 'asc' ? asc(columnToSort) : desc(columnToSort),
		limit: pageSize,
		offset: offset,
		with: {
			translations: true,
			clientPrices: {
				with: {
					client: true
				}
			}
		}
	});
	let products = productData.map((product) => {
		return {
			id: product.id,
			title: product.title,
			description: product.description,
			translations: product.translations,
			image: product.image,
			cost: (product.cost / 100).toFixed(2),
			price: (product.price / 100).toFixed(2),
			clientPrices: product.clientPrices.map((cp) => ({
				clientName: cp.client.name,
				price: (cp.price / 100).toFixed(2)
			})),
			created_at: product.created_at,
			updated_at: product.updated_at
		};
	});

	return {
		products,
		pagination: {
			page,
			pageSize,
			totalCount,
			totalPages: Math.ceil(totalCount / pageSize),
			search,
			sortColumn,
			sortDirection
		}
	};
};
