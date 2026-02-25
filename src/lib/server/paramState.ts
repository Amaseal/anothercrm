import { redirect } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';

/**
 * Handles saving and restoring list view query parameters using cookies.
 * 
 * @param url The current page URL from the load function
 * @param cookies The cookies object from the load function
 * @param basePath The base path of the list view (e.g., '/klienti')
 * @param cookieName The name of the cookie to store the parameters
 * @returns An object containing the current active parameters as key-value string pairs
 */
export function handleListParams(
    url: URL,
    cookies: Cookies,
    basePath: string,
    cookieName: string,
    excludeParams: string[] = []
): URLSearchParams {
    const currentSearch = url.search;
    const isAtBasePath = url.pathname === basePath || url.pathname === basePath + '/';

    if (url.searchParams.get('clear') === 'true') {
        cookies.delete(cookieName, { path: '/' });
        throw redirect(303, url.pathname);
    }

    if (currentSearch) {
        let paramsToSave = new URLSearchParams(currentSearch);
        excludeParams.forEach(param => paramsToSave.delete(param));

        let searchString = paramsToSave.toString() ? `?${paramsToSave.toString()}` : '';

        // If there are search params in the URL, save them to the cookie
        cookies.set(cookieName, searchString, {
            path: '/',
            maxAge: 60 * 60 * 24 * 365, // 1 year
            httpOnly: false, // Allow client-side access if needed
            secure: false
        });
        return new URLSearchParams(currentSearch);
    } else {
        // If there are no search params in the URL, check the cookie
        let savedSearch = cookies.get(cookieName);

        if (savedSearch) {
            let savedParams = new URLSearchParams(savedSearch);
            let hasExcluded = false;
            excludeParams.forEach(param => {
                if (savedParams.has(param)) {
                    savedParams.delete(param);
                    hasExcluded = true;
                }
            });

            if (hasExcluded) {
                savedSearch = savedParams.toString() ? `?${savedParams.toString()}` : '';
                cookies.set(cookieName, savedSearch, {
                    path: '/',
                    maxAge: 60 * 60 * 24 * 365,
                    httpOnly: false,
                    secure: false
                });
            }

            if (!savedSearch) {
                return new URLSearchParams();
            }

            if (isAtBasePath) {
                // If we are at the root list view without params, but have saved params, redirect
                throw redirect(303, `${basePath}${savedSearch}`);
            } else {
                // If we are in a sub-route (e.g., editing an item), we don't want to redirect,
                // but we still want the layout to have the correct pagination data for the UI behind it
                return new URLSearchParams(savedSearch);
            }
        }
    }

    // Default fallback
    return new URLSearchParams();
}
