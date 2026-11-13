<script lang="ts">
	import { resolve } from '$app/paths';
	import { beforeNavigate } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import * as Dialog from '$lib/components/ui/dialog';
	import ProductionOrderPreview from './production-order-preview.svelte';
	import * as m from '$lib/paraglide/messages';
	import type { PreparedSource } from '$lib/server/production-sources';
	import type { ProductionOrder } from '$lib/server/production-workbook';
	import type { GeneratedProduction } from '$lib/server/production-generation';

	let {
		taskId,
		description = '',
		oncreated
	}: {
		taskId: number;
		description?: string;
		oncreated: (result: GeneratedProduction) => void;
	} = $props();
	type Context = {
		attachments: { id: number; filename: string }[];
		images: { index: number; src: string }[];
		ai: { ready: boolean; model: string; revision: string };
	};
	type Proposal = {
		orders: ProductionOrder[];
		warnings: string[];
		sourceName: string;
		sourceRevision: string;
	};
	let context = $state<Context | null>(null);
	let choice = $state('file');
	let file = $state<File | null>(null);
	let text = $state('');
	let sheet = $state('');
	let prepared = $state<(PreparedSource & { engine: 'local' | 'ai' }) | null>(null);
	let pdfUrl = $state('');
	let snapshot: FormData | null = null;
	let pending = $state<Proposal | null>(null);
	let pendingOpen = $state(false);
	let preparing = $state(false);
	let busy = $state('');
	let message = $state('');
	let active: AbortController | undefined;
	let sourceRequest: AbortController | undefined;
	let contextRequest: AbortController | undefined;
	const options = $derived([
		{ value: 'file', label: m['production_parse.file']() },
		{ value: 'text', label: m['production_parse.text']() },
		{ value: 'editor-text', label: m['production_parse.use_editor_text']() },
		...(context?.attachments || []).map((entry) => ({
			value: `attachment:${entry.id}`,
			label: entry.filename
		})),
		...(context?.images || []).map((entry) => ({
			value: `image:${entry.src}`,
			label: `${entry.index + 1}: ${entry.src.split('/').at(-1)}`
		}))
	]);

	async function payload(response: Response) {
		const result = await response.json().catch(() => {
			throw new Error(m['production_parse.failed']());
		});
		if (!response.ok)
			throw Object.assign(new Error(result.message || m['production_parse.failed']()), {
				status: response.status
			});
		return result;
	}
	function invalidate(resetSheet = false) {
		sourceRequest?.abort();
		prepared = null;
		snapshot = null;
		message = '';
		if (resetSheet) sheet = '';
	}
	async function loadContext(id: number) {
		contextRequest?.abort();
		const request = new AbortController();
		contextRequest = request;
		try {
			const result = await payload(
				await fetch(resolve('/api/tasks/[id]/production-parse', { id: String(id) }), {
					signal: request.signal
				})
			);
			if (!request.signal.aborted) context = result;
		} catch (cause) {
			if (!request.signal.aborted)
				message = cause instanceof Error ? cause.message : m['production_parse.failed']();
		}
	}
	function editorText() {
		const template = document.createElement('template');
		template.innerHTML = description;
		template.content
			.querySelectorAll('script,style,img,iframe')
			.forEach((element) => element.remove());
		template.content.querySelectorAll('br').forEach((element) => element.replaceWith('\n'));
		template.content.querySelectorAll('td,th').forEach((element) => element.append('\t'));
		template.content
			.querySelectorAll('p,div,li,tr,h1,h2,h3')
			.forEach((element) => element.append('\n'));
		return template.content.textContent?.trim() || '';
	}
	function chooseSource(value: string) {
		choice = value;
		if (value === 'editor-text') text = editorText();
		invalidate(true);
	}
	function paste(event: ClipboardEvent) {
		const images = Array.from(event.clipboardData?.files || []).filter((entry) =>
			entry.type.startsWith('image/')
		);
		if (!images.length) return;
		event.preventDefault();
		if (images.length !== 1) {
			message = m['production_parse.one_image']();
			return;
		}
		const image = images[0];
		file =
			image.type === 'image/png' || image.type === 'image/jpeg'
				? new File(
						[image],
						image.type === 'image/png' ? 'pasted-screenshot.png' : 'pasted-screenshot.jpg',
						{ type: image.type }
					)
				: image;
		choice = 'file';
		invalidate(true);
	}
	async function persist(proposal: Proposal, signal: AbortSignal) {
		const result = await payload(
			await fetch(resolve('/api/tasks/[id]/production-parse/save', { id: String(taskId) }), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ orders: proposal.orders }),
				signal
			})
		);
		if (!signal.aborted) {
			pending = null;
			pendingOpen = false;
			oncreated(result);
		}
		return result as GeneratedProduction;
	}
	async function generate() {
		if (busy || !prepared || !snapshot || !context) return;
		const selected = prepared;
		const form = new FormData();
		for (const [key, value] of snapshot) form.append(key, value);
		form.set('engine', selected.engine);
		form.set('sourceRevision', selected.revision);
		if (selected.engine === 'ai') {
			form.set('paidConsent', 'true');
			form.set('aiRevision', context.ai.revision);
		}
		const request = new AbortController();
		active = request;
		busy = 'parse';
		message = '';
		try {
			// Retry only a failed save for this source; never repeat a paid call automatically.
			let proposal = pending?.sourceRevision === selected.revision ? pending : null;
			if (!proposal)
				proposal = await payload(
					await fetch(resolve('/api/tasks/[id]/production-parse', { id: String(taskId) }), {
						method: 'POST',
						body: form,
						signal: request.signal
					})
				);
			if (request.signal.aborted || !proposal) return;
			if (!proposal.orders.length) {
				message = m['production_parse.no_rows']();
				return;
			}
			pending = proposal;
			busy = 'save';
			await persist(proposal, request.signal);
		} catch (cause) {
			if (!request.signal.aborted) {
				message = cause instanceof Error ? cause.message : m['production_parse.failed']();
				if (busy === 'save' && pending?.orders.length) pendingOpen = true;
				if (cause instanceof Error && 'status' in cause && cause.status === 409)
					void loadContext(taskId);
			}
		} finally {
			if (active === request) {
				active = undefined;
				busy = '';
			}
		}
	}
	async function editPending() {
		if (busy || !pending?.orders.length) return;
		const tab = window.open('about:blank', '_blank');
		if (tab) tab.opener = null;
		const request = new AbortController();
		active = request;
		busy = 'save';
		message = '';
		try {
			const result = await persist(pending, request.signal);
			if (tab && !request.signal.aborted)
				tab.location.href = resolve('/(app)/dokumenti/[id]', { id: String(result.fileId) });
		} catch (cause) {
			tab?.close();
			if (!request.signal.aborted)
				message = cause instanceof Error ? cause.message : m['production_parse.failed']();
		} finally {
			if (active === request) {
				active = undefined;
				busy = '';
			}
		}
	}
	function cancel() {
		active?.abort();
		active = undefined;
		busy = '';
		message = m['production_parse.cancelled']();
	}

	$effect(() => {
		const id = taskId;
		context = null;
		pending = null;
		pendingOpen = false;
		prepared = null;
		snapshot = null;
		file = null;
		text = '';
		sheet = '';
		choice = 'file';
		message = '';
		busy = '';
		void loadContext(id);
		return () => {
			active?.abort();
			sourceRequest?.abort();
			contextRequest?.abort();
		};
	});
	$effect(() => {
		const available = context;
		const selected = choice;
		const upload = file;
		const excerpt = text;
		const selectedSheet = sheet;
		const id = taskId;
		prepared = null;
		snapshot = null;
		preparing = false;
		if (
			!available ||
			(selected === 'file' && !upload) ||
			((selected === 'text' || selected === 'editor-text') && !excerpt.trim())
		)
			return;
		const form = new FormData();
		if (selected === 'file' && upload) {
			form.set('kind', 'file');
			form.set('file', upload);
		} else if (selected === 'text' || selected === 'editor-text') {
			form.set('kind', 'text');
			form.set('text', excerpt);
		} else if (selected.startsWith('attachment:')) {
			form.set('kind', 'attachment');
			form.set('fileId', selected.slice(11));
		} else if (selected.startsWith('image:')) {
			const image = available.images.find((entry) => entry.src === selected.slice(6));
			if (!image) return;
			form.set('kind', 'editor-image');
			form.set('imageIndex', String(image.index));
		}
		if (selectedSheet) form.set('sheet', selectedSheet);
		const request = new AbortController();
		sourceRequest = request;
		preparing = true;
		const timer = setTimeout(async () => {
			try {
				const result = await payload(
					await fetch(resolve('/api/tasks/[id]/production-parse/source', { id: String(id) }), {
						method: 'POST',
						body: form,
						signal: request.signal
					})
				);
				if (!request.signal.aborted) {
					prepared = result;
					snapshot = form;
					if (result.sheet) form.set('sheet', result.sheet);
				}
			} catch (cause) {
				if (!request.signal.aborted)
					message = cause instanceof Error ? cause.message : m['production_parse.failed']();
			} finally {
				if (sourceRequest === request) preparing = false;
			}
		}, 250);
		return () => {
			clearTimeout(timer);
			request.abort();
		};
	});
	$effect(() => {
		const source = prepared;
		pdfUrl = '';
		if (source?.mime === 'application/pdf' && source.base64) {
			const bytes = Uint8Array.from(atob(source.base64), (character) => character.charCodeAt(0));
			const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
			pdfUrl = url;
			return () => URL.revokeObjectURL(url);
		}
	});
	beforeNavigate(({ cancel: stop }) => {
		if ((pending || busy) && !confirm(m['production_parse.unsaved_warning']())) stop();
	});
</script>

<svelte:window
	onfocus={() => {
		if (!busy) void loadContext(taskId);
	}}
	onbeforeunload={(event) => {
		if (pending || busy) {
			event.preventDefault();
			event.returnValue = '';
		}
	}}
/>

<section class="mb-6 space-y-3 rounded-lg border p-3" aria-label={m['production_parse.title']()}>
	<h3 class="text-sm font-medium">{m['production_parse.title']()}</h3>
	{#if message}<p role="status" class="text-sm text-destructive">{message}</p>{/if}
	{#if context}
		<Label for="production-source">{m['production_parse.source']()}</Label>
		<Select.Root type="single" value={choice} onValueChange={chooseSource} disabled={!!busy}>
			<Select.Trigger id="production-source" class="w-full"
				>{options.find((option) => option.value === choice)?.label}</Select.Trigger
			>
			<Select.Content
				>{#each options as option (option.value)}<Select.Item value={option.value}
						>{option.label}</Select.Item
					>{/each}</Select.Content
			>
		</Select.Root>
		{#if choice === 'file'}
			<Input
				type="file"
				aria-label={m['production_parse.file']()}
				accept=".txt,.csv,.tsv,.xlsx,.pdf,.png,.jpg,.jpeg"
				disabled={!!busy}
				onchange={(event) => {
					file = event.currentTarget.files?.[0] || null;
					invalidate(true);
				}}
			/>
			{#if file}<p class="text-xs text-muted-foreground">
					{file.name} · {(file.size / 1024).toFixed(1)} KB
				</p>{/if}
		{:else if choice === 'text' || choice === 'editor-text'}
			<Textarea
				aria-label={m['production_parse.excerpt']()}
				bind:value={text}
				oninput={() => invalidate()}
				onpaste={paste}
				maxlength={128000}
				disabled={!!busy}
				rows={4}
			/>
		{/if}
		{#if prepared?.sheets && prepared.sheets.length > 1}
			<Select.Root
				type="single"
				value={sheet || prepared.sheet}
				onValueChange={(value) => {
					sheet = value;
					invalidate();
				}}
				disabled={!!busy}
			>
				<Select.Trigger class="w-full" aria-label={m['production_parse.sheet']()}
					>{sheet || prepared.sheet}</Select.Trigger
				><Select.Content
					>{#each prepared.sheets as name (name)}<Select.Item value={name}>{name}</Select.Item
						>{/each}</Select.Content
				>
			</Select.Root>
		{/if}
		{#if preparing}<p class="text-xs text-muted-foreground">
				{m['production_parse.preparing']()}
			</p>{/if}
		{#if prepared}
			{#if prepared.mime.startsWith('image/')}<img
					src={`data:${prepared.mime};base64,${prepared.base64}`}
					alt={m['production_parse.selected_image']()}
					class="max-h-40 max-w-full object-contain"
				/>
			{:else if pdfUrl}<Button
					href={pdfUrl}
					target="_blank"
					rel="noopener"
					variant="ghost"
					size="sm">{m['production_parse.open_pdf']()}</Button
				>{/if}
			{#if prepared.text && choice !== 'text' && choice !== 'editor-text'}<details>
					<summary class="cursor-pointer text-xs"
						>{prepared.name}{prepared.sheet ? ` · ${prepared.sheet}` : ''}</summary
					>
					<pre class="max-h-40 overflow-auto text-xs whitespace-pre-wrap">{prepared.text}</pre>
				</details>{/if}
			<p class="text-xs text-muted-foreground">
				{pending?.sourceRevision === prepared.revision
					? m['production_parse.retry_notice']()
					: prepared.engine === 'local'
						? m['production_parse.free_notice']()
						: m['production_parse.generate_consent']({ model: context.ai.model || 'Gemini' })}
			</p>
			{#if prepared.engine === 'ai' && !context.ai.ready && pending?.sourceRevision !== prepared.revision}<p
					class="text-xs text-muted-foreground"
				>
					{m['production_parse.configure']()}
				</p>
				<Button
					href={`${resolve('/(app)/iestatijumi')}#gemini`}
					target="_blank"
					rel="noopener"
					variant="outline">{m['gemini_settings.title']()}</Button
				>{/if}
		{/if}
		<Button
			type="button"
			onclick={generate}
			disabled={!!busy ||
				preparing ||
				!prepared ||
				(prepared.engine === 'ai' &&
					!context.ai.ready &&
					pending?.sourceRevision !== prepared.revision)}
			>{pending && pending.sourceRevision === prepared?.revision
				? m['production_parse.retry_save']()
				: m['production_parse.generate']()}</Button
		>
		{#if busy}<p role="status" class="text-sm">{m['production_parse.working']()}</p>
			{#if busy !== 'save'}<Button type="button" variant="outline" onclick={cancel}
					>{m['production_parse.cancel']()}</Button
				>{/if}{/if}
		{#if pending && !busy}<Button
				type="button"
				variant="outline"
				onclick={() => {
					pendingOpen = true;
				}}>{m['production_projects.preview']()}</Button
			>{/if}
	{:else}<p class="text-sm text-muted-foreground">{m['production_parse.loading']()}</p>{/if}
</section>

<Dialog.Root bind:open={pendingOpen}>
	{#if pending}
		<Dialog.Content class="flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-5xl">
			<Dialog.Header class="shrink-0">
				<Dialog.Title class="pr-6 break-all"
					>{m['production_parse.unsaved_result']({ source: pending.sourceName })}</Dialog.Title
				>
				<Dialog.Description>{m['production_projects.modal_description']()}</Dialog.Description>
			</Dialog.Header>
			<div class="custom-scroll min-h-0 flex-1 space-y-3 overflow-y-auto">
				{#if message}<p role="status" class="text-sm text-destructive">{message}</p>{/if}
				<ProductionOrderPreview orders={pending.orders} warnings={pending.warnings} />
			</div>
			<Dialog.Footer class="shrink-0"
				><Button type="button" onclick={editPending} disabled={!!busy || !pending.orders.length}
					>{m['production_projects.edit']()}</Button
				></Dialog.Footer
			>
		</Dialog.Content>
	{/if}
</Dialog.Root>
