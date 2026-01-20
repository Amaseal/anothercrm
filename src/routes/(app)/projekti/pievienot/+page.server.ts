import { db } from '$lib/server/db';
import { client, tab, task, user, material, product, taskMaterial, taskProduct } from '$lib/server/db/schema';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const tabs = await db.query.tab.findMany({
		with: {
			translations: true,
			group: {
				with: {
					translations: true
				}
			}
		}
	});

	const clients = await db.query.client.findMany();
	const users = await db.query.user.findMany();
	const materials = await db.query.material.findMany();
	const products = await db.query.product.findMany();

	return {
		tabs,
		clients,
		users,
		materials,
		products
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const userId = user.id;
		
		// Find user's personal tab
		const personalTab = await db.query.tab.findFirst({
			where: (t, { eq, and }) => and(eq(t.userId, userId))
		});

		if (!personalTab) {
			return fail(400, { error: 'User does not have a personal tab' });
		}

		const formData = await request.formData();
		const title = formData.get('title') as string;
		const description = formData.get('description') as string;
		// Tab ID comes from personal tab now
		const tabId = personalTab.id;
		const clientId = formData.get('clientId') ? parseInt(formData.get('clientId') as string) : null;
		const assignedToUserId = formData.get('assignedToUserId') as string;
		const managerId = formData.get('managerId') as string;
		const endDate = formData.get('endDate') as string;

		
		const seamstress = formData.get('seamstress') as string;
		
		const materialIds = formData.getAll('materials').map(id => parseInt(id as string));
		const productIds = formData.getAll('productIds').map(id => parseInt(id as string));
		const productCounts = formData.getAll('productCounts').map(count => parseInt(count as string));
		
		// Calculate total count from products
		let calculatedCount = 0;
		let calculatedPrice = 0;
		if (productCounts.length > 0) {
			calculatedCount = productCounts.reduce((a, b) => a + b, 0);

			if (productIds.length > 0) {
				const selectedProducts = await db.query.product.findMany({
					where: (p, { inArray }) => inArray(p.id, productIds)
				});

				// Create a map for quick lookup
				const productCostMap = new Map(selectedProducts.map(p => [p.id, p.cost]));

				calculatedPrice = productIds.reduce((total, id, index) => {
					const cost = productCostMap.get(id) || 0;
					const count = productCounts[index] || 0;
					return total + (cost * count);
				}, 0);
			}
		}

		// Files (Not supported by storage yet, logging for now)
		const files = formData.getAll('files');
		const preview = formData.get('preview');

		if (!title) {
			return fail(400, { missing: true, error: 'Title is required' });
		}

		try {
			const [newTask] = await db.insert(task).values({
				title,
				description,
				tabId,
				clientId,
				assignedToUserId: assignedToUserId || null,
				managerId: managerId || null,
				endDate,
				price: calculatedPrice,
				count: calculatedCount,
				seamstress: seamstress || null,
				preview: preview && (preview as File).size > 0 ? (preview as File).name : null, 
				isDone: false
			}).returning();

			if (newTask) {
				if (materialIds.length > 0) {
					await db.insert(taskMaterial).values(
						materialIds.map(materialId => ({
							taskId: newTask.id,
							materialId
						}))
					);
				}

				if (productIds.length > 0) {
					const productsToInsert = productIds
						.map((id, index) => ({
							taskId: newTask.id,
							productId: id,
							count: productCounts[index] || 1
						}))
						.filter((p) => p.productId > 0);

					if (productsToInsert.length > 0) {
						await db.insert(taskProduct).values(productsToInsert);
					}
				}
			}

			// TODO: Handle File Uploads (save to disk/cloud and insert into 'file' table)
			if (files.length > 0) {
				console.log('Files to upload:', files);
			}

		} catch (err) {
			console.error(err);
			return fail(500, { error: 'Failed to create task' });
		}

		throw redirect(303, '/projekti'); // Redirect to projects list
	}
};
