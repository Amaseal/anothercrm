<script>
	import * as m from '$lib/paraglide/messages';
	import List from '$lib/components/list.svelte';
	let { data } = $props();
</script>

<svelte:head>
	<title>{m['projects.value']()}</title>
</svelte:head>
