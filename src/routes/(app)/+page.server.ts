import { db } from '$lib/server/db';
import { task, user, client, taskProduct, product, tab, tabGroup, taskAssignee, invoice } from '$lib/server/db/schema';
import { sql, count, desc, eq, and, or, lte, gte, ne, isNull, notInArray, exists } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, url, cookies }) => {

    if (locals.user?.type === 'client') {
        return redirect(302, '/projekti');
    }
    if (!locals.user) {
        return redirect(302, '/login');
    }

    // Get the current month's start and end dates
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Get today and tomorrow for urgent tasks
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Read hidden tab groups from cookie
    let hiddenTabGroups: number[] = [];
    const hiddenGroupsCookie = cookies.get('hiddenTabGroups');
    if (hiddenGroupsCookie) {
        try {
            const parsed = JSON.parse(hiddenGroupsCookie);
            hiddenTabGroups = Array.isArray(parsed) ? parsed : [];
        } catch (e) {            hiddenTabGroups = [];
        }
    }

    const alwaysHiddenGroups = [41, 62];
    const allHiddenGroups = Array.from(new Set([...alwaysHiddenGroups, ...hiddenTabGroups]));

    // Range toggles for managers and assignees (default: 'month')
    // 'month'      = this month, active tasks only
    // 'month-all'  = this month, including done tasks
    // 'alltime'    = all time, including done tasks
    const validRanges = ['month', 'month-all', 'alltime'] as const;
    type Range = typeof validRanges[number];
    const managersRange: Range = validRanges.includes(url.searchParams.get('managersRange') as Range)
        ? url.searchParams.get('managersRange') as Range : 'month';
    const assigneesRange: Range = validRanges.includes(url.searchParams.get('assigneesRange') as Range)
        ? url.searchParams.get('assigneesRange') as Range : 'month';

    // profitMode: 'profit' = revenue - product costs, 'revenue' = raw revenue
    // Stored in cookie so it persists across navigation, driven by URL param when present
    const profitModeParam = url.searchParams.get('profitMode');
    const profitModeCookie = cookies.get('profitMode');
    const profitMode: 'profit' | 'revenue' =
        profitModeParam === 'profit' || profitModeParam === 'revenue'
            ? profitModeParam
            : profitModeCookie === 'revenue'
                ? 'revenue'
                : 'profit';
    if (profitModeParam === 'profit' || profitModeParam === 'revenue') {
        cookies.set('profitMode', profitModeParam, { path: '/', maxAge: 31536000, sameSite: 'lax' });
    }    // Get top managers (users with highest total revenue/profit, invoice-aware)
    // Revenue per task = invoice.subtotal if invoice exists, otherwise task.price
    // Profit = revenue - product costs (when profitMode === 'profit')
    const revenueExpr = sql`COALESCE(${invoice.subtotal}, ${task.price}, 0)`;
    const profitExpr = sql`COALESCE(${invoice.subtotal}, ${task.price}, 0) - COALESCE(${taskProduct.count} * ${product.cost}, 0)`;
    const managerValuePerTask = profitMode === 'profit' ? profitExpr : revenueExpr;

    const managersValueExpr = managersRange === 'month'
        ? sql<number>`COALESCE(SUM(CASE WHEN ${task.isDone} IS NOT TRUE THEN ${managerValuePerTask} ELSE 0 END), 0)`
        : sql<number>`COALESCE(SUM(${managerValuePerTask}), 0)`;

    const managersJoinCondition = managersRange === 'alltime'
        ? eq(task.createdById, user.id)
        : and(
            eq(task.createdById, user.id),
            gte(task.created_at, currentMonthStart),
            lte(task.created_at, currentMonthEnd)
        );    const topManagers = await db
        .select({
            id: user.id,
            name: user.name,
            totalValue: managersValueExpr
        })
        .from(user)
        .leftJoin(task, managersJoinCondition)
        .leftJoin(invoice, eq(invoice.taskId, task.id))
        .leftJoin(taskProduct, eq(taskProduct.taskId, task.id))
        .leftJoin(product, eq(product.id, taskProduct.productId))
        .groupBy(user.id, user.name)
        .orderBy(desc(managersValueExpr))
        .limit(5);

    // Get top responsible persons (users with most assigned tasks)
    const assigneesJoinCondition = assigneesRange === 'alltime'
        ? eq(task.id, taskAssignee.taskId)
        : assigneesRange === 'month-all'
            ? and(
                eq(task.id, taskAssignee.taskId),
                gte(task.created_at, currentMonthStart),
                lte(task.created_at, currentMonthEnd)
            )
            : and( // 'month': active only
                eq(task.id, taskAssignee.taskId),
                ne(task.isDone, true),
                gte(task.created_at, currentMonthStart),
                lte(task.created_at, currentMonthEnd)
            );

    const topResponsiblePersons = await db
        .select({
            id: user.id,
            name: user.name,
            taskCount: count(task.id)
        })
        .from(user)
        .leftJoin(taskAssignee, eq(taskAssignee.userId, user.id))
        .leftJoin(task, assigneesJoinCondition)
        .groupBy(user.id, user.name)
        .orderBy(desc(count(task.id)))
        .limit(5);

    // Run all independent queries in parallel
    // Run all independent queries concurrently
    const clientsLimitRaw = parseInt(url.searchParams.get('clientsLimit') || '5');
    const clientsLimit = Number.isFinite(clientsLimitRaw) && clientsLimitRaw >= 1
        ? Math.min(clientsLimitRaw, 50)
        : 5;
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const selectedTabIdStr = url.searchParams.get('tabId');
    const selectedTabId = selectedTabIdStr ? parseInt(selectedTabIdStr) : 59;

    const [
        activeProjectsCount,
        activeTasksCount,
        totalTasksSnapshot,
        urgentTasks,
        bestClients,
        monthlyProfitsFromTasks,
        monthlyProfitsFromStandaloneInvoices,
        monthlyTaskCounts,
        currentMonthTasksProfit,
        currentMonthStandaloneInvoices,
        previousMonthTasksProfit,
        previousMonthStandaloneInvoices,
        tabGroupsStatsData,
        allTabsForSelect,
        selectedTabTasksData
    ] = await Promise.all([
        // activeProjectsCount
        db.select({ count: count() }).from(tabGroup).then((res) => res[0].count),

        // activeTasksCount
        db.select({ count: count() }).from(task).where(ne(task.isDone, true)).then((res) => res[0].count),

        // totalTasksSnapshot
        assigneesRange === 'month'
            ? db.select({ count: count() }).from(task).where(and(ne(task.isDone, true), gte(task.created_at, currentMonthStart), lte(task.created_at, currentMonthEnd))).then(res => res[0].count)
            : assigneesRange === 'month-all'
            ? db.select({ count: count() }).from(task).where(and(gte(task.created_at, currentMonthStart), lte(task.created_at, currentMonthEnd))).then(res => res[0].count)
            : db.select({ count: count() }).from(task).then(res => res[0].count),

        // urgentTasks
        db.select({
                id: task.id,
                title: task.title,
                endDate: task.endDate,
                clientName: client.name,
                responsibleName: sql<string>`STRING_AGG(${user.name}, ', ')`,
                status: task.endDate
            })
            .from(task)
            .leftJoin(tab, eq(task.tabId, tab.id))
            .leftJoin(client, eq(task.clientId, client.id))
            .leftJoin(taskAssignee, eq(taskAssignee.taskId, task.id))
            .leftJoin(user, eq(taskAssignee.userId, user.id))
            .where(and(
                or(eq(task.endDate, todayStr), eq(task.endDate, tomorrowStr), sql`${task.endDate} < ${todayStr}`),
                ne(task.isDone, true),
                or(
                    eq(task.createdById, locals.user!.id),
                    exists(db.select({ id: taskAssignee.taskId }).from(taskAssignee).where(and(eq(taskAssignee.taskId, task.id), eq(taskAssignee.userId, locals.user!.id))))
                ),
                or(isNull(tab.groupId), notInArray(tab.groupId, allHiddenGroups))
            ))
            .groupBy(task.id, task.title, task.endDate, client.name, tab.id)
            .orderBy(task.endDate)
            .limit(5),

        // bestClients
        db.select({
                id: client.id,
                name: client.name,
                totalRevenue: sql<number>`COALESCE(SUM(DISTINCT CASE WHEN ${invoice.id} IS NOT NULL THEN ${invoice.subtotal} ELSE ${task.price} END), 0)`,
                totalCost: sql<number>`COALESCE(SUM(${taskProduct.count} * ${product.cost}), 0)`,
                taskCount: sql<number>`COUNT(DISTINCT ${task.id})`
            })
            .from(client)
            .leftJoin(task, eq(task.clientId, client.id))
            .leftJoin(invoice, eq(invoice.clientId, client.id))
            .leftJoin(taskProduct, eq(taskProduct.taskId, task.id))
            .leftJoin(product, eq(product.id, taskProduct.productId))
            .groupBy(client.id, client.name)
            .having(sql`COALESCE(SUM(DISTINCT CASE WHEN ${invoice.id} IS NOT NULL THEN ${invoice.subtotal} ELSE ${task.price} END), 0) > 0`)
            .orderBy(desc(sql`COALESCE(SUM(DISTINCT CASE WHEN ${invoice.id} IS NOT NULL THEN ${invoice.subtotal} ELSE ${task.price} END), 0)`))
            .limit(clientsLimit),

        // monthlyProfitsFromTasks
        db.select({
                month: sql<string>`TO_CHAR(${task.created_at}, 'YYYY-MM')`,
                taskId: task.id,
                revenue: sql<number>`COALESCE(${invoice.subtotal}, ${task.price}, 0)`,
                productCost: sql<number>`COALESCE(SUM(${taskProduct.count} * ${product.cost}), 0)`
            })
            .from(task)
            .leftJoin(invoice, eq(invoice.taskId, task.id))
            .leftJoin(taskProduct, eq(task.id, taskProduct.taskId))
            .leftJoin(product, eq(taskProduct.productId, product.id))
            .where(or(sql`${task.price} IS NOT NULL`, sql`${invoice.id} IS NOT NULL`))
            .groupBy(task.id, task.created_at, invoice.subtotal, task.price, sql`TO_CHAR(${task.created_at}, 'YYYY-MM')`)
            .orderBy(sql`TO_CHAR(${task.created_at}, 'YYYY-MM')`),

        // monthlyProfitsFromStandaloneInvoices
        db.select({ month: sql<string>`TO_CHAR(${invoice.created_at}, 'YYYY-MM')`, revenue: invoice.subtotal })
            .from(invoice)
            .where(isNull(invoice.taskId))
            .orderBy(sql`TO_CHAR(${invoice.created_at}, 'YYYY-MM')`),

        // monthlyTaskCounts
        db.select({ month: sql<string>`TO_CHAR(${task.created_at}, 'YYYY-MM')`, count: count(task.id) })
            .from(task)
            .groupBy(sql`TO_CHAR(${task.created_at}, 'YYYY-MM')`),

        // currentMonthTasksProfit
        db.select({
                taskId: task.id,
                revenue: sql<number>`COALESCE(${invoice.subtotal}, ${task.price}, 0)`,
                productCost: sql<number>`COALESCE(SUM(${taskProduct.count} * ${product.cost}), 0)`
            })
            .from(task)
            .leftJoin(invoice, eq(invoice.taskId, task.id))
            .leftJoin(taskProduct, eq(task.id, taskProduct.taskId))
            .leftJoin(product, eq(taskProduct.productId, product.id))
            .where(and(gte(task.created_at, currentMonthStart), lte(task.created_at, currentMonthEnd), or(sql`${task.price} IS NOT NULL`, sql`${invoice.id} IS NOT NULL`)))
            .groupBy(task.id, task.price, invoice.subtotal),

        // currentMonthStandaloneInvoices
        db.select({ revenue: invoice.subtotal })
            .from(invoice)
            .where(and(isNull(invoice.taskId), gte(invoice.created_at, currentMonthStart), lte(invoice.created_at, currentMonthEnd))),

        // previousMonthTasksProfit
        db.select({
                taskId: task.id,
                revenue: sql<number>`COALESCE(${invoice.subtotal}, ${task.price}, 0)`,
                productCost: sql<number>`COALESCE(SUM(${taskProduct.count} * ${product.cost}), 0)`
            })
            .from(task)
            .leftJoin(invoice, eq(invoice.taskId, task.id))
            .leftJoin(taskProduct, eq(task.id, taskProduct.taskId))
            .leftJoin(product, eq(taskProduct.productId, product.id))
            .where(and(gte(task.created_at, previousMonthStart), lte(task.created_at, previousMonthEnd), or(sql`${task.price} IS NOT NULL`, sql`${invoice.id} IS NOT NULL`)))
            .groupBy(task.id, task.price, invoice.subtotal),

        // previousMonthStandaloneInvoices
        db.select({ revenue: invoice.subtotal })
            .from(invoice)
            .where(and(isNull(invoice.taskId), gte(invoice.created_at, previousMonthStart), lte(invoice.created_at, previousMonthEnd))),

        // tabGroupsStatsData
        db.query.tabGroup.findMany({
            with: {
                translations: true,
                tabs: {
                    with: {
                        tasks: {
                            where: (t, { ne, isNull, or }) => or(ne(t.isDone, true), isNull(t.isDone)),
                            columns: { id: true }
                        }
                    }
                }
            }
        }),

        // allTabsForSelect
        db.query.tab.findMany({ with: { translations: true } }),

        // selectedTabTasksData
        db.select({
                id: task.id,
                title: task.title,
                price: sql<number>`COALESCE(${invoice.subtotal}, ${task.price})`,
                hasInvoice: sql<boolean>`${invoice.id} IS NOT NULL`,
                clientName: client.name,
                endDate: task.endDate
            })
            .from(task)
            .leftJoin(invoice, eq(invoice.taskId, task.id))
            .leftJoin(client, eq(task.clientId, client.id))
            .where(and(eq(task.tabId, selectedTabId), or(ne(task.isDone, true), isNull(task.isDone))))
            .orderBy(desc(task.created_at))
    ]);

    const totalTasksCount = Number(totalTasksSnapshot) || 1;

    // Build monthly chart data
    type MonthStats = { profit: number; revenue: number };
    const monthlyStats = monthlyProfitsFromTasks.reduce((acc, item) => {
        const rev = Number(item.revenue || 0);
        const cost = Number(item.productCost || 0);
        if (!acc[item.month]) acc[item.month] = { profit: 0, revenue: 0 };
        acc[item.month].profit += rev - cost;
        acc[item.month].revenue += rev;
        return acc;
    }, {} as Record<string, MonthStats>);
    monthlyProfitsFromStandaloneInvoices.forEach((item) => {
        const rev = Number(item.revenue || 0);
        if (!monthlyStats[item.month]) monthlyStats[item.month] = { profit: 0, revenue: 0 };
        monthlyStats[item.month].profit += rev;
        monthlyStats[item.month].revenue += rev;
    });
    const monthlyTaskCountMap = monthlyTaskCounts.reduce((acc, item) => {
        acc[item.month] = Number(item.count);
        return acc;
    }, {} as Record<string, number>);
    const chartData = [];
    for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStr = date.toISOString().slice(0, 7);
        const stats = monthlyStats[monthStr];
        chartData.push({ month: monthStr, profit: stats?.profit ?? 0, revenue: stats?.revenue ?? 0, taskCount: monthlyTaskCountMap[monthStr] || 0 });
    }

    const currentMonthProfit =
        currentMonthTasksProfit.reduce((total, t) => total + Number(t.revenue || 0) - Number(t.productCost || 0), 0) +
        currentMonthStandaloneInvoices.reduce((total, i) => total + Number(i.revenue || 0), 0);
    const currentMonthRevenue =
        currentMonthTasksProfit.reduce((total, t) => total + Number(t.revenue || 0), 0) +
        currentMonthStandaloneInvoices.reduce((total, i) => total + Number(i.revenue || 0), 0);
    const previousMonthProfit =
        previousMonthTasksProfit.reduce((total, t) => total + Number(t.revenue || 0) - Number(t.productCost || 0), 0) +
        previousMonthStandaloneInvoices.reduce((total, i) => total + Number(i.revenue || 0), 0);
    const previousMonthRevenue =
        previousMonthTasksProfit.reduce((total, t) => total + Number(t.revenue || 0), 0) +
        previousMonthStandaloneInvoices.reduce((total, i) => total + Number(i.revenue || 0), 0);

    function calcChange(current: number, previous: number) {
        if (previous !== 0) return Math.round(((current - previous) / Math.abs(previous)) * 100);
        if (current > 0) return 100;
        return 0;
    }

    const profitChange = calcChange(currentMonthProfit, previousMonthProfit);
    const revenueChange = calcChange(currentMonthRevenue, previousMonthRevenue);

    const topResponsiblePersonsWithShare = topResponsiblePersons.map(person => ({
        ...person,
        share: Math.round((Number(person.taskCount) / totalTasksCount) * 100)
    }));

    const tabGroupsStats = tabGroupsStatsData.map(group => {
        const taskCount = group.tabs.reduce((sum, currentTab) => sum + currentTab.tasks.length, 0);
        return { id: group.id, color: group.color, translations: group.translations, taskCount };
    });

    const selectedTabTotalPrice = selectedTabTasksData.reduce((sum, t) => sum + (t.price || 0), 0);

    return {
        topManagers,
        topResponsiblePersons: topResponsiblePersonsWithShare,
        bestClients: bestClients.map(c => ({
            ...c,
            totalValue: profitMode === 'profit'
                ? Number(c.totalRevenue) - Number(c.totalCost)
                : Number(c.totalRevenue)
        })),
        urgentTasks,
        chartData,
        currentMonthProfit,
        currentMonthRevenue,
        activeProjectsCount,
        activeTasksCount,
        profitChange,
        revenueChange,
        profitMode,
        tabGroupsStats,
        allTabsForSelect,
        hiddenTabGroups,
        managersRange,
        assigneesRange,
        clientsLimit,
        selectedTabTasks: {
            id: selectedTabId,
            tasks: selectedTabTasksData,
            totalPrice: selectedTabTotalPrice
        }
    };
};

