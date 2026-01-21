<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { debounce } from '$lib/utilities';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { formatDate } from '$lib/utilities';
	import type { Material } from '$lib/server/db/schema';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Plus from '@lucide/svelte/icons/plus';
	import { Separator } from '$lib/components/ui/separator';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as m from '$lib/paraglide/messages';
	import Pagination from '$lib/components/pagination.svelte';

	let {
		data,
		children
	}: {
		data: {
			materials: Material[];
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
	let pageSizeOptions = [5, 10, 25, 50, 100];
	let sortColumn = $state(data.pagination.sortColumn as keyof Material | null);
	let sortDirection = $state(data.pagination.sortDirection as 'asc' | 'desc');
	let searchTerm = $state(data.pagination.search);

	// Keep local state in sync with server data
	$effect(() => {
		currentPage = data.pagination.page;
		pageSize = data.pagination.pageSize;
		sortColumn = data.pagination.sortColumn as keyof Material | null;
		sortDirection = data.pagination.sortDirection as 'asc' | 'desc';
		searchTerm = data.pagination.search;
	});

	// Edit modal state
	let editModalOpen = $state(false);
	let currentItem: Material | null = $state(null);
	let editedItem: Partial<Material> = $state({});
	let imageModalOpen = $state(false);

	// Set up debounced search
	const handleSearchInput = (event: Event) => {
		const target = event.target as HTMLInputElement;
		searchTerm = target.value;
		debouncedSearch(target.value);
	};

	const debouncedSearch = debounce((value: string) => {
		updateUrlAndNavigate({ search: value, page: 0 });
	}, 1200);

	// For pagination display
	function getVisiblePageNumbers() {
		const { totalPages } = data.pagination;
		const pages: number[] = [];
		const maxVisiblePages = 5;

		if (totalPages <= maxVisiblePages) {
			// Show all pages if there are few
			for (let i = 0; i < totalPages; i++) {
				pages.push(i);
			}
		} else {
			// Otherwise show a window of pages around current
			const firstPage = 0;
			const lastPage = totalPages - 1;

			// Always include first page
			pages.push(firstPage);

			// Calculate range around current page
			let rangeStart = Math.max(1, currentPage - 1);
			let rangeEnd = Math.min(lastPage - 1, currentPage + 1);

			// Adjust range to always show 3 pages in the middle if possible
			if (currentPage <= 2) {
				rangeEnd = Math.min(lastPage - 1, 3);
			} else if (currentPage >= lastPage - 2) {
				rangeStart = Math.max(1, lastPage - 3);
			}

			// Add ellipsis after first page if needed
			if (rangeStart > 1) {
				pages.push(-1); // -1 represents ellipsis
			}

			// Add pages in range
			for (let i = rangeStart; i <= rangeEnd; i++) {
				pages.push(i);
			}

			// Add ellipsis before last page if needed
			if (rangeEnd < lastPage - 1) {
				pages.push(-2); // -2 represents ellipsis
			}

			// Always include last page
			if (lastPage > 0) {
				pages.push(lastPage);
			}
		}

		return pages;
	}

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
	function handleSort(column: keyof Material) {
		// Check if the column is sortable
		const sortableColumns: (keyof Material)[] = [
			'title',
			'article',
			'manufacturer',
			'gsm',
			'width',
			'remaining',
			'updated_at'
		];
		if (!sortableColumns.includes(column)) return;

		const newDirection = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc';

		updateUrlAndNavigate({
			sortColumn: column,
			sortDirection: newDirection
		});
	}
	// Edit functions
	function openEditModal(item: Material) {
		currentItem = item;
		// Create a deep copy of the item to avoid reference issues
		editedItem = JSON.parse(JSON.stringify(item));
		editModalOpen = true;
	}

	function openImageModal(item: Material) {
		currentItem = item;
		imageModalOpen = true;
	}

	// Pagination functions
	function goToPage(page: number) {
		if (page >= 0 && page < data.pagination.totalPages) {
			updateUrlAndNavigate({ page });
		}
	}

	function goToFirstPage() {
		goToPage(0);
	}

	function goToLastPage() {
		goToPage(Math.max(0, data.pagination.totalPages - 1));
	}

	function handlePageSizeChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const newPageSize = parseInt(target.value);
		updateUrlAndNavigate({
			pageSize: newPageSize,
			page: 0 // Reset to first page when changing page size
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
		<h1 class="text-base font-medium">{m['materials.value']()}</h1>
		<Separator orientation="vertical" class="mx-2 data-[orientation=vertical]:h-4" />
		<Input
			type="text"
			class="mb-0 w-full max-w-sm"
			placeholder={m['components.search']()}
			value={searchTerm}
			oninput={handleSearchInput}
		/>
		<Button href="/audumi/pievienot" variant="outline" class="ml-auto flex items-center gap-2"
			><Plus />{m['components.add']()}</Button
		>
	</div>
</header>

<div class="mb-4 space-y-4">
	<div class="rounded-md border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-[150px] cursor-pointer" onclick={() => handleSort('title')}>
						<div class="flex items-center gap-1">
							{m['materials.name']()}
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
					<Table.Head
						class="hidden cursor-pointer md:table-cell"
						onclick={() => handleSort('article')}
					>
						<div class="flex items-center gap-1">
							{m['materials.article']()}
							{#if sortColumn === 'article'}
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
					<Table.Head
						class="hidden cursor-pointer md:table-cell"
						onclick={() => handleSort('manufacturer')}
					>
						<div class="flex items-center gap-1">
							{m['materials.manufacturer']()}
							{#if sortColumn === 'manufacturer'}
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
					<Table.Head class="hidden cursor-pointer md:table-cell" onclick={() => handleSort('gsm')}>
						<div class="flex items-center gap-1">
							{m['materials.gsm']()}
							{#if sortColumn === 'gsm'}
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
					<Table.Head
						class="hidden cursor-pointer md:table-cell"
						onclick={() => handleSort('width')}
					>
						<div class="flex items-center gap-1">
							{m['materials.width']()}
							{#if sortColumn === 'width'}
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
					<Table.Head class="cursor-pointer" onclick={() => handleSort('remaining')}>
						<div class="flex items-center gap-1">
							{m['materials.remaining']()}
							{#if sortColumn === 'remaining'}
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

					<Table.Head
						class="hidden cursor-pointer md:table-cell"
						onclick={() => handleSort('updated_at')}
					>
						<div class="flex items-center gap-1">
							{m['materials.edited']()}:
							{#if sortColumn === 'updated_at'}
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
					<Table.Head class="hidden cursor-pointer md:table-cell"
						>{m['materials.image']()}</Table.Head
					>
					<Table.Head class="w-12 text-center">{m['materials.edit']()}</Table.Head>
					<Table.Head class="w-12 text-center">{m['materials.delete']()}</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if data.materials.length === 0}
					<Table.Row>
						<Table.Cell colspan={10} class="py-6 text-center">{m['materials.empty']()}</Table.Cell>
					</Table.Row>
				{:else}
					{#each data.materials as item (item.id)}
						<Table.Row class="hover:bg-muted/50" onclick={() => openEditModal(item)}>
							<Table.Cell class="font-medium">
								<div class="max-w-[100px] truncate sm:max-w-none" title={item.title}>
									{item.title || '-'}
								</div>
							</Table.Cell>
							<Table.Cell class="hidden md:table-cell">{item.article || '-'}</Table.Cell>
							<Table.Cell class="hidden md:table-cell">{item.manufacturer || '-'}</Table.Cell>
							<Table.Cell class="hidden md:table-cell"
								>{item.gsm !== undefined ? `${item.gsm} g/m²` : '-'}</Table.Cell
							>
							<Table.Cell class="hidden md:table-cell"
								>{item.width !== undefined ? `${item.width} mm` : '-'}</Table.Cell
							>
							<Table.Cell
								>{item.remaining !== undefined ? `${item.remaining} ruļļi` : '-'}</Table.Cell
							>
							<Table.Cell class="hidden md:table-cell"
								>{formatDate(item.updated_at || item.created_at)}</Table.Cell
							>
							<Table.Cell class="hidden md:table-cell">
								<button
									class="flex cursor-pointer items-center"
									onclick={(e) => {
										e.stopPropagation();
										openImageModal(item);
									}}
								>
									{#if item.image}
										<img class="h-8 w-8 rounded-full" src={item.image} alt="auduma piemers" />
									{:else}
										-
									{/if}
								</button>
							</Table.Cell>
							<Table.Cell class="text-center">
								<Button href="/audumi/labot/{item.id}" variant="outline"><Pencil /></Button>
							</Table.Cell>
							<Table.Cell class="text-center">
								<Button href="/audumi/izdzest/{item.id}" variant="destructive"><Trash2 /></Button>
							</Table.Cell>
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>
	<Pagination pagination={data.pagination} />
</div>

<!-- Image modal -->
<Dialog.Root bind:open={imageModalOpen}>
	<Dialog.Content class="max-h-[90vh] max-w-[50vw]">
		<Dialog.Header>
			<Dialog.Title>{currentItem?.image}</Dialog.Title>
		</Dialog.Header>
		{#if currentItem?.image}
			<img
				class="h-[80vh] w-[90vw] rounded-xl object-contain"
				src={currentItem.image}
				alt="decorative"
			/>
		{:else}
			<div class="p-4 text-center">No image available</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
