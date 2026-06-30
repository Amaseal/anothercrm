<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import X from '@lucide/svelte/icons/x';

	let {
		value = '',
		placeholder = '',
		oninput,
		onclear,
		class: className = ''
	}: {
		value?: string;
		placeholder?: string;
		oninput?: (e: Event) => void;
		onclear?: () => void;
		class?: string;
	} = $props();
</script>

<div class="relative {className}">
	<Input
		type="text"
		class="mb-0 w-full {value ? 'pr-8' : ''}"
		{placeholder}
		{value}
		{oninput}
	/>
	{#if value}
		<button
			type="button"
			class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
			onclick={onclear}
		>
			<X class="size-4" />
			<span class="sr-only">Clear search</span>
		</button>
	{/if}
</div>
