<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import X from '@lucide/svelte/icons/x';
	import * as m from '$lib/paraglide/messages';
	import TreeView from './TreeView.svelte';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>{m['structure.manage']()}</title>
</svelte:head>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
	<div class="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg">
		<Card.Root class="custom-scroll relative max-h-[90vh] w-full gap-2 overflow-y-auto">
			<Card.Header>
				<a
					href="/projekti"
					class="absolute top-7 right-5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
				>
					<X />
				</a>
				<h2 class="text-lg font-semibold">{m['structure.manage']()}</h2>
			</Card.Header>
			<Card.Content class="p-6 pb-2">
				<TreeView {data} {form} />
			</Card.Content>
		</Card.Root>
	</div>
</div>

<style>
</style>
