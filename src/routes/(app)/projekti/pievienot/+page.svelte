<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { enhance } from '$app/forms';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select';
	import * as Popover from '$lib/components/ui/popover';
	import { Calendar } from '$lib/components/ui/calendar';
	import { CalendarIcon, Save, X } from '@lucide/svelte';
	import { DateFormatter, type DateValue, getLocalTimeZone, today } from '@internationalized/date';
	import Tiptap from '$lib/components/tiptap.svelte';
	import { cn } from '$lib/utils';
	import { buttonVariants } from '$lib/components/ui/button';
	import MultiSelect from '$lib/components/multi-select.svelte';
	import ProductList from '../../../../lib/components/product-list.svelte';
	import FileUpload from '@/components/file-upload.svelte';
	import ClientSelect from '$lib/components/client-select.svelte';
	import ImagePreviewInput from '@/components/image-preview-input.svelte';

	let { data } = $props();

	let selectedClientId = $state('');
	let selectedAssigneeId = $state('');
	let selectedManagerId = $state('');
	let selectedSeamstress = $state('');
	let selectedMaterialIds = $state<number[]>([]);

	// Date Picker State
	let dateValue = $state<DateValue | undefined>(undefined);
	const df = new DateFormatter('lv-LV', { dateStyle: 'long' });
	let datePlaceholder = $state<DateValue>(today(getLocalTimeZone()));

	// Tiptap Content
	let descriptionContent = $state('');

	// Total Price from ProductList
	let totalPrice = $state(0);

	// Derived Names
	let selectedClientName = $derived(
		data.clients.find((c) => c.id.toString() === selectedClientId)?.name ||
			m['projects.client_label']()
	);
	let selectedAssigneeName = $derived(
		data.users.find((u) => u.id === selectedAssigneeId)?.name || m['projects.assign_user_label']()
	);
	let selectedManagerName = $derived(
		data.users.find((u) => u.id === selectedManagerId)?.name || m['projects.assign_manager_label']()
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
</script>

<!-- Modal Overlay -->
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
	<!-- Inner Modal Container -->
	<div
		class="relative flex h-[90vh] w-[80vw] flex-col overflow-hidden rounded-xl bg-background shadow-2xl"
	>
		<form method="POST" use:enhance enctype="multipart/form-data" class="flex h-full flex-col">
			<!-- Sticky Header inside Modal -->
			<div class="flex items-center gap-4 border-b bg-background px-6 py-4">
				<!-- Title -->
				<div class="flex-1">
					<Input
						id="title"
						name="title"
						placeholder={m['projects.title_label']()}
						class="text-lg font-semibold"
						required
					/>
				</div>

				<!-- Client -->
				<div class="w-64">
					<input type="hidden" name="clientId" value={selectedClientId} />
					<ClientSelect bind:value={selectedClientId} clients={data.clients} />
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

				<!-- Save Button -->
				<Button type="submit" size="sm">
					<Save class="mr-2 size-4" />
					Saglabāt
				</Button>

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
				<!-- SECTION 1: Description & Products (Products moved here) -->
				<div class="grid grid-cols-12 items-stretch gap-6">
					<!-- Right (35%) - Assignment & Products -->
					<div class="col-span-12 flex flex-col gap-6 lg:col-span-4">
						<!-- Assignment Controls -->
						<div class="space-y-4">
							<!-- Manager -->
							<div class="grid gap-2">
								<Label>{m['projects.assign_manager_label']()}</Label>
								<input type="hidden" name="createdById" value={selectedManagerId} />
								<Select.Root type="single" bind:value={selectedManagerId}>
									<Select.Trigger class="w-full">
										{selectedManagerName}
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
									options={data.materials.map((i) => ({
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

						<!-- Products List (Moved from Execution section) -->
						<div class="flex-1">
							<ProductList products={data.products} bind:totalPrice />
						</div>
					</div>
					<!-- Left (65%) - Description -->
					<!-- Flex col to allow internal growth -->
					<div class="col-span-12 flex flex-col gap-2 lg:col-span-8">
						<Label>{m['projects.description_label']()}</Label>
						<div class="min-h-[400px] flex-1 rounded-md border p-2">
							<!-- Tiptap needs to take full height of parent -->
							<Tiptap bind:value={descriptionContent} class="h-full min-h-full" />
							<input type="hidden" name="description" value={descriptionContent} />
						</div>
					</div>
				</div>

				<!-- Separator/Heading for Execution -->
				<div class="my-6 border-t"></div>

				<!-- SECTION 2: Execution (Preview & Files) -->
				<div class="grid grid-cols-12 items-stretch gap-6">
					<!-- Right (35%) - Files (Moved here) -->
					<div class="col-span-12 lg:col-span-4">
						<div class="grid gap-2">
							<Label for="files">{m['projects.files_label']()}</Label>
							<FileUpload />
						</div>
					</div>
					<!-- Left (65%) - Large Visual Reference -->
					<div class="col-span-12 lg:col-span-8">
						<div class="h-full min-h-[400px]">
							<ImagePreviewInput
								id="preview"
								name="preview"
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
				<div class="text-xl font-bold">
					{m['projects.total_price']()}: €{formatPrice(totalPrice)}
				</div>

				<Button type="submit" size="lg">
					{m['projects.create_button']()}
				</Button>
			</div>
		</form>
	</div>
</div>
