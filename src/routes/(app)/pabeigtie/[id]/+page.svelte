<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { X, Download, File as FileIcon } from '@lucide/svelte';
	import { formatDate, toCurrency } from '$lib/utilities';
	import { Badge } from '$lib/components/ui/badge';
	import * as Table from '$lib/components/ui/table/index.js';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	const item = data.item;

	function downloadFile(file: { downloadUrl: string; filename: string }) {
		const a = document.createElement('a');
		a.href = file.downloadUrl;
		a.download = file.filename;
		a.target = '_blank';
		a.click();
	}
</script>

<!-- Modal Overlay -->
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
	<!-- Inner Modal Container -->
	<div
		class="relative flex h-[90vh] w-[80vw] flex-col overflow-hidden rounded-xl bg-background shadow-2xl"
	>
		<div class="flex h-full flex-col">
			<!-- Sticky Header inside Modal -->
			<div class="flex items-center gap-4 border-b bg-background px-6 py-4">
				<!-- Title -->
				<div class="flex-1">
					<h2 class="text-xl font-semibold">{item.title}</h2>
				</div>

				<!-- Close Button -->
				<Button
					variant="ghost"
					size="icon"
					href="/pabeigtie"
					class="ml-2 text-muted-foreground hover:text-foreground"
				>
					<X class="size-5" />
					<span class="sr-only">Close</span>
				</Button>
			</div>

			<!-- Scrollable Content -->
			<div class="custom-scroll flex-1 overflow-y-auto p-6">
				<!-- SECTION 1: Description & Details -->
				<div class="grid grid-cols-12 items-stretch gap-6">
					<!-- Left (65%) - Description -->
					<div class="col-span-12 flex flex-col gap-2 lg:col-span-8">
						<Label>{m['projects.description_label']()}</Label>
						<div
							class="prose min-h-[400px] max-w-none flex-1 rounded-md border p-4 dark:prose-invert"
						>
							{@html item.description || ''}
						</div>
					</div>

					<!-- Right (35%) - Assignment & Meta -->
					<div class="col-span-12 flex flex-col gap-6 lg:col-span-4">
						<!-- Client -->
						<div class="grid gap-2">
							<Label>{m['projects.client_label']()}</Label>
							<Input value={item.client?.name || '-'} readonly />
						</div>

						<!-- Manager -->
						<div class="grid gap-2">
							<Label>{m['projects.assign_manager_label']()}</Label>
							<Input value={item.creator?.name || '-'} readonly />
						</div>

						<!-- Assignee -->
						<div class="grid gap-2">
							<Label>{m['projects.assign_user_label']()}</Label>
							<Input value={item.assignedToUser?.name || '-'} readonly />
						</div>

						<!-- Seamstress -->
						<div class="grid gap-2">
							<Label>{m['projects.seamstress_label']()}</Label>
							<Input value={item.seamstress || '-'} readonly />
						</div>

						<!-- Dates -->
						<div class="grid gap-2">
							<Label>{m['projects.choose_date']()}</Label>
							<Input value={formatDate(item.endDate) || '-'} readonly />
						</div>

						<!-- Materials -->
						<div class="grid gap-2">
							<Label>{m['projects.materials_label']()}</Label>
							<div class="flex flex-wrap gap-2">
								{#each item.taskMaterials as tm}
									<Badge variant="secondary">{tm.material.title}</Badge>
								{/each}
								{#if item.taskMaterials.length === 0}
									<span class="text-sm text-muted-foreground">-</span>
								{/if}
							</div>
						</div>

						<!-- Products List -->
						<div class="grid gap-2">
							<Label>{m['projects.products_label']()}</Label>
							<div class="rounded-md border">
								<Table.Root>
									<Table.Header>
										<Table.Row>
											<Table.Head>{m['projects.products_placeholder']()}</Table.Head>
											<Table.Head class="text-right">{m['projects.count_label']()}</Table.Head>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{#each item.taskProducts as tp}
											<Table.Row>
												<Table.Cell>{tp.product.title}</Table.Cell>
												<Table.Cell class="text-right">{tp.count}</Table.Cell>
											</Table.Row>
										{/each}
										{#if item.taskProducts.length === 0}
											<Table.Row>
												<Table.Cell colspan={2} class="text-center text-muted-foreground"
													>-</Table.Cell
												>
											</Table.Row>
										{/if}
									</Table.Body>
								</Table.Root>
							</div>
						</div>
					</div>
				</div>

				<!-- Separator/Heading for Execution -->
				<div class="my-6 border-t"></div>

				<!-- SECTION 2: Execution (Preview & Files) -->
				<div class="grid grid-cols-12 items-stretch gap-6">
					<!-- Left (65%) - Large Visual Reference -->
					<div class="col-span-12 lg:col-span-8">
						<div class="h-full min-h-[400px]">
							<Label>{m['projects.preview_label']()}</Label>
							{#if item.preview}
								<img
									src={item.preview}
									alt="Preview"
									class="mt-2 h-full w-full rounded-md border object-contain"
								/>
							{:else}
								<div
									class="mt-2 flex h-full min-h-[200px] w-full items-center justify-center rounded-md border bg-muted/30"
								>
									<span class="text-muted-foreground">No preview image</span>
								</div>
							{/if}
						</div>
					</div>

					<!-- Right (35%) - Files -->
					<div class="col-span-12 lg:col-span-4">
						<div class="grid gap-2">
							<Label>{m['projects.files_label']()}</Label>
							<div class="grid gap-2">
								{#each item.files as file}
									<div
										class="flex items-center justify-between rounded-lg border bg-card p-2 text-sm"
									>
										<div class="flex items-center gap-3 overflow-hidden">
											<div class="grid h-8 w-8 place-items-center rounded bg-muted">
												<FileIcon class="h-4 w-4" />
											</div>
											<div class="flex flex-col truncate">
												<span class="truncate font-medium">{file.filename}</span>
												<span class="text-xs text-muted-foreground"
													>{(file.size / 1024).toFixed(1)} KB</span
												>
											</div>
										</div>
										<Button
											variant="ghost"
											size="icon"
											class="h-8 w-8 text-muted-foreground"
											onclick={() => downloadFile(file)}
										>
											<Download class="h-4 w-4" />
											<span class="sr-only">Download</span>
										</Button>
									</div>
								{/each}
								{#if item.files.length === 0}
									<span class="text-sm text-muted-foreground">No files attached</span>
								{/if}
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Sticky Footer inside Modal -->
			<div
				class="flex items-center justify-between border-t bg-background p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]"
			>
				<div class="text-xl font-bold">
					{m['projects.total_price']()}: €{toCurrency(item.price || 0)}
				</div>
			</div>
		</div>
	</div>
</div>
