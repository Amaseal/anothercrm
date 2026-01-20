<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card/index.js';
	import X from '@lucide/svelte/icons/x';
	import FormError from '$lib/components/form-error.svelte';
	import Send from '@lucide/svelte/icons/send';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Send Invoice</title>
</svelte:head>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
	<div class="max-h-[90vh] w-full max-w-md overflow-hidden rounded-lg">
		<Card.Root class="custom-scroll relative max-h-[90vh] w-full max-w-md gap-2 overflow-y-auto">
			<Card.Header>
				<a
					href="/rekini"
					class="absolute top-7 right-5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
					><X /></a
				>
				<h2 class="text-lg font-semibold">
					Send Invoice {data.item?.invoiceNumber} via Email?
				</h2>
			</Card.Header>
			<Card.Content class="p-6 pb-2">
				<div class="mb-4 text-sm text-gray-600">
					<p><strong>To Client:</strong> {data.item?.client?.name}</p>
					<p><strong>Email:</strong> {data.item?.client?.email || 'No email found!'}</p>
					<p><strong>Total:</strong> {(data.item?.total / 100).toFixed(2)} EUR</p>
				</div>

				{#if form?.message}
					<FormError error={form?.message} />
				{/if}

				{#if !data.item?.client?.email}
					<div class="mb-4 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-600">
						Client has no email address configured.
					</div>
				{/if}

				<form method="POST" use:enhance>
					<div class="flex items-center justify-end gap-2">
						<Button href="/rekini" variant="outline">Cancel</Button>
						<Button type="submit" disabled={!data.item?.client?.email} class="gap-2">
							<Send size="16" /> Send Email
						</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>
	</div>
</div>
