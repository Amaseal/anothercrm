import { db } from '$lib/server/db';
import { task, userTabPreference, tabGroup, tab, user, client } from '$lib/server/db/schema';
import { eq, or, and, isNull, inArray, notInArray, desc } from 'drizzle-orm';

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
    locale: string
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
        createdAt: true,
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
        const clientUsers = await db.query.user.findMany({
            where: eq(user.type, 'client'),
            columns: { id: true }
        });
        const clientIds = clientUsers.map(u => u.id);

        tasks = await db.query.task.findMany({
            where: (t, { or, eq, inArray }) => {
                const conditions = [
                    eq(t.createdById, currentUser.id),
                    eq(t.assignedToUserId, currentUser.id)
                ];
                if (clientIds.length > 0) {
                    conditions.push(inArray(t.createdById, clientIds));
                }
                return or(...conditions);
            },
            with: taskRelations,
            columns: taskColumns
        });
    } else {
        // Client: Fetch Created By Me OR Assigned To Me
        // Review says: "Clients... See only their tasks (created by them, and/or assigned-to if you allow that)"
        tasks = await db.query.task.findMany({
            where: (t, { or, eq }) => or(
                eq(t.createdById, currentUser.id),
                eq(t.assignedToUserId, currentUser.id)
            ),
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

        if ((personalTabId && targetId === personalTabId) || targetId === 0) {
            personalColumn.tasks.push(t);
        } else {
            if (!tasksMap.has(targetId)) tasksMap.set(targetId, []);
            tasksMap.get(targetId)?.push(t);
        }
    });

    // Build Final Columns List
    columns.push(personalColumn);

    if (currentUser.type === 'admin') {
        // Admin: Flatten tabs
        tabGroupsData.forEach(group => {
            group.tabs.forEach(tab => {
                if (hiddenTabIds.has(tab.id)) return; // Skip hidden tabs
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
