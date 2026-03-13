<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card/index.js';
	import X from '@lucide/svelte/icons/x';
	import ImageIcon from '@lucide/svelte/icons/image';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '@/paraglide/runtime.js';
	import type { Product, ProductTranslation } from '$lib/server/db/schema.js';

	let { data }: { data: { item: Product & { translations: ProductTranslation[] } } } = $props();

	function getLocalizedValue(field: 'title' | 'description', locale: string): string {
		const translation = data.item.translations?.find((t) => t.language === locale);
		if (translation && translation[field]) return translation[field] as string;
		if (locale === 'lv') return (data.item[field] as string) || '';
		return (data.item[field] as string) || '';
	}

	const title = $derived(getLocalizedValue('title', getLocale()));
	const description = $derived(getLocalizedValue('description', getLocale()));
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
	<div class="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-lg">
		<Card.Root class="custom-scroll relative max-h-[90vh] w-full max-w-lg gap-0 overflow-y-auto">
			<Card.Header class="pb-2">
				<a
					href="/produkti"
					class="absolute top-7 right-5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
				>
					<X />
				</a>
				<h2 class="pr-8 text-lg font-semibold">{title}</h2>
			</Card.Header>

			<Card.Content class="space-y-4 p-6 pt-2">
				<!-- Image -->
				{#if data.item.image}
					<div class="overflow-hidden rounded-lg border bg-muted">
						<img src={data.item.image} alt={title} class="max-h-64 w-full object-contain" />
					</div>
				{:else}
					<div
						class="flex h-40 w-full items-center justify-center rounded-lg border bg-muted text-muted-foreground"
					>
						<div class="flex flex-col items-center gap-2">
							<ImageIcon size="32" />
							<span class="text-sm">{m['products.no_image']()}</span>
						</div>
					</div>
				{/if}

				<div class="flex justify-end pt-2">
					<Button href="/produkti" variant="secondary">{m['components.back']()}</Button>
				</div>
			</Card.Content>
		</Card.Root>
	</div>
</div>
