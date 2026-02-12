<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { DateFormatter, type DateValue, getLocalTimeZone } from '@internationalized/date';
	import { cn } from '$lib/utils';

	// Define the shape of data we expect.
	// This needs to be flexible enough to handle both "draft" state (from Add page) and "saved" state (from Edit page)
	// or we pass in normalized props. Let's try passing normalized props for simplicity.

	let {
		title,
		clientName,
		dateValue,
		managerName,
		assigneeName,
		seamstress,
		materials = [], // Array of strings or objects with labels
		products = [], // Array of { product: { title }, count, price } or similar
		description,
		previewUrl,
		totalPrice
	} = $props<{
		title: string;
		clientName: string;
		dateValue: DateValue | undefined;
		managerName: string;
		assigneeName?: string;
		seamstress: string;
		materials: string[];
		products: { name: string; count: number; price: number }[];
		description: string;
		previewUrl?: string;
		totalPrice: number;
	}>();

	const df = new DateFormatter('lv-LV', { dateStyle: 'long' });

	function formatPrice(priceInCents: number): string {
		return (priceInCents / 100).toFixed(2);
	}
</script>

<div
	class="fixed top-0 left-0 z-[9999] hidden h-full w-full overflow-y-auto bg-white p-8 font-sans text-black print:block"
>
	<!-- Header -->
	<div class="mb-6 flex items-start justify-between border-b pb-4">
		<div>
			<h1 class="mb-2 text-3xl font-bold">{title || m['projects.title_label']()}</h1>
			<div class="text-lg text-gray-600">
				<span class="font-semibold">{m['projects.client_label']()}:</span>
				{clientName}
			</div>
		</div>
		<div class="text-right">
			<div class="text-lg">
				<!-- Use due_date_label 'Termiņš' instead of 'Choose Date' -->
				<span class="font-semibold">{m['projects.due_date_label']()}:</span>
				{dateValue ? df.format(dateValue.toDate(getLocalTimeZone())) : '-'}
			</div>
		</div>
	</div>

	<div class="grid grid-cols-12 gap-8">
		<!-- Main Content (Description) -->
		<div class="col-span-8 flex flex-col gap-6">
			<!-- Description -->
			<div>
				<h3 class="mb-2 border-b text-lg font-bold text-gray-700">
					{m['projects.description_label']()}
				</h3>
				<div class="prose max-w-none text-sm leading-relaxed">
					<!-- Render HTML from Tiptap -->
					{@html description}
				</div>
			</div>

			<!-- Preview Image -->
			{#if previewUrl}
				<div class="mt-4 break-inside-avoid">
					<h3 class="mb-2 border-b text-lg font-bold text-gray-700">
						{m['projects.preview_label']()}
					</h3>
					<div class="flex h-[400px] justify-center rounded-md border bg-gray-50 p-2">
						<!-- Fixed height for print consistency -->
						<img src={previewUrl} alt="Preview" class="h-full object-contain" />
					</div>
				</div>
			{/if}
		</div>

		<!-- Sidebar (Details) -->
		<div class="col-span-4 flex flex-col gap-6">
			<!-- Assignment Details & Products -->
			<div class="break-inside-avoid space-y-6 rounded-lg border bg-gray-50 p-4">
				<!-- Basic Info -->
				<div class="space-y-3 text-sm">
					<div>
						<span class="block font-bold text-gray-700">{m['projects.assign_manager_label']()}</span
						>
						<span>{managerName}</span>
					</div>
					{#if assigneeName}
						<div>
							<span class="block font-bold text-gray-700">{m['projects.assign_user_label']()}</span>
							<span>{assigneeName}</span>
						</div>
					{/if}
					<div>
						<span class="block font-bold text-gray-700">{m['projects.seamstress_label']()}</span>
						<span>{seamstress || '-'}</span>
					</div>
					<div>
						<span class="block font-bold text-gray-700">{m['projects.materials_label']()}</span>
						{#if materials.length > 0}
							<ul class="list-inside list-disc">
								{#each materials as material}
									<li>{material}</li>
								{/each}
							</ul>
						{:else}
							<span>-</span>
						{/if}
					</div>
				</div>

				<!-- Products List -->
				<div>
					<h3 class="mb-2 border-b border-gray-300 pb-1 text-sm font-bold text-gray-700">
						{m['projects.products_label']()}
					</h3>
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 text-left text-xs text-gray-500">
								<th class="py-1">{m['projects.title_label']()}</th>
								<th class="py-1 text-center">{m['projects.count_label']()}</th>
							</tr>
						</thead>
						<tbody>
							{#each products as product}
								<tr class="border-b border-gray-100 last:border-0">
									<td class="py-1.5">{product.name}</td>
									<td class="py-1.5 text-center">{product.count}</td>
								</tr>
							{/each}
						</tbody>
					</table>

					<!-- Total Price -->
					<div class="mt-4 border-t border-gray-300 pt-4 text-right">
						<div class="text-lg font-bold">
							{m['projects.total_price']()}: €{formatPrice(totalPrice)}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
