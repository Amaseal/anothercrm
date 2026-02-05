import { db } from '$lib/server/db';
import { client, tab, task, user, material, product, taskMaterial, taskProduct, file } from '$lib/server/db/schema';
import { fail, redirect } from '@sveltejs/kit';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
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
		const createdById = formData.get('createdById') as string;
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
		const preview = formData.get('preview') as File | null;
		let previewUrl: string | null = null;

		if (preview && preview.size > 0) {
			const uploadDir = 'uploads';
			await mkdir(uploadDir, { recursive: true });
			const fileName = `${Date.now()}-${preview.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
			const filePath = join(uploadDir, fileName);
			const buffer = Buffer.from(await preview.arrayBuffer());
			await writeFile(filePath, buffer);
			previewUrl = `/uploads/${fileName}`;
		}

		if (!title) {
			return fail(400, { missing: true, error: 'Title is required' });
		}

		try {
			const [newTask] = await db.insert(task).values({
				title,
				description,
				tabId,
				clientId,
				clientId,
				assignedToUserId: assignedToUserId || null,
				createdById: createdById || null,
				endDate,
				price: calculatedPrice,
				count: calculatedCount,
				seamstress: seamstress || null,
				preview: previewUrl,
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

					await db.insert(taskProduct).values(productsToInsert);
				}
			}

			// Emit Event
			const fullTask = await db.query.task.findFirst({
				where: (t, { eq }) => eq(t.id, newTask.id),
				with: {
					tab: true,
					client: true,
					creator: true,
					assignedToUser: true
				}
			});
			// Dynamic import to avoid circular dep issues during init if any, though here it's fine.
			const { taskEvents } = await import('$lib/server/events');
			taskEvents.emitTaskUpdate(fullTask, 'create');
		}

			// Handle File Uploads
			const filesJson = formData.get('files');
		if (typeof filesJson === 'string') {
			try {
				const uploadedFiles = JSON.parse(filesJson);
				if (Array.isArray(uploadedFiles) && uploadedFiles.length > 0) {
					await db.insert(file).values(
						uploadedFiles.map((f: any) => ({
							filename: f.name,
							downloadUrl: f.path,
							size: f.size || 0,
							taskId: newTask.id,
							created_at: new Date()
						}))
					);
				}
			} catch (e) {
				console.error('Failed to parse uploaded files JSON', e);
			}
		}

	} catch(err) {
		console.error(err);
		return fail(500, { error: 'Failed to create task' });
	}

		throw redirect(303, '/projekti'); // Redirect to projects list
}
};
