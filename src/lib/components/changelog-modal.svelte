<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button';
	import { getLocale } from '$lib/paraglide/runtime';
	import type { ChangelogEntry } from '$lib/config/changelog';

	let { changelog }: { changelog: ChangelogEntry[] } = $props();

	let open = $state(true);
	let dismissed = false;
	const locale = getLocale();

	function dismiss() {
		if (dismissed) return;
		dismissed = true;
		open = false;
		fetch('/api/changelog/dismiss', { method: 'POST', keepalive: true });
	}
</script>

<Dialog.Root bind:open onOpenChange={(v) => { if (!v) dismiss(); }}>
	<Dialog.Content class="max-h-[80vh] w-full max-w-lg overflow-hidden flex flex-col">
		<Dialog.Header>
			<Dialog.Title class="text-xl">
				{changelog[0].content[locale as 'lv' | 'en']?.title ?? changelog[0].content.en.title}
			</Dialog.Title>
			<Dialog.Description class="text-sm text-muted-foreground">
				{changelog[0].date}
			</Dialog.Description>
		</Dialog.Header>

		<div class="custom-scroll flex-1 overflow-y-auto py-2">
			{#each changelog as entry}
				{@const content = entry.content[locale as 'lv' | 'en'] ?? entry.content.en}
				{#if entry !== changelog[0]}
					<p class="mb-1 mt-4 text-sm font-semibold text-muted-foreground">{entry.date}</p>
				{/if}
				<ul class="space-y-2">
					{#each content.items as item}
						<li class="flex items-start gap-2 text-sm">
							<span class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"></span>
							{item}
						</li>
					{/each}
				</ul>
			{/each}
		</div>

		<Dialog.Footer class="pt-4">
			<Button onclick={dismiss} class="w-full sm:w-auto">OK</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
