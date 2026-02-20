<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select';
	import * as Popover from '$lib/components/ui/popover';
	import { Calendar } from '$lib/components/ui/calendar';
	import { CalendarIcon, X, Printer, FileText, Clock } from '@lucide/svelte';
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
	import ProductList from '$lib/components/product-list.svelte';
	import FileUpload from '$lib/components/file-upload.svelte';
	import ClientSelect from '$lib/components/client-select.svelte';
	import ImagePreviewInput from '$lib/components/image-preview-input.svelte';
	import type { PageData } from './$types';

	import { isClient, isAdmin } from '$lib/stores/user';

	let { data } = $props<{ data: PageData }>();

	let selectedClientId = $state(data.item.clientId?.toString() || '');

	$effect(() => {
		if (data.userClientId) {
			selectedClientId = data.userClientId.toString();
		}
	});

	let selectedAssigneeId = $state(data.item.assignedToUserId || '');
	let selectedManagerId = $state(data.item.createdById || '');
	let selectedSeamstress = $state(data.item.seamstress || '');
	let selectedMaterialIds = $state<number[]>(
		data.item.taskMaterials.map((m: { materialId: any }) => m.materialId)
	);

	let dateValue = $state<DateValue | undefined>(
		data.item.endDate ? parseDate(data.item.endDate) : undefined
	);
	const df = new DateFormatter('lv-LV', { dateStyle: 'long' });
	let datePlaceholder = $state<DateValue>(dateValue || today(getLocalTimeZone()));

	let descriptionContent = $state(data.item.description || '');

	let totalPrice = $state(data.item.price || 0);

	let selectedClientName = $derived(
		data.clients.find((c: { id: { toString: () => any } }) => c.id.toString() === selectedClientId)
			?.name || m['projects.client_label']()
	);
	let selectedAssigneeName = $derived(
		data.users.find((u: { id: any }) => u.id === selectedAssigneeId)?.name
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

	let initialProductEntries = $state(
		data.item.taskProducts.length > 0
			? data.item.taskProducts.map((tp: { productId: any; count: any }) => ({
					productId: tp.productId,
					count: tp.count || 1,
					isOpen: false
				}))
			: undefined
    );

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
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm print:hidden">
	<!-- Inner Modal Container -->
	<div class="relative flex h-[90vh] w-[80vw] flex-col overflow-hidden rounded-xl bg-background shadow-2xl">
		<div class="flex h-full flex-col">
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
						disabled
					/>
				</div>

				<!-- Client -->
				<div class="w-64">
					<ClientSelect bind:value={selectedClientId} clients={data.clients} disabled={true} />
				</div>

				<!-- Due Date -->
				<div class="w-auto">
					<Button
						variant="outline"
						class={cn(
							'w-[240px] justify-start pl-4 text-left font-normal cursor-not-allowed opacity-50',
							!dateValue && 'text-muted-foreground'
						)}
						disabled
					>
						{dateValue
							? df.format(dateValue.toDate(getLocalTimeZone()))
							: m['projects.choose_date']()}
						<CalendarIcon class="ml-auto size-4 opacity-50" />
					</Button>
				</div>

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
					<Sheet.Content side="right" class="w-[400px] sm:w-[540px] overflow-y-auto z-[100]">
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
               
					<div class="col-span-12 flex flex-col gap-6 lg:col-span-4">
                              {#if $isAdmin}
						<!-- Assignment Controls -->
						<div class="space-y-4">
							<!-- Assignee -->
							<div class="grid gap-2">
								<Label>{m['projects.assign_user_label']()}</Label>
								<Select.Root type="single" bind:value={selectedAssigneeId} disabled>
									<Select.Trigger class="w-full">
										{selectedAssigneeName || m['projects.assign_user_label']()}
									</Select.Trigger>
									<Select.Content>
										{#each data.users as user}
											<Select.Item value={user.id} label={user.name}>
												{user.name}
											</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
							</div>

							{#if !$isClient}
								<!-- Seamstress -->
								<div class="grid gap-2">
									<Label>{m['projects.seamstress_label']()}</Label>
									<Select.Root type="single" bind:value={selectedSeamstress} disabled>
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
							{/if}

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
                                    disabled={true}
								/>
							</div>
						</div>
                         {/if}
						<!-- Products List -->
						<div class="flex-1">
							<ProductList
								products={data.products}
								bind:totalPrice
								initialEntries={initialProductEntries}
                                readonly={true}
							/>
						</div>
					</div>
                

					<!-- Left (65%) - Description -->
					<div class="col-span-12 flex flex-col gap-2 lg:col-span-8">
						<Label>{m['projects.description_label']()}</Label>
						<div class="min-h-[400px] flex-1 rounded-md border p-2">
							<Tiptap bind:value={descriptionContent} class="h-full min-h-full" editable={false} />
						</div>
					</div>
				</div>

				<!-- Separator/Heading for Execution -->
				<div class="my-6 border-t"></div>

				<!-- SECTION 2: Execution (Preview & Files) -->
				<div class="grid grid-cols-12 items-stretch gap-6">
					<!-- Right (35%) - Files -->
					<div class="col-span-12 lg:col-span-4">
						<div class="grid gap-2">
							<Label for="files">{m['projects.files_label']()}</Label>
							<FileUpload bind:files readonly={true} />
						</div>
					</div>
					<!-- Left (65%) - Large Visual Reference -->
					<div class="col-span-12 lg:col-span-8">
						<div class="h-full min-h-[400px]">
							<ImagePreviewInput
								id="preview"
								name="preview"
								preview={data.item.preview || undefined}
								label={m['projects.preview_label']()}
								class="h-full w-full object-contain"
                                readonly={true}
							/>
						</div>
					</div>
				</div>

			</div>

			<!-- Sticky Footer inside Modal -->
			<div class="flex items-center justify-between border-t bg-background p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
				<div class="flex items-center gap-4">
					<div class="text-xl font-bold">
						{m['projects.total_price']()}: €{formatPrice(totalPrice)}
					</div>
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
				</div>
			</div>
		</div>
	</div>
</div>
