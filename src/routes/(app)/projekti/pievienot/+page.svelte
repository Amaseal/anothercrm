<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { enhance } from '$app/forms';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select';
	import * as Popover from '$lib/components/ui/popover';
	import { Calendar } from '$lib/components/ui/calendar';
	import { CalendarIcon } from '@lucide/svelte';
	import { DateFormatter, type DateValue, getLocalTimeZone, today } from '@internationalized/date';
	import Tiptap from '$lib/components/tiptap.svelte';
	import { cn } from '$lib/utils';
	import { buttonVariants } from '$lib/components/ui/button';
	import MultiSelect from '$lib/components/multi-select.svelte';
	import MoneyInput from '@/components/ui/input/money-input.svelte';
	import ProductList from '../../../../lib/components/product-list.svelte';
	import * as NumberField from '$lib/components/ui/number-field';

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
</script>

<div class="container mx-auto max-h-screen overflow-y-auto py-10">
	<h1 class="mb-6 text-3xl font-bold">{m['projects.value']()} - {m['projects.create_button']()}</h1>

	<form method="POST" use:enhance enctype="multipart/form-data" class="mx-auto space-y-6">
		<div class="flex gap-6">
			<div class="grid w-1/2 gap-4">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<div class="grid">
						<Label for="title">{m['projects.title_label']()}</Label>
						<Input id="title" name="title" placeholder={m['projects.title_label']()} required />
					</div>

					<div class="grid">
						<Label for="endDate">{m['projects.due_date_label']()}</Label>
						<Popover.Root>
							<Popover.Trigger
								class={cn(
									buttonVariants({ variant: 'outline' }),
									'w-full justify-start pl-4 text-left font-normal',
									!dateValue && 'text-muted-foreground'
								)}
							>
								{dateValue
									? df.format(dateValue.toDate(getLocalTimeZone()))
									: m['projects.choose_date']()}
								<CalendarIcon class="ml-auto size-4 opacity-50" />
							</Popover.Trigger>
							<Popover.Content class="w-auto p-0" side="top">
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
					<div class="grid w-full">
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
				</div>

				<!-- Row 3: Client, Manager -->
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div class="grid">
						<Label>{m['projects.client_label']()}</Label>
						<input type="hidden" name="clientId" value={selectedClientId} />
						<Select.Root type="single" bind:value={selectedClientId}>
							<Select.Trigger class="w-full">
								{selectedClientName}
							</Select.Trigger>
							<Select.Content class="max-h-[200px] overflow-y-auto">
								{#each data.clients as client}
									<Select.Item value={client.id.toString()} label={client.name}>
										{client.name}
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>

					<div class="grid">
						<Label>{m['projects.assign_manager_label']()}</Label>
						<input type="hidden" name="managerId" value={selectedManagerId} />
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
				</div>

				<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
					<!-- Materials -->
					<div class="grid">
						<Label>{m['projects.materials_label']()}</Label>
						<MultiSelect
							options={data.materials.map((m) => ({
								value: m.id,
								label: `${m.title} (${m.remaining})`
							}))}
							bind:value={selectedMaterialIds}
							placeholder={m['projects.materials_placeholder']()}
						/>
						{#each selectedMaterialIds as id}
							<input type="hidden" name="materials" value={id} />
						{/each}
					</div>

					<div class="grid">
						<Label for="files">{m['projects.files_label']()}</Label>
						<Input id="files" type="file" name="files" multiple />
					</div>
				</div>
				<!-- Products -->
				<div class="grid">
					<ProductList products={data.products} />
				</div>
			</div>
			<div class="w-1/2">
				<div class="grid">
					<Label>{m['projects.description_label']()}</Label>
					<div class="min-h-[200px] rounded-md border p-2">
						<Tiptap bind:value={descriptionContent} class="min-h-[200px]" />
						<input type="hidden" name="description" value={descriptionContent} />
					</div>
				</div>
			</div>
		</div>

		<div class="grid">
			<Label for="preview">{m['projects.preview_label']()}</Label>
			<Input id="preview" type="file" name="preview" accept="image/*" />
		</div>

		<Button type="submit" class="w-full">{m['projects.create_button']()}</Button>
	</form>
</div>
