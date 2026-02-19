import type { LayoutServerLoad } from '../$types';
import { getProjectBoardData } from '$lib/server/queries/projekti';
import { getLocale } from '$lib/paraglide/runtime';

export const load: LayoutServerLoad = async ({ locals, url }) => {

	const user = locals.user;

	if (!user) {

		return { user: null, columns: [] };
	}
	const locale = getLocale();

	const showAll = url.searchParams.get('view') === 'all';
	const search = url.searchParams.get('search') || undefined;

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
