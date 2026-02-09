<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { toCurrency } from '$lib/utilities';

	import type { Task } from '$lib/server/db/schema';
	import { Button } from './ui/button';
	import Plus from '@lucide/svelte/icons/plus';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import ProductCard from './product-card.svelte';

	import { dndzone, dragHandleZone, dragHandle, type DndEvent } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { locales, getLocale } from '@/paraglide/runtime.js';
	import { invalidateAll } from '$app/navigation';

	let { tab } = $props();

	const getLanguageName = (code: string) => {
		return new Intl.DisplayNames([getLocale()], { type: 'language' }).of(code) || code;
	};

	let items = $state(tab?.tasks || []);

	$effect(() => {
		items = tab?.tasks || [];
	});

	function handleDndConsider(e: CustomEvent<DndEvent<any>>) {
		items = e.detail.items as Task[];
	}

	async function handleDndFinalize(e: CustomEvent<DndEvent<any>>) {
		items = e.detail.items as Task[];

		// Find the item that was dropped (if needed) or just detect if it's a cross-column move
		// For simple "move to another column", we need to know the taskId and the new tabId.
		// Actually, svelte-dnd-action updates the items list.
		// We can detect if a task was added to this list from another list.
		// However, svelte-dnd-action triggers finalize on both source and target.
		// On target, we want to call the API.

		// Check if the dropped item is new to this list or just reordered
		// But since we aren't persisting reorder, we only care about moving between tabs.
		// We can check if any item in the new list has a different tabId than current tab.id

		const movedTask = items.find((t: { tabId: any }) => t.tabId !== tab.id);

		if (movedTask) {
			try {
				const response = await fetch('/api/tasks/move', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						taskId: movedTask.id,
						targetTabId: tab.id
					})
				});

				if (response.ok) {
					// Ideally invalidate to refetch data, simpler for now
					// invalidateAll(); // Optional: might cause flicker if we are already updating state.
					// actually we should let the server update loop handling propagate via SSE or invalidation
					// but for immediate UI feedback we already updated `items`.
					// However, `tab.tasks` is derived from data. props.
					// If we don't invalidate, `tab.tasks` might revert or stay old until next load.
					// So invalidateAll is good.
					// But wait, if we invalidate, the parent component re-renders and passes new `tab` prop.
					// Our `$effect` will update `items`.
					// So yes, invalidateAll() is correct.
					// To avoid double invalidation if SSE is also triggering, maybe debounce or check.
					// But simple is better for now.
					invalidateAll();
				} else {
					console.error('Failed to move task');
					// Revert?
					items = tab?.tasks || [];
				}
			} catch (error) {
				console.error('Error moving task:', error);
				items = tab?.tasks || [];
			}
		}
	}
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
				items: items,
				flipDurationMs: 300,
				dropTargetClasses: ['rounded-xl', 'bg-background/80'],
				dropTargetStyle: {
					outline: 'none'
				},
				morphDisabled: true,
				type: 'tasks'
			}}
			onconsider={handleDndConsider}
			onfinalize={handleDndFinalize}
		>
			{#if items.length === 0}
				<div
					class="flex h-full w-full items-center justify-center text-gray-500 dark:text-gray-400"
				>
					Nav projektu
				</div>
			{:else}
				{#each items as task (task.id)}
					<div animate:flip={{ duration: 300 }} class=" active:outline-none">
						<ProductCard {task} dragHandleAction={dragHandle} />
					</div>
				{/each}
			{/if}
		</div>
	</Card.Content>
</Card.Root>
