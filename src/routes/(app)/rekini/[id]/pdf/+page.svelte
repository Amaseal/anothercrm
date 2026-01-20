<script lang="ts">
	import { toCurrency, formatDate } from '$lib/utilities';
	import { Button } from '$lib/components/ui/button';
	import Printer from '@lucide/svelte/icons/printer';

	let { data } = $props();
	const { invoice, items, company } = data;

	function handlePrint() {
		window.print();
	}

	// Simple helper to format price for the specific layout
	const formatMoney = (cents: number) => (cents / 100).toFixed(2);
</script>

<svelte:head>
	<title>Rēķins {invoice.invoiceNumber}</title>
</svelte:head>

<div class="min-h-screen bg-gray-100 p-8 print:bg-white print:p-0">
	<!-- Toolbar (Hidden on print) -->
	<div class="mx-auto mb-6 flex max-w-[210mm] justify-end print:hidden">
		<Button onclick={handlePrint} class="flex gap-2">
			<Printer size="16" /> Print / Save as PDF
		</Button>
	</div>

	<!-- Invoice Paper (A4) -->
	<div
		class="mx-auto min-h-[297mm] max-w-[210mm] bg-white p-12 font-sans text-black shadow-md print:w-full print:max-w-none print:shadow-none"
		style="font-family: Arial, sans-serif;"
	>
		<!-- 1. Header Row -->
		<div class="mb-8 flex items-start justify-between">
			<!-- Logo -->
			<div class="w-1/2">
				{#if company?.logo}
					<!-- <img src={company.logo} alt="Logo" class="max-h-20" /> -->
					<div class="text-3xl font-black tracking-tighter uppercase italic">{company.name}</div>
				{:else}
					<div class="text-3xl font-black tracking-tighter uppercase italic">
						{company?.name ?? 'Company Name'}
					</div>
				{/if}
			</div>

			<!-- Invoice Meta Table -->
			<div class="flex w-1/2 flex-col items-end">
				<h1 class="mb-2 text-xl font-bold">Rēķins/Pavadzīme</h1>
				<table class="w-full max-w-[300px] border-collapse border border-black text-sm">
					<tbody>
						<tr>
							<td class="border border-black px-2 py-0.5 font-bold">Datums:</td>
							<td class="border border-black px-2 py-0.5 text-right"
								>{formatDate(invoice.issueDate)}</td
							>
						</tr>
						<tr>
							<td class="border border-black px-2 py-0.5 font-bold">Rēķina/pavadzīme Nr.:</td>
							<td class="border border-black px-2 py-0.5 text-right font-bold"
								>{invoice.invoiceNumber}</td
							>
						</tr>
						<tr>
							<td class="border border-black px-2 py-0.5 font-bold">Apmaksas termiņš:</td>
							<td class="border border-black px-2 py-0.5 text-right"
								>{formatDate(invoice.dueDate)}</td
							>
						</tr>
					</tbody>
				</table>
			</div>
		</div>

		<!-- 2. Supplier (Piegādātājs) -->
		<div class="mb-6">
			<div class="flex">
				<div class="w-32 font-bold">Piegādātājs</div>
				<div class="font-bold">{company?.name}</div>
			</div>
			<div class="flex text-sm">
				<div class="w-32">Reģ.Nr.</div>
				<div>{company?.registrationNumber}</div>
			</div>
			<div class="flex text-sm">
				<div class="w-32">PVN Nr.</div>
				<div>{company?.vatNumber}</div>
			</div>
			<div class="flex text-sm">
				<div class="w-32">Adrese</div>
				<div>{company?.address}</div>
			</div>
			<div class="flex text-sm">
				<div class="w-32">Banka</div>
				<div>{company?.bankName}</div>
			</div>
			<div class="flex text-sm">
				<div class="w-32">Kods</div>
				<div>{company?.bankCode}</div>
			</div>
			<div class="flex text-sm">
				<div class="w-32">Konts</div>
				<div>{company?.bankAccount}</div>
			</div>
		</div>

		<!-- 3. Client (Maksātājs) -->
		<div class="mb-8">
			<div class="flex">
				<div class="w-32 font-bold">Maksātājs</div>
				<div class="font-bold">{invoice.client?.name}</div>
			</div>
			<!-- Personas kods logic if needed, usually Reg Nr covers it -->
			<div class="flex text-sm">
				<div class="w-32">Reģ.Nr./p.k.</div>
				<div>{invoice.client?.registrationNumber || '-'}</div>
			</div>
			<div class="flex text-sm">
				<div class="w-32">PVN Nr.</div>
				<div>{invoice.client?.vatNumber || '-'}</div>
			</div>
			<div class="flex text-sm">
				<div class="w-32">Adrese</div>
				<div>{invoice.client?.address || '-'}</div>
			</div>
			<div class="flex text-sm">
				<div class="w-32">Banka</div>
				<div>{invoice.client?.bankName || '-'}</div>
			</div>
			<div class="flex text-sm">
				<div class="w-32">Kods</div>
				<div>{invoice.client?.bankCode || '-'}</div>
			</div>
			<div class="flex text-sm">
				<div class="w-32">Konts</div>
				<div>{invoice.client?.bankAccount || '-'}</div>
			</div>
		</div>

		{#if invoice.notes}
			<div class="mb-4 text-sm">
				<span class="font-bold">Darījuma apraksts:</span>
				{invoice.notes}
			</div>
		{/if}

		<!-- 4. Items Table -->
		<table class="mb-1 w-full border-collapse border border-black bg-white">
			<thead>
				<tr class="text-sm">
					<th class="w-10 border border-black px-2 py-1 text-center italic">Nr.p.k.</th>
					<th class="border border-black px-2 py-1 text-left italic">Nosaukums</th>
					<th class="w-24 border border-black px-2 py-1 text-center italic">Mērvienība</th>
					<th class="w-20 border border-black px-2 py-1 text-center italic">Daudzums</th>
					<th class="w-24 border border-black px-2 py-1 text-center italic">Cena EUR</th>
					<th class="w-24 border border-black px-2 py-1 text-center italic">Summa EUR</th>
				</tr>
			</thead>
			<tbody class="text-sm">
				{#each items as item, i}
					<tr>
						<td class="border border-black px-2 py-1 text-center">{i + 1}</td>
						<td class="border border-black px-2 py-1">{item.description}</td>
						<td class="border border-black px-2 py-1 text-center">{item.unit || 'gab.'}</td>
						<td class="border border-black px-2 py-1 text-center">{item.quantity}</td>
						<td class="border border-black px-2 py-1 text-right">{formatMoney(item.price)}</td>
						<td class="border border-black px-2 py-1 text-right font-bold"
							>{formatMoney(item.total)}</td
						>
					</tr>
				{/each}
				<!-- Fill empty rows if needed for A4 look? optional -->
			</tbody>
		</table>

		<!-- 5. Totals -->
		<div class="mb-6 flex flex-col items-end text-sm font-bold">
			<div class="flex w-64 justify-between border-r border-b border-l border-black bg-white px-2">
				<span>Kopā</span>
				<span>{formatMoney(invoice.subtotal)}</span>
			</div>
			<div class="flex w-64 justify-between border-r border-b border-l border-black bg-white px-2">
				<span>PVN {invoice.taxRate}%</span>
				<span>{formatMoney(invoice.taxAmount)}</span>
			</div>
			<div class="flex w-64 justify-between border-r border-b border-l border-black bg-white px-2">
				<span>Summa apmaksai EUR</span>
				<span>{formatMoney(invoice.total)}</span>
			</div>
		</div>

		<!-- 6. Amount in Words -->
		<div class="mb-8">
			<div class="text-sm font-bold">Summa vārdiem EUR:</div>
			<div class="text-sm italic">{invoice.totalInWords || 'One hundred percent awesome'}</div>
			<!-- TODO: Implement number to words in Latvian -->
		</div>

		<!-- 7. Footer -->
		<div class="text-sm">Rēķins/pavadzīme ir izrakstīts elektroniski un ir derīgs bez paraksta</div>
	</div>
</div>

<div class="min-h-screen bg-gray-100 p-8 print:bg-white print:p-0">
	<!-- Toolbar (Hidden on print) -->
	<div class="mx-auto mb-6 flex max-w-[210mm] justify-end print:hidden">
		<Button onclick={handlePrint} class="flex gap-2">
			<Printer size="16" /> Print / Save as PDF
		</Button>
	</div>

	<!-- Invoice Paper -->
	<div
		class="mx-auto min-h-[297mm] max-w-[210mm] bg-white p-12 shadow-md print:w-full print:max-w-none print:shadow-none"
	>
		<!-- Header -->
		<div class="mb-12 flex items-start justify-between">
			<div>
				{#if company?.logo}
					<!-- <img src={company.logo} alt="Logo" class="h-16 mb-4 object-contain" /> -->
					<h1 class="text-2xl font-bold tracking-wide text-primary uppercase">{company.name}</h1>
				{:else}
					<h1 class="text-2xl font-bold tracking-wide text-primary uppercase">
						{company?.name ?? 'Company Name'}
					</h1>
				{/if}
				<div class="mt-2 space-y-1 text-sm text-gray-500">
					<p>{company?.address}</p>
					<p>Reg. No: {company?.registrationNumber}</p>
					<p>VAT: {company?.vatNumber}</p>
				</div>
			</div>
			<div class="text-right">
				<h2 class="mb-2 text-4xl font-light text-gray-900">INVOICE</h2>
				<p class="text-lg font-medium text-gray-600">#{invoice.invoiceNumber}</p>
			</div>
		</div>

		<!-- Info Grid -->
		<div class="mb-12 flex justify-between gap-12">
			<!-- Client Info -->
			<div class="flex-1">
				<h3 class="mb-2 text-xs font-bold tracking-wider text-gray-400 uppercase">Bill To</h3>
				<div class="font-medium text-gray-800">
					<p class="text-lg">{invoice.client?.name}</p>
					{#if invoice.client?.address}<p class="text-sm text-gray-500">
							{invoice.client.address}
						</p>{/if}
					{#if invoice.client?.registrationNumber}<p class="text-sm text-gray-500">
							Reg: {invoice.client.registrationNumber}
						</p>{/if}
					{#if invoice.client?.vatNumber}<p class="text-sm text-gray-500">
							VAT: {invoice.client.vatNumber}
						</p>{/if}
				</div>
			</div>

			<!-- Meta Data -->
			<div class="flex-1 text-right">
				<div class="space-y-2">
					<div class="flex justify-between border-b pb-1">
						<span class="text-sm text-gray-500">Issue Date:</span>
						<span class="font-medium">{formatDate(invoice.issueDate)}</span>
					</div>
					<div class="flex justify-between border-b pb-1">
						<span class="text-sm text-gray-500">Due Date:</span>
						<span class="font-medium">{formatDate(invoice.dueDate)}</span>
					</div>
					<div class="flex justify-between border-b pb-1">
						<span class="text-sm text-gray-500">Bank:</span>
						<span class="text-xs font-medium">{company?.bankName}</span>
					</div>
					<div class="flex justify-between border-b pb-1">
						<span class="text-sm text-gray-500">Account:</span>
						<span class="font-mono text-xs font-medium">{company?.bankAccount}</span>
					</div>
					<div class="flex justify-between border-b pb-1">
						<span class="text-sm text-gray-500">Swift:</span>
						<span class="text-xs font-medium">{company?.bankCode}</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Items Table -->
		<table class="mb-12 w-full">
			<thead>
				<tr class="border-b-2 border-gray-100">
					<th class="py-3 text-left text-xs font-bold tracking-wider text-gray-400 uppercase"
						>Description</th
					>
					<th class="w-24 py-3 text-right text-xs font-bold tracking-wider text-gray-400 uppercase"
						>Qty</th
					>
					<th class="w-32 py-3 text-right text-xs font-bold tracking-wider text-gray-400 uppercase"
						>Price</th
					>
					<th class="w-32 py-3 text-right text-xs font-bold tracking-wider text-gray-400 uppercase"
						>Total</th
					>
				</tr>
			</thead>
			<tbody class="text-sm">
				{#each items as item}
					<tr class="border-b border-gray-50">
						<td class="py-4 text-gray-800">{item.description}</td>
						<td class="py-4 text-right text-gray-500">{item.quantity}</td>
						<td class="py-4 text-right text-gray-500">{toCurrency(item.price)} €</td>
						<td class="py-4 text-right font-medium text-gray-900">{toCurrency(item.total)} €</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<!-- Totals -->
		<div class="mb-12 flex justify-end">
			<div class="w-64 space-y-3">
				<div class="flex justify-between text-sm text-gray-600">
					<span>Subtotal</span>
					<span>{toCurrency(invoice.subtotal)} €</span>
				</div>
				<div class="flex justify-between text-sm text-gray-600">
					<span>VAT ({invoice.taxRate}%)</span>
					<span>{toCurrency(invoice.taxAmount)} €</span>
				</div>
				<div class="flex justify-between border-t pt-3 text-xl font-bold text-gray-900">
					<span>Total</span>
					<span>{toCurrency(invoice.total)} €</span>
				</div>
			</div>
		</div>

		<!-- Footer -->
		{#if invoice.notes}
			<div class="mb-12">
				<h4 class="mb-2 text-xs font-bold tracking-wider text-gray-400 uppercase">Notes</h4>
				<p class="text-sm text-gray-500 italic">{invoice.notes}</p>
			</div>
		{/if}

		<div class="mt-auto border-t pt-8 text-center text-xs text-gray-400">
			<p>This invoice was created electronically and is valid without a signature.</p>
			<p class="mt-1">{company?.email} | {company?.website}</p>
		</div>
	</div>
</div>

<style>
	@media print {
		@page {
			margin: 0;
			size: A4;
		}
		body {
			background: white;
			-webkit-print-color-adjust: exact;
		}
	}
</style>
