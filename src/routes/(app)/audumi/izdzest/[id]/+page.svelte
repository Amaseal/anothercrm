<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card/index.js';
	import type { Material } from '$lib/server/db/schema.js';
	import X from '@lucide/svelte/icons/x';
	import * as m from '$lib/paraglide/messages';
	import FormError from '$lib/components/form-error.svelte';
	let { data, form }: { data: { item: Material }; form: { message: string } } = $props();
</script>

<svelte:head>
	<title>{m['components.delete_modal.title']({ item: data.item.title })}</title>
</svelte:head>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
	<div class="max-h-[90vh] w-full max-w-md overflow-hidden rounded-lg">
		<Card.Root class="custom-scroll relative max-h-[90vh] w-full max-w-md gap-2 overflow-y-auto">
			<Card.Header>
				<a
					href="/audumi"
					class="absolute top-7 right-5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
					><X /></a
				>
				<h2 class="text-lg font-semibold">
					{m['components.delete_modal.message']({ item: data.item?.title })}
				</h2>
			</Card.Header>
			<Card.Content class="p-6 pb-2">
				{#if form?.message}
					<FormError error={form?.message} />
				{/if}
				<form method="POST" use:enhance>
					<div class="flex items-center justify-end gap-2">
						<Button href="/audumi" variant="outline">{m['components.delete_modal.cancel']()}</Button
						>
						<Button type="submit" variant="destructive"
							>{m['components.delete_modal.delete']()}</Button
						>
					</div>
				</form>
			</Card.Content>
		</Card.Root>
	</div>
</div>
