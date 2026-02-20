import { db } from '$lib/server/db';
import { file, material, companySettings, task } from '$lib/server/db/schema';
import { eq, like, or, and, isNotNull } from 'drizzle-orm';
import { readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';
import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { handleListParams } from '$lib/server/paramState';

export const load: PageServerLoad = async ({ url, cookies }) => {
    const activeParams = handleListParams(url, cookies, '/faili', 'faili_filters');

    const page = parseInt(activeParams.get('page') || '0');
    const pageSize = parseInt(activeParams.get('pageSize') || '50');
    const search = (activeParams.get('search') || '').toLowerCase();
    const sortColumn = activeParams.get('sortColumn') || 'created';
    const sortDirection = activeParams.get('sortDirection') || 'desc';

    // 1. Fetch all data needed for usage check
    const [dbFiles, materials, company, tasksWithPreview, tasksWithFiles] = await Promise.all([
        db.select().from(file),
        db.select({ id: material.id, title: material.title, image: material.image }).from(material).where(isNotNull(material.image)),
        db.select({ id: companySettings.id, logo: companySettings.logo }).from(companySettings),
        db.select({ id: task.id, title: task.title, preview: task.preview }).from(task).where(isNotNull(task.preview)),
        db.select({ id: task.id, title: task.title }).from(task) // We can't easily join on the "file" table's taskId via simple array merge, so we'll use the file's taskId property
    ]);

    // Create lookup maps for usage
    const materialImages = new Set(materials.map(m => m.image).filter(Boolean));
    const companyLogos = new Set(company.map(c => c.logo).filter(Boolean));
    const taskPreviews = new Set(tasksWithPreview.map(t => t.preview).filter(Boolean));
    const taskMap = new Map(tasksWithFiles.map(t => [t.id, t.title]));
    const materialMap = new Map(); // Map image -> Material Title
    materials.forEach(m => { if (m.image) materialMap.set(m.image, m.title) });

    // 2. Scan Uploads Directory
    const uploadDir = 'uploads';
    let fsFiles: string[] = [];
    try {
        fsFiles = await readdir(uploadDir);
    } catch (e) {
        console.error("Error reading uploads dir:", e);
    }

    // 3. Merge Logic
    const allFilesMap = new Map<string, any>();

    // Process FS files first
    for (const filename of fsFiles) {
        if (filename === '.gitkeep') continue;
        const filePath = join(uploadDir, filename);
        let stats;
        try {
            stats = await stat(filePath);
        } catch (e) {
            continue;
        }

        const urlPath = `/uploads/${filename}`;

        allFilesMap.set(filename, {
            id: `fs-${filename}`,
            filename: filename,
            url: urlPath,
            size: stats.size,
            created: stats.birthtime,
            source: 'fs', // Initially FS only
            dbId: null,
            usage: []
        });
    }

    // Process DB files (Update or Add)
    for (const dbFile of dbFiles) {
        // Extract filename from URL if possible, or use filename field
        // dbFile.downloadUrl usually looks like /uploads/filename
        const fsName = dbFile.downloadUrl.split('/uploads/')[1] || dbFile.filename;

        const existing = allFilesMap.get(fsName);
        if (existing) {
            existing.source = 'both';
            existing.dbId = dbFile.id;
            existing.taskId = dbFile.taskId;
        } else {
            // DB only
            allFilesMap.set(fsName, {
                id: dbFile.id,
                filename: dbFile.filename, // Or fsName if reliable
                url: dbFile.downloadUrl,
                size: dbFile.size,
                created: dbFile.created_at,
                source: 'db',
                dbId: dbFile.id,
                taskId: dbFile.taskId,
                usage: []
            });
        }
    }

    // 4. Calculate Usage
    const allFiles = Array.from(allFilesMap.values());
    for (const f of allFiles) {
        const usages = [];

        // Check Task Attachment (from DB relation)
        if (f.taskId) {
            usages.push({ type: 'task', id: f.taskId, name: taskMap.get(f.taskId) || `Task #${f.taskId}` });
        }

        // Check Material Image
        if (materialImages.has(f.url)) {
            usages.push({ type: 'material', name: materialMap.get(f.url) });
        }

        // Check Company Logo
        if (companyLogos.has(f.url)) {
            usages.push({ type: 'company', name: 'Company Logo' });
        }

        // Check Task Preview
        if (taskPreviews.has(f.url)) {
            // Find which task
            const t = tasksWithPreview.find(t => t.preview === f.url);
            if (t) usages.push({ type: 'task_preview', id: t.id, name: t.title });
        }

        f.usage = usages;
        f.status = usages.length > 0 ? 'used' : 'orphaned';
    }

    // 5. Filter
    let filteredFiles = allFiles;
    if (search) {
        filteredFiles = allFiles.filter(f =>
            f.filename.toLowerCase().includes(search) ||
            f.usage.some((u: any) => u.name?.toLowerCase().includes(search))
        );
    }

    // 6. Sort
    filteredFiles.sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];

        if (sortColumn === 'usage') {
            valA = a.usage.length;
            valB = b.usage.length;
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    // 7. Paginate
    const totalCount = filteredFiles.length;
    const paginatedFiles = filteredFiles.slice(page * pageSize, (page + 1) * pageSize);

    return {
        files: paginatedFiles,
        pagination: {
            page,
            pageSize,
            totalCount,
            totalPages: Math.ceil(totalCount / pageSize),
            search,
            sortColumn,
            sortDirection
        }
    };
};

export const actions: Actions = {
    delete: async ({ request }) => {
        const formData = await request.formData();
        const id = formData.get('id') as string;
        const filename = formData.get('filename') as string; // We might need this to delete from FS
        const dbId = formData.get('dbId'); // ID in DB

        if (!filename) return fail(400, { message: 'Missing filename' });

        try {
            // 1. Delete from FS
            const uploadDir = 'uploads';
            const filePath = join(uploadDir, filename);
            try {
                await unlink(filePath);
            } catch (e: any) {
                console.warn(`Failed to delete FS file ${filename}:`, e.message);
                // Continue if file is missing
            }

            // 2. Delete from DB if needed
            if (dbId) {
                await db.delete(file).where(eq(file.id, parseInt(dbId.toString())));
            } else {
                // Try finding by filename just in case
                // But generally rely on passed ID
            }

            return { success: true };
        } catch (e) {
            console.error(e);
            return fail(500, { message: 'Failed to delete file' });
        }
    }
};
