<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { enhance } from '$app/forms';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select';
	import * as Popover from '$lib/components/ui/popover';
	import { Calendar } from '$lib/components/ui/calendar';
	import { CalendarIcon, Save, X, Printer, FileText, Clock } from '@lucide/svelte';
	import * as Sheet from '$lib/components/ui/sheet';
	import {
		DateFormatter,
		type DateValue,
		getLocalTimeZone,
		today,
		parseDate
	} from '@internationalized/date';
	import Tiptap from '$lib/components/tiptap.svelte';
	import { cn } from '$lib/utils';
	import { buttonVariants } from '$lib/components/ui/button';
	import MultiSelect from '$lib/components/multi-select.svelte';
	import ProductList from '@/components/product-list.svelte';
	import FileUpload from '@/components/file-upload.svelte';
	import ClientSelect from '$lib/components/client-select.svelte';
	import ImagePreviewInput from '@/components/image-preview-input.svelte';
	import type { PageData } from './$types';

	import { isClient, isAdmin } from '$lib/stores/user';

	let { data } = $props<{ data: PageData }>();

	let selectedClientId = $state(data.item.clientId?.toString() || '');

	$effect(() => {
		if (data.userClientId) {
			selectedClientId = data.userClientId.toString();
		}
	});

	let selectedAssigneeIds = $state<string[]>(
		data.item.assignees ? data.item.assignees.map((a: any) => a.userId) : []
	);
	let selectedManagerId = $state(data.item.createdById || '');
	let selectedSeamstress = $state(data.item.seamstress || '');
	let selectedMaterialIds = $state<number[]>(
		data.item.taskMaterials.map((m: { materialId: any }) => m.materialId)
	);

	// Date Picker State
	// data.item.endDate is string (text) from DB, likely YYYY-MM-DD or similar standard format if saved correctly.
	// If saving from Calendar value.toString(), it saves 'YYYY-MM-DD'.
	let dateValue = $state<DateValue | undefined>(
		data.item.endDate ? parseDate(data.item.endDate) : undefined
	);
	const df = new DateFormatter('lv-LV', { dateStyle: 'long' });
	let datePlaceholder = $state<DateValue>(dateValue || today(getLocalTimeZone()));

	// Tiptap Content
	let descriptionContent = $state(data.item.description || '');

	// Total Price from ProductList
	let totalPrice = $state(data.item.price || 0);
	let totalCost = $state(0);

	let isSubmitting = $state(false);
	let isUploading = $state(false);

	let initialProductTotalCents = data.item.taskProducts.reduce((sum: number, tp: any) => {
		const prod = data.products.find((p: any) => p.id === tp.productId);
		if (!prod) return sum;
		const effectivePrice = prod.clientPrice ?? prod.price;
		return sum + effectivePrice * tp.count;
	}, 0);

	let customPriceInput = $state<string>(
		data.item.price !== null && data.item.price !== initialProductTotalCents
			? (data.item.price / 100).toFixed(2)
			: ''
	);

	// Derived Names
	let selectedClientName = $derived(
		data.clients.find((c: { id: { toString: () => any } }) => c.id.toString() === selectedClientId)
			?.name || m['projects.client_label']()
	);
	let selectedAssigneeName = $derived(
		selectedAssigneeIds.length > 0
			? data.users
					.filter((u: { id: any }) => selectedAssigneeIds.includes(u.id))
					.map((u: any) => u.name)
					.join(', ')
			: undefined
	);

	let selectedManagerName = $derived(
		data.users.find((u: { id: any }) => u.id === selectedManagerId)?.name
	);

	const seamstresses = [
		{ value: 'Ikšķile', label: 'Ikšķile' },
		{ value: 'Pie mums', label: 'Pie mums' },
		{ value: 'Vladislavs', label: 'Vladislavs' },
		{ value: 'Lielvārde', label: 'Lielvārde' },
		{ value: 'Pagrabs', label: 'Pagrabs' }
	];

	function formatPrice(priceInCents: number): string {
		return (priceInCents / 100).toFixed(2);
	}

	// Prepare initial entries for ProductList
	let initialProductEntries = $state(
		data.item.taskProducts.length > 0
			? data.item.taskProducts.map((tp: { productId: any; count: any }) => ({
					productId: tp.productId,
					count: tp.count || 1,
					isOpen: false
				}))
			: undefined
	);

	// Prepare existing files for FileUpload
	// FileUpload expects { name, path, size, type? }
	let files = $state(
		data.item.files.map((f: { filename: any; downloadUrl: any; size: any }) => ({
			name: f.filename,
			path: f.downloadUrl,
			size: f.size
		}))
	);

	import ProjectPrintView from '$lib/components/project-print-view.svelte';
	import HistoryList from '$lib/components/history-list.svelte';
</script>

<ProjectPrintView
	title={data.item.title}
	clientName={selectedClientName}
	{dateValue}
	managerName={selectedManagerName}
	assigneeName={selectedAssigneeName}
	seamstress={selectedSeamstress}
	materials={data.item.taskMaterials.map(
		(tm: any) => `${tm.material.title} (${tm.material.remaining})`
	)}
	products={data.item.taskProducts.map((tp: any) => ({
		name: tp.product.title,
		count: tp.count,
		price: tp.product.cost
	}))}
	description={descriptionContent}
	previewUrl={data.item.preview || undefined}
	{totalPrice}
/>

<!-- Modal Overlay -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm print:hidden"
>
	<!-- Inner Modal Container -->
	<div
		class="relative flex h-[90vh] w-[96vw] flex-col overflow-hidden rounded-xl bg-background shadow-2xl md:w-[90vw] 2xl:w-[80vw]"
	>
		<form
			method="POST"
			use:enhance={() => {
				isSubmitting = true;
				return async ({ update }) => {
					await update();
					isSubmitting = false;
				};
			}}
			enctype="multipart/form-data"
			class="flex h-full flex-col"
		>
			<!-- Sticky Header inside Modal -->
			<div class="flex items-center gap-4 border-b bg-background px-6 py-4">
				<!-- Title -->
				<div class="flex-1">
					<Input
						id="title"
						name="title"
						value={data.item.title}
						placeholder={m['projects.title_label']()}
						class="text-lg font-semibold"
						required
					/>
				</div>

				<!-- Client -->
				<div>
					<input type="hidden" name="clientId" value={selectedClientId} />
					<ClientSelect bind:value={selectedClientId} clients={data.clients} disabled={$isClient} />
				</div>

				<!-- Due Date -->
				<div class="w-auto">
					<Popover.Root>
						<Popover.Trigger
							class={cn(
								buttonVariants({ variant: 'outline' }),
								'w-[240px] justify-start pl-4 text-left font-normal',
								!dateValue && 'text-muted-foreground'
							)}
						>
							{dateValue
								? df.format(dateValue.toDate(getLocalTimeZone()))
								: m['projects.choose_date']()}
							<CalendarIcon class="ml-auto size-4 opacity-50" />
						</Popover.Trigger>
						<Popover.Content class="w-auto p-0" side="bottom">
							<Calendar
								type="single"
								value={dateValue}
								bind:placeholder={datePlaceholder}
								minValue={today(getLocalTimeZone())}
								onValueChange={(v) => {
									dateValue = v;
								}}
							/>
						</Popover.Content>
					</Popover.Root>
					<input type="hidden" name="endDate" value={dateValue ? dateValue.toString() : ''} />
				</div>

				<!-- Close Button -->
				<!-- History Toggle -->
				<Sheet.Root>
					<Sheet.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								variant="ghost"
								size="icon"
								class="text-muted-foreground hover:text-foreground"
								title={m['history.title']()}
							>
								<Clock class="size-5" />
								<span class="sr-only">History</span>
							</Button>
						{/snippet}
					</Sheet.Trigger>
					<Sheet.Content side="right" class="z-[100] w-[400px] overflow-y-auto sm:w-[540px]">
						<Sheet.Header>
							<Sheet.Title>{m['history.title']()}</Sheet.Title>
						</Sheet.Header>
						<div class="mt-6 p-4">
							<HistoryList history={data.item.history} />
						</div>
					</Sheet.Content>
				</Sheet.Root>

				<!-- Close Button -->
				<Button
					variant="ghost"
					size="icon"
					href="/projekti"
					class="ml-2 text-muted-foreground hover:text-foreground"
				>
					<X class="size-5" />
					<span class="sr-only">Close</span>
				</Button>
			</div>

			<!-- Scrollable Content -->
			<div class="custom-scroll flex-1 overflow-y-auto p-6">
				<!-- SECTION 1: Description & Products -->
				<div class="grid grid-cols-12 items-stretch gap-6">
					<!-- Right (35%) - Assignment & Products -->
					<div class="col-span-12 flex min-w-0 flex-col gap-6 xl:col-span-4">
						{#if $isAdmin}
							<!-- Assignment Controls -->
							<div class="space-y-4">
								<!-- Assignee -->
								<div class="grid gap-2">
									<Label>{m['projects.assign_user_label']()}</Label>
									<MultiSelect
										groups={[
											{
												label: 'Admins',
												options: data.users
													.filter((u: any) => u.type === 'admin')
													.map((u: any) => ({ value: u.id, label: u.name }))
											},
											{
												label: 'Klienti',
												options: data.users
													.filter((u: any) => u.type === 'client')
													.map((u: any) => ({ value: u.id, label: u.name }))
											}
										]}
										bind:value={selectedAssigneeIds}
										placeholder={m['projects.assign_user_label']()}
									/>
									<input
										type="hidden"
										name="assignedToUserIds"
										value={selectedAssigneeIds.join(',')}
									/>
								</div>

								<!-- Seamstress -->
								<div class="grid gap-2">
									<Label>{m['projects.seamstress_label']()}</Label>
									<input type="hidden" name="seamstress" value={selectedSeamstress} />
									<Select.Root type="single" bind:value={selectedSeamstress}>
										<Select.Trigger class="w-full">
											{selectedSeamstress || m['projects.seamstress_placeholder']()}
										</Select.Trigger>
										<Select.Content>
											{#each seamstresses as s}
												<Select.Item value={s.value} label={s.label}>
													{s.label}
												</Select.Item>
											{/each}
										</Select.Content>
									</Select.Root>
								</div>

								<!-- Materials -->
								<div class="grid gap-2">
									<Label>{m['projects.materials_label']()}</Label>
									<MultiSelect
										options={data.materials.map((i: { id: any; title: any; remaining: any }) => ({
											value: i.id,
											label: `${i.title} (${i.remaining})`
										}))}
										bind:value={selectedMaterialIds}
										placeholder={m['projects.materials_placeholder']()}
									/>
									{#each selectedMaterialIds as id}
										<input type="hidden" name="materials" value={id} />
									{/each}
								</div>
							</div>
						{/if}
						<!-- Products List -->
						<div class="flex-1">
							<ProductList
								products={data.products}
								bind:totalPrice
								bind:totalCost
								initialEntries={initialProductEntries}
								isAdmin={$isAdmin}
							/>
						</div>
					</div>
					<!-- Left (65%) - Description -->
					<div class="col-span-12 flex min-w-0 flex-col gap-2 xl:col-span-8">
						<Label>{m['projects.description_label']()}</Label>
						<div class="min-h-[400px] min-w-0 flex-1 rounded-md border p-2">
							<Tiptap bind:value={descriptionContent} class="h-full min-h-full" />
							<input type="hidden" name="description" value={descriptionContent} />
						</div>
					</div>
				</div>

				<!-- Separator/Heading for Execution -->
				<div class="my-6 border-t"></div>

				<!-- SECTION 3: Invoices -->
				{#if data.taskInvoices && data.taskInvoices.length > 0}
					<div class="mb-6 space-y-4">
						<Label class="text-lg">Rēķini</Label>
						<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							{#each data.taskInvoices as inv}
								<a
									href={`/rekini/labot/${inv.id}`}
									class="block rounded-lg border bg-gray-50/50 p-4 transition-colors hover:bg-gray-50"
								>
									<div class="mb-2 flex items-center justify-between">
										<span class="font-bold">{inv.invoiceNumber}</span>
										<span class="rounded bg-gray-200 px-2 py-1 text-xs">{inv.status}</span>
									</div>
									<div class="text-sm">
										<div>Summa: {formatPrice(inv.total)} €</div>
										<div class="text-muted-foreground">{inv.issueDate} - {inv.dueDate}</div>
									</div>
								</a>
							{/each}
						</div>
					</div>
					<div class="my-6 border-t"></div>
				{/if}

				<!-- SECTION 2: Execution (Preview & Files) -->
				<div class="grid grid-cols-12 items-stretch gap-6">
					<!-- Right (35%) - Files -->
					<div class="col-span-12 min-w-0 xl:col-span-4">
						<div class="grid min-w-0 gap-2">
							<Label for="files">{m['projects.files_label']()}</Label>
							<FileUpload bind:files bind:uploading={isUploading} zipFilename={data.item.title} />
						</div>
					</div>
					<!-- Left (65%) - Large Visual Reference -->
					<div class="col-span-12 min-w-0 xl:col-span-8">
						<div class="h-full min-h-[400px] min-w-0">
							<ImagePreviewInput
								id="preview"
								name="preview"
								preview={data.item.preview || undefined}
								label={m['projects.preview_label']()}
								class="h-full w-full object-contain"
							/>
						</div>
					</div>
				</div>
			</div>

			<!-- Sticky Footer inside Modal -->
			<div
				class="flex items-center justify-between border-t bg-background p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]"
			>
				<div class="flex items-center gap-4">
					<div class=" whitespace-nowrap">
						{m['projects.total_price']()}: €{formatPrice(totalPrice)}
					</div>
					{#if $isAdmin}
						<div class="ml-2 flex items-center gap-2 border-l pl-4">
							<span class="whitespace-nowrap">{m['projects.adjusted_price']()} (€):</span>
							<Input
								id="customPrice"
								name="customPrice"
								type="number"
								step="0.01"
								bind:value={customPriceInput}
								placeholder={m['projects.adjusted_price_label']()}
								class="w-32"
							/>
						</div>
						<div class="ml-2 flex items-center gap-2 border-l pl-4">
							{m['projects.total_cost']()}: €{formatPrice(totalCost)}
						</div>
					{/if}
				</div>
				<div class="flex items-center gap-2 print:hidden">
					<Button
						type="button"
						variant="outline"
						size="icon"
						onclick={() => window.print()}
						title="Printēt"
					>
						<Printer class="size-4" />
						<span class="sr-only">Print</span>
					</Button>

					{#if data.user?.type === 'admin'}
						<Button
							variant="outline"
							size="icon"
							href={`/rekini/pievienot?taskId=${data.item.id}`}
							title="Izveidot rēķinu"
						>
							<FileText class="size-4" />
							<span class="sr-only">Create Invoice</span>
						</Button>
					{/if}
					<Button type="submit" size="lg" disabled={isSubmitting || isUploading}>
						{#if isSubmitting || isUploading}
							<span
								class="mr-2 inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
							></span>
						{/if}
						{m['components.save']()}
						<!-- Change to Save/Update if distinct label exists, or create_button is typically 'Saglabāt' -->
					</Button>
				</div>
			</div>
		</form>
	</div>
</div>
