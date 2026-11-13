<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import FormError from '$lib/components/form-error.svelte';
	import * as m from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>{m['production.title']()}</title>
</svelte:head>

<div class="space-y-6 p-4 md:p-6">
	<div>
		<h1 class="text-2xl font-semibold">{m['production.title']()}</h1>
		<p class="mt-2 text-sm text-muted-foreground">{m['production.description']()}</p>
	</div>

	{#if form?.message}
		<div role="alert"><FormError error={form.message} /></div>
	{/if}

	<div class="grid items-start gap-6 md:grid-cols-[minmax(16rem,1fr)_2fr]">
		<Card.Root>
			<Card.Header><Card.Title>{m['production.products']()}</Card.Title></Card.Header>
			<Card.Content class="space-y-4">
				<form method="POST" action="?/createProduct" use:enhance class="space-y-2">
					<Label for="production-name">{m['production.name']()}</Label>
					<Input id="production-name" name="name" required maxlength={120} />
					<Button type="submit">{m['production.add_product']()}</Button>
				</form>
				<nav aria-label={m['production.products']()} class="flex flex-col gap-1">
					{#each data.products as product (product.id)}
						<!-- eslint-disable svelte/no-navigation-without-resolve -- Query string is appended to a resolved path. -->
						<a
							href={`${resolve('/razosana')}?product=${product.id}`}
							aria-current={data.selectedProduct?.id === product.id ? 'page' : undefined}
							class="rounded-md px-3 py-2 text-sm break-words hover:bg-accent"
							class:bg-accent={data.selectedProduct?.id === product.id}
						>
							{product.name}
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{:else}
						<p class="text-sm text-muted-foreground">{m['production.empty_products']()}</p>
					{/each}
				</nav>
			</Card.Content>
		</Card.Root>

		{#if data.selectedProduct}
			{@const product = data.selectedProduct}
			<Card.Root>
				<Card.Header>
					<Card.Title>{product.name}</Card.Title>
					<p class="text-sm text-muted-foreground">crm-production:{product.id}</p>
				</Card.Header>
				<Card.Content class="space-y-4">
					<p class="text-sm text-muted-foreground">{m['production.base_help']()}</p>
					<form method="POST" action="?/addSize&product={product.id}" use:enhance class="space-y-2">
						<input type="hidden" name="productId" value={product.id} />
						<Label for="production-size">{m['production.size_label']()}</Label>
						<div class="flex gap-2">
							<Input id="production-size" name="label" required maxlength={40} />
							<Button type="submit">{m['production.add_size']()}</Button>
						</div>
					</form>

					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>{m['production.size_label']()}</Table.Head>
								<Table.Head>{m['production.base_size']()}</Table.Head>
								<Table.Head>{m['production.actions']()}</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each product.sizes as size (size.id)}
								<Table.Row>
									<Table.Cell>{size.label}</Table.Cell>
									<Table.Cell>
										<form method="POST" action="?/setBase&product={product.id}" use:enhance>
											<input type="hidden" name="productId" value={product.id} />
											<input type="hidden" name="sizeId" value={size.id} />
											<input type="hidden" name="isBase" value={size.isBase ? 'false' : 'true'} />
											<Button type="submit" variant="outline" size="sm" aria-pressed={size.isBase}>
												{size.isBase ? m['production.unset_base']() : m['production.set_base']()}
											</Button>
										</form>
									</Table.Cell>
									<Table.Cell>
										<form
											method="POST"
											action="?/deleteSize&product={product.id}"
											use:enhance={({ cancel }) => {
												if (!confirm(m['production.confirm_delete_size']({ label: size.label })))
													cancel();
											}}
										>
											<input type="hidden" name="productId" value={product.id} />
											<input type="hidden" name="sizeId" value={size.id} />
											<Button type="submit" variant="destructive" size="sm"
												>{m['production.delete']()}</Button
											>
										</form>
									</Table.Cell>
								</Table.Row>
							{:else}
								<Table.Row
									><Table.Cell colspan={3}>{m['production.empty_sizes']()}</Table.Cell></Table.Row
								>
							{/each}
						</Table.Body>
					</Table.Root>

					<form
						method="POST"
						action="?/deleteProduct"
						use:enhance={({ cancel }) => {
							if (!confirm(m['production.confirm_delete_product']({ name: product.name })))
								cancel();
						}}
					>
						<input type="hidden" name="productId" value={product.id} />
						<Button type="submit" variant="destructive">{m['production.delete_product']()}</Button>
					</form>
				</Card.Content>
			</Card.Root>
		{/if}
	</div>
</div>
