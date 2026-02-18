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
    if (typeof dateStr === 'number') {
        return new Date((dateStr - 25569) * 86400 * 1000);
    }
    let sanitized = String(dateStr).trim();
    sanitized = sanitized.replace('202ser5', '2025');
    if (sanitized.endsWith('.')) sanitized = sanitized.slice(0, -1);
    const d = new Date(sanitized);
    if (isNaN(d.getTime())) return new Date();
    return d;
}

function safeDateOrNull(dateStr: any): Date | null {
    if (!dateStr) return null;
    if (typeof dateStr === 'number') {
        return new Date((dateStr - 25569) * 86400 * 1000);
    }
    let sanitized = String(dateStr).trim();
    if (sanitized === '') return null;
    sanitized = sanitized.replace('202ser5', '2025');
    const d = new Date(sanitized);
    if (isNaN(d.getTime())) return null;
    return d;
}

async function buildLookupMaps() {
    console.log('Building lookup maps for existing entities...');

    // Users: CSV ID -> DB ID
    const userMap = new Map<string, string>();
    const usersCsv = readCsv('users.csv');
    // We assume the DB has users with emails matching CSV.
    // AND we also need to account for the preserved user 'pkzehz4vqgej4izybrpjngh5'.
    // Best effort: Query all users from DB, map by Email.
    const allDbUsers = await db.query.user.findMany();
    const emailToIdMap = new Map<string, string>();
    for (const u of allDbUsers) {
        if (u.email) emailToIdMap.set(u.email.toLowerCase(), u.id);
    }

    for (const uCsv of usersCsv) {
        if (uCsv.email) {
            const dbId = emailToIdMap.get(uCsv.email.toLowerCase());
            if (dbId) {
                userMap.set(uCsv.id, dbId);
            }
        }
    }
    console.log(`Mapped ${userMap.size} users.`);

    // Materials: CSV ID -> DB ID
    // Map by Title.
    const materialMap = new Map<number, number>(); // CSV ID is likely number string
    const materialsCsv = readCsv('materials.csv');
    const allDbMaterials = await db.query.material.findMany();
    const titleToMatId = new Map<string, number>();
    for (const m of allDbMaterials) {
        titleToMatId.set(m.title, m.id);
    }

    for (const mCsv of materialsCsv) {
        const dbId = titleToMatId.get(mCsv.title);
        if (dbId) {
            materialMap.set(parseInt(mCsv.id), dbId);
        }
    }
    console.log(`Mapped ${materialMap.size} materials.`);

    // Products: CSV ID -> DB ID
    const productMap = new Map<number, number>();
    const productsCsv = readCsv('products.csv');
    const allDbProducts = await db.query.product.findMany();
    const titleToProdId = new Map<string, number>();
    for (const p of allDbProducts) {
        titleToProdId.set(p.title, p.id);
    }

    for (const pCsv of productsCsv) {
        const dbId = titleToProdId.get(pCsv.title);
        if (dbId) {
            productMap.set(parseInt(pCsv.id), dbId);
        }
    }
    console.log(`Mapped ${productMap.size} products.`);

    return { userMap, materialMap, productMap };
}

async function nukeClientsAndTasks() {
    console.log('Cleaning split tables (Clients/Tasks)...');

    // Dependencies first
    await db.delete(schema.taskMaterial);
    await db.delete(schema.taskProduct);
    await db.delete(schema.taskHistory);
    await db.delete(schema.taskEditSession);
    await db.delete(schema.file); // Assuming files are only task related here
    await db.delete(schema.invoice);

    await db.delete(schema.task);

    // Client dependencies
    await db.delete(schema.userClient);
    await db.delete(schema.client);

    console.log('Split tables cleaned.');
}

async function importClientsAndTasks(maps: { userMap: Map<string, string>, materialMap: Map<number, number>, productMap: Map<number, number> }) {
    console.log('Importing Clients and Tasks...');

    // 1. Clients
    const clients = readCsv('clients.csv');
    console.log(`Found ${clients.length} clients.`);
    const clientIdMap = new Map<number, number>();

    for (const c of clients) {
        try {
            let email = c.email;
            let phone = c.phone;
            if (!email && !phone) {
                email = `missing_contact_${c.id}@legacy-import.local`;
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

    // 2. Resolve "Legacy" Tab ID
    // Find or create 'Legacy Import' group and 'Legacy' tab?
    // User said "keep tabs", so assumption is they exist.
    // Try to find "Legacy" tab.
    let legacyTabId: number;

    // Find Tab Group 'Legacy Import' - check translations?
    // Assuming simple structure or just find any tab that looks like it.
    // Or just look for tab with translation 'Legacy'
    // But since we nuked them in previous script, and re-imported them, they should be there.
    // Unless user "kept tabs" means they kept the ones from the previous run.

    // Let's find tab by translation name 'Legacy'
    const legacyTabTrans = await db.query.tabTranslation.findFirst({
        where: eq(schema.tabTranslation.name, 'Legacy')
    });

    if (legacyTabTrans) {
        legacyTabId = legacyTabTrans.tabId;
        console.log(`Found existing Legacy Tab ID: ${legacyTabId}`);
    } else {
        console.log('Legacy Tab not found, creating...');
        // Create Group
        const groupResult = await db.insert(schema.tabGroup).values({
            color: '#808080',
            sortOrder: 999
        }).returning({ id: schema.tabGroup.id });
        const tabGroupId = groupResult[0].id;

        await db.insert(schema.tabGroupTranslation).values({
            tabGroupId: tabGroupId,
            language: 'lv',
            name: 'Legacy Import'
        });

        const tabResult = await db.insert(schema.tab).values({
            groupId: tabGroupId,
            color: '#808080',
            sortOrder: 0
        }).returning({ id: schema.tab.id });
        legacyTabId = tabResult[0].id;

        await db.insert(schema.tabTranslation).values({
            tabId: legacyTabId,
            language: 'lv',
            name: 'Legacy'
        });
    }

    const oldDoneTabId = 1;

    // 3. Tasks
    const tasks = readCsv('tasks.csv');
    console.log(`Found ${tasks.length} tasks.`);
    const taskIdMap = new Map<number, number>();

    for (const t of tasks) {
        const isDone = parseInt(t.tabId) === oldDoneTabId;

        try {
            const newClientId = t.clientId ? clientIdMap.get(parseInt(t.clientId)) : null;
            // Map Users using the map we built
            const createdBy = t.managerId ? maps.userMap.get(t.managerId) : null;
            // NOTE: t.responsiblePersonId might be same logic
            const assignedTo = t.responsiblePersonId ? maps.userMap.get(t.responsiblePersonId) : null;

            const result = await db.insert(schema.task).values({
                title: t.title,
                description: t.description,
                tabId: legacyTabId,
                clientId: newClientId,
                createdById: createdBy, // Using mapped ID
                assignedToUserId: assignedTo, // Using mapped ID
                seamstress: t.seamstress,
                count: t.count ? parseInt(t.count) : null,
                endDate: safeDateOrNull(t.endDate)?.toISOString().split('T')[0] ?? null,
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

    // 4. Task Materials
    const taskMaterials = readCsv('task_materials.csv');
    console.log(`Found ${taskMaterials.length} task materials.`);

    for (const tm of taskMaterials) {
        try {
            const newTaskId = taskIdMap.get(parseInt(tm.taskId));
            const newMaterialId = maps.materialMap.get(parseInt(tm.materialId)); // Using lookups

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

    // 5. Task Products
    const taskProducts = readCsv('task_products.csv');
    console.log(`Found ${taskProducts.length} task products.`);

    for (const tp of taskProducts) {
        try {
            const newTaskId = taskIdMap.get(parseInt(tp.taskId));
            const newProductId = maps.productMap.get(parseInt(tp.productId)); // Using lookups

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

    // 6. Files
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

    console.log('Partial Import completed successfully!');
    process.exit(0);
}

async function main() {
    const maps = await buildLookupMaps();
    await nukeClientsAndTasks();
    await importClientsAndTasks(maps);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
