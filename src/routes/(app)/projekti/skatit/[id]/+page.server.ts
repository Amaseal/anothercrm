// Copied from labot server file, removed actions
import { db } from '$lib/server/db';
import { task, material, product, taskMaterial, taskProduct, file, invoice, userClient } from '$lib/server/db/schema';
import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { eq, and, inArray, desc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params, locals }) => {
    const taskId = Number(params.id);

    // Fetch required data for dropdowns
    const clients = await db.query.client.findMany();
    const users = await db.query.user.findMany({
        where: (u, { eq }) => eq(u.type, 'admin')
    });
    const materials = await db.query.material.findMany();
    const products = await db.query.product.findMany({
        with: {
            translations: true,
            clientPrices: true
        }
    });

    // Fetch the task to view
    const item = await db.query.task.findFirst({
        where: eq(task.id, taskId),
        with: {
            taskMaterials: {
                with: {
                    material: true
                }
            },
            taskProducts: {
                with: {
                    product: true
                }
            },
            files: true,
            history: {
                with: {
                    user: true
                },
                orderBy: (history, { desc }) => [desc(history.createdAt)]
            }
        }
    });

    if (!item) {
        throw redirect(303, '/projekti');
    }

    let userClientId: number | null = null;
    if (locals.user && locals.user.type === 'client') {
        const { userClient } = await import('$lib/server/db/schema');
        const result = await db
            .select({ clientId: userClient.clientId })
            .from(userClient)
            .where(eq(userClient.userId, locals.user.id))
            .limit(1);

        if (result.length > 0) {
            userClientId = result[0].clientId;
        }

        // Filter history for clients: hide 'seamstress' changes
        if (item.history) {
            item.history = item.history.filter((h) => {
                if (h.changeData) {
                    try {
                        const changes = JSON.parse(h.changeData);
                        if (Array.isArray(changes)) {
                            const filteredChanges = changes.filter((c: any) => c.field !== 'seamstress');

                            // If no changes remain after filtering, and it was structured data, hide the entry
                            if (filteredChanges.length === 0) {
                                return false;
                            }

                            h.changeData = JSON.stringify(filteredChanges);
                        }
                    } catch (e) {
                        // ignore parse errors
                    }
                }
                return true;
            });
        }
    }

    // Attach clientPrice for the current user's client
    const productsWithClientPrice = products.map((p) => ({
        ...p,
        clientPrice: userClientId
            ? (p.clientPrices.find((cp: { clientId: number }) => cp.clientId === userClientId)?.price ?? null)
            : null
    }));

    return {
        item,
        clients,
        users,
        materials,
        products: productsWithClientPrice,
        userClientId
    };
};
