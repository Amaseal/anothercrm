<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import FormError from '$lib/components/form-error.svelte';
	import type { Client } from '$lib/server/db/schema.js';
	import X from '@lucide/svelte/icons/x';
	import Merge from '@lucide/svelte/icons/git-merge';
	import UserCheck from '@lucide/svelte/icons/user-check';
	import * as m from '$lib/paraglide/messages';
	import { goto } from '$app/navigation';

	let {
		data,
		form
	}: {
		data: { clients: Client[]; userLinkedClientIds: number[] };
		form: { message: string } | null;
	} = $props();

	let primaryId = $state<number | null>(
		// Auto-select the user-linked client if exactly one exists
		data.userLinkedClientIds.length === 1 ? data.userLinkedClientIds[0] : null
	);

	const clientIdsStr = $derived(data.clients.map((c) => c.id).join(','));
	const canSubmit = $derived(primaryId !== null && data.clients.length >= 2);
	const hasMultipleUserLinked = $derived(data.userLinkedClientIds.length > 1);
</script>

<svelte:head>
	<title>{m['clients.merge_title']()}</title>
</svelte:head>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
	<div class="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg">
		<Card.Root class="custom-scroll relative max-h-[90vh] w-full gap-2 overflow-y-auto">
			<Card.Header>
				<a
					href="/klienti"
					class="absolute top-7 right-5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
				>
					<X />
				</a>
				<div class="flex items-center gap-2">
					<Merge class="h-5 w-5" />
					<h2 class="text-lg font-semibold">{m['clients.merge_title']()}</h2>
				</div>
				<p class="text-sm text-muted-foreground">{m['clients.merge_description']()}</p>
			</Card.Header>
			<Card.Content class="p-6 pb-2">
				{#if form?.message}
					<FormError error={form.message} />
				{/if}

				{#if hasMultipleUserLinked}
					<FormError error={m['clients.errors.merge_multiple_user_clients']()} />
				{:else if data.clients.length < 2}
					<FormError error={m['clients.merge_select_min']()} />
				{:else}
					<form method="POST" use:enhance>
						<input type="hidden" name="clientIds" value={clientIdsStr} />
						<input type="hidden" name="primaryId" value={primaryId ?? ''} />

						<div class="mb-6 space-y-3">
							{#each data.clients as item (item.id)}
								{@const isUserLinked = data.userLinkedClientIds.includes(item.id)}
								{@const isPrimary = primaryId === item.id}
								<button
									type="button"
									onclick={() => {
										if (!isUserLinked || data.userLinkedClientIds.length !== 1) {
											primaryId = item.id;
										}
									}}
									class="w-full cursor-pointer rounded-lg border-2 p-4 text-left transition-colors {isPrimary
										? 'border-primary bg-primary/5'
										: 'border-border hover:border-muted-foreground/50'}"
								>
									<div class="flex items-start justify-between gap-2">
										<div class="min-w-0 flex-1">
											<div class="flex flex-wrap items-center gap-2">
												<span class="font-medium">{item.name}</span>
												{#if isPrimary}
													<Badge variant="default" class="text-xs"
														>{m['clients.merge_primary_badge']()}</Badge
													>
												{/if}
												{#if isUserLinked}
													<Badge variant="secondary" class="flex items-center gap-1 text-xs">
														<UserCheck class="h-3 w-3" />
														{m['clients.merge_linked_user']()}
													</Badge>
												{/if}
											</div>
											<div
												class="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground"
											>
												{#if item.email}
													<span>{item.email}</span>
												{/if}
												{#if item.phone}
													<span>{item.phone}</span>
												{/if}
												{#if item.type}
													<span>{item.type}</span>
												{/if}
											</div>
										</div>
										<div
											class="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 {isPrimary
												? 'border-primary bg-primary'
												: 'border-muted-foreground/40'}"
										></div>
									</div>
								</button>
							{/each}
						</div>

						<div class="flex items-center justify-end gap-2 pb-4">
							<Button href="/klienti" variant="outline">{m['clients.merge_cancel']()}</Button>
							<Button type="submit" disabled={!canSubmit}>
								<Merge class="mr-2 h-4 w-4" />
								{m['clients.merge_confirm']()}
							</Button>
						</div>
					</form>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</div>
