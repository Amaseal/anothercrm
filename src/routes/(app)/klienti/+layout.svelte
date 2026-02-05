<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Table from '$lib/components/ui/table/index.js';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { debounce, toCurrency } from '$lib/utilities';
	import { goto } from '$app/navigation';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Plus from '@lucide/svelte/icons/plus';
	import type { Client } from '$lib/server/db/schema.js';
	import { page } from '$app/state';
	import Pencil from '@lucide/svelte/icons/pencil';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Separator } from '$lib/components/ui/separator';
	import Pagination from '@/components/pagination.svelte';

	import * as m from '$lib/paraglide/messages';

	let {
		data,
		children
	}: {
		data: {
			clients: Client[];
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
	let sortColumn = $state(data.pagination.sortColumn as keyof Client | null);
	let sortDirection = $state(data.pagination.sortDirection as 'asc' | 'desc');
	let searchTerm = $state(data.pagination.search);

	// Keep local state in sync with server data
	$effect(() => {
		currentPage = data.pagination.page;
		pageSize = data.pagination.pageSize;
		sortColumn = data.pagination.sortColumn as keyof Client | null;
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
	function handleSort(column: keyof Client) {
		// Check if the column is sortable
		const sortableColumns: (keyof Client)[] = ['name', 'type', 'totalOrdered'];
		if (!sortableColumns.includes(column)) return;

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
		<h1 class="text-base font-medium">{m['clients.value']()}</h1>
		<Separator orientation="vertical" class="mx-2 data-[orientation=vertical]:h-4" />
		<Input
			type="text"
			class="mb-0 w-full max-w-sm"
			placeholder={m['components.search']()}
			value={searchTerm}
			oninput={handleSearchInput}
		/>
		<Button href="/klienti/pievienot" variant="outline" class="ml-auto flex items-center gap-2"
			><Plus />{m['components.add']()}</Button
		>
	</div>
</header>
<div class="mb-4 space-y-4">
	<div class="rounded-md border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-[150px] cursor-pointer" onclick={() => handleSort('name')}>
						<div class="flex items-center gap-1">
							{m['clients.name']()}
							{#if sortColumn === 'name'}
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
					<Table.Head class="hidden md:table-cell">{m['clients.phone']()}</Table.Head>
					<Table.Head class="hidden md:table-cell">{m['clients.email']()}</Table.Head>
					<Table.Head class="hidden md:table-cell">{m['clients.description']()}</Table.Head>
					<Table.Head
						class="hidden cursor-pointer md:table-cell"
						onclick={() => handleSort('type')}
					>
						<div class="flex items-center gap-1">
							{m['clients.type']()}
							{#if sortColumn === 'type'}
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
					<Table.Head class="cursor-pointer" onclick={() => handleSort('totalOrdered')}>
						<div class="flex items-center gap-1">
							{m['clients.total_ordered']()}
							{#if sortColumn === 'totalOrdered'}
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
					<Table.Head class="w-12 text-center">{m['components.edit']()}</Table.Head>
					<Table.Head class="w-12 text-center">{m['components.delete']()}</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if data.clients.length === 0}
					<Table.Row>
						<Table.Cell colspan={8} class="py-6 text-center">{m['clients.empty']()}</Table.Cell>
					</Table.Row>
				{:else}
					{#each data.clients as item (item.id)}
						<Table.Row class="cursor-pointer hover:bg-muted/50">
							<Table.Cell class="font-medium">{item.name || '-'}</Table.Cell>
							<Table.Cell>{item.phone || '-'}</Table.Cell>
							<Table.Cell class="hidden md:table-cell">{item.email || '-'}</Table.Cell>
							<Table.Cell class="hidden md:table-cell">{item.description || '-'}</Table.Cell>
							<Table.Cell class="hidden md:table-cell">{item.type || '-'}</Table.Cell>
							<Table.Cell class="hidden md:table-cell"
								>{toCurrency(item.totalOrdered as number) || '-'} €</Table.Cell
							>
							<Table.Cell class="text-center">
								<Button href="/klienti/labot/{item.id}" variant="ghost"><Pencil /></Button>
							</Table.Cell>
							<Table.Cell class="text-center">
								<Button
									href="/klienti/izdzest/{item.id}"
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
