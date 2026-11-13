<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { onDestroy } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as m from '$lib/paraglide/messages';
	import type { productionAiStatus } from '$lib/server/production-ai';

	let { settings }: { settings: Awaited<ReturnType<typeof productionAiStatus>> } = $props();
	let apiKey = $state('');
	let removeKey = $state(false);
	let saving = $state(false);
	let refreshing = $state(false);
	let models = $state<{ id: string; displayName: string }[]>([]);
	let message = $state('');
	let active: AbortController | undefined;

	function keyChanged() {
		active?.abort();
		active = undefined;
		refreshing = false;
		models = [];
		message = '';
	}
	async function refreshModels() {
		active?.abort();
		const request = new AbortController();
		active = request;
		refreshing = true;
		message = '';
		const form = new FormData();
		form.set('apiKey', apiKey);
		try {
			const response = await fetch(resolve('/api/production-ai/models'), {
				method: 'POST',
				body: form,
				signal: request.signal
			});
			const result = await response.json().catch(() => {
				throw new Error(m['gemini_settings.refresh_failed']());
			});
			if (!response.ok) throw new Error(result.message || m['gemini_settings.refresh_failed']());
			if (!request.signal.aborted) {
				models = result.models;
				message = m['gemini_settings.models_loaded']({ count: models.length });
			}
		} catch (cause) {
			if (!request.signal.aborted)
				message = cause instanceof Error ? cause.message : m['gemini_settings.refresh_failed']();
		} finally {
			if (active === request) {
				active = undefined;
				refreshing = false;
			}
		}
	}
	onDestroy(() => active?.abort());
</script>

<Card.Root id="gemini">
	<Card.Header>
		<Card.Title>{m['gemini_settings.title']()}</Card.Title>
		<Card.Description>{m['gemini_settings.description']()}</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-4">
		<p class="text-sm text-muted-foreground">
			{settings.source === 'environment'
				? m['gemini_settings.environment']()
				: m['gemini_settings.database']()}
		</p>
		<p class="text-sm">
			{settings.ready ? m['gemini_settings.ready']() : m['gemini_settings.not_ready']()}
		</p>
		<form
			method="POST"
			action="?/updateGemini"
			class="space-y-4"
			use:enhance={() => {
				saving = true;
				return async ({ result, update }) => {
					try {
						if (result.type === 'success') {
							apiKey = '';
							removeKey = false;
							models = [];
						}
						await update({ reset: false });
					} finally {
						saving = false;
					}
				};
			}}
		>
			<div class="grid gap-2">
				<Label for="gemini-key">{m['gemini_settings.key']()}</Label>
				<Input
					id="gemini-key"
					name="apiKey"
					type="password"
					bind:value={apiKey}
					oninput={keyChanged}
					autocomplete="new-password"
					spellcheck={false}
					maxlength={512}
					disabled={saving || removeKey}
					placeholder={settings.keyConfigured ? m['gemini_settings.key_saved']() : ''}
				/>
				<p class="text-xs text-muted-foreground">{m['gemini_settings.key_help']()}</p>
			</div>
			<div class="flex items-start gap-2">
				<input
					id="gemini-remove-key"
					name="removeKey"
					type="checkbox"
					bind:checked={removeKey}
					disabled={saving}
					onchange={keyChanged}
				/>
				<Label for="gemini-remove-key" class="text-sm">{m['gemini_settings.remove_key']()}</Label>
			</div>
			<div class="grid gap-2">
				<Label for="gemini-model">{m['gemini_settings.model']()}</Label>
				<Input
					id="gemini-model"
					name="model"
					value={settings.model}
					list="gemini-model-options"
					autocomplete="off"
					spellcheck={false}
					maxlength={128}
					disabled={saving}
					placeholder="gemini-…"
				/>
				<datalist id="gemini-model-options"
					>{#each models as model (model.id)}<option value={model.id}>{model.displayName}</option
						>{/each}</datalist
				>
				<p class="text-xs text-muted-foreground">{m['gemini_settings.model_help']()}</p>
			</div>
			<div class="flex flex-wrap gap-2">
				<Button
					type="button"
					variant="outline"
					onclick={refreshModels}
					disabled={saving ||
						refreshing ||
						removeKey ||
						(!settings.keyConfigured && !apiKey.trim())}
					>{refreshing ? m['gemini_settings.refreshing']() : m['gemini_settings.refresh']()}</Button
				>
				<Button type="submit" disabled={saving || refreshing}>{m['components.save']()}</Button>
			</div>
		</form>
		{#if message}<p role="status" class="text-sm">{message}</p>{/if}
		<p class="text-xs text-muted-foreground">{m['gemini_settings.cost_notice']()}</p>
	</Card.Content>
</Card.Root>
