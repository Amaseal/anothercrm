<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card/index.js';
	import X from '@lucide/svelte/icons/x';
	import * as m from '$lib/paraglide/messages';
	import FormError from '$lib/components/form-error.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>{m['components.done_modal.title']({ item: data.item.title })}</title>
</svelte:head>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
	<div class="max-h-[90vh] w-full max-w-md overflow-hidden rounded-lg">
		<Card.Root class="custom-scroll relative max-h-[90vh] w-full max-w-md gap-2 overflow-y-auto">
			<Card.Header>
				<a
					href="/projekti"
					class="absolute top-6 right-5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
					><X /></a
				>
				<h2 class="text-lg font-semibold">
					{m['components.done_modal.message']({ item: data.item?.title })}
				</h2>
			</Card.Header>
			<Card.Content class="p-6 pb-2">
				{#if form?.message}
					<FormError error={form?.message} />
				{/if}
				<form method="POST" use:enhance>
					<div class="flex items-center justify-end gap-2">
						<Button href="/projekti" variant="secondary"
							>{m['components.done_modal.cancel']()}</Button
						>
						<Button type="submit" class="bg-green-600 hover:bg-green-700"
							>{m['components.done_modal.confirm']()}</Button
						>
					</div>
				</form>
			</Card.Content>
		</Card.Root>
	</div>
</div>
