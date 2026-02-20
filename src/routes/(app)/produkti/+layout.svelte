<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Table from '$lib/components/ui/table/index.js';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';

	import { debounce } from '$lib/utilities';
	import { goto } from '$app/navigation';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { formatDate } from '$lib/utilities';
	import { page } from '$app/state';
	import type { Product, ProductTranslation } from '$lib/server/db/schema.js';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Plus from '@lucide/svelte/icons/plus';
	import * as m from '$lib/paraglide/messages';
	import Pagination from '$lib/components/pagination.svelte';
	import { getLocale } from '@/paraglide/runtime.js';

	let {
		data,
		children
	}: {
		data: {
			products: (Product & { translations: ProductTranslation[] })[];
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

	let sortColumn = $state(data.pagination.sortColumn as keyof Product | null);
	let sortDirection = $state(data.pagination.sortDirection as 'asc' | 'desc');
	let searchTerm = $state(data.pagination.search);

	$effect(() => {
		sortColumn = data.pagination.sortColumn as keyof Product | null;
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

	function handleSort(column: keyof Product) {
		// Check if the column is sortable
		const sortableColumns: (keyof Product)[] = ['title', 'cost'];
		if (!sortableColumns.includes(column)) return;

		const newDirection = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc';

		updateUrlAndNavigate({
			sortColumn: column,
			sortDirection: newDirection
		});
	}

	function getLocalizedValue(item: Product & { translations: ProductTranslation[] }, field: 'title' | 'description', locale: string) {
		const translation = item.translations?.find(t => t.language === locale);
		if (translation && translation[field]) return translation[field];
        if (locale === 'lv') return item[field]; // Base schema holds 'lv' string usually as fallback
		return item[field];
	}
</script>

{@render children?.()}
<header
	class=" flex h-(--header-height) shrink-0 items-center gap-2 rounded-lg transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)"
>
	<div class="flex w-full items-center gap-1 lg:gap-2">
		<Sidebar.Trigger class="-ml-1" />
		<Separator orientation="vertical" class="mx-2 data-[orientation=vertical]:h-4" />
		<h1 class="text-base font-medium">{m['products.value']()}</h1>
		<Separator orientation="vertical" class="mx-2 data-[orientation=vertical]:h-4" />
		<Input
			type="text"
			class="mb-0 w-full max-w-sm"
			placeholder={m['components.search']()}
			value={searchTerm}
			oninput={handleSearchInput}
		/>
		<Button href="/produkti/pievienot" variant="outline" class="ml-auto flex items-center gap-2"
			><Plus />{m['components.add']()}</Button
		>
	</div>
</header>
<div class="mb-4 space-y-4">
	<!-- Table -->
	<div class="rounded-md border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-[150px] cursor-pointer" onclick={() => handleSort('title')}>
						<div class="flex items-center gap-1">
							{m['products.name']()}
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
					<Table.Head class="hidden md:table-cell">{m['products.description']()}</Table.Head>

					<Table.Head
						class="hidden cursor-pointer md:table-cell"
						onclick={() => handleSort('cost')}
					>
						<div class="flex items-center gap-1">
							{m['products.cost']()}
							{#if sortColumn === 'cost'}
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
					<Table.Head class="hidden md:table-cell">{m['products.edited']()}</Table.Head>
					<Table.Head class="w-12 text-center">{m['products.edit']()}</Table.Head>
					<Table.Head class="w-12 text-center">{m['products.delete']()}</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if data.products.length === 0}
					<Table.Row>
						<Table.Cell colspan={6} class="py-6 text-center">{m['products.empty']()}</Table.Cell>
					</Table.Row>
				{:else}
					{#each data.products as item (item.id)}
						<Table.Row class="cursor-pointer hover:bg-muted/50">
							<Table.Cell class="font-medium">{getLocalizedValue(item, 'title', getLocale()) || '-'}</Table.Cell>
							<Table.Cell class="hidden md:table-cell">{getLocalizedValue(item, 'description', getLocale()) || '-'}</Table.Cell>
							<Table.Cell class="hidden md:table-cell">{item.cost} €</Table.Cell>

							<Table.Cell class="hidden md:table-cell">
								{formatDate(item.updated_at || item.created_at)}
							</Table.Cell>

							<Table.Cell class="text-right">
								<Button href="/produkti/labot/{item.id}" variant="ghost"><Pencil /></Button>
							</Table.Cell>
							<Table.Cell class="text-right">
								<Button
									href="/produkti/izdzest/{item.id}"
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
	<Pagination pagination={data.pagination} />
</div>
