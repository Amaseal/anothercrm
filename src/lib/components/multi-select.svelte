<script lang="ts">
	import * as Command from '$lib/components/ui/command';
	import * as Popover from '$lib/components/ui/popover';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Check, ChevronsUpDown } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import * as m from '$lib/paraglide/messages';

	let {
		options = [],
		value = $bindable([]),
		placeholder = 'Select items...',
		disabled = false
	} = $props<{
		options: { value: string | number; label: string }[];
		value: (string | number)[];
		placeholder?: string;
		disabled?: boolean;
	}>();

	let open = $state(false);

	function toggleSelection(optionValue: string | number) {
		if (value.includes(optionValue)) {
			value = value.filter((v: any) => v !== optionValue);
		} else {
			value = [...value, optionValue];
		}
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger disabled={disabled}>
		{#snippet child({ props })}
			<Button
				variant="outline"
				role="combobox"
				aria-expanded={open}
				disabled={disabled}
				class="h-auto min-h-10 w-full !justify-between hover:bg-background"
				{...props}
			>
				<div class="flex w-full flex-wrap gap-1">
					{#if value.length === 0}
						<span class="font-normal text-muted-foreground">{placeholder}</span>
					{:else if value.length > 4}
						<Badge variant="secondary" class="rounded-sm px-1 font-normal">
							{m['projects.selected_count']({ count: value.length })}
						</Badge>
					{:else}
						{#each value as v}
							{@const option = options.find((o: any) => o.value === v)}
							{#if option}
								<Badge variant="secondary" class="rounded-sm px-1 font-normal">
									{option.label}
								</Badge>
							{/if}
						{/each}
					{/if}
				</div>
				<ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-[var(--bits-popover-anchor-width)] p-0">
		<Command.Root>
			<Command.Input placeholder={m['projects.search_placeholder']()} />
			<Command.List class="max-h-[300px] overflow-y-auto">
				<Command.Empty>{m['projects.no_item_found']()}</Command.Empty>
				<Command.Group>
					{#each options as option}
						<Command.Item
							value={option.label}
							onSelect={() => {
								toggleSelection(option.value);
							}}
						>
							<Check
								class={cn(
									'mr-2 h-4 w-4',
									value.includes(option.value) ? 'opacity-100' : 'opacity-0'
								)}
							/>
							{option.label}
						</Command.Item>
					{/each}
				</Command.Group>
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
