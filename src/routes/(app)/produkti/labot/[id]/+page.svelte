<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import X from '@lucide/svelte/icons/x';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import MoneyInput from '$lib/components/ui/input/money-input.svelte';
	import type { Product, ProductTranslation, ClientProductPrice, Client } from '$lib/server/db/schema';
	import { enhance } from '$app/forms';
	import { Label } from '@/components/ui/label';
	import * as m from '$lib/paraglide/messages';
	import FormError from '$lib/components/form-error.svelte';
	import { locales, getLocale } from '@/paraglide/runtime.js';
	import ClientSelect from '$lib/components/client-select.svelte';

	let { data, form } = $props();

	const getLanguageName = (code: string) => {
		return new Intl.DisplayNames([getLocale()], { type: 'language' }).of(code) || code;
	};

	let clientPrices: { id: number; clientId: string | null; price: number }[] = $state([]);
	let nextId = 0;
	let initializedForId: number | null = null;

	// Svelte 5 pattern for initializing state from props without infinite loops
	$effect(() => {
		if (data.item.id !== initializedForId) {
			clientPrices = (data.item.clientPrices || []).map((cp: ClientProductPrice, index: number) => ({
				id: index,
				clientId: String(cp.clientId),
				price: cp.price
			}));
			nextId = clientPrices.length;
			initializedForId = data.item.id;
		}
	});

	function addClientPrice() {
		clientPrices = [...clientPrices, { id: nextId++, clientId: null, price: 0 }];
	}

	function removeClientPrice(id: number) {
		clientPrices = clientPrices.filter((cp) => cp.id !== id);
	}
</script>

<svelte:head>
	<title>{m['products.edit_product']({ title: data.item.title })}</title>
</svelte:head>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
	<div class="max-h-[90vh] w-full max-w-md overflow-hidden rounded-lg">
		<Card.Root class="custom-scroll relative max-h-[90vh] w-full max-w-md gap-2 overflow-y-auto">
			<Card.Header>
				<a
					href="/produkti"
					class="absolute top-7 right-5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
					><X /></a
				>

				<h2 class=" text-lg font-semibold">
					{m['products.edit_product']({ title: data.item.title })}
				</h2>
			</Card.Header>
			<Card.Content class="p-6 pb-2">
				<form method="POST" use:enhance>
					<!-- Locales Loop for Title and Description -->
					{#each locales as locale}
						<Label>{m['products.name']()} ({getLanguageName(locale)})</Label>
						<Input
							placeholder={m['products.name_placeholder']()}
							name="title-{locale}"
							value={data.item.translations.find((t: ProductTranslation) => t.language === locale)?.title ||
								(locale === 'lv' ? data.item.title : '')}
							required
						/>

						<Label>{m['products.description']()} ({getLanguageName(locale)})</Label>
						<Textarea
							class="mb-4 bg-background"
							placeholder={m['products.description_placeholder']()}
							name="description-{locale}"
							value={data.item.translations.find((t: ProductTranslation) => t.language === locale)?.description ||
								(locale === 'lv' ? data.item.description || '' : '')}
						/>
					{/each}

					<Label>{m['products.cost']()}</Label>
					<MoneyInput currency="EUR" placeholder="5.70" name="cost" bind:value={data.item.cost} />

					<Label class="mt-4">{m['products.price']()}</Label>
					<MoneyInput currency="EUR" placeholder="10.00" name="price" bind:value={data.item.price} />

					<!-- Client Specific Prices -->
					<div class="mt-6">
						<div class="mb-2 flex items-center justify-between">
							<Label>{m['products.client_specific_prices']()}</Label>
							<Button variant="outline" size="sm" type="button" onclick={addClientPrice}>
								<Plus class="mr-2 h-4 w-4" /> Add
							</Button>
						</div>

						<input type="hidden" name="clientPrices" value={JSON.stringify(clientPrices)} />

						{#each clientPrices as cp (cp.id)}
							<div class="mb-2 flex items-center gap-2">
								<div class="flex-1">
									<ClientSelect
										bind:value={cp.clientId as string}
										clients={data.btbClients}
									/>
								</div>
								<div class="w-32">
									<MoneyInput currency="EUR" placeholder="0.00" bind:value={cp.price} />
								</div>
								<Button
									variant="ghost"
									size="icon"
									type="button"
									onclick={() => removeClientPrice(cp.id)}
								>
									<Trash2 class="h-4 w-4 text-destructive" />
								</Button>
							</div>
						{/each}
					</div>

					{#if form?.message}
						<FormError error={form?.message} />
					{/if}
					<div class="mt-6 flex justify-end">
						<Button type="submit">{m['components.save']()}</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>
	</div>
</div>
