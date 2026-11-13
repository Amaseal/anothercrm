<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Select from '$lib/components/ui/select';
	import { Separator } from '$lib/components/ui/separator';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Badge } from '$lib/components/ui/badge';
	import Plus from '@lucide/svelte/icons/plus';
	import Upload from '@lucide/svelte/icons/upload';
	import Database from '@lucide/svelte/icons/database';
	import HardDrive from '@lucide/svelte/icons/hard-drive';
	import * as m from '$lib/paraglide/messages';

	let { data, form } = $props();
	let createOpen = $state(false);
	let documentName = $state('');
	let documentType = $state('');
	let creating = $state(false);
	let createError = $state('');

	function editorUrl(id: number | string) {
		return `/dokumenti/${encodeURIComponent(String(id))}`;
	}

	function formatSize(bytes: number) {
		if (bytes === 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB'];
		const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
		return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
	}
</script>

<svelte:head>
	<title>{m['documents.title']()}</title>
</svelte:head>

<header
	class="flex h-(--header-height) shrink-0 items-center gap-2 rounded-lg transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)"
>
	<div class="flex w-full items-center gap-1 lg:gap-2">
		<Sidebar.Trigger class="-ml-1" />
		<Separator orientation="vertical" class="mx-2 data-[orientation=vertical]:h-4" />
		<h1 class="text-base font-medium">{m['documents.title']()}</h1>
	</div>
</header>

<div class="space-y-4">
	<div class="flex flex-wrap gap-2 rounded-md border p-3">
		<Dialog.Root
			bind:open={createOpen}
			onOpenChange={(open) => {
				if (open) {
					documentName = '';
					documentType = '';
					createError = '';
				}
			}}
		>
			<Dialog.Trigger>
				{#snippet child({ props })}
					<Button variant="outline" {...props}
						><Plus class="mr-2 h-4 w-4" />{m['components.add']()}</Button
					>
				{/snippet}
			</Dialog.Trigger>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>{m['documents.create_title']()}</Dialog.Title>
					<Dialog.Description>{m['documents.create_description']()}</Dialog.Description>
				</Dialog.Header>
				<form
					method="POST"
					action="?/create"
					class="space-y-4"
					use:enhance={() => {
						creating = true;
						createError = '';
						return async ({ result, update }) => {
							try {
								await update({ reset: false });
								if (result.type === 'success' && result.data?.id) {
									createOpen = false;
									// eslint-disable-next-line svelte/no-navigation-without-resolve
									await goto(editorUrl(result.data.id as number));
								} else if (result.type === 'failure') {
									createError = String(result.data?.message ?? m['documents.create_required']());
								}
							} finally {
								creating = false;
							}
						};
					}}
				>
					<div class="grid gap-2">
						<Label for="document-name">{m['files.name']()}</Label>
						<Input
							id="document-name"
							name="name"
							bind:value={documentName}
							placeholder={m['documents.name_placeholder']()}
							required
							maxlength={120}
						/>
					</div>
					<div class="grid gap-2">
						<Label for="document-type">{m['documents.document_type']()}</Label>
						<Select.Root type="single" bind:value={documentType}>
							<Select.Trigger id="document-type" class="w-full">
								{documentType === 'docx'
									? 'Word (.docx)'
									: documentType === 'xlsx'
										? 'Excel (.xlsx)'
										: m['documents.select_type']()}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="docx" label="Word (.docx)" />
								<Select.Item value="xlsx" label="Excel (.xlsx)" />
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="type" value={documentType} />
					</div>
					{#if createError}<p role="alert" class="text-sm text-destructive">{createError}</p>{/if}
					<Dialog.Footer>
						<Button
							type="button"
							variant="outline"
							onclick={() => (createOpen = false)}
							disabled={creating}>{m['components.cancel']()}</Button
						>
						<Button type="submit" disabled={!documentName.trim() || !documentType || creating}
							>{m['documents.create_confirm']()}</Button
						>
					</Dialog.Footer>
				</form>
			</Dialog.Content>
		</Dialog.Root>

		<form
			method="POST"
			action="?/upload"
			enctype="multipart/form-data"
			class="flex gap-2"
			use:enhance={({ formElement }) => {
				return async ({ result, update }) => {
					await update();
					if (result.type === 'success' && result.data?.id) {
						formElement.reset();
						// eslint-disable-next-line svelte/no-navigation-without-resolve
						goto(editorUrl(result.data.id as number));
					}
				};
			}}
		>
			<Input type="file" name="file" accept=".docx,.xlsx,.pptx,.csv" required />
			<Button type="submit" variant="outline">
				<Upload class="mr-2 h-4 w-4" />{m['documents.upload']()}
			</Button>
		</form>
	</div>

	<p class="text-sm text-muted-foreground">{m['documents.supported_formats']()}</p>
	{#if form?.message}<p role="alert" class="text-sm text-destructive">{form.message}</p>{/if}
	<div class="rounded-md border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>{m['files.name']()}</Table.Head>
					<Table.Head class="hidden md:table-cell">{m['files.type']()}</Table.Head>
					<Table.Head class="hidden md:table-cell">{m['files.size']()}</Table.Head>
					<Table.Head class="w-24"></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if data.documents.length === 0}
					<Table.Row>
						<Table.Cell colspan={4} class="py-6 text-center">{m['documents.empty']()}</Table.Cell>
					</Table.Row>
				{:else}
					{#each data.documents as document (document.id)}
						<Table.Row>
							<Table.Cell class="font-medium">
								<!-- eslint-disable svelte/no-navigation-without-resolve -->
								<a href={editorUrl(document.id)} class="hover:underline">{document.filename}</a>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							</Table.Cell>
							<Table.Cell class="hidden md:table-cell">
								<Badge variant="outline" class="gap-1">
									{#if document.source === 'both'}
										<Database class="h-3 w-3" /><HardDrive class="h-3 w-3" />
									{:else if document.source === 'db'}
										<Database class="h-3 w-3" />
									{:else}
										<HardDrive class="h-3 w-3" />
									{/if}
									{document.source}
								</Badge>
							</Table.Cell>
							<Table.Cell class="hidden md:table-cell">{formatSize(document.size)}</Table.Cell>
							<Table.Cell class="text-right">
								<!-- eslint-disable svelte/no-navigation-without-resolve -->
								<Button href={editorUrl(document.id)} size="sm" variant="outline">
									{m['documents.open']()}
								</Button>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							</Table.Cell>
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>
</div>
