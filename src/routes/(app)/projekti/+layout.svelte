<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { debounce } from '$lib/utilities';
	import { goto } from '$app/navigation';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { page } from '$app/state';
	import Plus from '@lucide/svelte/icons/plus';
	import Columns3Cog from '@lucide/svelte/icons/columns-3-cog';
	import * as m from '$lib/paraglide/messages';
	import List from '$lib/components/list.svelte';
	import * as Select from '$lib/components/ui/select/index.js';
	import { dragScroll } from '$lib/actions/drag-scroll';

	let { data, children } = $props();

	let searchTerm = $state(data.pagination?.search);

	const handleSearchInput = (event: Event) => {
		const target = event.target as HTMLInputElement;
		searchTerm = target.value;
		debouncedSearch(target.value);
	};

	const debouncedSearch = debounce((value: string) => {
		updateUrlAndNavigate({ search: value });
	}, 1200);

	function updateUrlAndNavigate(params: Record<string, any>) {
		const url = new URL(page.url);

		// Update the provided parameters
		Object.entries(params).forEach(([key, value]) => {
			if (value !== null && value !== undefined && value !== '') {
				url.searchParams.set(key, value.toString());
			} else {
				url.searchParams.delete(key);
			}
		});

		goto(url.toString(), { replaceState: true });
	}
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { browser } from '$app/environment';

	// Handle unified data structure (columns)
	let tabsToRender = $derived(data.columns || []);

	onMount(() => {
		if (browser && data.user) {
			const eventSource = new EventSource('/api/events');

			eventSource.onmessage = (event) => {
				const data = JSON.parse(event.data);
				if (data.type === 'create' || data.type === 'update' || data.type === 'delete') {
					// Invalidate all to reload data from server (simplest "performant enough" approach for now)
					// Optimally we'd update the store directly, but with complex mapping logic in load(),
					// reloading is safer to ensure consistency.
					invalidateAll();
				}
			};

			return () => {
				eventSource.close();
			};
		}
	});

	// ... (rest of search logic)
</script>

<header
	class="flex h-(--header-height) shrink-0 items-center gap-2 rounded-lg transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)"
>
	<div class="flex w-full items-center gap-1 lg:gap-2">
		<Sidebar.Trigger class="-ml-1" />
		<Separator orientation="vertical" class="mx-2 data-[orientation=vertical]:h-4" />
		<h1 class="text-base font-medium">{m['projects.value']()}</h1>
		<Separator orientation="vertical" class="mx-2 data-[orientation=vertical]:h-4" />
		<Input
			type="text"
			class="mb-0 w-full max-w-sm"
			placeholder={m['components.search']()}
			value={searchTerm}
			oninput={handleSearchInput}
		/>
		{#if data.user?.type === 'admin'}
			<div class="w-[180px]">
				<Select.Root
					type="single"
					value={page.url.searchParams.get('view') ?? 'default'}
					onValueChange={(v) => updateUrlAndNavigate({ view: v === 'default' ? null : v })}
				>
					<Select.Trigger>
						{page.url.searchParams.get('view') === 'all'
							? m['components.filter.show_all']()
							: m['components.filter.default']()}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="default">{m['components.filter.default']()}</Select.Item>
						<Select.Item value="all">{m['components.filter.show_all']()}</Select.Item>
					</Select.Content>
				</Select.Root>
			</div>
			<Button href="/projekti/struktura" variant="outline" class="ml-auto flex items-center gap-2">
				<Columns3Cog />
			</Button>
		{/if}

		<Button href="/projekti/pievienot" variant="outline" class="flex items-center gap-2"
			><Plus />{m['components.add']()}</Button
		>
	</div>
</header>

<div class="custom-scroll flex h-[calc(100vh-110px)] gap-4 overflow-x-auto pb-2" use:dragScroll>
	{#each tabsToRender as item}
		<List tab={item} />
	{/each}
</div>

{@render children?.()}
