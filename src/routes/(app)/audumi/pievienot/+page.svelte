<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Card from '$lib/components/ui/card/index.js';
	import X from '@lucide/svelte/icons/x';

	import Label from '@/components/ui/label/label.svelte';
	import { enhance } from '$app/forms';
	import ImageDropzone from '@/components/image-dropzone.svelte';
	import * as m from '$lib/paraglide/messages';
	import FormError from '$lib/components/form-error.svelte';
	let { data, form } = $props();
</script>

<svelte:head>
	<title>Pievienot audumu</title>
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

				<h2 class="text-lg font-semibold">{m[`materials.add_material`]()}</h2>
			</Card.Header>
			<Card.Content class="p-6 pb-2">
				<form method="POST" use:enhance>
					<Label>{m[`materials.name`]()}</Label>
					<Input placeholder="F02, 2007, Raghok 3..." name="title" required />

					<Label>{m[`materials.article`]()}</Label>

					<Input placeholder="F02, 2007, Raghok 3..." name="article" required />

					<Label>{m[`materials.manufacturer`]()}</Label>
					<Input placeholder={m[`materials.manufacturer`]()} name="manufacturer" />
					<div class="flex gap-2">
						<div>
							<Label>{m[`materials.gsm`]()}</Label>
							<Input type="number" placeholder="100, 200..." name="gsm" />
						</div>

						<div>
							<Label>{m[`materials.width`]()}</Label>
							<Input type="number" placeholder="1200, 1400..." name="width" />
						</div>

						<div>
							<Label>{m[`materials.remaining`]()}</Label>
							<Input type="number" placeholder="1, 2, 4..." name="remaining" required />
						</div>
					</div>

					<Label>{m[`materials.image`]()}</Label>
					<ImageDropzone></ImageDropzone>

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
