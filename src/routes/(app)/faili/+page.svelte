<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Badge } from '$lib/components/ui/badge';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { debounce } from '$lib/utilities';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { formatDate } from '$lib/utilities';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Eye from '@lucide/svelte/icons/eye';
	import FileIcon from '@lucide/svelte/icons/file';
	import Database from '@lucide/svelte/icons/database';
	import HardDrive from '@lucide/svelte/icons/hard-drive';
	import { Separator } from '$lib/components/ui/separator';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as m from '$lib/paraglide/messages';
	import Pagination from '$lib/components/pagination.svelte';
	import { enhance } from '$app/forms';

	let { data } = $props();

	// Initialize state from server data
	let currentPage = $state(data.pagination.page);
	let pageSize = $state(data.pagination.pageSize);
	let sortColumn = $state(data.pagination.sortColumn);
	let sortDirection = $state(data.pagination.sortDirection);
	let searchTerm = $state(data.pagination.search);
	let SortIcon = $derived(sortDirection === 'asc' ? ChevronUp : ChevronDown);
	let imageModalOpen = $state(false);
	let previewUrl = $state('');

	// Keep local state in sync with server data
	$effect(() => {
		currentPage = data.pagination.page;
		pageSize = data.pagination.pageSize;
		sortColumn = data.pagination.sortColumn;
		sortDirection = data.pagination.sortDirection;
		searchTerm = data.pagination.search;
	});

	// Set up debounced search
	const handleSearchInput = (event: Event) => {
		const target = event.target as HTMLInputElement;
		searchTerm = target.value;
		debouncedSearch(target.value);
	};

	const debouncedSearch = debounce((value: string) => {
		updateUrlAndNavigate({ search: value, page: 0 });
	}, 500);

	// Update URL and navigate to the new page
	function updateUrlAndNavigate(params: Record<string, any>) {
		const url = new URL(page.url);

		// Update the provided parameters
		Object.entries(params).forEach(([key, value]) => {
			if (value !== null && value !== undefined && value !== '') {
				url.searchParams.set(key, value.toString());
			} else {
				url.searchParams.delete(key);
			}
		});

		// Navigate to the new URL
		goto(url.toString(), { replaceState: true });
	}

	// Handle sorting
	function handleSort(column: string) {
		const newDirection = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc';
		updateUrlAndNavigate({
			sortColumn: column,
			sortDirection: newDirection
		});
	}

	function openPreview(url: string) {
		previewUrl = url;
		imageModalOpen = true;
	}

	function formatSize(bytes: number) {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}
</script>

<svelte:head>
	<title>{m['files.title']()}</title>
</svelte:head>

<header
	class="flex h-(--header-height) shrink-0 items-center gap-2 rounded-lg transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)"
>
	<div class="flex w-full items-center gap-1 lg:gap-2">
		<Sidebar.Trigger class="-ml-1" />
		<Separator orientation="vertical" class="mx-2 data-[orientation=vertical]:h-4" />
		<h1 class="text-base font-medium">{m['files.title']()}</h1>
		<Separator orientation="vertical" class="mx-2 data-[orientation=vertical]:h-4" />
		<Input
			type="text"
			class="mb-0 w-full max-w-sm"
			placeholder={m['components.search']()}
			value={searchTerm}
			oninput={handleSearchInput}
		/>
	</div>
</header>

<div class="mb-4 space-y-4">
	<div class="rounded-md border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<!-- Preview -->
					<Table.Head class="w-12 text-center">{m['files.preview']()}</Table.Head>

					<!-- Filename -->
					<Table.Head class="cursor-pointer" onclick={() => handleSort('filename')}>
						<div class="flex items-center gap-1">
							{m['files.name']()}
							{#if sortColumn === 'filename'}
								<SortIcon size="14" />
							{/if}
						</div>
					</Table.Head>

					<!-- Type (Source) -->
					<Table.Head
						class="hidden cursor-pointer md:table-cell"
						onclick={() => handleSort('source')}
					>
						<div class="flex items-center gap-1">
							{m['files.type']()}
							{#if sortColumn === 'source'}
								<SortIcon size="14" />
							{/if}
						</div>
					</Table.Head>

					<!-- Size -->
					<Table.Head
						class="hidden cursor-pointer md:table-cell"
						onclick={() => handleSort('size')}
					>
						<div class="flex items-center gap-1">
							{m['files.size']()}
							{#if sortColumn === 'size'}
								<SortIcon size="14" />
							{/if}
						</div>
					</Table.Head>

					<!-- Created -->
					<Table.Head
						class="hidden cursor-pointer md:table-cell"
						onclick={() => handleSort('created')}
					>
						<div class="flex items-center gap-1">
							{m['files.created']()}
							{#if sortColumn === 'created'}
								<SortIcon size="14" />
							{/if}
						</div>
					</Table.Head>

					<!-- Status/Usage -->
					<Table.Head class="cursor-pointer" onclick={() => handleSort('usage')}>
						{m['files.usage']()}
					</Table.Head>

					<!-- Actions -->
					<Table.Head class="w-12 text-center">{m['files.delete']()}</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if data.files.length === 0}
					<Table.Row>
						<Table.Cell colspan={7} class="py-6 text-center">{m['files.empty']()}</Table.Cell>
					</Table.Row>
				{:else}
					{#each data.files as file (file.id)}
						<Table.Row class="hover:bg-muted/50">
							<!-- Preview -->
							<Table.Cell class="p-2 text-center">
								<div
									class="flex h-10 w-10 items-center justify-center rounded bg-muted text-muted-foreground"
								>
									<FileIcon size="20" />
								</div>
							</Table.Cell>

							<!-- Filename -->
							<Table.Cell class="max-w-[200px] font-medium">
								<div class="truncate" title={file.filename}>
									<a href={file.url} target="_blank" class="hover:underline">{file.filename}</a>
								</div>
							</Table.Cell>

							<!-- Source -->
							<Table.Cell class="hidden md:table-cell">
								{#if file.source === 'both'}
									<div class="flex gap-1" title={m['files.both']()}>
										<Database size="16" class="text-green-500" />
										<HardDrive size="16" class="text-green-500" />
									</div>
								{:else if file.source === 'db'}
									<div class="flex gap-1" title={m['files.db_only']()}>
										<Database size="16" class="text-red-500" />
									</div>
								{:else}
									<div class="flex gap-1" title={m['files.fs_only']()}>
										<HardDrive size="16" class="text-orange-500" />
									</div>
								{/if}
							</Table.Cell>

							<!-- Size -->
							<Table.Cell class="hidden whitespace-nowrap md:table-cell">
								{formatSize(file.size)}
							</Table.Cell>

							<!-- Created -->
							<Table.Cell class="hidden whitespace-nowrap md:table-cell">
								{formatDate(file.created)}
							</Table.Cell>

							<!-- Usage -->
							<Table.Cell>
								{#if file.usage.length > 0}
									<div class="flex flex-wrap gap-1">
										{#each file.usage as usage}
											<Badge variant="outline" class="text-xs whitespace-nowrap">
												{#if usage.type === 'task'}
													{m['files.used_by_task']()} {usage.name}
												{:else if usage.type === 'material'}
													{m['files.used_by_material']()}: {usage.name}
												{:else if usage.type === 'company'}
													{m['files.used_by_company']()}
												{:else if usage.type === 'task_preview'}
													{m['files.used_by_task_preview']()}: {usage.name}
												{:else}
													{usage.name || usage.type}
												{/if}
											</Badge>
										{/each}
									</div>
								{:else}
									<span class="text-xs text-muted-foreground italic">{m['files.orphaned']()}</span>
								{/if}
							</Table.Cell>

							<!-- Delete -->
							<Table.Cell class="text-center">
								<form action="?/delete" method="POST" use:enhance>
									<input type="hidden" name="id" value={file.id} />
									<input type="hidden" name="dbId" value={file.dbId || ''} />
									<input type="hidden" name="filename" value={file.filename} />
									<Button
										variant="ghost"
										size="icon"
										type="submit"
										disabled={file.usage.length > 0}
										class="text-destructive hover:bg-destructive/10 hover:text-destructive"
										title={file.usage.length > 0 ? m['files.used']() : m['files.delete']()}
										onclick={(e) => {
											if (!confirm(m['files.confirm_delete']())) {
												e.preventDefault();
											}
										}}
									>
										<Trash2 size="18" />
									</Button>
								</form>
							</Table.Cell>
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>
	<Pagination pagination={data.pagination} />
</div>

<!-- Image Preview Modal -->
<Dialog.Root bind:open={imageModalOpen}>
	<Dialog.Content class="max-h-[90vh] w-auto max-w-[90vw] overflow-hidden p-0">
		<div class="relative flex h-full w-full items-center justify-center bg-black/50 p-4">
			<img
				src={previewUrl}
				alt="Preview"
				class="max-h-[85vh] max-w-full rounded-md object-contain shadow-lg"
			/>
		</div>
	</Dialog.Content>
</Dialog.Root>
