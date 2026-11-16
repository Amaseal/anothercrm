<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { toCurrency } from '$lib/utilities';
	import type { taskHistory } from '$lib/server/db/schema';
	import type { HistoryChange } from '$lib/server/history';

	export let history: (typeof taskHistory.$inferSelect & { user?: { name: string } | null })[] = [];

	// Helper to parse changeData safely
	function parseChanges(json: string): HistoryChange[] {
		try {
			return JSON.parse(json) as HistoryChange[];
		} catch {
			return [];
		}
	}

	// Helper to get field label
	function getFieldLabel(field: string) {
		switch (field) {
			case 'title':
				return m['projects.title_label']();
			case 'description':
				return m['projects.description_label']();
			case 'client':
				return m['projects.client_label']();
			case 'assigned':
				return m['projects.assign_user_label']();
			case 'dueDate':
				return m['projects.due_date_label']();
			case 'seamstress':
				return m['projects.seamstress_label']();
			case 'price':
				return m['projects.price_label']();
			default:
				return field;
		}
	}

	function formatValue(field: string, val: unknown) {
		if (val === null || val === undefined) return '-';
		if (field === 'price' && typeof val === 'number') return toCurrency(val);
		return String(val);
	}
</script>

<div class="space-y-4">
	{#if history.length === 0}
		<p class="text-sm text-muted-foreground">{m['history.empty']()}</p>
	{:else}
		<div class="flex flex-col gap-4">
			{#each history as item (item.id)}
				<div class="border-l-2 border-primary py-1 pl-4">
					<div class="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
						<span class="font-medium text-foreground"
							>{item.user?.name || m['history.user_unknown']()}</span
						>
						<span>•</span>
						<span>{new Date(item.createdAt).toLocaleString()}</span>
					</div>

					{#if item.changeType === 'created'}
						<p>{m['history.created']()}</p>
					{:else if item.changeType === 'updated' && item.changeData}
						{@const changes = parseChanges(item.changeData)}
						<ul class="list-none space-y-1">
							{#each changes as change, entryIndex1 (entryIndex1)}
								<li class="text-sm">
									{m['history.field_changed']({
										field: getFieldLabel(change.field),
										from: formatValue(change.field, change.from),
										to: formatValue(change.field, change.to)
									})}
								</li>
							{/each}
						</ul>
					{:else}
						<p class="text-sm">{item.description}</p>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
