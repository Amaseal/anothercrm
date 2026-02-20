<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Table from '$lib/components/ui/table/index.js';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { debounce, toCurrency } from '$lib/utilities';
	import { goto } from '$app/navigation';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Plus from '@lucide/svelte/icons/plus';
	import { page } from '$app/state';
	import Pencil from '@lucide/svelte/icons/pencil';
	import FileText from '@lucide/svelte/icons/file-text';
	import Send from '@lucide/svelte/icons/send';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Separator } from '$lib/components/ui/separator';
	import Pagination from '@/components/pagination.svelte';
	import * as m from '$lib/paraglide/messages';
	import FileSpreadsheet from '@lucide/svelte/icons/file-spreadsheet';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import {isAdmin} from '$lib/stores/user';

	let importing = $state(false);
	let fileInput: HTMLInputElement;

	async function handleImport(event: Event) {
		const target = event.target as HTMLInputElement;
		if (!target.files || target.files.length === 0) return;

		importing = true;
		const formData = new FormData();
		for (const file of target.files) {
			formData.append('files', file);
		}

		try {
			const res = await fetch('/api/invoices/import', {
				method: 'POST',
				body: formData
			});

			const data = await res.json();

			if (res.ok) {
				const successCount = data.results.filter((r: any) => r.status === 'success').length;
				const errorCount = data.results.filter((r: any) => r.status === 'error').length;
				const skippedCount = data.results.filter((r: any) => r.status === 'skipped').length;

				if (successCount > 0) toast.success(`Successfully imported ${successCount} invoices.`);
				if (skippedCount > 0) toast.info(`Skipped ${skippedCount} invoices (already exist).`);
				if (errorCount > 0) toast.error(`Failed to import ${errorCount} invoices.`);

				await invalidateAll();
			} else {
				toast.error(data.error || 'Import failed');
			}
		} catch (e) {
			console.error(e);
			toast.error('An error occurred during import');
		} finally {
			importing = false;
			if (fileInput) fileInput.value = '';
		}
	}

	// Type definition for Invoice with relations
	type InvoiceWithRelations = {
		id: number;
		invoiceNumber: string;
		issueDate: string;
		dueDate: string;
		total: number;
		status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
		client: { name: string } | null;
		task: { title: string } | null;
	};

	let {
		data,
		children
	}: {
		data: {
			invoices: InvoiceWithRelations[];
			pagination: {
				page: number;
				pageSize: number;
				totalCount: number;
				totalPages: number;
				search: string;
				sortColumn: string;
				sortDirection: string;
			};
		};
		children?: () => any;
	} = $props();

	function handleDownload(invoice: any) {
		window.open(`/rekini/drukat/${invoice.id}`, '_blank');
	}

	// Initialize state from server data
	let currentPage = $state(data.pagination.page);
	let pageSize = $state(data.pagination.pageSize);
	let sortColumn = $state(data.pagination.sortColumn);
	let sortDirection = $state(data.pagination.sortDirection as 'asc' | 'desc');
	let searchTerm = $state(data.pagination.search);

	// Keep local state in sync with server data
	$effect(() => {
		currentPage = data.pagination.page;
		pageSize = data.pagination.pageSize;
		sortColumn = data.pagination.sortColumn;
		sortDirection = data.pagination.sortDirection as 'asc' | 'desc';
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
	}, 1200);

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
		const sortableColumns = [
			'invoiceNumber',
			'issueDate',
			'dueDate',
			'total',
			'status',
			'clientName'
		];
		if (!sortableColumns.includes(column)) return;

		const newDirection = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc';

		updateUrlAndNavigate({
			sortColumn: column,
			sortDirection: newDirection
		});
	}
</script>

{@render children?.()}
<header
	class="flex h-(--header-height) shrink-0 items-center gap-2 rounded-lg transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)"
>
	<div class="flex w-full items-center gap-1 lg:gap-2">
		<Sidebar.Trigger class="-ml-1" />
		<Separator orientation="vertical" class="mx-2 data-[orientation=vertical]:h-4" />
		<h1 class="text-base font-medium">{m['invoices.value']()}</h1>
		<Separator orientation="vertical" class="mx-2 data-[orientation=vertical]:h-4" />
		<Input
			type="text"
			class="mb-0 w-full max-w-sm"
			placeholder={m['components.search']()}
			value={searchTerm}
			oninput={handleSearchInput}
		/>
		<input
			type="file"
			multiple
			accept=".xlsx"
			class="hidden"
			bind:this={fileInput}
			onchange={handleImport}
		/>

		{#if $isAdmin}
		<Button
			variant="outline"
			class="ml-auto flex items-center gap-2"
			onclick={() => fileInput?.click()}
			disabled={importing}
		>
			{#if importing}
				<Loader2 class="animate-spin" /> {m['invoices.import_button']()}
			{:else}
				<FileSpreadsheet /> {m['invoices.import_button']()}
			{/if}
		</Button>
				<Button href="/rekini/pievienot" variant="outline" class="flex items-center gap-2"
			><Plus />{m['components.add']()}</Button
		>
		{/if}

	</div>
</header>
<div class="mb-4 space-y-4">
	<div class="rounded-md border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="cursor-pointer" onclick={() => handleSort('invoiceNumber')}>
						<div class="flex items-center gap-1">
							{m['invoices.number']()}
							{#if sortColumn === 'invoiceNumber'}
								<ChevronDown size="14" class={sortDirection === 'asc' ? 'rotate-180' : ''} />
							{:else}
								<ChevronDown size="14" class="opacity-50" />
							{/if}
						</div>
					</Table.Head>
					<Table.Head class="cursor-pointer" onclick={() => handleSort('issueDate')}>
						<div class="flex items-center gap-1">
							{m['invoices.issue_date']()}
							{#if sortColumn === 'issueDate'}
								<ChevronDown size="14" class={sortDirection === 'asc' ? 'rotate-180' : ''} />
							{:else}
								<ChevronDown size="14" class="opacity-50" />
							{/if}
						</div>
					</Table.Head>
					<Table.Head
						class="hidden cursor-pointer md:table-cell"
						onclick={() => handleSort('clientName')}
					>
						<div class="flex items-center gap-1">
							{m['invoices.client']()}
							{#if sortColumn === 'clientName'}
								<ChevronDown size="14" class={sortDirection === 'asc' ? 'rotate-180' : ''} />
							{:else}
								<ChevronDown size="14" class="opacity-50" />
							{/if}
						</div>
					</Table.Head>
					<Table.Head class="cursor-pointer text-right" onclick={() => handleSort('total')}>
						<div class="flex items-center justify-end gap-1">
							{m['invoices.total']()}
							{#if sortColumn === 'total'}
								<ChevronDown size="14" class={sortDirection === 'asc' ? 'rotate-180' : ''} />
							{:else}
								<ChevronDown size="14" class="opacity-50" />
							{/if}
						</div>
					</Table.Head>
					<Table.Head class="text-center">{m['invoices.status']()}</Table.Head>
					<Table.Head class="w-12 text-center">PDF</Table.Head>
					<Table.Head class="w-12 text-center">Send</Table.Head>
					{#if $isAdmin}
					<Table.Head class="w-12 text-center">{m['components.edit']()}</Table.Head>
					<Table.Head class="w-12 text-center">{m['components.delete']()}</Table.Head>
					{/if}
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if data.invoices.length === 0}
					<Table.Row>
						<Table.Cell colspan={9} class="py-6 text-center"
							>{m['clients.empty'] ? m['clients.empty']() : 'No invoices found'}</Table.Cell
						>
					</Table.Row>
				{:else}
					{#each data.invoices as item (item.id)}
						<Table.Row class="hover:bg-muted/50">
							<Table.Cell class="font-medium">{item.invoiceNumber}</Table.Cell>
							<Table.Cell>{item.issueDate}</Table.Cell>
							<Table.Cell class="hidden md:table-cell">{item.client?.name || '-'}</Table.Cell>
							<Table.Cell class="text-right font-medium">{toCurrency(item.total)} €</Table.Cell>
							<Table.Cell class="text-center">
								<span class="rounded border bg-muted px-2 py-1 text-xs capitalize">
									{#if m[`invoices.status_${item.status}`]}
										{m[`invoices.status_${item.status}`]()}
									{:else}
										{item.status}
									{/if}
								</span>
							</Table.Cell>

							<Table.Cell class="text-center">
								<Button onclick={() => handleDownload(item)} variant="ghost" size="icon"
									><FileText size="16" /></Button
								>
							</Table.Cell>
							<Table.Cell class="text-center">
								<Button href="/rekini/{item.id}/send" variant="ghost" size="icon"
									><Send size="16" /></Button
								>
							</Table.Cell>
							{#if $isAdmin}
							<Table.Cell class="text-center">
								<Button href="/rekini/labot/{item.id}" variant="ghost" size="icon"
									><Pencil size="16" /></Button
								>
							</Table.Cell>
							<Table.Cell class="text-center">
								<Button
									href="/rekini/izdzest/{item.id}"
									variant="ghost"
									size="icon"
									class="hover:bg-red-100 hover:text-red-600"><Trash2 size="16" /></Button
								>
							</Table.Cell>
							{/if}
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>

	<Pagination pagination={data.pagination} />
</div>
