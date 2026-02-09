import { getCompletedTasks } from '$lib/server/queries/projekti';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ url }) => {
    const page = parseInt(url.searchParams.get('page') || '0');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '50');
    const search = url.searchParams.get('search') || '';
    const sortColumn = url.searchParams.get('sortColumn') || 'endDate';
    const sortDirection = (url.searchParams.get('sortDirection') as 'asc' | 'desc') || 'desc';

    const data = await getCompletedTasks(page, pageSize, search, sortColumn, sortDirection);

    return data;
};
