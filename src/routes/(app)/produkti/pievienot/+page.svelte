<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	import { Textarea } from '$lib/components/ui/textarea';

	import * as Card from '$lib/components/ui/card/index.js';
	import X from '@lucide/svelte/icons/x';
	import MoneyInput from '$lib/components/ui/input/money-input.svelte';
	import { Label } from '@/components/ui/label';
	import { enhance } from '$app/forms';
	import * as m from '$lib/paraglide/messages';
	import FormError from '$lib/components/form-error.svelte';
	let { data, form } = $props();
</script>

<svelte:head>
	<title>{m['products.add_product']()}</title>
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

				<h2 class=" text-lg font-semibold">{m['products.add_product']()}</h2>
			</Card.Header>
			<Card.Content class="p-6 pb-2">
				<form method="POST" use:enhance>
					<Label>{m['products.name']()}</Label>
					<Input placeholder={m['products.name_placeholder']()} name="title" />

					<Label>{m['products.description']()}</Label>
					<Textarea
						class=""
						placeholder={m['products.description_placeholder']()}
						name="description"
					/>

					<Label>{m['products.cost']()}</Label>
					<MoneyInput currency="EUR" placeholder="5.70" name="cost" />
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
