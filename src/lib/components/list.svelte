<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';

	import type { ProjectBoardColumn, ProjectBoardTask } from '$lib/server/queries/projekti';

	import ProductCard from './product-card.svelte';

	import { dragHandleZone, dragHandle, type DndEvent } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';

	import { invalidateAll } from '$app/navigation';
	import { m } from '@/paraglide/messages';

	let { tab }: { tab: ProjectBoardColumn; data?: unknown } = $props();

	let items = $derived(tab.tasks);

	function handleDndConsider(e: CustomEvent<DndEvent<ProjectBoardTask>>) {
		items = e.detail.items;
	}

	async function handleDndFinalize(e: CustomEvent<DndEvent<ProjectBoardTask>>) {
		items = e.detail.items;

		const movedTask = items.find((t) => t.tabId !== tab.id);

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
					{m['projects.no_item_found']()}
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
