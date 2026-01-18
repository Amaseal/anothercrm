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
	default: async ({ request }) => {
		const formData = await request.formData();
		const title = formData.get('title') as string;
		const description = formData.get('description') as string;
		const tabId = formData.get('tabId') ? parseInt(formData.get('tabId') as string) : null;
		const clientId = formData.get('clientId') ? parseInt(formData.get('clientId') as string) : null;
		const assignedToUserId = formData.get('assignedToUserId') as string;
		const managerId = formData.get('managerId') as string;
		const endDate = formData.get('endDate') as string;
		const price = formData.get('price') ? parseInt(formData.get('price') as string) : null;
		const count = formData.get('count') ? parseInt(formData.get('count') as string) : null;
		const seamstress = formData.get('seamstress') as string;
		
		const materialIds = formData.getAll('materials').map(id => parseInt(id as string));
		const productIds = formData.getAll('products').map(id => parseInt(id as string));
		
		// Files (Not supported by storage yet, logging for now)
		const files = formData.getAll('files');
		const preview = formData.get('preview');

		if (!title) {
			return fail(400, { missing: true, error: 'Title is required' });
		}

		if (!tabId) {
			return fail(400, { missing: true, error: 'Tab is required' });
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
				price,
				count,
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
					await db.insert(taskProduct).values(
						productIds.map(productId => ({
							taskId: newTask.id,
							productId,
							count: 1 // Default count for now
						}))
					);
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
