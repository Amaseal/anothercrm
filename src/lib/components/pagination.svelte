<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ChevronsLeft from '@lucide/svelte/icons/chevrons-left';
	import ChevronsRight from '@lucide/svelte/icons/chevrons-right';
	import { Button } from '$lib/components/ui/button';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as ButtonGroup from '$lib/components/ui/button-group/index.js';
	import * as m from '$lib/paraglide/messages';
	let {
		pagination
	}: {
		pagination: {
			page: number;
			pageSize: number;
			totalCount: number;
			totalPages: number;
			search: string;
			sortColumn: string;
			sortDirection: string;
		};
	} = $props();

	let pageSizeOptions = [5, 10, 25, 50, 100];
	let currentPage = $state(pagination.page);
	let pageSize = $state(pagination.pageSize);

	$effect(() => {
		currentPage = pagination.page;
		pageSize = pagination.pageSize;
	});

	$inspect({ currentPage, pageSize });

	function getVisiblePageNumbers() {
		const { totalPages } = pagination;
		const pages: number[] = [];
		const maxVisiblePages = 5;

		if (totalPages <= maxVisiblePages) {
			// Show all pages if there are few
			for (let i = 0; i < totalPages; i++) {
				pages.push(i);
			}
		} else {
			// Otherwise show a window of pages around current
			const firstPage = 0;
			const lastPage = totalPages - 1;

			// Always include first page
			pages.push(firstPage);

			// Calculate range around current page
			let rangeStart = Math.max(1, currentPage - 1);
			let rangeEnd = Math.min(lastPage - 1, currentPage + 1);

			// Adjust range to always show 3 pages in the middle if possible
			if (currentPage <= 2) {
				rangeEnd = Math.min(lastPage - 1, 3);
			} else if (currentPage >= lastPage - 2) {
				rangeStart = Math.max(1, lastPage - 3);
			}

			// Add ellipsis after first page if needed
			if (rangeStart > 1) {
				pages.push(-1); // -1 represents ellipsis
			}

			// Add pages in range
			for (let i = rangeStart; i <= rangeEnd; i++) {
				pages.push(i);
			}

			// Add ellipsis before last page if needed
			if (rangeEnd < lastPage - 1) {
				pages.push(-2); // -2 represents ellipsis
			}

			// Always include last page
			if (lastPage > 0) {
				pages.push(lastPage);
			}
		}

		return pages;
	}

	function goToPage(page: number) {
		if (page >= 0 && page < pagination.totalPages) {
			updateUrlAndNavigate({ page });
		}
	}

	function goToFirstPage() {
		goToPage(0);
	}

	function goToLastPage() {
		goToPage(Math.max(0, pagination.totalPages - 1));
	}

	function handlePageSizeChange(value: string) {
		const newPageSize = parseInt(value);
		updateUrlAndNavigate({
			pageSize: newPageSize,
			page: 0 // Reset to first page when changing page size
		});
	}

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
</script>

<div class="flex flex-col items-center justify-between gap-4 sm:flex-row">
	<div class="text-sm text-muted-foreground">
		{m['components.pagination.showing']({
			start: (currentPage * pageSize + 1).toString(),
			end: Math.min((currentPage + 1) * pageSize, pagination.totalCount).toString(),
			total: pagination.totalCount.toString()
		})}
	</div>

	<div class="flex flex-col items-center gap-2 md:flex-row">
		<div class="flex items-center space-x-2">
			<ButtonGroup.Root>
				<Button
					variant="outline"
					size="icon"
					class="h-8 w-8"
					disabled={currentPage === 0}
					onclick={goToFirstPage}
					aria-label="Pirmā lapa"
				>
					<ChevronsLeft className="h-4 w-4" />
				</Button>
				<Button
					variant="outline"
					size="icon"
					class="h-8 w-8"
					disabled={currentPage === 0}
					onclick={() => goToPage(currentPage - 1)}
					aria-label="Iepriekšējā lapa"
				>
					<ChevronLeft className="h-4 w-4" />
				</Button>

				{#each getVisiblePageNumbers() as pageNum}
					{#if pageNum >= 0}
						<Button
							variant={pageNum === currentPage ? 'default' : 'outline'}
							size="icon"
							class="h-8 w-8"
							onclick={() => goToPage(pageNum)}
						>
							{pageNum + 1}
						</Button>
					{:else}
						<Button variant="outline" size="icon" class="h-8 w-8" disabled>...</Button>
					{/if}
				{/each}

				<Button
					variant="outline"
					size="icon"
					class="h-8 w-8"
					disabled={currentPage >= pagination.totalPages - 1 || pagination.totalPages === 0}
					onclick={() => goToPage(currentPage + 1)}
					aria-label="Nākamā lapa"
				>
					<ChevronRight className="h-4 w-4" />
				</Button>
				<Button
					variant="outline"
					size="icon"
					class="h-8 w-8"
					disabled={currentPage >= pagination.totalPages - 1 || pagination.totalPages === 0}
					onclick={goToLastPage}
					aria-label="Pēdējā lapa"
				>
					<ChevronsRight className="h-4 w-4" />
				</Button>
			</ButtonGroup.Root>
		</div>

		<Select.Root type="single" onValueChange={(value) => handlePageSizeChange(value)}>
			<Select.Trigger
				class="cursor-pointer bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
				>{m['components.pagination.items_per_page']({
					pageSize: pagination.pageSize
				})}</Select.Trigger
			>
			<Select.Content class="w-[30px]">
				{#each pageSizeOptions as option}
					<Select.Item value={String(option)} label={String(option)}>{option}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>
</div>
