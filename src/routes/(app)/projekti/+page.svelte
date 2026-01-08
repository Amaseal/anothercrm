<script>
	import * as m from '$lib/paraglide/messages';
	import List from '$lib/components/list.svelte';
	let { data } = $props();
</script>

<svelte:head>
	<title>{m['projects.value']()}</title>
</svelte:head>

<div class="flex h-[calc(100vh-110px)] gap-4 overflow-x-auto pb-2">
	{#each data.tabs as item}
		<List tab={item} />
	{/each}
</div>
