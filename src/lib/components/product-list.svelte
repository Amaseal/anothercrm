<script lang="ts">
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
	}

	let { products } = $props<{ products: Product[] }>();

	let entries = $state<{ productId: number; count: number; isOpen: boolean }[]>([
		{ productId: 0, count: 1, isOpen: false }
	]);
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
		if (!searchQuery) return products;
		return products.filter(
			(p: { title: string; description: any }) =>
				fuzzyMatch(searchQuery, p.title) || fuzzyMatch(searchQuery, p.description || '')
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
				return total + product.cost * entry.count;
			}
			return total;
		}, 0);
	}

	let totalPrice = $derived(calculateTotalPrice());

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
						class={cn(
							buttonVariants({ variant: 'outline' }),
							'w-full justify-between text-left',
							(!entry.productId || entry.productId === 0) && 'text-muted-foreground'
						)}
						role="combobox"
					>
						<div class="flex items-center gap-2 overflow-hidden">
							{#if entry.productId === 0}
								<span>{m['projects.products_placeholder']()}</span>
							{:else}
								{@const product = products.find((p: { id: number }) => p.id === entry.productId)}
								<span class="truncate font-medium"
									>{product?.title || m['projects.products_placeholder']()}</span
								>
								{#if product?.description}
									<span class="truncate text-xs text-muted-foreground">{product.description}</span>
								{/if}
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
								<Command.Group class="max-h-64 overflow-y-auto">
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
												{#if product.description}
													<span class="text-xs text-muted-foreground">{product.description}</span>
												{/if}
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
						<NumberField.Decrement />
						<NumberField.Input class="w-12" />
						<NumberField.Increment />
					</NumberField.Group>
				</NumberField.Root>
			</div>

			<!-- Remove Button -->
			{#if entries.length > 0}
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
		<div class="text-sm font-medium">
			{m['projects.total_price']()}: €{formatPrice(totalPrice)}
		</div>
		<Button type="button" variant="outline" onclick={addEntry}>
			{m['projects.add_product']()}
		</Button>
	</div>
</div>
