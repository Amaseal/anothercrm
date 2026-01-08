<script lang="ts">
	import { enhance } from '$app/forms';
	import * as Card from '@/components/ui/card';
	import { Input } from '@/components/ui/input';
	import { Button } from '@/components/ui/button';
	import { Label } from '@/components/ui/label';
	import * as m from '$lib/paraglide/messages';
	import { Separator } from '@/components/ui/separator';
	import { setLocale } from '$lib/paraglide/runtime';
	import background from '$lib/assets/background.svg';

	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>{m['reset.value']()}</title>
</svelte:head>

<div
	class="flex h-screen w-full items-center justify-center bg-cover bg-left px-4"
	style="background-image: url({background})"
>
	<Card.Root class="mx-auto w-full max-w-sm">
		<Card.Header>
			<Card.Title class="flex justify-between gap-2 align-middle text-2xl"
				><span>{m['reset.value']()} </span>
				<span class="flex gap-1">
					<Button onclick={() => setLocale('lv')} variant="ghost">LV</Button>
					<Separator orientation="vertical" />
					<Button onclick={() => setLocale('en')} variant="ghost">EN</Button>
				</span>
			</Card.Title>
			<Card.Description>{m['reset.text']()}</Card.Description>
		</Card.Header>
		<Card.Content>
			<form method="post" use:enhance>
				<Label>{m['reset.email']()}</Label>
				<Input name="email" placeholder="john@example.com" id="email" />

				{#if form?.message}
					<p class="text-red-500">{form.message}</p>
				{/if}
				<div class="mt-4 flex items-center justify-between">
					<Button type="submit">{m['reset.send']()}</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
</div>
