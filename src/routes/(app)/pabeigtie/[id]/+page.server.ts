import { db } from '$lib/server/db';
import { task, invoice } from '$lib/server/db/schema';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { eq } from 'drizzle-orm';
import { assertTaskAccess, getClientScope } from '$lib/server/task-access';
import { safeUserColumns } from '$lib/server/auth';
import { productionFileIds } from '$lib/server/production-projects';

export const load: PageServerLoad = async ({ params, locals }) => {
	const taskId = Number(params.id);
	await assertTaskAccess(locals, taskId);
	const clientScope = await getClientScope(locals);

	const [clients, users, materials, products] = await Promise.all([
		db.query.client.findMany({
			where: (c, { inArray }) => (clientScope === null ? undefined : inArray(c.id, clientScope)),
			columns: { id: true, name: true, email: true, phone: true }
		}),
		db.query.user.findMany({
			where: (u, { eq }) => eq(u.type, 'admin'),
			columns: { id: true, name: true, type: true }
		}),
		db.query.material.findMany({
			columns: { id: true, title: true, article: true, image: true, remaining: true }
		}),
		db.query.product.findMany({
			with: {
				translations: true,
				clientPrices: {
					where: (cp, { inArray }) =>
						clientScope === null ? undefined : inArray(cp.clientId, clientScope)
				}
			}
		})
	]);

	const item = await db.query.task.findFirst({
		where: eq(task.id, taskId),
		with: {
			assignees: { with: { user: { columns: safeUserColumns } } },
			taskMaterials: { with: { material: true } },
			taskProducts: { with: { product: true } },
			files: true,
			history: {
				with: { user: { columns: { name: true } } },
				orderBy: (history, { desc }) => [desc(history.createdAt)]
			}
		}
	});

	if (!item) {
		throw redirect(303, '/pabeigtie');
	}

	const productionFiles = await productionFileIds(taskId);
	item.files = item.files.filter((entry) => !productionFiles.has(entry.id));

	const userClientId = clientScope === null ? null : item.clientId;
	if (locals.user && locals.user.type === 'client') {
		if (item.history) {
			item.history = item.history.filter((h) => {
				if (h.changeData) {
					try {
						const changes = JSON.parse(h.changeData);
						if (Array.isArray(changes)) {
							const filteredChanges = changes.filter((c) => c.field !== 'seamstress');
							if (filteredChanges.length === 0) return false;
							h.changeData = JSON.stringify(filteredChanges);
						}
					} catch {
						// Keep legacy history entries when their change data cannot be parsed.
					}
				}
				return true;
			});
		}
	}

	const productsWithClientPrice = products.map((p) => ({
		...p,
		clientPrice: userClientId
			? (p.clientPrices.find((cp: { clientId: number }) => cp.clientId === userClientId)?.price ??
				null)
			: null
	}));

	const taskInvoices = await db.query.invoice.findMany({
		where: eq(invoice.taskId, taskId)
	});

	return {
		item,
		clients,
		users,
		materials,
		products: productsWithClientPrice,
		userClientId,
		taskInvoices
	};
};
