<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Card from '$lib/components/ui/card/index.js';
	import X from '@lucide/svelte/icons/x';

	import Label from '@/components/ui/label/label.svelte';
	import { enhance } from '$app/forms';
	import ImageDropzone from '@/components/image-dropzone.svelte';
	import * as m from '$lib/paraglide/messages';
	import type { Material } from '@/server/db/schema';
	import FormError from '$lib/components/form-error.svelte';
	let { data, form }: { data: { item: Material }; form: any } = $props();
</script>

<svelte:head>
	<title>{m['materials.edit_material']({ title: data.item.title })}</title>
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
					{m['materials.edit_material']({ title: data.item.title })}
				</h2>
			</Card.Header>
			<Card.Content class="p-6 pb-2">
				<form method="POST" use:enhance>
					<Label>{m[`materials.name`]()}</Label>
					<Input
						placeholder="F02, 2007, Raghok 3..."
						name="title"
						required
						bind:value={data.item.title}
					/>

					<Label>{m[`materials.article`]()}</Label>

					<Input
						placeholder="F02, 2007, Raghok 3..."
						name="article"
						required
						bind:value={data.item.article}
					/>

					<Label>{m[`materials.manufacturer`]()}</Label>
					<Input
						placeholder={m[`materials.manufacturer`]()}
						name="manufacturer"
						required
						bind:value={data.item.manufacturer}
					/>
					<div class="flex gap-2">
						<div>
							<Label>{m[`materials.gsm`]()}</Label>
							<Input
								type="number"
								placeholder="100, 200..."
								name="gsm"
								required
								bind:value={data.item.gsm}
							/>
						</div>

						<div>
							<Label>{m[`materials.width`]()}</Label>
							<Input
								type="number"
								placeholder="1200, 1400..."
								name="width"
								required
								bind:value={data.item.width}
							/>
						</div>

						<div>
							<Label>{m[`materials.remaining`]()}</Label>
							<Input
								type="number"
								placeholder="1, 2, 4..."
								name="remaining"
								required
								bind:value={data.item.remaining}
							/>
						</div>
					</div>

					<Label>{m[`materials.image`]()}</Label>
					<ImageDropzone initialImagePath={data.item.image}></ImageDropzone>

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
