import type { LayoutServerLoad } from '../$types';
import { getProjectBoardData } from '$lib/server/queries/projekti';
import { getLocale } from '$lib/paraglide/runtime';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const user = locals.user;

	if (!user) return { user: null, columns: [] };

	// Assuming we can get locale from runtime. 
	// If not, we might need to parse it from the event or use another method.
	// Based on hooks, paraglide is set up. `languageTag()` should work if running in context.
	// Ideally, we pass it from `locals` if hooks set it there, but standard paraglide usage is import.
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
