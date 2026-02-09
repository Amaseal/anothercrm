<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Table from '$lib/components/ui/table/index.js';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { debounce, toCurrency, formatDate } from '$lib/utilities';
	import { goto } from '$app/navigation';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Eye from '@lucide/svelte/icons/eye';
	import { page } from '$app/state';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Separator } from '$lib/components/ui/separator';
	import Pagination from '@/components/pagination.svelte';
	import type { Task } from '$lib/server/db/schema';
	import * as m from '$lib/paraglide/messages';

	let {
		data,
		children
	}: {
		data: {
			tasks: (Task & {
				client?: { name: string };
				assignedToUser?: { name: string };
				creator?: { name: string };
			})[];
			pagination: {
				page: number;
				pageSize: number;
				totalCount: number;
				totalPages: number;
				search: string;
				sortColumn: string;
				sortDirection: string;
			};
		};
		children?: () => any;
	} = $props();

	// Initialize state from server data
	let currentPage = $state(data.pagination.page);
	let pageSize = $state(data.pagination.pageSize);
	let sortColumn = $state(data.pagination.sortColumn);
	let sortDirection = $state(data.pagination.sortDirection as 'asc' | 'desc');
	let searchTerm = $state(data.pagination.search);

	// Keep local state in sync with server data
	$effect(() => {
		currentPage = data.pagination.page;
		pageSize = data.pagination.pageSize;
		sortColumn = data.pagination.sortColumn;
		sortDirection = data.pagination.sortDirection as 'asc' | 'desc';
		searchTerm = data.pagination.search;
	});

	// Set up debounced search
	const handleSearchInput = (event: Event) => {
		const target = event.target as HTMLInputElement;
		searchTerm = target.value;
		debouncedSearch(target.value);
	};

	const debouncedSearch = debounce((value: string) => {
		updateUrlAndNavigate({ search: value, page: 0 });
	}, 1200);

	// Update URL and navigate to the new page
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

		// Navigate to the new URL
		goto(url.toString(), { replaceState: true });
	}

	// Handle sorting
	function handleSort(column: string) {
		const newDirection = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc';
		updateUrlAndNavigate({
			sortColumn: column,
			sortDirection: newDirection
		});
	}
</script>

{@render children?.()}
<header
	class="flex h-(--header-height) shrink-0 items-center gap-2 rounded-lg transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)"
>
	<div class="flex w-full items-center gap-1 lg:gap-2">
		<Sidebar.Trigger class="-ml-1" />
		<Separator orientation="vertical" class="mx-2 data-[orientation=vertical]:h-4" />
		<h1 class="text-base font-medium">{m['completed_tasks.value']()}</h1>
		<Separator orientation="vertical" class="mx-2 data-[orientation=vertical]:h-4" />
		<Input
			type="text"
			class="mb-0 w-full max-w-sm"
			placeholder={m['components.search']()}
			value={searchTerm}
			oninput={handleSearchInput}
		/>
	</div>
</header>
<div class="mb-4 space-y-4">
	<div class="rounded-md border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-[300px] cursor-pointer" onclick={() => handleSort('title')}>
						<div class="flex items-center gap-1">
							{m['completed_tasks.title']()}
							{#if sortColumn === 'title'}
								{#if sortDirection === 'asc'}
									<ChevronUp size="14" />
								{:else}
									<ChevronDown size="14" />
								{/if}
							{:else}
								<ChevronDown size="14" />
							{/if}
						</div>
					</Table.Head>
					<Table.Head>{m['completed_tasks.client']()}</Table.Head>
					<Table.Head class="cursor-pointer" onclick={() => handleSort('price')}>
						<div class="flex items-center gap-1">
							{m['completed_tasks.price']()}
							{#if sortColumn === 'price'}
								{#if sortDirection === 'asc'}
									<ChevronUp size="14" />
								{:else}
									<ChevronDown size="14" />
								{/if}
							{:else}
								<ChevronDown size="14" />
							{/if}
						</div>
					</Table.Head>
					<Table.Head class="cursor-pointer" onclick={() => handleSort('endDate')}>
						<div class="flex items-center gap-1">
							{m['completed_tasks.end_date']()}
							{#if sortColumn === 'endDate'}
								{#if sortDirection === 'asc'}
									<ChevronUp size="14" />
								{:else}
									<ChevronDown size="14" />
								{/if}
							{:else}
								<ChevronDown size="14" />
							{/if}
						</div>
					</Table.Head>
					<Table.Head>{m['completed_tasks.assigned_to']()}</Table.Head>
					<Table.Head class="w-12 text-center">{m['completed_tasks.view']()}</Table.Head>
					<Table.Head class="w-12 text-center">{m['components.delete']()}</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if data.tasks.length === 0}
					<Table.Row>
						<Table.Cell colspan={7} class="py-6 text-center"
							>{m['completed_tasks.empty']()}</Table.Cell
						>
					</Table.Row>
				{:else}
					{#each data.tasks as item (item.id)}
						<Table.Row class="cursor-pointer hover:bg-muted/50">
							<Table.Cell class="font-medium">{item.title}</Table.Cell>
							<Table.Cell>{item.client?.name || '-'}</Table.Cell>
							<Table.Cell>{toCurrency(item.price || 0)} €</Table.Cell>
							<Table.Cell>{formatDate(item.endDate) || '-'}</Table.Cell>
							<Table.Cell>{item.assignedToUser?.name || '-'}</Table.Cell>
							<Table.Cell class="text-center">
								<Button href="/pabeigtie/{item.id}" variant="ghost"><Eye /></Button>
							</Table.Cell>
							<Table.Cell class="text-center">
								<Button
									href="/pabeigtie/izdzest/{item.id}"
									variant="ghost"
									class="hover:bg-red-100 hover:text-red-600"><Trash2 /></Button
								>
							</Table.Cell>
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>

	<!-- Enhanced Pagination Controls -->
	<Pagination pagination={data.pagination} />
</div>
