import { page } from '$app/stores';
import { derived } from 'svelte/store';

export const user = derived(page, ($page) => $page.data.user);

export const isAdmin = derived(user, ($user) => $user?.type === 'admin');
export const isClient = derived(user, ($user) => $user?.type === 'client');
