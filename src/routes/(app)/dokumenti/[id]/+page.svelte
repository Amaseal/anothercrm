<script lang="ts">
	import { onMount } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { deserialize } from '$app/forms';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import Save from '@lucide/svelte/icons/save';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { toast } from 'svelte-sonner';
	import * as m from '$lib/paraglide/messages';

	let { data } = $props();
	let frame = $state<HTMLIFrameElement>();
	let loading = $state(true);
	let saving = $state(false);
	let errorMessage = $state('');
	let dirty = $state(false);
	let ready = $state(false);
	let revision = '';
	let editVersion = 0;
	let openRequest = '';
	let saveRequest = '';
	let fetchController: AbortController | undefined;
	const editorUrl = $derived(
		`/office/editor.html?embed=1&embedOrigin=${encodeURIComponent(page.url.origin)}&locale=en&document=${encodeURIComponent(data.document.id)}`
	);

	function send(type: string, payload: object = {}) {
		const id = crypto.randomUUID();
		frame?.contentWindow?.postMessage({ id, type, payload }, page.url.origin);
		return id;
	}

	async function openDocument() {
		fetchController?.abort();
		const controller = new AbortController();
		fetchController = controller;
		try {
			const response = await fetch(data.document.downloadUrl, {
				cache: 'no-store',
				signal: controller.signal
			});
			if (!response.ok) throw new Error(m['documents.open_failed']());
			const buffer = await response.arrayBuffer();
			if (controller.signal.aborted) return;
			revision = response.headers.get('X-Document-Revision') ?? data.document.revision;
			openRequest = send('document:open-buffer', { fileName: data.document.filename, buffer });
		} catch (cause) {
			if (controller.signal.aborted) return;
			errorMessage = cause instanceof Error ? cause.message : m['documents.open_failed']();
			loading = false;
		}
	}

	function save() {
		if (!ready || saving) return;
		saving = true;
		errorMessage = '';
		saveRequest = send('document:save', {
			targetExt: data.document.filename.split('.').pop()?.toUpperCase()
		});
	}

	async function upload(file: File, remainingEdits: boolean) {
		const documentId = data.document.id;
		const version = editVersion;
		try {
			const form = new FormData();
			form.set('file', file);
			form.set('revision', revision);
			const response = await fetch('?/save', {
				method: 'POST',
				headers: { accept: 'application/json', 'x-sveltekit-action': 'true' },
				body: form
			});
			const result = deserialize(await response.text());
			if (data.document.id !== documentId) return;
			if (result.type !== 'success' || typeof result.data?.revision !== 'string') {
				throw new Error(
					result.type === 'failure' && typeof result.data?.message === 'string'
						? result.data.message
						: m['documents.save_failed']()
				);
			}
			revision = result.data.revision;
			dirty = remainingEdits || editVersion !== version;
			toast.success(dirty ? m['documents.saved_more_edits']() : m['documents.saved']());
		} catch (cause) {
			if (data.document.id !== documentId) return;
			dirty = true;
			errorMessage = cause instanceof Error ? cause.message : m['documents.save_failed']();
		} finally {
			if (data.document.id === documentId) saving = false;
		}
	}

	function receive(event: MessageEvent<unknown>) {
		if (event.origin !== page.url.origin || event.source !== frame?.contentWindow) return;
		const message = event.data;
		if (!message || typeof message !== 'object' || !('type' in message)) return;
		const payload =
			'payload' in message && message.payload && typeof message.payload === 'object'
				? message.payload
				: null;
		const id = 'id' in message ? message.id : undefined;
		switch (message.type) {
			case 'document:ready':
				void openDocument();
				break;
			case 'document:opened':
				if (id !== openRequest) return;
				ready = true;
				loading = false;
				errorMessage = '';
				break;
			case 'document:dirty-changed':
				if (payload && 'dirty' in payload && payload.dirty === true) {
					dirty = true;
					editVersion++;
				}
				break;
			case 'document:saved':
				if (!saving || !saveRequest || id !== saveRequest) return;
				saveRequest = '';
				if (payload && 'file' in payload && payload.file instanceof File) {
					void upload(payload.file, 'dirty' in payload && payload.dirty === true);
				} else {
					saving = false;
					errorMessage = m['documents.save_failed']();
				}
				break;
			case 'document:error':
				if (id !== openRequest && id !== saveRequest) return;
				errorMessage =
					payload && 'message' in payload && typeof payload.message === 'string'
						? payload.message
						: m['documents.open_failed']();
				loading = false;
				saving = false;
				saveRequest = '';
				break;
		}
	}

	beforeNavigate(({ cancel, willUnload }) => {
		// Full-page exits use the native beforeunload warning instead of prompting twice.
		if (!willUnload && (dirty || saving) && !window.confirm(m['documents.leave_unsaved']()))
			cancel();
	});

	$effect(() => {
		const documentId = data.document.id;
		ready = false;
		saving = false;
		loading = true;
		dirty = false;
		errorMessage = '';
		openRequest = '';
		saveRequest = '';
		const timeout = setTimeout(() => {
			if (data.document.id === documentId && !ready) {
				loading = false;
				errorMessage = m['documents.editor_unavailable']();
			}
		}, 60_000);
		return () => {
			clearTimeout(timeout);
			fetchController?.abort();
		};
	});

	onMount(() => {
		const warnUnsaved = (event: BeforeUnloadEvent) => {
			if (!dirty && !saving) return;
			event.preventDefault();
			event.returnValue = '';
		};
		window.addEventListener('message', receive);
		window.addEventListener('beforeunload', warnUnsaved);
		return () => {
			fetchController?.abort();
			window.removeEventListener('message', receive);
			window.removeEventListener('beforeunload', warnUnsaved);
		};
	});
</script>

<svelte:head><title>{data.document.filename}</title></svelte:head>

<header class="flex h-(--header-height) shrink-0 items-center gap-2 rounded-lg">
	<div class="flex w-full items-center gap-2">
		<Sidebar.Trigger class="-ml-1" />
		<Separator orientation="vertical" class="mx-2 data-[orientation=vertical]:h-4" />
		<a href={resolve('/dokumenti')} class="text-base font-medium hover:underline"
			>{m['documents.title']()}</a
		>
		<span class="truncate text-sm text-muted-foreground">/ {data.document.filename}</span>
		{#if dirty}<span class="text-xs text-muted-foreground">{m['documents.unsaved']()}</span>{/if}
	</div>
</header>

<section class="rounded-md border bg-background">
	<div class="flex flex-wrap items-center gap-2 border-b p-2">
		<Button href={resolve('/dokumenti')} size="sm" variant="outline">
			<ArrowLeft class="mr-2 h-4 w-4" />{m['documents.back_to_documents']()}
		</Button>
		<a
			href={resolve('/api/documents/[id]', { id: data.document.id })}
			target="_blank"
			rel="noopener"
			class="min-w-0 flex-1 truncate text-sm hover:underline">{data.document.filename}</a
		>
		<Button size="sm" variant="outline" onclick={save} disabled={!ready || loading || saving}>
			<Save class="mr-2 h-4 w-4" />{saving ? m['documents.saving']() : m['documents.save']()}
		</Button>
	</div>
	{#if loading}<p role="status" class="p-4 text-sm text-muted-foreground">
			{m['documents.loading']()}
		</p>{/if}
	{#if errorMessage}<p role="alert" class="p-4 text-sm text-destructive">{errorMessage}</p>{/if}
	<iframe
		bind:this={frame}
		src={editorUrl}
		title={m['documents.editor_title']()}
		allow="clipboard-read; clipboard-write"
		class="h-[calc(100vh-13rem)] min-h-[32rem] w-full border-0"
	></iframe>
</section>
