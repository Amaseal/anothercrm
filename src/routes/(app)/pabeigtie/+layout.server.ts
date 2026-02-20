import { getCompletedTasks } from '$lib/server/queries/projekti';
import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { handleListParams } from '$lib/server/paramState';

export const load: LayoutServerLoad = async ({ url, locals, cookies }) => {
    if (!locals.user) {
        throw redirect(302, '/login');
    }

    const activeParams = handleListParams(url, cookies, '/pabeigtie', 'pabeigtie_filters');

    const page = parseInt(activeParams.get('page') || '0');
    const pageSize = parseInt(activeParams.get('pageSize') || '50');
    const search = activeParams.get('search') || '';
    const sortColumn = activeParams.get('sortColumn') || 'endDate';
    const sortDirection = (activeParams.get('sortDirection') as 'asc' | 'desc') || 'desc';

    const data = await getCompletedTasks(locals.user, page, pageSize, search, sortColumn, sortDirection);

    return data;
};
