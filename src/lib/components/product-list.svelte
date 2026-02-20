<script lang="ts">
	import { getLocale } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Popover from '$lib/components/ui/popover';
	import * as Command from '$lib/components/ui/command';
	import { cn } from '$lib/utils';
	import { buttonVariants } from '$lib/components/ui/button';
	import { CheckIcon, ChevronsUpDownIcon, X } from '@lucide/svelte';
	import * as NumberField from '$lib/components/ui/number-field';

	interface Product {
		id: number;
		title: string;
		description?: string | null;
		cost: number;
		price: number;
		clientPrice?: number | null;
		translations?: { language: string; title: string; description: string | null }[];
	}

	let {
		products,
		totalPrice = $bindable(0),
		totalCost = $bindable(0),
		initialEntries = [],
		readonly = false,
		isAdmin = false
	} = $props<{
		products: Product[];
		totalPrice?: number;
		totalCost?: number;
		initialEntries?: { productId: number; count: number; isOpen: boolean }[];
		readonly?: boolean;
		isAdmin?: boolean;
	}>();

	let entries = $state<{ productId: number; count: number; isOpen: boolean }[]>(
		initialEntries.length > 0 ? initialEntries : [{ productId: 0, count: 1, isOpen: false }]
	);

	let translatedProducts = $derived(products.map((p: { translations: any[]; title: any; description: any; }) => {
		const lang = getLocale();
		const translation = p.translations?.find((t: { language: string; }) => t.language === lang);
		return {
			...p,
			title: translation?.title || p.title,
			description: translation?.description || p.description
		};
	}));

    $effect(() => {
        // React to upstream changes from SSE
        if (initialEntries && initialEntries.length > 0) {
             // We can use a simple JSON stringify check to avoid unnecessary updates if deep compare is needed, 
             // but since we create new objects in parent, reference check might fail even if content same.
             // However, for this use case, we want to force update.
             // To be safe against focus loss, we might want to check length or IDs.
             // But let's trust the parent's new reference for now.
             entries = initialEntries;
        }
    });
	let searchQueries = $state<Record<number, string>>({});

	function getSearchQuery(index: number): string {
		return searchQueries[index] || '';
	}

	function setSearchQuery(index: number, value: string) {
		searchQueries[index] = value;
	}

	// Fuzzy search logic
	function normalizeText(text: string): string {
		return text
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9\s]/g, '')
			.trim();
	}

	function fuzzyMatch(searchTerm: string, targetText: string): boolean {
		if (!searchTerm) return true;
		const normalizedSearch = normalizeText(searchTerm);
		const normalizedTarget = normalizeText(targetText);
		// Check if all chars appear in order? Or just includes?
		// Replicating old logic:
		let searchIndex = 0;
		for (let i = 0; i < normalizedTarget.length && searchIndex < normalizedSearch.length; i++) {
			if (normalizedTarget[i] === normalizedSearch[searchIndex]) {
				searchIndex++;
			}
		}
		return searchIndex === normalizedSearch.length;
	}

	function getFilteredOptions(searchQuery: string) {
		if (!searchQuery) return translatedProducts;
		return translatedProducts.filter(
			(p: { title: string; }) => fuzzyMatch(searchQuery, p.title)
		);
	}

	function addEntry() {
		entries = [...entries, { productId: 0, count: 1, isOpen: false }];
	}

	function removeEntry(index: number) {
		entries = entries.filter((_, i) => i !== index);
	}

	function calculateTotalPrice() {
		return entries.reduce((total, entry) => {
			const product = products.find((p: { id: number }) => p.id === entry.productId);
			if (product && entry.count > 0) {
				// Use clientPrice if set, else selling price
				const effectivePrice = product.clientPrice ?? product.price;
				return total + effectivePrice * entry.count;
			}
			return total;
		}, 0);
	}

	function calculateTotalCost() {
		return entries.reduce((total, entry) => {
			const product = products.find((p: { id: number }) => p.id === entry.productId);
			if (product && entry.count > 0) {
				return total + product.cost * entry.count;
			}
			return total;
		}, 0);
	}

	let calculatedTotal = $derived(calculateTotalPrice());
	let calculatedCost = $derived(calculateTotalCost());

	$effect(() => {
		totalPrice = calculatedTotal;
		totalCost = calculatedCost;
	});

	function formatPrice(priceInCents: number): string {
		return (priceInCents / 100).toFixed(2);
	}
</script>

<div class="space-y-4">
	{#each entries as entry, index}
		<div class="flex items-end gap-2">
			<!-- Product Selector -->
			<div class="grid flex-1">
				<Label>{m['projects.products_label']()}</Label>
				<Popover.Root bind:open={entry.isOpen}>
					<Popover.Trigger
						disabled={readonly}
						class={cn(
							buttonVariants({ variant: 'outline' }),
							'w-full justify-between text-left',
							(!entry.productId || entry.productId === 0) && 'text-muted-foreground',
							readonly && 'opacity-50 cursor-not-allowed'
						)}
						role="combobox"
					>
						<div class="flex items-center gap-2 overflow-hidden">
							{#if entry.productId === 0}
								<span>{m['projects.products_placeholder']()}</span>
							{:else}
								{@const product = translatedProducts.find((p: { id: number; }) => p.id === entry.productId)}
								<span class="truncate font-medium">{product?.title || m['projects.products_placeholder']()}</span>
							{/if}
						</div>
						<ChevronsUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
					</Popover.Trigger>
					<Popover.Content class="w-[300px] p-0" side="bottom" align="start">
						<Command.Root shouldFilter={false}>
							<Command.Input
								placeholder={m['projects.search_placeholder']()}
								value={getSearchQuery(index)}
								oninput={(e) => setSearchQuery(index, e.currentTarget.value)}
							/>
							<Command.List>
								<Command.Empty>{m['projects.no_item_found']()}</Command.Empty>
								<Command.Group class="max-h-64 overflow-y-auto custom-scroll">
									{#each getFilteredOptions(getSearchQuery(index)) as product (product.id)}
										<Command.Item
											value={product.title}
											onSelect={() => {
												entry.productId = product.id;
												entry.isOpen = false;
												setSearchQuery(index, '');
											}}
											class="flex items-start gap-2"
										>
											<div class="flex w-full flex-col">
												<div class="flex items-center justify-between">
													<span>{product.title}</span>
													<CheckIcon
														class={cn(
															'ml-auto h-4 w-4',
															product.id === entry.productId ? 'opacity-100' : 'opacity-0'
														)}
													/>
												</div>
											</div>
										</Command.Item>
									{/each}
								</Command.Group>
							</Command.List>
						</Command.Root>
					</Popover.Content>
				</Popover.Root>
			</div>

			<!-- Count Input -->
			<div class="grid">
				<Label>{m['projects.count_label']()}</Label>
				<NumberField.Root min={1} max={1000} bind:value={entry.count}>
					<NumberField.Group>
						<NumberField.Decrement disabled={readonly} />
						<NumberField.Input class="w-12" disabled={readonly} />
						<NumberField.Increment disabled={readonly} />
					</NumberField.Group>
				</NumberField.Root>
			</div>

			<!-- Remove Button -->
			{#if entries.length > 0 && !readonly}
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onclick={() => removeEntry(index)}
					class="mb-0.5"
					title="Noņemt"
				>
					<X class="h-4 w-4" />
				</Button>
			{/if}

			<input type="hidden" name="productIds" value={entry.productId} />
			<input type="hidden" name="productCounts" value={entry.count} />
		</div>
	{/each}

	<div class="flex items-center justify-between pt-2">
		<div class="space-y-0.5">
			<div class="text-sm font-medium">
				{m['projects.total_price']()}: €{formatPrice(calculatedTotal)}
			</div>
			{#if isAdmin}
				<div class="text-xs text-muted-foreground">
					Izmaksas: €{formatPrice(calculatedCost)}
				</div>
			{/if}
		</div>
		{#if !readonly}
			<Button type="button" variant="outline" onclick={addEntry}>
				{m['projects.add_product']()}
			</Button>
		{/if}
	</div>
</div>
