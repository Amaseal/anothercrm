<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Card from '$lib/components/ui/card/index.js';
	import X from '@lucide/svelte/icons/x';

	import Label from '@/components/ui/label/label.svelte';
	import { enhance } from '$app/forms';
	import * as m from '$lib/paraglide/messages';
	import FormError from '$lib/components/form-error.svelte';
	import { locales, getLocale } from '@/paraglide/runtime.js';
	let { data, form } = $props();

	const getLanguageName = (code: string) => {
		return new Intl.DisplayNames([getLocale()], { type: 'language' }).of(code) || code;
	};

</script>

<svelte:head>
	<title>{m['groups.new_group']()}</title>
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

				<h2 class="text-lg font-semibold">{m[`materials.add_material`]()}</h2>
			</Card.Header>
			<Card.Content class="p-6 pb-2">
				<form method="POST" use:enhance>
					{#each locales as locale}
						<Label>{m[`groups.name`]({ locale: getLanguageName(locale) })}</Label>
						<Input
							placeholder={m[`groups.name_placeholder`]({ locale: getLanguageName(locale) })}
							name="title-{locale}"
							required
							value={data.item?.translations.find((t) => t.language === locale)?.name || ''}
						/>
					{/each}

					<div class="mt-4">
						<Label for="color">{m['groups.color']()}</Label>
						<Input
							type="color"
							name="color"
							id="color"
							class="h-10 w-20 p-1"
							value={data.item?.color || '#ffffff'}
						/>
					</div>

					<!-- todo -->
					<p class="text-sm text-muted-foreground">{m[`groups.name_info`]()}</p>

					{#if form?.message}
						<FormError error={form?.message} />
					{/if}
					<div class="mt-6 flex justify-end">
						<Button type="submit">{m[`components.save`]()}</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>
	</div>
</div>
