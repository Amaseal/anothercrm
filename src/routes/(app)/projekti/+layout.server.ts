import type { LayoutServerLoad } from '../$types';
import { getProjectBoardData } from '$lib/server/queries/projekti';
import { getLocale } from '$lib/paraglide/runtime';
import { handleListParams } from '$lib/server/paramState';

export const load: LayoutServerLoad = async ({ locals, url, cookies }) => {

	const user = locals.user;

	if (!user) {

		return { user: null, columns: [] };
	}
	const locale = getLocale();

	const activeParams = handleListParams(url, cookies, '/projekti', 'projekti_filters');

	const showAll = activeParams.get('view') === 'all';
	const search = activeParams.get('search') || undefined;

	const data = await getProjectBoardData(
		// @ts-ignore
		user as { id: string; type: 'admin' | 'client' },
		locale,
		showAll,
		search
	);

	return {
		...data,
		pagination: {
			search
		}
	};
};
