<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	import { Textarea } from '$lib/components/ui/textarea';

	import * as Card from '$lib/components/ui/card/index.js';
	import X from '@lucide/svelte/icons/x';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import MoneyInput from '$lib/components/ui/input/money-input.svelte';
	import { Label } from '@/components/ui/label';
	import { enhance } from '$app/forms';
	import * as m from '$lib/paraglide/messages';
	import FormError from '$lib/components/form-error.svelte';
	import { locales, getLocale } from '@/paraglide/runtime.js';
	import ClientSelect from '$lib/components/client-select.svelte';
	import ImageDropzone from '$lib/components/image-dropzone.svelte';
	import type { ProductTranslation, ClientProductPrice } from '$lib/server/db/schema.js';

	let { data, form } = $props();

	const getLanguageName = (code: string) => {
		return new Intl.DisplayNames([getLocale()], { type: 'language' }).of(code) || code;
	};
	let clientPrices: { id: number; clientId: string | null; price: number }[] = $state(
		data.copyFrom?.clientPrices
			? data.copyFrom.clientPrices.map((cp: ClientProductPrice, i: number) => ({
					id: i,
					clientId: String(cp.clientId),
					price: cp.price
				}))
			: []
	);
	let nextId = data.copyFrom?.clientPrices?.length ?? 0;

	function addClientPrice() {
		clientPrices = [...clientPrices, { id: nextId++, clientId: null, price: 0 }];
	}

	function removeClientPrice(id: number) {
		clientPrices = clientPrices.filter((cp) => cp.id !== id);
	}

	function getCopyValue(field: 'title' | 'description', locale: string): string {
		if (!data.copyFrom) return '';
		const translation = data.copyFrom.translations?.find(
			(t: ProductTranslation) => t.language === locale
		);
		if (translation && translation[field]) return translation[field];
		if (locale === 'lv') return data.copyFrom[field] ?? '';
		return '';
	}
</script>

<svelte:head>
	<title>{m['products.add_product']()}</title>
</svelte:head>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
	<div class="max-h-[90vh] w-[30vw] overflow-hidden rounded-lg">
		<Card.Root class="custom-scroll relative max-h-[90vh] w-full  gap-2 overflow-y-auto">
			<Card.Header>
				<a
					href="/produkti"
					class="absolute top-7 right-5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
					><X /></a
				>

				<h2 class=" text-lg font-semibold">
					{data.copyFrom ? m['products.copy_product']() : m['products.add_product']()}
				</h2>
			</Card.Header>
			<Card.Content class="p-6 pb-2">
				<form method="POST" use:enhance>
					<div class="flex gap-4">
						{#each locales as locale}
							<div class="flex-1">
								<Label>{m['products.name']()} ({getLanguageName(locale)})</Label>
								<Input
									placeholder={m['products.name_placeholder']()}
									name="title-{locale}"
									value={getCopyValue('title', locale)}
									required
								/>

								<Label>{m['products.description']()} ({getLanguageName(locale)})</Label>
								<Textarea
									class="mb-4"
									placeholder={m['products.description_placeholder']()}
									name="description-{locale}"
									value={getCopyValue('description', locale)}
								/>
							</div>
						{/each}
					</div>
					<!-- Locales Loop for Title and Description -->
					<div class="flex gap-4">
						<div class="flex-1">
							<Label>{m['products.cost']()}</Label>
							<MoneyInput
								currency="EUR"
								placeholder="5.70"
								name="cost"
								value={data.copyFrom?.cost}
							/>
						</div>
						<div class="flex-1">
							<Label>{m['products.price']()}</Label>
							<MoneyInput
								currency="EUR"
								placeholder="10.00"
								name="price"
								value={data.copyFrom?.price}
							/>
						</div>
					</div>

					<Label class="mt-4">{m['products.image']()}</Label>
					<ImageDropzone initialImagePath={data.copyFrom?.image ?? null} />

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
								<div class="w-full!">
									<ClientSelect bind:value={cp.clientId as string} clients={data.btbClients} />
								</div>
								<div class="w-24">
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
