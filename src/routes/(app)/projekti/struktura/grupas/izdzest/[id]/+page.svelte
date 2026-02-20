<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card/index.js';
	import type { TabGroupTranslation, TabGroup } from '$lib/server/db/schema.js';
	import X from '@lucide/svelte/icons/x';
	import * as m from '$lib/paraglide/messages';
	import FormError from '$lib/components/form-error.svelte';
	import { locales, getLocale } from '@/paraglide/runtime.js';
	let { data, form } = $props();

	const getTranslation = (translations: TabGroupTranslation[]) => {
		const currentLocale = getLocale();
		return translations.find((t) => t.language === currentLocale);
	};

</script>

<svelte:head>
	<title
		>{m['components.delete_modal.title']({
			item: getTranslation(data.item?.translations as TabGroupTranslation[])?.name as string
		})}</title
	>
</svelte:head>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
	<div class="max-h-[90vh] w-full max-w-md overflow-hidden rounded-lg">
		<Card.Root class="custom-scroll relative max-h-[90vh] w-full max-w-md gap-2 overflow-y-auto">
			<Card.Header>
				<a
					href="/projekti/struktura"
					class="absolute top-7 right-5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
					><X /></a
				>
				<h2 class="text-lg font-semibold">
					{m['components.delete_modal.message']({
						item: getTranslation(data.item?.translations as TabGroupTranslation[])?.name as string
					})}
				</h2>
			</Card.Header>
			<Card.Content class="p-6 pb-2">
				{#if form?.message}
					<FormError error={form?.message} />
				{/if}
				<form method="POST" use:enhance>
					<div class="flex items-center justify-end gap-2">
						<Button href="/projekti/struktura" variant="outline"
							>{m['components.delete_modal.cancel']()}</Button
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
