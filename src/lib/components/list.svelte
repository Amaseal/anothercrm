<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { toCurrency } from '$lib/utilities';

	import type { Task } from '$lib/server/db/schema';
	import { Button } from './ui/button';
	import Plus from '@lucide/svelte/icons/plus';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import ProductCard from './product-card.svelte';

	import { dndzone, dragHandleZone, dragHandle } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { locales, getLocale } from '@/paraglide/runtime.js';

	let { tab } = $props();

	const getLanguageName = (code: string) => {
		return new Intl.DisplayNames([getLocale()], { type: 'language' }).of(code) || code;
	};
</script>

<Card.Root
	class=" relative flex h-full w-[240px] flex-shrink-0 flex-col gap-0 bg-background/70 py-2"
>
	<Card.Header class="justify-streatch flex flex-col gap-2 p-0">
		<div class="flex w-full items-center gap-2">
			<Card.Title class="p-2 text-base">{tab?.name || ''}</Card.Title>
		</div>
		<hr class=" mb-2 w-full border-2" style="border-color: {tab?.color || '#ffffff'}" />
	</Card.Header>
	<Card.Content class="custom-scroll  h-full  overflow-y-auto p-1">
		<div
			class="flex h-full flex-col gap-3 transition-colors duration-200"
			use:dragHandleZone={{
				items: (tab?.tasks || []).map((task: Task) => ({ ...task, sourceTabId: tab?.id })),
				flipDurationMs: 300,
				dropTargetClasses: ['rounded-xl', 'bg-background/80'],
				dropTargetStyle: {
					outline: 'none'
				},
				morphDisabled: true,
				type: 'tasks'
			}}
		>
			{#if !tab?.tasks || tab.tasks.length === 0}
				<div
					class="flex h-full w-full items-center justify-center text-gray-500 dark:text-gray-400"
				>
					Nav projektu
				</div>
			{:else}
				{#each tab?.tasks || [] as task (task.id)}
					<div animate:flip={{ duration: 300 }} class=" active:outline-none">
						<ProductCard {task} />
					</div>
				{/each}
			{/if}
		</div>
	</Card.Content>
</Card.Root>
