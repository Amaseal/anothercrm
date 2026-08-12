import { db } from '$lib/server/db';
import { task, userTabPreference, tabGroup, tab, user, client, userClient, taskAssignee } from '$lib/server/db/schema';
import { eq, or, and, inArray, desc, asc, count, sql, exists } from 'drizzle-orm';
import { ilikeNormalize } from '$lib/server/dbUtils';
export interface ProjectBoardColumn {
    id: number;
    name: string;
    color: string;
    tasks: any[];
    isPersonal?: boolean;
    translations?: any[];
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

    // Shared tabGroups query — includes user preferences so hidden tab IDs need no separate round-trip
    const tabGroupsQuery = db.query.tabGroup.findMany({
        with: {
            translations: true,
            tabs: {
                orderBy: (tabs, { asc }) => [asc(tabs.sortOrder)],
                with: {
                    translations: true,
                    userPreferences: {
                        where: and(
                            eq(userTabPreference.userId, currentUser.id),
                            eq(userTabPreference.isVisible, false)
                        ),
                        columns: { tabId: true }
                    }
                }
            }
        },
        orderBy: (groups, { asc }) => [asc(groups.sortOrder)]
    });

    let tasks;
    let tabGroupsData: Awaited<typeof tabGroupsQuery>;
    let hiddenTabIds: Set<number>;

    // Subquery: is the task creator a client user? Used in place of a separate user IDs fetch.
    const creatorIsClient = (t: typeof task) => exists(
        db.select({ one: sql`1` }).from(user)
            .where(and(eq(user.id, t.createdById), eq(user.type, 'client')))
    );

    if (currentUser.type === 'admin') {
        if (clientOnly) {
            tabGroupsData = await tabGroupsQuery;
            hiddenTabIds = new Set(tabGroupsData.flatMap(g => g.tabs.flatMap(t => t.userPreferences.map(p => p.tabId))));

            // Admin "Client Tasks" - tasks created by client users
            tasks = await db.query.task.findMany({
                where: (t, { eq, and }) => {
                    const conditions = [
                        eq(t.isDone, false),
                        creatorIsClient(t)
                    ];
                    if (search) conditions.push(ilikeNormalize(t.title, search));
                    return and(...conditions);
                },
                with: taskRelations,
                columns: taskColumns,
                orderBy: (t, { asc }) => [asc(t.endDate)]
            });
        } else if (showAll) {
            tabGroupsData = await tabGroupsQuery;
            hiddenTabIds = new Set(tabGroupsData.flatMap(g => g.tabs.flatMap(t => t.userPreferences.map(p => p.tabId))));

            // Admin "Show All" - Fetch all active tasks (not done)
            tasks = await db.query.task.findMany({
                where: (t, { eq, and }) => {
                    const conditions = [eq(t.isDone, false)];
                    if (search) conditions.push(ilikeNormalize(t.title, search));
                    return and(...conditions);
                },
                with: taskRelations,
                columns: taskColumns,
                orderBy: (t, { asc }) => [asc(t.endDate)]
            });
        } else {
            // Admin default view — tabGroups only (client IDs replaced by correlated subquery)
            tabGroupsData = await tabGroupsQuery;
            hiddenTabIds = new Set(tabGroupsData.flatMap(g => g.tabs.flatMap(t => t.userPreferences.map(p => p.tabId))));

            // Admin default view:
            // A1. Tasks created by me
            // A2. Tasks assigned to me
            // A3. Tasks created by any client user with NO assignees
            // A4. Client-created tasks WITH assignees → only if I am one of them (covered by A2)
            // A5. Tasks created by other admins → NOT visible unless assigned to me (covered by A2)
            tasks = await db.query.task.findMany({
                where: (t, { or, eq, and }) => {
                    const isAssignedToMe = exists(
                        db.select({ one: sql`1` })
                            .from(taskAssignee)
                            .where(and(eq(taskAssignee.taskId, t.id), eq(taskAssignee.userId, currentUser.id)))
                    );
                    const hasAnyAssignee = exists(
                        db.select({ one: sql`1` })
                            .from(taskAssignee)
                            .where(eq(taskAssignee.taskId, t.id))
                    );

                    // Client-created tasks that have no assignees yet (any admin can see these)
                    const clientCreatedUnassigned = and(creatorIsClient(t), sql`NOT ${hasAnyAssignee}`);

                    const baseConditions = [
                        eq(t.createdById, currentUser.id), // A1: created by me
                        isAssignedToMe,                    // A2 & A4: assigned to me
                        clientCreatedUnassigned            // A3: client-created, no assignees
                    ];

                    const conditions = [
                        or(eq(t.createdById, currentUser.id), isAssignedToMe, clientCreatedUnassigned),
                        eq(t.isDone, false)
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

        // Run tabGroups and userClient links in parallel
        const [_tabGroups, userClientLinks] = await Promise.all([
            tabGroupsQuery,
            db.query.userClient.findMany({
                where: eq(userClient.userId, currentUser.id),
                columns: { clientId: true }
            })
        ]);
        tabGroupsData = _tabGroups;
        hiddenTabIds = new Set(tabGroupsData.flatMap(g => g.tabs.flatMap(t => t.userPreferences.map(p => p.tabId))));
        const linkedClientIds = userClientLinks.map((uc) => uc.clientId);

        tasks = await db.query.task.findMany({
            where: (t, { or, eq, and }) => {
                const isAssignedToMe = exists(
                    db.select({ one: sql`1` })
                        .from(taskAssignee)
                        .where(and(eq(taskAssignee.taskId, t.id), eq(taskAssignee.userId, currentUser.id)))
                );

                const myClientTask = linkedClientIds.length > 0
                    ? inArray(t.clientId, linkedClientIds)
                    : sql`false`;

                const conditions = [
                    or(eq(t.createdById, currentUser.id), isAssignedToMe, myClientTask),
                    eq(t.isDone, false)
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
