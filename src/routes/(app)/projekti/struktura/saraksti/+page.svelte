<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import Plus from '@lucide/svelte/icons/plus';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import X from '@lucide/svelte/icons/x';
	import { Label } from '@/components/ui/label';
	import * as m from '$lib/paraglide/messages';
	import { locales, getLocale } from '@/paraglide/runtime.js';
	import FormError from '$lib/components/form-error.svelte';
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	const getLanguageName = (code: string) => {
		return new Intl.DisplayNames([getLocale()], { type: 'language' }).of(code) || code;
	};
	let selected: string | undefined = $state(data.preselectedGroupId || undefined);
</script>

<svelte:head>
	<title>{m['tabs.add']()}</title>
</svelte:head>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
	<div class="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-lg">
		<Card.Root class="custom-scroll relative max-h-[90vh] w-3xl max-w-3xl gap-2 overflow-y-auto">
			<Card.Header>
				<a
					href="/projekti"
					class="absolute top-7 right-5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
					><X /></a
				>

				<h2 class=" text-lg font-semibold">{m['tabs.add']()}</h2>
			</Card.Header>
			<Card.Content class="flex gap-2 p-6 pb-2">
				<div class="w-full">
					<h3 class="mb-2 font-bold">{m['tabs.value']()}</h3>
					<form method="POST" use:enhance>
						{#each locales as locale}
							<Label>{m[`groups.name`]({ locale: getLanguageName(locale) })}</Label>
							<Input
								placeholder={m[`groups.name_placeholder`]({ locale: getLanguageName(locale) })}
								name="title-{locale}"
								required
							/>
						{/each}
						<Label for="color">{m['tabs.color']()}</Label>
						<Input type="color" name="color" id="color" />
						<Label for="group" class="mt-4">{m['tabs.group']()}</Label>
						<Select.Root type="single" bind:value={selected} name="group">
							<Select.Trigger class="mb-4 w-full"
								>{data.tabGroups
									.find((tabGroup) => String(tabGroup.id) === selected)
									?.translations.find((t) => t.language === getLocale())?.name ||
									m['tabs.group_placeholder']()}</Select.Trigger
							>
							<Select.Content>
								{#each data.tabGroups as tabGroup}
									<Select.Item value={String(tabGroup.id)}
										>{tabGroup.translations.find((t) => t.language === getLocale())?.name ||
											''}</Select.Item
									>
									<!-- content here -->
								{/each}
							</Select.Content>
						</Select.Root>
						<div class="nav">
							<Button type="submit" variant="outline"><Plus /> {m['components.add']()}</Button>
						</div>
					</form>
				</div>
			</Card.Content>
		</Card.Root>
	</div>
</div>
