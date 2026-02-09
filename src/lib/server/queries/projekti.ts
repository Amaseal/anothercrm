import { db } from '$lib/server/db';
import { task, userTabPreference, tabGroup, tab, user, client } from '$lib/server/db/schema';
import { eq, or, and, isNull, inArray, notInArray, desc, asc, count, sql, ilike } from 'drizzle-orm';

export interface ProjectBoardColumn {
    id: number;
    name: string;
    color: string;
    tasks: any[];
    isPersonal?: boolean;
    translations?: any[];
}

// Helper to get hidden tasks for a user
export async function getHiddenTabIds(userId: string): Promise<Set<number>> {
    const preferences = await db.query.userTabPreference.findMany({
        where: and(eq(userTabPreference.userId, userId), eq(userTabPreference.isVisible, false)),
        columns: { tabId: true }
    });
    return new Set(preferences.map((p) => p.tabId));
}

export async function getProjectBoardData(
    currentUser: { id: string; type: 'admin' | 'client' },
    locale: string,
    showAll: boolean = false,
    search?: string
) {
    // 1. Fetch User's Personal Tab ID
    const personalTab = await db.query.tab.findFirst({
        where: eq(tab.userId, currentUser.id),
        with: { translations: true }
    });
    const personalTabId = personalTab?.id;

    // 2. Fetch Hidden Tabs (Admin uses this to hide columns, Clients logic implies only visible stuff)
    const hiddenTabIds = await getHiddenTabIds(currentUser.id);

    // 3. Define Task Columns
    const taskColumns = {
        id: true,
        title: true,
        price: true,
        endDate: true,
        created_at: true,
        tabId: true,
        clientId: true,
        assignedToUserId: true,
        createdById: true,
        isDone: true,
        // Add other needed columns
    } as const;

    // Define relations to fetch
    const taskRelations = {
        client: { columns: { name: true } },
        creator: { columns: { name: true, type: true } }, // Include TYPE
        assignedToUser: { columns: { name: true } }
    } as const;

    let tasks;

    if (currentUser.type === 'admin') {
        if (showAll) {
            // Admin "Show All" - Fetch all active tasks (not done)
            tasks = await db.query.task.findMany({
                where: (t, { eq, or, isNull, and, ilike }) => {
                    const conditions = [or(eq(t.isDone, false), isNull(t.isDone))];
                    if (search) conditions.push(ilike(t.title, `%${search}%`));
                    return and(...conditions);
                },
                with: taskRelations,
                columns: taskColumns
            });
        } else {
            const clientUsers = await db.query.user.findMany({
                where: eq(user.type, 'client'),
                columns: { id: true }
            });
            const clientIds = clientUsers.map(u => u.id);

            tasks = await db.query.task.findMany({
                where: (t, { or, eq, inArray, and, ilike, isNull }) => {
                    const baseConditions = [
                        eq(t.createdById, currentUser.id),
                        eq(t.assignedToUserId, currentUser.id)
                    ];
                    if (clientIds.length > 0) {
                        baseConditions.push(inArray(t.createdById, clientIds));
                    }

                    const conditions = [
                        or(...baseConditions),
                        or(eq(t.isDone, false), isNull(t.isDone))
                    ];
                    if (search) conditions.push(ilike(t.title, `%${search}%`));

                    return and(...conditions);
                },
                with: taskRelations,
                columns: taskColumns
            });
        }
    } else {
        // Client: Fetch Created By Me OR Assigned To Me
        tasks = await db.query.task.findMany({
            where: (t, { or, eq, and, ilike, isNull }) => {
                const baseConditions = [
                    eq(t.createdById, currentUser.id),
                    eq(t.assignedToUserId, currentUser.id)
                ];
                const conditions = [
                    or(...baseConditions),
                    or(eq(t.isDone, false), isNull(t.isDone))
                ];
                if (search) conditions.push(ilike(t.title, `%${search}%`));
                return and(...conditions);
            },
            with: taskRelations,
            columns: taskColumns
        });
    }

    // 5. Structure & Mapping

    // Fetch Tab Groups and Tabs
    const tabGroupsData = await db.query.tabGroup.findMany({
        with: {
            translations: true,
            tabs: {
                orderBy: (tabs, { asc }) => [asc(tabs.sortOrder)],
                with: { translations: true }
            }
        },
        orderBy: (groups, { asc }) => [asc(groups.sortOrder)]
    });

    const columns: ProjectBoardColumn[] = [];
    const tasksMap = new Map<number, any[]>(); // tabId -> tasks

    // Init Personal Column
    let personalColumn: ProjectBoardColumn;

    if (personalTab) {
        const translation = personalTab.translations.find(t => t.language === locale) || personalTab.translations[0];
        personalColumn = {
            id: personalTab.id,
            name: translation?.name || 'My Tasks',
            color: personalTab.color,
            tasks: [],
            isPersonal: true
        };
    } else {
        // Fallback or "Inbox" if no personal tab
        personalColumn = {
            id: 0,
            name: 'Inbox',
            color: '#000000',
            tasks: [],
            isPersonal: true
        };
    }

    const isClientCreated = (t: any) => t.creator?.type === 'client';

    // Distribute Tasks
    tasks.forEach(t => {
        let targetId = t.tabId;

        if (currentUser.type === 'client') {
            // Client: Always Personal Tab basically?
            // "These tasks naturally live in the client’s personal tab"
            // If we just map to personalTabId, they all show up there.
            if (personalTabId) targetId = personalTabId;
            else targetId = 0; // Fallback
        } else {
            // Admin Logic

            if (showAll) {
                // Show All Mode: Don't hide based on hiddenTabIds
                // Just map to their tabId
                // But what about client created tasks?
                // User request: "let you see all tasks and all collumns... even those you didnt create"
                // Implication is we see them WHERE THEY ARE.
                // Ideally we just respect t.tabId.

                // However, "defaults stay as they are" implies special logic for default view is KEPT.
                // For "Show All", we likely just want straight mapping.
                // But wait, "client-created tasks" logic was: "Remaped to personal collumn only if they are not asigned to other users"
                // If I "Show All", maybe I still want to see that remapping? 
                // Or maybe I want to see them in their "native" tab (which might be null/0/invalid if they are client created)?

                // Client created tasks often don't HAVE a real tabId assigned yet, or it's just some default.
                // If `t.tabId` is null/undefined, `targetId` is ...?

                // Let's assume for "Show All", we mostly want to respect the raw data, BUT...
                // If a task is "unassigned client task", it conceptually "lives" in the Inbox (Personal Tab).
                // So remapping logic for unassigned client tasks probably still applies visually.

                const clientOptions = isClientCreated(t);
                const isUnassigned = !t.assignedToUserId;

                if (clientOptions && isUnassigned) {
                    if (personalTabId) targetId = personalTabId;
                    else targetId = 0;
                }
                // NO hiddenTabIds check here.
            } else {
                // Default Admin Logic
                // Check if it's a "Client Intake" task
                // "Client-created tasks must appear in... personal tab... unless assigned to manager"
                // "Remaped to personal collumn only if they are not asigned to other users"

                const clientOptions = isClientCreated(t);
                const isUnassigned = !t.assignedToUserId;

                if (clientOptions && isUnassigned) {
                    // Remap to Personal (Inbox)
                    if (personalTabId) targetId = personalTabId;
                    else targetId = 0;
                } else {
                    // Regular Task -> Check Visibility
                    if (hiddenTabIds.has(t.tabId)) {
                        // Hidden
                        return;
                    }
                }
            }
        }

        // Map created_at to createdAt for frontend component
        const taskWithCreatedAt = { ...t, createdAt: t.created_at };

        if ((personalTabId && targetId === personalTabId) || targetId === 0) {
            personalColumn.tasks.push(taskWithCreatedAt);
        } else {
            if (!tasksMap.has(targetId)) tasksMap.set(targetId, []);
            tasksMap.get(targetId)?.push(taskWithCreatedAt);
        }
    });

    // Build Final Columns List
    columns.push(personalColumn);

    if (currentUser.type === 'admin') {
        // Admin: Flatten tabs
        tabGroupsData.forEach(group => {
            group.tabs.forEach(tab => {
                if (!showAll && hiddenTabIds.has(tab.id)) return; // Skip hidden tabs ONLY if not showAll
                if (tab.id === personalTabId) return; // Skip personal tab (already added)

                const trans = tab.translations.find(tr => tr.language === locale) || tab.translations[0];
                columns.push({
                    id: tab.id,
                    name: trans?.name || 'Unnamed Tab',
                    color: tab.color,
                    tasks: tasksMap.get(tab.id) || []
                });
            });
        });
    } else {
        // Client: Tab Groups = Columns
        tabGroupsData.forEach(group => {
            const trans = group.translations.find(tr => tr.language === locale) || group.translations[0];
            columns.push({
                id: group.id,
                name: trans?.name || 'Unnamed Group',
                color: '#ffffff', // Default
                tasks: [] // Clients only see tasks in personal tab
            });
        });
    }

    return {
        columns,
        user: currentUser
    };
}

export async function getCompletedTasks(
    page: number = 0,
    pageSize: number = 50,
    search: string = '',
    sortColumn: string = 'endDate',
    sortDirection: 'asc' | 'desc' = 'desc'
) {
    const offset = page * pageSize;
    const filterConditions = [];
    filterConditions.push(eq(task.isDone, true));

    if (search) {
        const searchTerm = `%${search}%`;
        filterConditions.push(
            or(
                ilike(task.title, searchTerm),
                ilike(task.description, searchTerm),
                sql`${task.price}::text LIKE ${searchTerm}`
            )
        );
    }

    const [{ value: totalCount }] = await db
        .select({ value: count() })
        .from(task)
        .where(and(...filterConditions));

    const sortableColumns = {
        title: task.title,
        price: task.price,
        endDate: task.endDate,
        createdAt: task.created_at
    };

    const columnToSort = sortableColumns[sortColumn as keyof typeof sortableColumns] || task.endDate;

    const tasks = await db.query.task.findMany({
        where: and(...filterConditions),
        orderBy: sortDirection === 'asc' ? asc(columnToSort) : desc(columnToSort),
        limit: pageSize,
        offset: offset,
        with: {
            client: true,
            assignedToUser: true,
            creator: true
        }
    });

    return {
        tasks,
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
}
