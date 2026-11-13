<script lang="ts">
	import * as Table from '$lib/components/ui/table';
	import { Button } from '$lib/components/ui/button';
	import * as m from '$lib/paraglide/messages';
	import type { ProductionOrder } from '$lib/server/production-workbook';
	let {
		orders,
		warnings = [],
		defaultProduct = ''
	}: { orders: ProductionOrder[]; warnings?: string[]; defaultProduct?: string } = $props();
	let page = $state(0);
	$effect(() => {
		void orders;
		page = 0;
	});
</script>

<p class="text-xs text-muted-foreground">
	{m['production_projects.garments']({ count: orders.length })}
</p>
{#each warnings as warning (warning)}<p class="text-sm text-destructive">{warning}</p>{/each}
{#if orders.length > 100}
	<div class="flex items-center gap-2">
		<Button type="button" variant="outline" size="sm" disabled={page === 0} onclick={() => page--}
			>{m['production_parse.previous']()}</Button
		>
		<span class="text-xs"
			>{page * 100 + 1}–{Math.min((page + 1) * 100, orders.length)} / {orders.length}</span
		>
		<Button
			type="button"
			variant="outline"
			size="sm"
			disabled={(page + 1) * 100 >= orders.length}
			onclick={() => page++}>{m['production_parse.next']()}</Button
		>
	</div>
{/if}
<Table.Root>
	<Table.Header
		><Table.Row>
			<Table.Head>{m['production_projects.name']()}</Table.Head>
			<Table.Head>{m['production_projects.size']()}</Table.Head>
			<Table.Head>{m['production_projects.number']()}</Table.Head>
			<Table.Head>{m['production_projects.artwork']()}</Table.Head>
			<Table.Head>{m['production_projects.product']()}</Table.Head>
		</Table.Row></Table.Header
	>
	<Table.Body>
		{#each orders.slice(page * 100, (page + 1) * 100) as row, index (page * 100 + index)}
			<Table.Row
				><Table.Cell>{row.name}</Table.Cell><Table.Cell>{row.size}</Table.Cell><Table.Cell
					>{row.number}</Table.Cell
				><Table.Cell>{row.artwork}</Table.Cell><Table.Cell
					>{row.product || defaultProduct}</Table.Cell
				></Table.Row
			>
		{/each}
	</Table.Body>
</Table.Root>
