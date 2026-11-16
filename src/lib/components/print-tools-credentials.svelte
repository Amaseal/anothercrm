<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as m from '$lib/paraglide/messages';
	let {
		url,
		tokens,
		createdToken = ''
	}: { url: string; tokens: { id: number; expiresAt: Date }[]; createdToken?: string } = $props();
</script>

<Card.Root>
	<Card.Header><Card.Title>{m['print_tools.title']()}</Card.Title></Card.Header>
	<Card.Content class="space-y-4">
		<p class="text-sm text-muted-foreground">{m['print_tools.help']()}</p>
		<div class="space-y-2">
			<Label for="print-tools-url">{m['print_tools.url']()}</Label><Input
				id="print-tools-url"
				readonly
				value={url}
			/>
		</div>
		<form method="POST" action="?/createPrintToolsToken" use:enhance>
			<Button type="submit">{m['print_tools.create']()}</Button>
		</form>
		{#if createdToken}
			<div class="space-y-2" role="status">
				<Label for="print-tools-token">{m['print_tools.copy_once']()}</Label><Input
					id="print-tools-token"
					readonly
					value={createdToken}
					class="font-mono"
				/>
			</div>
		{/if}
		<ul class="space-y-2">
			{#each tokens as token (token.id)}
				<li class="flex flex-wrap items-center justify-between gap-2 text-sm">
					<span
						>#{token.id} · {m['print_tools.expires']()}
						{new Date(token.expiresAt).toISOString().slice(0, 10)}</span
					>
					<form method="POST" action="?/revokePrintToolsToken" use:enhance>
						<input type="hidden" name="tokenId" value={token.id} /><Button
							type="submit"
							variant="outline"
							size="sm">{m['print_tools.revoke']()}</Button
						>
					</form>
				</li>
			{/each}
		</ul>
	</Card.Content>
</Card.Root>
