<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
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
	import SearchInput from '$lib/components/search-input.svelte';
	import { getLocale } from '@/paraglide/runtime.js';
	import { isClient, isAdmin } from '$lib/stores/user';
	import ImageIcon from '@lucide/svelte/icons/image';
	import Eye from '@lucide/svelte/icons/eye';
	import Copy from '@lucide/svelte/icons/copy';
	import * as Dialog from '$lib/components/ui/dialog/index.js';

	let {
		data,
		children
	}: {
		data: {
			products: (Product & {
				translations: ProductTranslation[];
				price: string | number;
				clientPrices: { clientName: string; price: string }[];
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

		if (url.searchParams.toString() === '') {
			url.searchParams.set('clear', 'true');
		}

		goto(url.toString(), { replaceState: true });
	}

	function clearSearch() {
		debouncedSearch.cancel();
		searchTerm = '';
		updateUrlAndNavigate({ search: '', page: 0 });
	}

	function handleSort(column: keyof Product) {
		// Check if the column is sortable
		const sortableColumns: (keyof Product)[] = ['title', 'cost', 'price'];
		if (!sortableColumns.includes(column)) return;

		const newDirection = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc';

		updateUrlAndNavigate({
			sortColumn: column,
			sortDirection: newDirection
		});
	}
	function getLocalizedValue(
		item: Product & { translations: ProductTranslation[] },
		field: 'title' | 'description',
		locale: string
	) {
		const translation = item.translations?.find((t) => t.language === locale);
		if (translation && translation[field]) return translation[field];
		if (locale === 'lv') return item[field]; // Base schema holds 'lv' string usually as fallback
		return item[field];
	}

	let imageModalOpen = $state(false);
	let imageModalSrc = $state<string | null>(null);
	let imageModalAlt = $state('');

	function openImageModal(
		item: Product & { translations: ProductTranslation[]; image?: string | null }
	) {
		if (!item.image) return;
		imageModalSrc = item.image;
		imageModalAlt = getLocalizedValue(item, 'title', getLocale()) || '';
		imageModalOpen = true;
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
		<SearchInput
			class="w-full max-w-sm"
			placeholder={m['components.search']()}
			value={searchTerm}
			oninput={handleSearchInput}
			onclear={clearSearch}
		/>
		{#if !$isClient}
			<Button href="/produkti/pievienot" variant="outline" class="ml-auto flex items-center gap-2"
				><Plus />{m['components.add']()}</Button
			>
		{/if}
	</div>
</header>
<div class="mb-4 space-y-4">
	<!-- Table -->
	<div class="rounded-md border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-12">{m['products.image']()}</Table.Head>
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

					{#if !$isClient}
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
						<Table.Head
							class="hidden cursor-pointer md:table-cell"
							onclick={() => handleSort('price')}
						>
							<div class="flex items-center gap-1">
								{m['products.price']()}
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
						<Table.Head class="hidden md:table-cell"
							>{m['products.client_specific_prices']()}</Table.Head
						>
					{/if}

					<Table.Head class="hidden md:table-cell">{m['products.edited']()}</Table.Head>
					{#if !$isClient}
						<Table.Head class="w-12 text-center">{m['products.edit']()}</Table.Head>
						<Table.Head class="w-12 text-center">{m['products.copy']()}</Table.Head>
						<Table.Head class="w-12 text-center">{m['products.delete']()}</Table.Head>
					{/if}
					<Table.Head class="w-12 text-center">{m['products.view']()}</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if data.products.length === 0}
					<Table.Row>
						<Table.Cell colspan={$isClient ? 4 : 9} class="py-6 text-center"
							>{m['products.empty']()}</Table.Cell
						>
					</Table.Row>
				{:else}
					{#each data.products as item (item.id)}
						<Table.Row class="cursor-pointer hover:bg-muted/50">
							<Table.Cell>
								{#if item.image}
									<button
										class="flex cursor-pointer items-center"
										onclick={(e) => {
											e.stopPropagation();
											openImageModal(item);
										}}
									>
										<img
											src={item.image}
											alt={getLocalizedValue(item, 'title', getLocale())}
											class="h-10 w-10 rounded object-cover"
										/>
									</button>
								{:else}
									<div
										class="grid h-10 w-10 place-items-center rounded border bg-muted text-muted-foreground"
									>
										<ImageIcon size="16" />
									</div>
								{/if}
							</Table.Cell>
							<Table.Cell class="font-medium"
								>{getLocalizedValue(item, 'title', getLocale()) || '-'}</Table.Cell
							>
							<Table.Cell class="hidden md:table-cell"
								>{getLocalizedValue(item, 'description', getLocale()) || '-'}</Table.Cell
							>

							{#if !$isClient}
								<Table.Cell class="hidden md:table-cell">{item.cost} €</Table.Cell>
								<Table.Cell class="hidden md:table-cell">{item.price} €</Table.Cell>
								<Table.Cell class="hidden md:table-cell">
									{#if item.clientPrices && item.clientPrices.length > 0}
										<Tooltip.Provider delayDuration={150}>
											<Tooltip.Root>
												<Tooltip.Trigger
													class="cursor-help border-b border-dashed border-muted-foreground/60"
													>{item.clientPrices.length}</Tooltip.Trigger
												>
												<Tooltip.Content>
													<div class="flex max-h-[300px] w-[300px] flex-col gap-1 overflow-y-auto">
														<div class="mb-1 border-b px-1 pb-1 font-semibold">
															{m['products.client_specific_prices']()}
														</div>
														{#each item.clientPrices as cp}
															<div
																class="flex justify-between gap-4 rounded px-1 py-0.5 text-sm transition-colors hover:bg-muted/50"
															>
																<span class="truncate pr-4">{cp.clientName}</span>
																<span class="font-medium whitespace-nowrap">{cp.price} €</span>
															</div>
														{/each}
													</div>
												</Tooltip.Content>
											</Tooltip.Root>
										</Tooltip.Provider>
									{:else}
										<span class="text-muted-foreground">0</span>
									{/if}
								</Table.Cell>
							{/if}

							<Table.Cell class="hidden md:table-cell">
								{formatDate(item.updated_at || item.created_at)}
							</Table.Cell>
							{#if !$isClient}
								<Table.Cell class="text-right">
									<Button href="/produkti/labot/{item.id}" variant="ghost"><Pencil /></Button>
								</Table.Cell>
								{#if $isAdmin}
									<Table.Cell class="text-right">
										<Button
											href="/produkti/pievienot?kopet={item.id}"
											variant="ghost"
											class="hover:bg-blue-100 hover:text-blue-600"><Copy /></Button
										>
									</Table.Cell>
								{:else}
									<Table.Cell></Table.Cell>
								{/if}
								<Table.Cell class="text-right">
									<Button
										href="/produkti/izdzest/{item.id}"
										variant="ghost"
										class="hover:bg-red-100 hover:text-red-600"><Trash2 /></Button
									>
								</Table.Cell>
							{/if}
							<Table.Cell class="text-center">
								<Button href="/produkti/skatit/{item.id}" variant="ghost"><Eye /></Button>
							</Table.Cell>
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>
	<Pagination pagination={data.pagination} />
</div>

<!-- Image lightbox -->
<Dialog.Root bind:open={imageModalOpen}>
	<Dialog.Content class="max-h-[90vh] max-w-[60vw]">
		<Dialog.Header>
			<Dialog.Title>{imageModalAlt}</Dialog.Title>
		</Dialog.Header>
		{#if imageModalSrc}
			<img
				class="max-h-[75vh] w-full rounded-xl object-contain"
				src={imageModalSrc}
				alt={imageModalAlt}
			/>
		{/if}
	</Dialog.Content>
</Dialog.Root>
