<script>
	import * as Card from '$lib/components/ui/card/index.js';
	import X from '@lucide/svelte/icons/x';

	let { error } = $props();
</script>

<Card.Root class="border-1 border-red-500/50 bg-red-50 text-center">
	<Card.Content class="flex items-center gap-4 ">
		<X class="h-8 w-8 rounded-full border-2 border-red-500 p-2 text-red-500 " />
		<p class="text-red-500">{error}</p>
	</Card.Content>
</Card.Root>
