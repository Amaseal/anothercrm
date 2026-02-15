import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/lib/server/db/schema';
import { eq, sql, inArray } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import * as xlsx from 'xlsx';

// Load env
const envPath = path.resolve('.env');
let databaseUrl = process.env.DATABASE_URL;

if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    for (const line of envConfig.split('\n')) {
        const [key, value] = line.split('=');
        if (key && value && key.trim() === 'DATABASE_URL') {
            databaseUrl = value.trim().replace(/"/g, '');
        }
    }
}

if (!databaseUrl) {
    console.error('DATABASE_URL not found in .env');
    process.exit(1);
}

const client = postgres(databaseUrl);
const db = drizzle(client, { schema });

// Determine the path to the exports directory
const EXPORTS_DIR = path.resolve('exports');

// Helper to read CSV with explicit UTF-8
function readCsv(filename: string): any[] {
    const filePath = path.join(EXPORTS_DIR, filename);
    if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        return [];
    }
    // Read as UTF-8 string
    const fileContent = fs.readFileSync(filePath, 'utf8');
    // Parse string
    const workbook = xlsx.read(fileContent, { type: 'string' });
    const sheetName = workbook.SheetNames[0];
    return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
}

function safeDate(dateStr: any): Date {
    if (!dateStr) return new Date();

    let sanitized = String(dateStr).trim();
    // Fix known corruption: 202ser5 -> 2025
    sanitized = sanitized.replace('202ser5', '2025');
    // Remove trailing dot
    if (sanitized.endsWith('.')) {
        sanitized = sanitized.slice(0, -1);
    }

    const d = new Date(sanitized);
    if (isNaN(d.getTime())) {
        console.warn(`Invalid date encountered: "${dateStr}". Fallback to now.`);
        return new Date();
    }
    return d;
}

function safeDateOrNull(dateStr: any): Date | null {
    if (!dateStr) return null;
    let sanitized = String(dateStr).trim();
    if (sanitized === '') return null;

    // Fix known corruption
    sanitized = sanitized.replace('202ser5', '2025');

    const d = new Date(sanitized);
    if (isNaN(d.getTime())) {
        console.warn(`Invalid nullable date: "${dateStr}". Returning null.`);
        return null; // Return null instead of now for optional dates like endDate
    }
    return d;
}

async function cleanup() {
    console.log('Cleaning up previous legacy import data...');

    // 1. Delete ALL Legacy Import Tab Groups
    const legacyGroups = await db.query.tabGroupTranslation.findMany({
        where: eq(schema.tabGroupTranslation.name, 'Legacy Import')
    });

    console.log(`Found ${legacyGroups.length} legacy groups to delete.`);

    for (const legacyGroup of legacyGroups) {
        console.log(`Processing Legacy Group ${legacyGroup.tabGroupId}...`);

        const tabs = await db.query.tab.findMany({
            where: eq(schema.tab.groupId, legacyGroup.tabGroupId)
        });

        for (const t of tabs) {
            console.log(`  Deleting tasks for tab ${t.id}...`);
            // Find tasks to cleanup their dependencies
            const tasks = await db.query.task.findMany({
                where: eq(schema.task.tabId, t.id)
            });

            // Batch delete dependencies if possible or loop
            for (const task of tasks) {
                await db.delete(schema.taskMaterial).where(eq(schema.taskMaterial.taskId, task.id));
                await db.delete(schema.taskProduct).where(eq(schema.taskProduct.taskId, task.id));
                await db.delete(schema.file).where(eq(schema.file.taskId, task.id));
            }

            // Now delete tasks
            if (tasks.length > 0) {
                await db.delete(schema.task).where(eq(schema.task.tabId, t.id));
            }

            await db.delete(schema.tabTranslation).where(eq(schema.tabTranslation.tabId, t.id));
            await db.delete(schema.tab).where(eq(schema.tab.id, t.id));
        }

        await db.delete(schema.tabGroupTranslation).where(eq(schema.tabGroupTranslation.tabGroupId, legacyGroup.tabGroupId));
        await db.delete(schema.tabGroup).where(eq(schema.tabGroup.id, legacyGroup.tabGroupId));
        console.log(`Deleted Legacy Import tab group ${legacyGroup.tabGroupId}.`);
    }

    // 2. Content-Based Cleanup with Dependency Handling

    // Clean Clients
    console.log('Cleaning up Clients based on CSV names...');
    const rawClients = readCsv('clients.csv');
    const clientNames = rawClients.map(c => c.name).filter(n => n);

    // We fetch all clients that match names to get their IDs
    if (clientNames.length > 0) {
        const clientsToDelete = await db.query.client.findMany({
            where: inArray(schema.client.name, clientNames)
        });

        if (clientsToDelete.length > 0) {
            const clientIds = clientsToDelete.map(c => c.id);
            console.log(`Found ${clientIds.length} existing clients to replace.`);

            // Delete Invoices
            await db.delete(schema.invoice).where(inArray(schema.invoice.clientId, clientIds));
            // Unlink Tasks (Set clientId to null)
            await db.update(schema.task).set({ clientId: null }).where(inArray(schema.task.clientId, clientIds));
            // Delete Clients
            await db.delete(schema.client).where(inArray(schema.client.id, clientIds));
        }
    }

    // Clean Materials
    console.log('Cleaning up Materials based on CSV titles...');
    const rawMaterials = readCsv('materials.csv');
    const materialTitles = rawMaterials.map(m => m.title).filter(t => t);

    if (materialTitles.length > 0) {
        const materialsToDelete = await db.query.material.findMany({
            where: inArray(schema.material.title, materialTitles)
        });

        if (materialsToDelete.length > 0) {
            const matIds = materialsToDelete.map(m => m.id);
            // Delete Task Materials
            await db.delete(schema.taskMaterial).where(inArray(schema.taskMaterial.materialId, matIds));
            // Delete Materials
            await db.delete(schema.material).where(inArray(schema.material.id, matIds));
        }
    }

    // Clean Products
    console.log('Cleaning up Products based on CSV titles...');
    const rawProducts = readCsv('products.csv');
    const productTitles = rawProducts.map(p => p.title).filter(t => t);

    if (productTitles.length > 0) {
        const productsToDelete = await db.query.product.findMany({
            where: inArray(schema.product.title, productTitles)
        });

        if (productsToDelete.length > 0) {
            const prodIds = productsToDelete.map(p => p.id);
            // Delete Task Products
            await db.delete(schema.taskProduct).where(inArray(schema.taskProduct.productId, prodIds));
            // Delete Products
            await db.delete(schema.product).where(inArray(schema.product.id, prodIds));
        }
    }

    console.log('Cleanup completed check.');
}


async function main() {
    await cleanup();
    console.log('Starting legacy data import...');

    // 1. Import Users
    const users = readCsv('users.csv');
    console.log(`Found ${users.length} users.`);
    const userIdMap = new Map<string, string>(); // Old ID -> New/Real ID

    for (const u of users) {
        try {
            const existingUser = await db.query.user.findFirst({
                where: eq(schema.user.email, u.email)
            });

            if (existingUser) {
                console.log(`User ${u.email} already exists. Updating Name and promoting to Admin. Mapping ID.`);

                await db.update(schema.user)
                    .set({
                        name: u.name,
                        type: 'admin'
                    })
                    .where(eq(schema.user.email, u.email));

                userIdMap.set(u.id, existingUser.id);
            } else {
                try {
                    await db.insert(schema.user).values({
                        id: u.id,
                        email: u.email,
                        password: u.password,
                        name: u.name,
                        type: 'admin',
                    });
                    userIdMap.set(u.id, u.id);

                    if (u.nextcloud_username || u.nextcloud_password) {
                        await db.insert(schema.settings).values({
                            id: crypto.randomUUID(),
                            userId: u.id,
                            language: 'lv',
                            nextcloud_username: u.nextcloud_username,
                            nextcloud_password: u.nextcloud_password
                        }).onConflictDoNothing();
                    }

                } catch (insertError) {
                    console.error(`Failed to insert user ${u.email} with old ID.`, insertError);
                }
            }
        } catch (e) {
            console.error(`Failed to process user ${u.email}:`, e);
        }
    }

    // 2. Import Clients
    const clients = readCsv('clients.csv');
    console.log(`Found ${clients.length} clients.`);
    const clientIdMap = new Map<number, number>(); // Old ID -> New ID

    for (const c of clients) {
        try {
            let email = c.email;
            let phone = c.phone;
            if (!email && !phone) {
                email = `missing_contact_${c.id}@legacy-import.local`;
                console.warn(`Client ${c.name} (ID ${c.id}) has no email or phone. Using placeholder: ${email}`);
            }

            const result = await db.insert(schema.client).values({
                name: c.name,
                email: email || null,
                phone: phone || null,
                description: c.description,
                address: c.address,
                type: c.type === 'BTB' ? 'BTB' : 'BTC',
                totalOrdered: c.totalOrdered ? parseInt(c.totalOrdered) : 0,
                created_at: safeDate(c.created_at),
                updated_at: safeDate(c.updated_at)
            }).returning({ id: schema.client.id });

            if (result[0]) {
                clientIdMap.set(parseInt(c.id), result[0].id);
            }
        } catch (e) {
            console.error(`Failed to import client ${c.name}:`, e);
        }
    }

    // 3. Create "Legacy Import" Tab Group and "Legacy" Tab
    const groupResult = await db.insert(schema.tabGroup).values({
        color: '#808080',
        sortOrder: 999
    }).returning({ id: schema.tabGroup.id });
    const tabGroupId = groupResult[0].id;

    await db.insert(schema.tabGroupTranslation).values({
        tabGroupId: tabGroupId,
        language: 'lv', // Default language
        name: 'Legacy Import'
    });

    const tabResult = await db.insert(schema.tab).values({
        groupId: tabGroupId,
        color: '#808080',
        sortOrder: 0
    }).returning({ id: schema.tab.id });
    const legacyTabId = tabResult[0].id;

    await db.insert(schema.tabTranslation).values({
        tabId: legacyTabId,
        language: 'lv',
        name: 'Legacy'
    });

    const oldDoneTabId = 1;

    // 4. Import Materials
    const materials = readCsv('materials.csv');
    console.log(`Found ${materials.length} materials.`);
    const materialIdMap = new Map<number, number>();

    for (const m of materials) {
        try {
            const result = await db.insert(schema.material).values({
                title: m.title,
                article: m.article,
                image: m.image,
                manufacturer: m.manufacturer,
                gsm: m.gsm ? String(m.gsm) : null,
                width: m.width ? String(m.width) : null,
                remaining: m.remaining ? parseInt(m.remaining) : 0,
                created_at: safeDate(m.created_at),
                updated_at: safeDate(m.updated_at)
            }).returning({ id: schema.material.id });
            if (result[0]) {
                materialIdMap.set(parseInt(m.id), result[0].id);
            }
        } catch (e) {
            console.error(`Failed to import material ${m.title}:`, e);
        }
    }

    // 5. Import Products
    const products = readCsv('products.csv');
    console.log(`Found ${products.length} products.`);
    const productIdMap = new Map<number, number>();

    for (const p of products) {
        try {
            const result = await db.insert(schema.product).values({
                title: p.title,
                description: p.description,
                cost: p.cost ? parseInt(p.cost) : 0,
                created_at: safeDate(p.created_at),
                updated_at: safeDate(p.updated_at)
            }).returning({ id: schema.product.id });
            if (result[0]) {
                productIdMap.set(parseInt(p.id), result[0].id);
            }
        } catch (e) {
            console.error(`Failed to import product ${p.title}:`, e);
        }
    }

    // 6. Import Tasks
    const tasks = readCsv('tasks.csv');
    console.log(`Found ${tasks.length} tasks.`);
    const taskIdMap = new Map<number, number>();

    for (const t of tasks) {
        const isDone = parseInt(t.tabId) === oldDoneTabId;

        try {
            const newClientId = t.clientId ? clientIdMap.get(parseInt(t.clientId)) : null;
            const createdBy = t.managerId ? userIdMap.get(t.managerId) : null;
            const assignedTo = t.responsiblePersonId ? userIdMap.get(t.responsiblePersonId) : null;

            const result = await db.insert(schema.task).values({
                title: t.title,
                description: t.description,
                tabId: legacyTabId, // All go to legacy tab
                clientId: newClientId,
                createdById: createdBy, // mapped
                assignedToUserId: assignedTo, // mapped
                seamstress: t.seamstress,
                count: t.count ? parseInt(t.count) : null,
                endDate: safeDateOrNull(t.endDate), // Use safeDateOrNull for endDate
                isDone: isDone,
                isPrinted: t.isPrinted === 'true' || t.isPrinted === true,
                price: t.price ? parseInt(t.price) : null,
                preview: t.preview,
                created_at: safeDate(t.created_at),
                updated_at: safeDate(t.updated_at)
            }).returning({ id: schema.task.id });

            if (result[0]) {
                taskIdMap.set(parseInt(t.id), result[0].id);
            }
        } catch (e) {
            console.error(`Failed to import task ${t.id}:`, e);
        }
    }

    // 7. Import Task Materials (Junction)
    const taskMaterials = readCsv('task_materials.csv');
    console.log(`Found ${taskMaterials.length} task materials.`);

    for (const tm of taskMaterials) {
        try {
            const newTaskId = taskIdMap.get(parseInt(tm.taskId));
            const newMaterialId = materialIdMap.get(parseInt(tm.materialId));

            if (newTaskId && newMaterialId) {
                await db.insert(schema.taskMaterial).values({
                    taskId: newTaskId,
                    materialId: newMaterialId,
                    created_at: safeDate(tm.created_at),
                    updated_at: safeDate(tm.updated_at)
                }).onConflictDoNothing();
            }
        } catch (e) {
            console.error('Failed to import task material junction', e);
        }
    }

    // 8. Import Task Products (Junction)
    const taskProducts = readCsv('task_products.csv');
    console.log(`Found ${taskProducts.length} task products.`);

    for (const tp of taskProducts) {
        try {
            const newTaskId = taskIdMap.get(parseInt(tp.taskId));
            const newProductId = productIdMap.get(parseInt(tp.productId));

            if (newTaskId && newProductId) {
                await db.insert(schema.taskProduct).values({
                    taskId: newTaskId,
                    productId: newProductId,
                    count: tp.count ? parseInt(tp.count) : 1,
                    created_at: safeDate(tp.created_at),
                    updated_at: safeDate(tp.updated_at)
                }).onConflictDoNothing();
            }
        } catch (e) {
            console.error('Failed to import task product junction', e);
        }
    }

    // 9. Import Files
    const files = readCsv('files.csv');
    console.log(`Found ${files.length} files.`);

    for (const f of files) {
        try {
            const newTaskId = f.taskId ? taskIdMap.get(parseInt(f.taskId)) : null;

            await db.insert(schema.file).values({
                filename: f.filename,
                downloadUrl: f.downloadUrl,
                size: f.size ? parseInt(f.size) : 0,
                taskId: newTaskId,
                created_at: safeDate(f.created_at),
                updated_at: safeDate(f.updated_at)
            });
        } catch (e) {
            console.error('Failed to import file', e);
        }
    }

    console.log('Import completed!');
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
