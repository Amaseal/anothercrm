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
	import Merge from '@lucide/svelte/icons/git-merge';
	import X from '@lucide/svelte/icons/x';

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

		Object.entries(params).forEach(([key, value]) => {
			if (value !== null && value !== undefined && value !== '') {
				url.searchParams.set(key, value.toString());
			} else {
				url.searchParams.delete(key);
			}
		});

		if (url.searchParams.toString() === '') {
			url.searchParams.set('clear', 'true');
		}

		goto(url.toString(), { replaceState: true });
	}

	// Handle sorting
	function handleSort(column: keyof Client) {
		const sortableColumns: (keyof Client)[] = ['name', 'type', 'totalOrdered'];
		if (!sortableColumns.includes(column)) return;

		const newDirection = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc';

		updateUrlAndNavigate({ sortColumn: column, sortDirection: newDirection });
	}

	// Merge mode
	let mergeMode = $state(false);
	let selectedIds = $state<Set<number>>(new Set());

	function toggleMergeMode() {
		mergeMode = !mergeMode;
		selectedIds = new Set();
	}

	function toggleSelect(id: number) {
		const next = new Set(selectedIds);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		selectedIds = next;
	}

	function goToMerge() {
		const ids = [...selectedIds].join(',');
		goto(`/klienti/saplust?ids=${ids}`);
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
		{#if mergeMode}
			<span class="text-sm whitespace-nowrap text-muted-foreground"
				>{m['clients.merge_select']()}</span
			>
		{/if}
		<Button href="/klienti/pievienot" variant="outline" class="ml-auto flex items-center gap-2">
			<Plus />{m['components.add']()}
		</Button>
		{#if mergeMode}
			<Button
				variant="default"
				class="flex items-center gap-2"
				disabled={selectedIds.size < 2}
				onclick={goToMerge}
			>
				<Merge class="h-4 w-4" />
				{m['clients.merge_confirm']()}{selectedIds.size >= 2 ? ` (${selectedIds.size})` : ''}
			</Button>
			<Button
				variant="ghost"
				size="icon"
				onclick={toggleMergeMode}
				title={m['clients.merge_cancel']()}
			>
				<X class="h-4 w-4" />
			</Button>
		{:else}
			<Button variant="outline" class="flex items-center gap-2" onclick={toggleMergeMode}>
				<Merge class="h-4 w-4" />
				{m['clients.merge']()}
			</Button>
		{/if}
	</div>
</header>
<div class="mb-4 space-y-4">
	<div class="rounded-md border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					{#if mergeMode}
						<Table.Head class="w-10"></Table.Head>
					{/if}
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
					{#if !mergeMode}
						<Table.Head class="w-12 text-center">{m['components.edit']()}</Table.Head>
						<Table.Head class="w-12 text-center">{m['components.delete']()}</Table.Head>
					{/if}
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if data.clients.length === 0}
					<Table.Row>
						<Table.Cell colspan={mergeMode ? 6 : 8} class="py-6 text-center"
							>{m['clients.empty']()}</Table.Cell
						>
					</Table.Row>
				{:else}
					{#each data.clients as item (item.id)}
						<Table.Row
							class="cursor-pointer hover:bg-muted/50 {mergeMode && selectedIds.has(item.id)
								? 'bg-primary/5'
								: ''}"
							onclick={mergeMode ? () => toggleSelect(item.id) : () => goto(`/klienti/${item.id}`)}
						>
							{#if mergeMode}
								<Table.Cell class="text-center">
									<input
										type="checkbox"
										checked={selectedIds.has(item.id)}
										class="h-4 w-4 cursor-pointer accent-primary"
										onclick={(e) => e.stopPropagation()}
										onchange={() => toggleSelect(item.id)}
									/>
								</Table.Cell>
							{/if}
							<Table.Cell class="font-medium">{item.name || '-'}</Table.Cell>
							<Table.Cell>{item.phone || '-'}</Table.Cell>
							<Table.Cell class="hidden md:table-cell">{item.email || '-'}</Table.Cell>
							<Table.Cell class="hidden md:table-cell">{item.description || '-'}</Table.Cell>
							<Table.Cell class="hidden md:table-cell">{item.type || '-'}</Table.Cell>
							<Table.Cell class="hidden md:table-cell">
								{toCurrency(item.totalOrdered as number) || '-'} €
							</Table.Cell>
							{#if !mergeMode}
								<Table.Cell class="text-center">
									<Button
										href="/klienti/labot/{item.id}"
										variant="ghost"
										onclick={(e) => e.stopPropagation()}><Pencil /></Button
									>
								</Table.Cell>
								<Table.Cell class="text-center">
									<Button
										href="/klienti/izdzest/{item.id}"
										variant="ghost"
										class="hover:bg-red-100 hover:text-red-600"
										onclick={(e) => e.stopPropagation()}><Trash2 /></Button
									>
								</Table.Cell>
							{/if}
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>

	<!-- Pagination -->
	<Pagination pagination={data.pagination} />
</div>
