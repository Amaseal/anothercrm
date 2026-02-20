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
    cookieName: string
): URLSearchParams {
    const currentSearch = url.search;
    const isAtBasePath = url.pathname === basePath || url.pathname === basePath + '/';



    if (currentSearch) {

        // If there are search params in the URL, save them to the cookie
        cookies.set(cookieName, currentSearch, {
            path: '/',
            maxAge: 60 * 60 * 24 * 365, // 1 year
            httpOnly: false, // Allow client-side access if needed
            secure: false
        });
        return new URLSearchParams(currentSearch);
    } else {
        // If there are no search params in the URL, check the cookie
        const savedSearch = cookies.get(cookieName);



        if (savedSearch) {
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
