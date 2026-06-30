// Skipping edit for now to investigate where tab moves happen.
import { db } from '$lib/server/db';
import { task, client, user, material, product, taskMaterial, taskProduct, file, invoice, userClient, taskAssignee } from '$lib/server/db/schema';
import { fail, redirect } from '@sveltejs/kit';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import type { Actions, PageServerLoad } from './$types';
import { eq, and, inArray, desc } from 'drizzle-orm';
import {
    ensureUploadsDir,
    getUploadPath,
    makeTimestampFilename,
    toUploadsUrl
} from '$lib/server/upload-storage';

export const load: PageServerLoad = async ({ params, locals }) => {
    const taskId = Number(params.id);

    // Fetch dropdown data in parallel with restricted columns
    const [clients, users, materials, products] = await Promise.all([
        db.query.client.findMany({ columns: { id: true, name: true, email: true, phone: true } }),
        db.query.user.findMany({ columns: { id: true, name: true, type: true } }),
        db.query.material.findMany({ columns: { id: true, title: true, article: true, unit: true, price: true, image: true, remaining: true } }),
        db.query.product.findMany({ with: { translations: true, clientPrices: true } })
    ]);

    // Fetch the task to edit
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
            assignees: {
                with: { user: true }
            },
            history: {
                with: {
                    user: { columns: { name: true } }
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

export const actions: Actions = {
    default: async ({ request, locals, params }) => {
        const user = locals.user;
        if (!user) {
            return fail(401, { error: 'Unauthorized' });
        }

        const taskId = Number(params.id);
        const formData = await request.formData();
        const title = formData.get('title') as string;
        const description = formData.get('description') as string;
        const clientId = formData.get('clientId') ? parseInt(formData.get('clientId') as string) : null;
        const assignedToUserIdsStr = formData.get('assignedToUserIds') as string;
        const assignedToUserIds = assignedToUserIdsStr ? assignedToUserIdsStr.split(',').filter(id => id.trim() !== '') : [];
        const createdById = formData.get('createdById') as string;
        const endDate = formData.get('endDate') as string;
        // const seamstress = formData.get('seamstress') as string; // User removed seamstress in pievienot? code shows it line 63.
        const seamstress = formData.get('seamstress') as string;

        const materialIds = formData.getAll('materials').map(id => parseInt(id as string));
        // Product list logic
        const productIds = formData.getAll('productIds').map(id => parseInt(id as string));
        const productCounts = formData.getAll('productCounts').map(count => parseInt(count as string));

        // Calculate total count and price
        let calculatedCount = 0;
        let calculatedPrice = 0;
        if (productCounts.length > 0) {
            calculatedCount = productCounts.reduce((a, b) => a + b, 0);

            if (productIds.length > 0) {
                const selectedProducts = await db.query.product.findMany({
                    where: (p, { inArray }) => inArray(p.id, productIds),
                    with: { clientPrices: true }
                });

                // Resolve clientId for the current user (if type 'client')
                let userLinkedClientId: number | null = null;
                if (user.type === 'client') {
                    const ucResult = await db
                        .select({ clientId: userClient.clientId })
                        .from(userClient)
                        .where(eq(userClient.userId, user.id))
                        .limit(1);
                    if (ucResult.length > 0) {
                        userLinkedClientId = ucResult[0].clientId;
                    }
                }

                calculatedPrice = productIds.reduce((total, id, index) => {
                    const prod = selectedProducts.find(p => p.id === id);
                    if (!prod) return total;
                    const clientPriceEntry = userLinkedClientId
                        ? prod.clientPrices.find((cp: { clientId: number }) => cp.clientId === userLinkedClientId)
                        : null;
                    const effectivePrice = clientPriceEntry?.price ?? prod.price;
                    const count = productCounts[index] || 0;
                    return total + (effectivePrice * count);
                }, 0);
            }
        }

        const customPriceStr = formData.get('customPrice') as string;
        let finalPrice = calculatedPrice;
        if (customPriceStr && customPriceStr.trim() !== '') {
            const parsed = parseFloat(customPriceStr);
            if (!isNaN(parsed)) {
                finalPrice = Math.round(parsed * 100);
            }
        }

        if (!title) {
            return fail(400, { missing: true, error: 'Title is required' });
        }

        // Fetch old task data for history and preview deletion - moved to top level
        const oldTask = await db.query.task.findFirst({
            where: eq(task.id, taskId),
            with: {
                taskMaterials: true,
                taskProducts: true,
                assignees: true
            }
        });

        if (!oldTask) {
            return fail(404, { error: 'Task not found' });
        }

        // Handle Preview Image
        const preview = formData.get('preview') as File | null;
        let previewUrl: string | undefined = undefined; // undefined means no change

        if (preview && preview.size > 0) {
            // New preview uploaded
            await ensureUploadsDir();
            const fileName = makeTimestampFilename(preview.name);
            const filePath = getUploadPath(fileName);
            const buffer = Buffer.from(await preview.arrayBuffer());
            await writeFile(filePath, buffer);
            previewUrl = toUploadsUrl(fileName);


            if (oldTask.preview) {
                const relativePath = oldTask.preview.startsWith('/') ? oldTask.preview.substring(1) : oldTask.preview;
                await unlink(join(process.cwd(), relativePath)).catch(e => console.error('Failed to delete old preview', e));
            }
        }

        try {
            await db.update(task).set({
                title,
                description,
                clientId,
                endDate,
                price: finalPrice,
                count: calculatedCount,
                seamstress: seamstress || null,
                ...(previewUrl ? { preview: previewUrl } : {})
            }).where(eq(task.id, taskId));

            // Update Relations: Delete all and re-insert is simplest strategy for now
            // Materials
            await db.delete(taskMaterial).where(eq(taskMaterial.taskId, taskId));
            if (materialIds.length > 0) {
                await db.insert(taskMaterial).values(
                    materialIds.map(materialId => ({
                        taskId,
                        materialId
                    }))
                );
            }

            // Products
            await db.delete(taskProduct).where(eq(taskProduct.taskId, taskId));
            if (productIds.length > 0) {
                const productsToInsert = productIds
                    .map((id, index) => ({
                        taskId,
                        productId: id,
                        count: productCounts[index] || 1
                    }))
                    .filter((p) => p.productId > 0);

                if (productsToInsert.length > 0) {
                    await db.insert(taskProduct).values(productsToInsert);
                }
            }

            // Assignees
            await db.delete(taskAssignee).where(eq(taskAssignee.taskId, taskId));
            if (assignedToUserIds.length > 0) {
                const assigneesToInsert = assignedToUserIds.map((id) => ({
                    taskId,
                    userId: id
                }));
                await db.insert(taskAssignee).values(assigneesToInsert);
            }

            // Handle File Uploads (Sync logic)
            const filesJson = formData.get('files');
            if (typeof filesJson === 'string') {
                const submittedFiles = JSON.parse(filesJson);

                if (Array.isArray(submittedFiles)) {
                    // 1. Get current files from DB
                    const currentDbFiles = await db.query.file.findMany({
                        where: eq(file.taskId, taskId)
                    });

                    // normalize paths (remove leading slash if needed for comparison, but keep consistency)
                    // In DB: downloadUrl. FileUpload: path.
                    // Assuming consistency.

                    const submittedPaths = new Set(submittedFiles.map((f: any) => f.path));

                    // 2. Identify files to delete (in DB but not in submission)
                    const idsToDelete = currentDbFiles
                        .filter(f => !submittedPaths.has(f.downloadUrl))
                        .map(f => f.id);

                    if (idsToDelete.length > 0) {
                        await db.delete(file).where(inArray(file.id, idsToDelete));
                    }

                    // 3. Identify files to insert (in submission but not in DB)
                    // Note: A file might be renamed or something? Assuming path is unique ID here.
                    const currentPaths = new Set(currentDbFiles.map(f => f.downloadUrl));

                    const filesToInsert = submittedFiles
                        .filter((f: any) => !currentPaths.has(f.path))
                        .map((f: any) => ({
                            filename: f.name,
                            downloadUrl: f.path,
                            size: f.size || 0,
                            taskId: taskId,
                            created_at: new Date()
                        }));

                    if (filesToInsert.length > 0) {
                        await db.insert(file).values(filesToInsert);
                    }
                }
            }




            // Record History
            const changes: any[] = [];

            if (oldTask.title !== title) changes.push({ field: 'title', from: oldTask.title, to: title });
            if (oldTask.description !== description) changes.push({ field: 'description', from: oldTask.description, to: description });
            if (oldTask.clientId !== clientId) changes.push({ field: 'client', from: oldTask.clientId, to: clientId });

            const oldAssignees = (oldTask.assignees || []).map((a: any) => a.userId).sort().join(',');
            const newAssignees = [...assignedToUserIds].sort().join(',');
            if (oldAssignees !== newAssignees) {
                changes.push({ field: 'assigned', from: oldAssignees || null, to: newAssignees || null });
            }

            if (oldTask.endDate !== endDate) changes.push({ field: 'dueDate', from: oldTask.endDate, to: endDate });
            if (oldTask.seamstress !== (seamstress || null)) changes.push({ field: 'seamstress', from: oldTask.seamstress, to: seamstress || null });
            if (oldTask.price !== finalPrice) changes.push({ field: 'price', from: oldTask.price, to: finalPrice });

            // Note: Material and Product changes are more complex to track individually in this simple diff, 
            // but we can track that "materials updated" or similar if we want.
            // For now, let's just track the main fields.

            if (changes.length > 0) {
                const { recordHistory } = await import('$lib/server/history');
                await recordHistory(taskId, user.id, 'updated', changes, 'Task updated');
            }

        } catch (err) {
            console.error(err);
            return fail(500, { error: 'Failed to update task' });
        }

        throw redirect(303, '/projekti');
    }
};
