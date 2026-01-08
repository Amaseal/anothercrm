<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import Plus from '@lucide/svelte/icons/plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '@/paraglide/runtime.js';
	import { dragHandle, dragHandleZone } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import FormError from '@/components/form-error.svelte';

	let { data, form } = $props();

	let groups = $state(data.tabGroups);
	let expandedGroups = $state<Set<number>>(new Set());
	let initialized = $state(false);

	// Initialize expanded groups only once on mount
	$effect(() => {
		if (groups.length > 0 && !initialized) {
			// Ensure all groups have a tabs array (even if empty)
			groups = groups.map((g: any) => ({
				...g,
				tabs: g.tabs || []
			}));
			expandedGroups = new Set(groups.map((g: any) => g.id));
			initialized = true;
		}
	});

	const flipDurationMs = 300;

	const getTranslation = (translations: any[]) => {
		const currentLocale = getLocale();
		return translations.find((t) => t.language === currentLocale);
	};

	function toggleGroup(groupId: number) {
		const newSet = new Set(expandedGroups);
		if (newSet.has(groupId)) {
			newSet.delete(groupId);
		} else {
			newSet.add(groupId);
		}
		expandedGroups = newSet;
	}

	// Handle group reordering
	function handleGroupDndConsider(e: CustomEvent) {
		groups = e.detail.items;
	}

	async function handleGroupDndFinalize(e: CustomEvent) {
		groups = e.detail.items;

		const formData = new FormData();
		groups.forEach((group: any, index: number) => {
			formData.append(`order[${group.id}]`, index.toString());
		});

		await fetch('?/reorderGroups', {
			method: 'POST',
			body: formData
		});
	}

	// Handle tab reordering within a group and across groups
	function createTabHandlers(groupIndex: number, groupId: number) {
		return {
			handleDndConsider(e: CustomEvent) {
				// During consider, just update the items directly
				// Being too immutable here can break the library's internal state
				groups[groupIndex].tabs = e.detail.items;
			},
			async handleDndFinalize(e: CustomEvent) {
				const newTabs = e.detail.items;
				const info = e.detail.info;

				// Handle based on trigger type
				if (info.trigger === 'droppedIntoAnother') {
					// This zone is the SOURCE - a tab was dragged OUT to another zone
					// Update this group to remove the moved tab
					const updatedGroups = [...groups];
					updatedGroups[groupIndex] = {
						...updatedGroups[groupIndex],
						tabs: newTabs
					};
					groups = updatedGroups;
				} else if (info.trigger === 'droppedIntoZone') {
					// This zone is the TARGET - a tab was dragged IN from another zone
					// The dragged tab should be in newTabs (added by consider phase)
					const draggedTabId = info.id;
					const draggedTab = newTabs.find((t: any) => t.id === draggedTabId);

					if (draggedTab) {
						// Update groups: add to this group, remove from others
						const updatedGroups = groups.map((g: any, idx: number) => {
							if (idx === groupIndex) {
								// Add to target group with updated groupId
								return {
									...g,
									tabs: [...(g.tabs || []), { ...draggedTab, groupId: groupId }]
								};
							} else if (g.tabs?.some((t: any) => t.id === draggedTabId)) {
								// Remove from source group
								return {
									...g,
									tabs: g.tabs.filter((t: any) => t.id !== draggedTabId)
								};
							}
							return g;
						});

						groups = updatedGroups;

						// Send update to server
						const formData = new FormData();
						formData.append('tabId', draggedTabId.toString());
						formData.append('newGroupId', groupId.toString());

						await fetch('?/moveTabToGroup', {
							method: 'POST',
							body: formData
						});

						// Update sort order for this group
						const orderFormData = new FormData();
						updatedGroups[groupIndex].tabs.forEach((tab: any, index: number) => {
							orderFormData.append(`order[${tab.id}]`, index.toString());
						});

						await fetch('?/reorderTabs', {
							method: 'POST',
							body: orderFormData
						});
					}
				} else {
					// Just reordering within same group
					const updatedGroups = [...groups];
					updatedGroups[groupIndex] = {
						...updatedGroups[groupIndex],
						tabs: newTabs
					};
					groups = updatedGroups;

					// Update sort order
					if (newTabs.length > 0) {
						const orderFormData = new FormData();
						newTabs.forEach((tab: any, index: number) => {
							orderFormData.append(`order[${tab.id}]`, index.toString());
						});

						await fetch('?/reorderTabs', {
							method: 'POST',
							body: orderFormData
						});
					}
				}
			}
		};
	}
</script>

<div class="w-full rounded-xl border bg-card text-card-foreground shadow-sm">
	<div class="p-4">
		<div class="mb-4 flex items-center justify-between">
			<h3 class="text-lg font-bold">{m['structure.manage']()}</h3>
			<Button variant="outline" href="/projekti/struktura/grupas">
				<Plus class="mr-2 h-4 w-4" />
				{m['groups.new_group']()}
			</Button>
		</div>

		<div class="space-y-1">
			<div
				use:dragHandleZone={{
					items: groups,
					flipDurationMs,
					morphDisabled: true
				}}
				onconsider={handleGroupDndConsider}
				onfinalize={handleGroupDndFinalize}
			>
				{#each groups as group, groupIndex (group.id)}
					<div animate:flip={{ duration: flipDurationMs }} class="rounded-md border bg-background">
						<!-- Group Header -->
						<div class="flex items-center gap-2 p-2 transition-colors hover:bg-muted/50">
							<button
								use:dragHandle
								class="cursor-grab rounded p-1 hover:bg-muted active:cursor-grabbing"
								aria-label="Drag to reorder group"
							>
								<GripVertical class="h-4 w-4 text-muted-foreground" />
							</button>

							<button
								onclick={() => toggleGroup(group.id)}
								class="flex flex-1 items-center gap-2 rounded p-1 text-left font-medium hover:bg-muted"
							>
								{#if expandedGroups.has(group.id)}
									<ChevronDown class="h-4 w-4" />
								{:else}
									<ChevronRight class="h-4 w-4" />
								{/if}
								<span>{getTranslation(group.translations)?.name || 'Untitled Group'}</span>
								<span class="ml-2 text-xs text-muted-foreground">
									({group.tabs?.length || 0}
									{m['tabs.value']()})
								</span>
							</button>

							<div class="flex gap-2">
								<Button href="/projekti/struktura/grupas/{group.id}" variant="ghost" size="icon">
									<Pencil class="h-4 w-4" />
								</Button>
								<Button
									href="/projekti/struktura/grupas/izdzest/{group.id}"
									variant="ghost"
									size="icon"
								>
									<Trash2 class="h-4 w-4 text-destructive" />
								</Button>
							</div>
						</div>

						{#if expandedGroups.has(group.id)}
							<div class="border-t bg-muted/20">
								<!-- Always render drop zone, conditionally render content inside -->
								<div
									class="ml-6"
									use:dragHandleZone={{
										items: group.tabs || [],
										flipDurationMs,
										morphDisabled: true,
										type: 'tab',
										dropFromOthersDisabled: false
									}}
									onconsider={createTabHandlers(groupIndex, group.id).handleDndConsider}
									onfinalize={createTabHandlers(groupIndex, group.id).handleDndFinalize}
								>
									{#if group.tabs && group.tabs.length > 0}
										{#each group.tabs as tab (tab.id)}
											<div
												animate:flip={{ duration: flipDurationMs }}
												class="flex items-center gap-2 border-b p-2 transition-colors last:border-b-0 hover:bg-muted/50"
											>
												<button
													use:dragHandle
													class="cursor-grab rounded p-1 hover:bg-muted active:cursor-grabbing"
													aria-label="Drag to reorder tab"
												>
													<GripVertical class="h-3 w-3 text-muted-foreground" />
												</button>

												<div
													class="h-4 w-4 rounded-full border-2"
													style="background-color: {tab.color}"
													title="Tab color: {tab.color}"
												></div>

												<span class="flex-1 text-sm">
													{getTranslation(tab.translations)?.name || 'Untitled Tab'}
												</span>

												{#if tab.owner}
													<span class="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
														Personal
													</span>
												{/if}

												<div class="flex gap-1">
													<Button
														href="/projekti/struktura/saraksti/{tab.id}"
														variant="ghost"
														size="icon"
														class="h-8 w-8"
													>
														<Pencil class="h-3 w-3" />
													</Button>
													<Button
														href="/projekti/struktura/saraksti/izdzest/{tab.id}"
														variant="ghost"
														size="icon"
														class="h-8 w-8"
													>
														<Trash2 class="h-3 w-3 text-destructive" />
													</Button>
												</div>
											</div>
										{/each}
									{:else}
										<!-- Empty group message -->
										<div
											class="rounded-md border-2 border-dashed border-muted p-4 text-center text-sm text-muted-foreground"
										>
											{m['groups.empty']()}
										</div>
									{/if}
								</div>
								<!-- Add Tab Button -->
								<div class="ml-6 border-t p-2">
									<Button
										href="/projekti/struktura/saraksti?group={group.id}"
										variant="ghost"
										size="sm"
										class="w-full justify-start"
									>
										<Plus class="mr-2 h-3 w-3" />
										{m['tabs.add']()}
									</Button>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>

			{#if groups.length === 0}
				<div class="py-8 text-center text-muted-foreground">
					<p>{m['groups.empty']()}</p>
					<Button variant="outline" href="/projekti/struktura/grupas" class="mt-4">
						<Plus class="mr-2 h-4 w-4" />
						{m['groups.new_group']()}
					</Button>
				</div>
			{/if}
		</div>

		{#if form?.message}
			<FormError error={form?.message} />
		{/if}
	</div>
</div>
