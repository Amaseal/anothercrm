<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import ProductionOrderPreview from './production-order-preview.svelte';
	import ProductionParser from './production-parser.svelte';
	import FileIcon from '@lucide/svelte/icons/file';
	import * as m from '$lib/paraglide/messages';
	import type { ProductionWorkbook } from '$lib/server/production-workbook';
	import type { GeneratedProduction } from '$lib/server/production-generation';

	let { taskId, description = '' }: { taskId: number; description?: string } = $props();
	type Project = { id: number; fileId: number; filename: string; size: number; revision: string };
	let projects = $state<Project[]>([]);
	let preview = $state<{ id: number; revision: string; workbook: ProductionWorkbook } | null>(null);
	let previewOpen = $state(false);
	const previewProject = $derived(projects.find((project) => project.id === preview?.id));
	let message = $state('');
	let loading = $state(false);
	let previewLoading = $state<number | null>(null);
	let listRequest: AbortController | undefined;
	let previewRequest: AbortController | undefined;

	async function refresh(id: number) {
		listRequest?.abort();
		previewRequest?.abort();
		previewLoading = null;
		const request = new AbortController();
		listRequest = request;
		loading = true;
		message = '';
		try {
			const response = await fetch(
				resolve('/api/tasks/[id]/production-projects', { id: String(id) }),
				{ signal: request.signal }
			);
			if (!response.ok) throw new Error(m['production_projects.load_failed']());
			const result = await response.json();
			if (request.signal.aborted) return;
			projects = result.projects;
			if (preview) {
				const current = projects.find((project) => project.id === preview?.id);
				if (!current) {
					preview = null;
					previewOpen = false;
				} else if (current.revision !== preview.revision) await showPreview(current);
			}
		} catch (cause) {
			if (!request.signal.aborted) {
				// Do not present a cached preview as current when checking the latest revision fails.
				preview = null;
				previewOpen = false;
				message = cause instanceof Error ? cause.message : m['production_projects.load_failed']();
			}
		} finally {
			if (!request.signal.aborted) loading = false;
		}
	}

	async function showPreview(project: Project) {
		previewRequest?.abort();
		const request = new AbortController();
		previewRequest = request;
		if (!previewOpen) preview = null;
		previewLoading = project.id;
		message = '';
		try {
			const response = await fetch(
				resolve('/api/tasks/[id]/production-projects/[project]', {
					id: String(taskId),
					project: String(project.id)
				}),
				{ signal: request.signal }
			);
			if (!response.ok) {
				const failure = await response.json();
				throw new Error(failure.message || m['production_projects.load_failed']());
			}
			const result = await response.json();
			if (request.signal.aborted) return;
			preview = { id: project.id, ...result };
			previewOpen = true;
			projects = projects.map((entry) =>
				entry.id === project.id ? { ...entry, revision: result.revision } : entry
			);
		} catch (cause) {
			if (!request.signal.aborted) {
				preview = null;
				previewOpen = false;
				message = cause instanceof Error ? cause.message : m['production_projects.load_failed']();
			}
		} finally {
			if (!request.signal.aborted) previewLoading = null;
		}
	}

	function generated(result: GeneratedProduction) {
		listRequest?.abort();
		previewRequest?.abort();
		loading = false;
		previewLoading = null;
		message = '';
		const { workbook, ...project } = result;
		projects = [...projects.filter((entry) => entry.id !== project.id), project];
		preview = { id: project.id, revision: project.revision, workbook };
		previewOpen = true;
	}

	$effect(() => {
		const id = taskId;
		projects = [];
		preview = null;
		previewOpen = false;
		void refresh(id);
		return () => {
			listRequest?.abort();
			previewRequest?.abort();
		};
	});
</script>

<svelte:window onfocus={() => refresh(taskId)} />

<ProductionParser {taskId} {description} oncreated={generated} />

<section class="space-y-3" aria-label={m['production_projects.title']()}>
	<div class="flex items-center justify-between gap-2">
		<h3 class="text-sm font-medium">{m['production_projects.title']()}</h3>
		<Button
			type="button"
			variant="ghost"
			size="sm"
			onclick={() => refresh(taskId)}
			disabled={loading}
		>
			{m['production_projects.refresh']()}
		</Button>
	</div>
	{#if message}<p role="status" class="text-sm text-destructive">{message}</p>{/if}
	{#if loading}<p class="text-sm text-muted-foreground">
			{m['production_projects.loading']()}
		</p>{/if}
	{#if !loading && projects.length === 0 && !message}
		<p class="text-sm text-muted-foreground">{m['production_projects.empty']()}</p>
	{/if}
	{#each projects as project (project.id)}
		<div class="space-y-3 rounded-lg border bg-card p-2 text-sm">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<div class="flex min-w-0 items-center gap-3">
					<div class="grid h-8 w-8 shrink-0 place-items-center rounded bg-muted">
						<FileIcon class="h-4 w-4" />
					</div>
					<div class="min-w-0">
						<p class="font-medium break-all">{project.filename}</p>
						<p class="text-xs text-muted-foreground">{(project.size / 1024).toFixed(1)} KB</p>
					</div>
				</div>
				<div class="flex flex-wrap gap-1">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onclick={() => showPreview(project)}
						disabled={previewLoading === project.id}>{m['production_projects.preview']()}</Button
					>
					<Button
						href={resolve('/(app)/dokumenti/[id]', { id: String(project.fileId) })}
						target="_blank"
						rel="noopener"
						variant="ghost"
						size="sm">{m['production_projects.edit']()}</Button
					>
					<Button
						href={`${resolve('/api/tasks/[id]/production-projects/[project]', { id: String(taskId), project: String(project.id) })}?download`}
						variant="ghost"
						size="sm">{m['production_projects.download']()}</Button
					>
				</div>
			</div>
		</div>
	{/each}
</section>

<Dialog.Root
	bind:open={previewOpen}
	onOpenChange={(open) => {
		if (!open) {
			previewRequest?.abort();
			previewLoading = null;
			preview = null;
		}
	}}
>
	{#if preview && previewProject}
		<Dialog.Content class="flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-5xl">
			<Dialog.Header class="shrink-0">
				<Dialog.Title class="pr-6 break-all">{previewProject.filename}</Dialog.Title>
				<Dialog.Description>{m['production_projects.modal_description']()}</Dialog.Description>
			</Dialog.Header>
			<div class="custom-scroll min-h-0 flex-1 space-y-3 overflow-y-auto">
				{#if previewLoading !== null || preview.revision !== previewProject.revision}<p
						role="status"
					>
						{m['production_projects.loading']()}
					</p>
				{:else}
					{#if preview.workbook.setup.Draft === 'true'}<p class="text-xs text-muted-foreground">
							{m['production_parse.generated_draft']()}
						</p>{/if}
					<ProductionOrderPreview
						orders={preview.workbook.orders}
						warnings={preview.workbook.warnings}
						defaultProduct={preview.workbook.setup.DefaultProduct}
					/>
				{/if}
			</div>
			<Dialog.Footer class="shrink-0">
				<Button
					href={resolve('/(app)/dokumenti/[id]', { id: String(previewProject.fileId) })}
					target="_blank"
					rel="noopener">{m['production_projects.edit']()}</Button
				>
			</Dialog.Footer>
		</Dialog.Content>
	{/if}
</Dialog.Root>
