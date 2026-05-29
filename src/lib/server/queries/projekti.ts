import { db } from '$lib/server/db';
import { task, userTabPreference, tabGroup, tab, user, client, userClient, taskAssignee } from '$lib/server/db/schema';
import { eq, or, and, isNull, inArray, notInArray, desc, asc, count, sql, ilike, exists } from 'drizzle-orm';
import { ilikeNormalize } from '$lib/server/dbUtils';
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
    search?: string,
    clientOnly: boolean = false
) {
    // 2. Define Task Columns
    const taskColumns = {
        id: true,
        title: true,
        price: true,
        endDate: true,
        created_at: true,
        tabId: true,
        clientId: true,
        createdById: true,
        isDone: true,
        // Add other needed columns
    } as const;

    // Define relations to fetch
    const taskRelations = {
        client: { columns: { name: true } },
        creator: { columns: { name: true, type: true } }, // Include TYPE
        assignees: { columns: { userId: true }, with: { user: { columns: { name: true } } } },
        taskProducts: { columns: { count: true } }
    } as const;

    // Shared tabGroups query (always needed, runs in parallel)
    const tabGroupsQuery = db.query.tabGroup.findMany({
        with: {
            translations: true,
            tabs: {
                orderBy: (tabs, { asc }) => [asc(tabs.sortOrder)],
                with: { translations: true }
            }
        },
        orderBy: (groups, { asc }) => [asc(groups.sortOrder)]
    });

    let tasks;
    let tabGroupsData: Awaited<typeof tabGroupsQuery>;
    let hiddenTabIds: Set<number>;

    if (currentUser.type === 'admin') {
        if (clientOnly) {
            // Run all independent queries in parallel
            const [_hidden, _tabGroups, clientUsers] = await Promise.all([
                getHiddenTabIds(currentUser.id),
                tabGroupsQuery,
                db.query.user.findMany({ where: eq(user.type, 'client'), columns: { id: true } })
            ]);
            hiddenTabIds = _hidden;
            tabGroupsData = _tabGroups;
            const clientIds = clientUsers.map(u => u.id);

            // Admin "Client Tasks" - Fetch only tasks created by client users
            tasks = await db.query.task.findMany({
                where: (t, { eq, or, isNull, and, inArray }) => {
                    const conditions = [
                        or(eq(t.isDone, false), isNull(t.isDone)),
                        clientIds.length > 0 ? inArray(t.createdById, clientIds) : sql`false`
                    ];
                    if (search) conditions.push(ilikeNormalize(t.title, search));
                    return and(...conditions);
                },
                with: taskRelations,
                columns: taskColumns,
                orderBy: (t, { asc }) => [asc(t.endDate)]
            });
        } else if (showAll) {
            // Run hidden tabs and tabGroups in parallel
            const [_hidden, _tabGroups] = await Promise.all([
                getHiddenTabIds(currentUser.id),
                tabGroupsQuery
            ]);
            hiddenTabIds = _hidden;
            tabGroupsData = _tabGroups;

            // Admin "Show All" - Fetch all active tasks (not done)
            tasks = await db.query.task.findMany({
                where: (t, { eq, or, isNull, and }) => {
                    const conditions = [or(eq(t.isDone, false), isNull(t.isDone))];
                    if (search) conditions.push(ilikeNormalize(t.title, search));
                    return and(...conditions);
                },
                with: taskRelations,
                columns: taskColumns,
                orderBy: (t, { asc }) => [asc(t.endDate)]
            });
        } else {
            // Admin default view — run all independent queries in parallel
            const [_hidden, _tabGroups, clientUsers] = await Promise.all([
                getHiddenTabIds(currentUser.id),
                tabGroupsQuery,
                db.query.user.findMany({ where: eq(user.type, 'client'), columns: { id: true } })
            ]);
            hiddenTabIds = _hidden;
            tabGroupsData = _tabGroups;
            const clientIds = clientUsers.map(u => u.id);

            // Admin default view:
            // A1. Tasks created by me
            // A2. Tasks assigned to me
            // A3. Tasks created by any client user with NO assignees
            // A4. Client-created tasks WITH assignees → only if I am one of them (covered by A2)
            // A5. Tasks created by other admins → NOT visible unless assigned to me (covered by A2)
            tasks = await db.query.task.findMany({
                where: (t, { or, eq, inArray, and, isNull }) => {
                    const isAssignedToMe = exists(
                        db.select({ id: taskAssignee.taskId })
                            .from(taskAssignee)
                            .where(and(eq(taskAssignee.taskId, t.id), eq(taskAssignee.userId, currentUser.id)))
                    );
                    const hasAnyAssignee = exists(
                        db.select({ id: taskAssignee.taskId })
                            .from(taskAssignee)
                            .where(eq(taskAssignee.taskId, t.id))
                    );

                    // Client-created tasks that have no assignees yet (any admin can see these)
                    const clientCreatedUnassigned = clientIds.length > 0
                        ? and(inArray(t.createdById, clientIds), sql`NOT ${hasAnyAssignee}`)
                        : sql`false`;

                    const baseConditions = [
                        eq(t.createdById, currentUser.id), // A1: created by me
                        isAssignedToMe,                    // A2 & A4: assigned to me
                        clientCreatedUnassigned            // A3: client-created, no assignees
                    ];

                    const conditions = [
                        or(...baseConditions),
                        or(eq(t.isDone, false), isNull(t.isDone))
                    ];
                    if (search) conditions.push(ilikeNormalize(t.title, search));

                    return and(...conditions);
                },
                with: taskRelations,
                columns: taskColumns,
                orderBy: (t, { asc }) => [asc(t.endDate)]
            });
        }
    } else {
        // Client visibility rules:
        // C1. Creator always sees their own task (regardless of assignees)
        // C2. Assignee always sees tasks assigned to them
        // C3. Client user sees all tasks where task.clientId matches their linked client entry (regardless of assignees)
        // C6. Tasks created by other client users are never visible

        // Run hidden tabs, tabGroups, and userClient links in parallel
        const [_hidden, _tabGroups, userClientLinks] = await Promise.all([
            getHiddenTabIds(currentUser.id),
            tabGroupsQuery,
            db.query.userClient.findMany({
                where: eq(userClient.userId, currentUser.id),
                columns: { clientId: true }
            })
        ]);
        hiddenTabIds = _hidden;
        tabGroupsData = _tabGroups;
        const linkedClientIds = userClientLinks.map((uc) => uc.clientId);

        tasks = await db.query.task.findMany({
            where: (t, { or, eq, and, isNull }) => {
                const isAssignedToMe = exists(
                    db.select({ id: taskAssignee.taskId })
                        .from(taskAssignee)
                        .where(and(eq(taskAssignee.taskId, t.id), eq(taskAssignee.userId, currentUser.id)))
                );

                // C1: I created this task
                const createdByMe = eq(t.createdById, currentUser.id);
                // C2: I am assigned to this task
                const assignedToMe = isAssignedToMe;
                // C3: Task client matches my linked client entry
                const myClientTask = linkedClientIds.length > 0
                    ? inArray(t.clientId, linkedClientIds)
                    : sql`false`;

                const baseConditions = [createdByMe, assignedToMe, myClientTask];

                const conditions = [
                    or(...baseConditions),
                    or(eq(t.isDone, false), isNull(t.isDone))
                ];
                if (search) conditions.push(ilikeNormalize(t.title, search));
                return and(...conditions);
            },
            with: taskRelations,
            columns: taskColumns,
            orderBy: (t, { asc }) => [asc(t.endDate)]
        });
    }

    // 3. Structure & Mapping

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
                const isUnassigned = !t.assignees || t.assignees.length === 0;

                if (clientOptions && isUnassigned) {
                    targetId = defaultTabId;
                }
            } else {
                // Default Admin Logic
                const clientOptions = isClientCreated(t);
                const isUnassigned = !t.assignees || t.assignees.length === 0;
                const isAssignedToMe = t.assignees?.some((a: any) => a.userId === currentUser.id);
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
    filterConditions.push(eq(task.isDone, true));    if (currentUser.type === 'client') {
        // Client visibility rules (mirrors getProjectBoardData client rules):
        // C1. Creator always sees their own task
        // C2. Assignee always sees tasks assigned to them
        // C3. Task client matches linked client entry → always visible

        const userClients = await db.query.userClient.findMany({
            where: eq(userClient.userId, currentUser.id),
            columns: { clientId: true }
        });
        const linkedClientIds = userClients.map((uc) => uc.clientId);

        const isAssignedToMe = exists(
            db.select({ id: taskAssignee.taskId })
                .from(taskAssignee)
                .where(and(eq(taskAssignee.taskId, task.id), eq(taskAssignee.userId, currentUser.id)))
        );

        const clientConditions = [
            eq(task.createdById, currentUser.id),  // C1
            isAssignedToMe,                          // C2
            ...(linkedClientIds.length > 0 ? [inArray(task.clientId, linkedClientIds)] : []) // C3
        ];

        filterConditions.push(or(...clientConditions));
    }

    if (search) {
        const searchTerm = `%${search}%`;
        filterConditions.push(
            or(
                ilikeNormalize(task.title, search),
                ilikeNormalize(task.description, search),
                sql`${task.price}::text ILIKE ${searchTerm}`
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
            assignees: { with: { user: true } },
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
