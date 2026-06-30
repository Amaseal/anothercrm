import { db } from '$lib/server/db';
import { task, invoice, userClient } from '$lib/server/db/schema';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { eq, desc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params, locals }) => {
    const taskId = Number(params.id);

    const [clients, users, materials, products] = await Promise.all([
        db.query.client.findMany({ columns: { id: true, name: true, email: true, phone: true } }),
        db.query.user.findMany({ where: (u, { eq }) => eq(u.type, 'admin'), columns: { id: true, name: true, type: true } }),
        db.query.material.findMany({ columns: { id: true, title: true, article: true, unit: true, price: true, image: true, remaining: true } }),
        db.query.product.findMany({ with: { translations: true, clientPrices: true } })
    ]);

    const item = await db.query.task.findFirst({
        where: eq(task.id, taskId),
        with: {
            assignees: { with: { user: true } },
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

    let userClientId: number | null = null;
    if (locals.user && locals.user.type === 'client') {
        const result = await db
            .select({ clientId: userClient.clientId })
            .from(userClient)
            .where(eq(userClient.userId, locals.user.id))
            .limit(1);

        if (result.length > 0) {
            userClientId = result[0].clientId;
        }

        if (item.history) {
            item.history = item.history.filter((h) => {
                if (h.changeData) {
                    try {
                        const changes = JSON.parse(h.changeData);
                        if (Array.isArray(changes)) {
                            const filteredChanges = changes.filter((c: any) => c.field !== 'seamstress');
                            if (filteredChanges.length === 0) return false;
                            h.changeData = JSON.stringify(filteredChanges);
                        }
                    } catch (e) {}
                }
                return true;
            });
        }
    }

    const productsWithClientPrice = products.map((p) => ({
        ...p,
        clientPrice: userClientId
            ? (p.clientPrices.find((cp: { clientId: number }) => cp.clientId === userClientId)?.price ?? null)
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
