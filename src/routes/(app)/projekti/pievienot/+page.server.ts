import { db } from '$lib/server/db';
import { uploadUrlPath } from '$lib/server/file-download';
import { safeUserColumns } from '$lib/server/auth';
import { getClientScope, assertClientAccess } from '$lib/server/task-access';
import { task, taskMaterial, taskProduct, file, taskAssignee } from '$lib/server/db/schema';
import { fail, redirect } from '@sveltejs/kit';
import { writeFile } from 'fs/promises';
import type { Actions, PageServerLoad } from './$types';
import {
	ensureUploadsDir,
	getUploadPath,
	makeTimestampFilename,
	toUploadsUrl
} from '$lib/server/upload-storage';

export const load: PageServerLoad = async ({ locals }) => {
	const clientScope = await getClientScope(locals);
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

	const userClientId = clientScope?.[0] ?? null;
	const clients = await db.query.client.findMany({
		where: (c, { inArray }) => (clientScope === null ? undefined : inArray(c.id, clientScope)),
		columns: { id: true, name: true, email: true, phone: true }
	});
	const users = await db.query.user.findMany({
		where: (u, { eq }) => (clientScope === null ? undefined : eq(u.type, 'admin')),
		columns: { id: true, name: true, type: true }
	});
	const materials = await db.query.material.findMany({
		columns: { id: true, title: true, article: true, image: true, remaining: true }
	});
	const rawProducts = await db.query.product.findMany({
		with: {
			translations: true,
			clientPrices: {
				where: (cp, { inArray }) =>
					clientScope === null ? undefined : inArray(cp.clientId, clientScope)
			}
		}
	});

	// Attach clientPrice for the current user's client (if they are of type client)
	const products = rawProducts.map((p) => ({
		...p,
		clientPrice: userClientId
			? (p.clientPrices.find((cp) => cp.clientId === userClientId)?.price ?? null)
			: null
	}));

	return {
		tabs,
		clients,
		users,
		materials,
		products,
		userClientId
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const userId = user.id;

		// Find default tab (First shared tab in first group)
		const firstGroup = await db.query.tabGroup.findFirst({
			orderBy: (groups, { asc }) => [asc(groups.sortOrder)],
			with: {
				tabs: {
					orderBy: (tabs, { asc }) => [asc(tabs.sortOrder)],
					limit: 1
				}
			}
		});

		const defaultTab = firstGroup?.tabs[0];

		if (!defaultTab) {
			return fail(400, { error: 'No default tab found. Please ask an admin to create a tab.' });
		}

		const formData = await request.formData();
		const title = formData.get('title') as string;
		const description = formData.get('description') as string;
		// Tab ID comes from default tab now
		const tabId = defaultTab.id;
		const clientId = formData.get('clientId') ? Number(formData.get('clientId')) : null;
		const assignedToUserIdsStr = formData.get('assignedToUserIds') as string;
		await assertClientAccess(locals, clientId);
		const assignedToUserIds =
			user.type !== 'client' && assignedToUserIdsStr
				? assignedToUserIdsStr.split(',').filter((id) => id.trim() !== '')
				: [];
		const endDate = formData.get('endDate') as string;

		const seamstress = user.type === 'client' ? null : (formData.get('seamstress') as string);

		const materialIds =
			user.type === 'client'
				? []
				: formData.getAll('materials').map((id) => parseInt(id as string));
		const productIds = formData.getAll('productIds').map((id) => parseInt(id as string));
		const productCounts = formData
			.getAll('productCounts')
			.map((count) => parseInt(count as string));

		// Calculate total count from products
		let calculatedCount = 0;
		let calculatedPrice = 0;
		if (productCounts.length > 0) {
			calculatedCount = productCounts.reduce((a, b) => a + b, 0);

			if (productIds.length > 0) {
				const selectedProducts = await db.query.product.findMany({
					where: (p, { inArray }) => inArray(p.id, productIds),
					with: { clientPrices: true }
				});

				const userLinkedClientId = user.type === 'client' ? clientId : null;

				// Build a price map (clientPrice > price > cost fallback)
				calculatedPrice = productIds.reduce((total, id, index) => {
					const prod = selectedProducts.find((p) => p.id === id);
					if (!prod) return total;
					const clientPriceEntry = userLinkedClientId
						? prod.clientPrices.find((cp) => cp.clientId === userLinkedClientId)
						: null;
					const effectivePrice = clientPriceEntry?.price ?? prod.price;
					const count = productCounts[index] || 0;
					return total + effectivePrice * count;
				}, 0);
			}
		}

		const customPriceStr = formData.get('customPrice') as string;
		let finalPrice = calculatedPrice;
		if (user.type !== 'client' && customPriceStr && customPriceStr.trim() !== '') {
			const parsed = parseFloat(customPriceStr);
			if (!isNaN(parsed)) {
				finalPrice = Math.round(parsed * 100);
			}
		}

		// Files (Not supported by storage yet, logging for now)

		const preview = formData.get('preview') as File | null;
		let previewUrl: string | null = null;

		if (preview && preview.size > 0) {
			await ensureUploadsDir();
			const fileName = makeTimestampFilename(preview.name);
			const filePath = getUploadPath(fileName);
			const buffer = Buffer.from(await preview.arrayBuffer());
			await writeFile(filePath, buffer);
			previewUrl = toUploadsUrl(fileName);
		}

		if (!title) {
			return fail(400, { missing: true, error: 'Title is required' });
		}

		try {
			const [newTask] = await db
				.insert(task)
				.values({
					title,
					description,
					tabId,
					clientId,
					createdById: userId,
					endDate,
					price: finalPrice,
					count: calculatedCount,
					seamstress: seamstress || null,
					preview: previewUrl,
					isDone: false
				})
				.returning();

			if (newTask) {
				if (assignedToUserIds.length > 0) {
					const assigneesToInsert = assignedToUserIds.map((id) => ({
						taskId: newTask.id,
						userId: id
					}));
					await db.insert(taskAssignee).values(assigneesToInsert);
				}

				// Filter out invalid material IDs and check length
				const materialsToInsert = materialIds
					.filter((id) => !isNaN(id) && id > 0)
					.map((materialId) => ({
						taskId: newTask.id,
						materialId
					}));

				if (materialsToInsert.length > 0) {
					await db.insert(taskMaterial).values(materialsToInsert);
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

			// Emit Event
			const fullTask = await db.query.task.findFirst({
				where: (t, { eq }) => eq(t.id, newTask.id),
				with: {
					tab: true,
					client: true,
					creator: { columns: safeUserColumns },
					assignees: { with: { user: { columns: safeUserColumns } } }
				}
			});
			// Dynamic import to avoid circular dep issues during init if any, though here it's fine.
			const { taskEvents } = await import('$lib/server/events');
			taskEvents.emitTaskUpdate(
				fullTask,
				'create',
				fullTask?.assignees?.map((a: { userId: string }) => a.userId) ?? []
			);

			// Handle File Uploads
			const filesJson = formData.get('files');
			if (typeof filesJson === 'string') {
				try {
					const uploadedFiles = JSON.parse(filesJson);
					if (Array.isArray(uploadedFiles) && uploadedFiles.length > 0) {
						for (const entry of uploadedFiles) uploadUrlPath(entry.path);
						await db.insert(file).values(
							uploadedFiles.map((f) => ({
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
		} catch (err) {
			console.error(err);
			return fail(500, { error: 'Failed to create task' });
		}

		throw redirect(303, '/projekti'); // Redirect to projects list
	}
};
