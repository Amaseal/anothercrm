<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import X from '@lucide/svelte/icons/x';
	import MoneyInput from '$lib/components/ui/input/money-input.svelte';
	import type { Product } from '$lib/server/db/schema';
	import { enhance } from '$app/forms';
	import { Label } from '@/components/ui/label';
	import * as m from '$lib/paraglide/messages';
	import FormError from '$lib/components/form-error.svelte';
	let { data, form }: { data: { item: Product }; form: { message: string } } = $props();
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
					<Label>{m['products.name']()}</Label>
					<Input
						placeholder={m['products.name_placeholder']()}
						name="title"
						bind:value={data.item.title}
					/>

					<Label>{m['products.description']()}</Label>
					<Textarea
						class="bg-background"
						placeholder={m['products.description_placeholder']()}
						name="description"
						bind:value={data.item.description}
					/>

					<Label>{m['products.cost']()}</Label>
					<MoneyInput currency="EUR" placeholder="5.70" name="cost" bind:value={data.item.cost} />
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
