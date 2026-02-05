import { db } from '$lib/server/db';
import { task, material, product, taskMaterial, taskProduct, file, invoice } from '$lib/server/db/schema';
import { fail, redirect } from '@sveltejs/kit';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import type { Actions, PageServerLoad } from './$types';
import { eq, and, inArray } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params }) => {
    const taskId = Number(params.id);

    // Fetch required data for dropdowns
    const clients = await db.query.client.findMany();
    const users = await db.query.user.findMany();
    const materials = await db.query.material.findMany();
    const products = await db.query.product.findMany();

    // Fetch the task to edit
    const item = await db.query.task.findFirst({
        where: eq(task.id, taskId),
        with: {
            taskMaterials: true,
            taskProducts: true,
            files: true
        }
    });

    if (!item) {
        throw redirect(303, '/projekti');
    }

    return {
        item,
        clients,
        users,
        materials,
        products
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
        const assignedToUserId = formData.get('assignedToUserId') as string;
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
                    where: (p, { inArray }) => inArray(p.id, productIds)
                });

                const productCostMap = new Map(selectedProducts.map(p => [p.id, p.cost]));
                calculatedPrice = productIds.reduce((total, id, index) => {
                    const cost = productCostMap.get(id) || 0;
                    const count = productCounts[index] || 0;
                    return total + (cost * count);
                }, 0);
            }
        }

        // Handle Preview Image
        const preview = formData.get('preview') as File | null;
        let previewUrl: string | undefined = undefined; // undefined means no change

        if (preview && preview.size > 0) {
            // New preview uploaded
            const uploadDir = 'uploads';
            await mkdir(uploadDir, { recursive: true });
            const fileName = `${Date.now()}-${preview.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
            const filePath = join(uploadDir, fileName);
            const buffer = Buffer.from(await preview.arrayBuffer());
            await writeFile(filePath, buffer);
            previewUrl = `/uploads/${fileName}`;

            // Delete old preview if exists
            const oldTask = await db.query.task.findFirst({
                where: eq(task.id, taskId),
                columns: { preview: true }
            });
            if (oldTask?.preview) {
                const relativePath = oldTask.preview.startsWith('/') ? oldTask.preview.substring(1) : oldTask.preview;
                await unlink(join(process.cwd(), relativePath)).catch(e => console.error('Failed to delete old preview', e));
            }
        }

        if (!title) {
            return fail(400, { missing: true, error: 'Title is required' });
        }

        try {
            await db.update(task).set({
                title,
                description,
                clientId,
                assignedToUserId: assignedToUserId || null,
                createdById: createdById || null,
                endDate,
                price: calculatedPrice,
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

            // Note: Deleting existing files isn't in the UI for Edit yet unless they used the File manager separate logic?
            // For now we just add new files.

            // Emit Event
            const updatedTask = await db.query.task.findFirst({
                where: eq(task.id, taskId),
                with: {
                    tab: true,
                    client: true,
                    creator: true,
                    assignedToUser: true
                }
            });
            const { taskEvents } = await import('$lib/server/events');
            taskEvents.emitTaskUpdate(updatedTask, 'update');

        } catch (err) {
            console.error(err);
            return fail(500, { error: 'Failed to update task' });
        }

        throw redirect(303, '/projekti');
    }
};
