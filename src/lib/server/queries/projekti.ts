import { db } from '$lib/server/db';
import { task, userTabPreference, tabGroup, tab, user, client, userClient } from '$lib/server/db/schema';
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
    // 1. Fetch Hidden Tabs (Admin uses this to hide columns, Clients logic implies only visible stuff)
    const hiddenTabIds = await getHiddenTabIds(currentUser.id);

    // 2. Define Task Columns
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

    // 3. Structure & Mapping

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
    const tasksMap = new Map<number, any[]>(); // tabId (or groupId for clients) -> tasks

    // Find Default Tab (First shared tab in first group)
    let defaultTabId = 0;
    for (const group of tabGroupsData) {
        if (group.tabs.length > 0) {
            defaultTabId = group.tabs[0].id;
            break;
        }
    }

    const isClientCreated = (t: any) => t.creator?.type === 'client';

    // Helper: Map Tab ID to Group ID
    const tabToGroupMap = new Map<number, number>();
    tabGroupsData.forEach(g => {
        g.tabs.forEach(t => {
            tabToGroupMap.set(t.id, g.id);
        });
    });

    // Distribute Tasks
    tasks.forEach(t => {
        let targetId = t.tabId;

        // Check if tab exists in our known structure
        const isKnownTab = tabToGroupMap.has(t.tabId);

        // If the task is in a personal tab (not in tabToGroupMap) or explicitly in a "missing" tab, reassign to default
        if (!isKnownTab) {
            targetId = defaultTabId;
        }

        if (currentUser.type === 'client') {
            // Client Logic: map to Group ID
            const groupId = tabToGroupMap.get(targetId); // Use targetId which might be corrected to default
            if (groupId) {
                targetId = groupId;
            } else {
                // Should not happen if defaultTabId is valid and mapped, but fallback to 0 or something
                const defaultGroupId = tabToGroupMap.get(defaultTabId);
                targetId = defaultGroupId || 0;
            }

        } else {
            // Admin Logic
            if (showAll) {
                // Show All Mode: Respect tabId (targetId is already corrected for unknown tabs)
                const clientOptions = isClientCreated(t);
                const isUnassigned = !t.assignedToUserId;

                if (clientOptions && isUnassigned) {
                    targetId = defaultTabId;
                }
            } else {
                // Default Admin Logic
                const clientOptions = isClientCreated(t);
                const isUnassigned = !t.assignedToUserId;
                const isAssignedToMe = t.assignedToUserId === currentUser.id;
                const isHidden = hiddenTabIds.has(t.tabId); // Check original tab ID for hidden preference

                // If it was remaps to default, we should check if default is hidden? 
                // Logic simplifiction: If it's effectively going to default tab, check if default tab is hidden.
                // But let's stick to original intent: 
                // If "client unassigned" OR "assigned to me but hidden/orphan", map to DEFAULT instead of PERSONAL.

                if ((clientOptions && isUnassigned) || (isAssignedToMe && (!isKnownTab || isHidden))) {
                    // Remap to Default
                    targetId = defaultTabId;
                } else {
                    if (isHidden) return; // Hidden
                }
            }
        }

        // Map created_at to createdAt for frontend component
        const taskWithCreatedAt = { ...t, createdAt: t.created_at, isMoved: t.tabId !== defaultTabId };

        if (!tasksMap.has(targetId)) tasksMap.set(targetId, []);
        tasksMap.get(targetId)?.push(taskWithCreatedAt);
    });

    if (currentUser.type === 'admin') {
        // Admin: Flatten tabs
        tabGroupsData.forEach(group => {
            group.tabs.forEach(tab => {
                if (!showAll && hiddenTabIds.has(tab.id)) return; // Skip hidden tabs ONLY if not showAll

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
                color: group.color,
                tasks: tasksMap.get(group.id) || [] // Now pulling from the map!
            });
        });
    }

    return {
        columns,
        user: currentUser
    };
}

export async function getCompletedTasks(
    currentUser: { id: string; type: 'admin' | 'client' },
    page: number = 0,
    pageSize: number = 50,
    search: string = '',
    sortColumn: string = 'endDate',
    sortDirection: 'asc' | 'desc' = 'desc'
) {
    const offset = page * pageSize;
    const filterConditions = [];
    filterConditions.push(eq(task.isDone, true));

    if (currentUser.type === 'client') {
        // Client filtering logic
        // 1. Get client IDs associated with this user
        const userClients = await db.query.userClient.findMany({
            where: eq(userClient.userId, currentUser.id),
            columns: { clientId: true }
        });
        const clientIds = userClients.map((uc) => uc.clientId);

        const clientConditions = [
            eq(task.createdById, currentUser.id)
        ];

        if (clientIds.length > 0) {
            clientConditions.push(inArray(task.clientId, clientIds));
        }

        filterConditions.push(or(...clientConditions));
    }

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

    const whereCondition = and(...filterConditions);

    const [{ value: totalCount }] = await db
        .select({ value: count() })
        .from(task)
        .where(whereCondition);

    const sortableColumns = {
        title: task.title,
        price: task.price,
        endDate: task.endDate,
        createdAt: task.created_at
    };

    const columnToSort = sortableColumns[sortColumn as keyof typeof sortableColumns] || task.endDate;

    const tasks = await db.query.task.findMany({
        where: whereCondition,
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
