import { db } from '$lib/server/db';
import { task, user, client, taskProduct, product, tab, tabGroup } from '$lib/server/db/schema';
import { sql, count, desc, eq, and, or, lte, gte, ne } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {

    if (locals.user?.type === 'client') {
        return redirect(302, '/projekti');
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

    // Get top managers (users with highest total task prices all time)
    const topManagers = await db
        .select({
            id: user.id,
            name: user.name,
            totalValue: sql<number>`COALESCE(SUM(${task.price}), 0)`
        })
        .from(user)
        .leftJoin(task, eq(task.createdById, user.id))
        .groupBy(user.id, user.name)
        .orderBy(desc(sql`COALESCE(SUM(${task.price}), 0)`))
        .limit(5);

    // Get top responsible persons (users with most responsible tasks all time)
    const topResponsiblePersons = await db
        .select({
            id: user.id,
            name: user.name,
            taskCount: count(task.id)
        })
        .from(user)
        .leftJoin(task, eq(task.assignedToUserId, user.id))
        .groupBy(user.id, user.name)
        .orderBy(desc(count(task.id)))
        .limit(5);

    // Get active projects count (tab groups)
    const activeProjectsCount = await db
        .select({ count: count() })
        .from(tabGroup)
        .then((res) => res[0].count);

    // Get active tasks count
    const activeTasksCount = await db
        .select({ count: count() })
        .from(task)
        .where(ne(task.isDone, true))
        .then((res) => res[0].count);

    // Get total tasks count for responsible person share calculation
    const totalTasksSnapshot = await db.select({ count: count() }).from(task).then(res => res[0].count);
    const totalTasksCount = Number(totalTasksSnapshot) || 1; // Avoid division by zero

    // Get urgent tasks (due today, tomorrow, or overdue)
    // Exclude completed tasks by filtering out the "done" tab
    const urgentTasks = await db
        .select({
            id: task.id,
            title: task.title,
            endDate: task.endDate,
            clientName: client.name,
            responsibleName: user.name,
            status: task.endDate
        })
        .from(task)
        .leftJoin(client, eq(task.clientId, client.id))
        .leftJoin(user, eq(task.assignedToUserId, user.id))
        .where(
            and(
                or(
                    eq(task.endDate, todayStr),
                    eq(task.endDate, tomorrowStr),
                    sql`${task.endDate} < ${todayStr}`
                ),
                ne(task.isDone, true),
                or(
                    eq(task.createdById, locals.user!.id),
                    eq(task.assignedToUserId, locals.user!.id)
                )
            )
        )
        .orderBy(task.endDate)
        .limit(5);

    // Get best clients by total ordered
    const bestClients = await db
        .select({
            id: client.id,
            name: client.name,
            totalOrdered: client.totalOrdered
        })
        .from(client)
        .where(sql`${client.totalOrdered} > 0`)
        .orderBy(desc(client.totalOrdered))
        .limit(5);

    // Get all monthly profit data with product costs subtracted
    const monthlyProfits = await db
        .select({
            month: sql<string>`TO_CHAR(${task.created_at}, 'YYYY-MM')`,
            taskId: task.id,
            taskPrice: task.price,
            productCost: sql<number>`COALESCE(SUM(${taskProduct.count} * ${product.cost}), 0)`
        })
        .from(task)
        .leftJoin(taskProduct, eq(task.id, taskProduct.taskId))
        .leftJoin(product, eq(taskProduct.productId, product.id))
        .where(sql`${task.price} IS NOT NULL`)
        .groupBy(
            task.id,
            task.price,
            sql`TO_CHAR(${task.created_at}, 'YYYY-MM')`
        )
        .orderBy(sql`TO_CHAR(${task.created_at}, 'YYYY-MM')`);

    // Calculate profit by month (task price - product costs)
    const monthlyProfitSums = monthlyProfits.reduce((acc, item) => {
        const profit = (item.taskPrice || 0) - (item.productCost || 0);
        if (!acc[item.month]) {
            acc[item.month] = 0;
        }
        acc[item.month] += profit;
        return acc;
    }, {} as Record<string, number>);

    // Create array of last 12 months with zero values as default
    const chartData = [];
    for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStr = date.toISOString().slice(0, 7); // YYYY-MM format

        // Find if we have data for this month
        const monthProfit = monthlyProfitSums[monthStr] || 0;

        chartData.push({
            month: monthStr,
            profit: monthProfit
        });
    }

    // Calculate profit for current month (task prices - product costs)
    const currentMonthTasks = await db
        .select({
            taskId: task.id,
            taskPrice: task.price,
            productCost: sql<number>`COALESCE(SUM(${taskProduct.count} * ${product.cost}), 0)`
        })
        .from(task)
        .leftJoin(taskProduct, eq(task.id, taskProduct.taskId))
        .leftJoin(product, eq(taskProduct.productId, product.id))
        .where(
            and(
                gte(task.created_at, currentMonthStart),
                lte(task.created_at, currentMonthEnd),
                sql`${task.price} IS NOT NULL`
            )
        )
        .groupBy(task.id, task.price);

    // Calculate total profit for current month
    const currentMonthProfit = currentMonthTasks.reduce((total, taskData) => {
        const profit = (taskData.taskPrice || 0) - (taskData.productCost || 0);
        return total + profit;
    }, 0);

    // Calculate profit for previous month
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const previousMonthTasks = await db
        .select({
            taskId: task.id,
            taskPrice: task.price,
            productCost: sql<number>`COALESCE(SUM(${taskProduct.count} * ${product.cost}), 0)`
        })
        .from(task)
        .leftJoin(taskProduct, eq(task.id, taskProduct.taskId))
        .leftJoin(product, eq(taskProduct.productId, product.id))
        .where(
            and(
                gte(task.created_at, previousMonthStart),
                lte(task.created_at, previousMonthEnd),
                sql`${task.price} IS NOT NULL`
            )
        )
        .groupBy(task.id, task.price);

    const previousMonthProfit = previousMonthTasks.reduce((total, taskData) => {
        const profit = (taskData.taskPrice || 0) - (taskData.productCost || 0);
        return total + profit;
    }, 0);

    let profitChange = 0;
    if (previousMonthProfit !== 0) {
        profitChange = ((currentMonthProfit - previousMonthProfit) / previousMonthProfit) * 100;
    } else if (currentMonthProfit > 0) {
        profitChange = 100; // 100% increase if previous was 0 and current is positive
    }

    // Update Top Responsible Persons with share calculation
    const topResponsiblePersonsWithShare = topResponsiblePersons.map(person => ({
        ...person,
        share: Math.round((Number(person.taskCount) / totalTasksCount) * 100)
    }));

    return {
        topManagers,
        topResponsiblePersons: topResponsiblePersonsWithShare,
        bestClients: bestClients.filter((client) => client.totalOrdered),
        urgentTasks,
        chartData,
        currentMonthProfit,
        activeProjectsCount,
        activeTasksCount,
        profitChange
    };
};
