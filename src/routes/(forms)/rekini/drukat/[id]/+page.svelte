<script lang="ts">
	import FastBreakLogo from '$lib/components/fastbreak-logo.svelte';
	import { numberToWordsLV, numberToWordsEN } from '$lib/numberToWords';
	import { onMount } from 'svelte';

	let { data } = $props();
	const { invoice, company } = data;

	const labels = {
		lv: {
			invoice: 'Rēķins/Pavadzīme',
			date: 'Datums',
			invoiceNr: 'Rēķina nr.',
			dueDate: 'Apmaksas termiņš',
			supplier: 'Piegādātājs',
			payer: 'Maksātājs',
			regNo: 'Reģ.Nr.',
			vatNo: 'PVN Nr.',
			address: 'Adrese',
			bank: 'Banka',
			code: 'Kods',
			account: 'Konts',
			itemNr: 'Nr.',
			description: 'Nosaukums',
			unit: 'Mērv.',
			quantity: 'Daudzums',
			price: 'Cena',
			amount: 'Summa',
			subtotal: 'Summa bez PVN',
			vat: 'PVN',
			total: 'Summa apmaksai',
			totalInWords: 'Summa vārdiem',
			footer: 'Rēķins/pavadzīme ir izrakstīts elektroniski un ir derīgs bez paraksta'
		},
		en: {
			invoice: 'Commercial Invoice',
			date: 'Issue Date',
			invoiceNr: 'Invoice No.',
			dueDate: 'Due Date',
			supplier: 'Supplier',
			payer: 'Bill To',
			regNo: 'Reg. No.',
			vatNo: 'VAT No.',
			address: 'Address',
			bank: 'Bank',
			code: 'SWIFT/BIC',
			account: 'IBAN',
			itemNr: '#',
			description: 'Description',
			unit: 'Unit',
			quantity: 'Qty',
			price: 'Price',
			amount: 'Amount',
			subtotal: 'Subtotal',
			vat: 'VAT',
			total: 'Total Due',
			totalInWords: 'Amount in words',
			footer: 'This invoice is generated electronically and is valid without signature.'
		}
	};

	const l = labels[(invoice.language as 'lv' | 'en') || 'lv'];

	const formatDate = (d: string | Date | null) => {
		if (!d) return '';
		const date = new Date(d);
		return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
	};

	const formatMoney = (cents: number) => (cents / 100).toFixed(2);

	const subtotal = invoice.items.reduce(
		(acc: number, item: any) => acc + item.quantity * item.price,
		0
	);
	const taxAmount = Math.round(subtotal * ((invoice.taxRate ?? 21) / 100));
	const total = subtotal + taxAmount;

	const totalInWords = invoice.language === 'en' ? numberToWordsEN(total) : numberToWordsLV(total);

	onMount(() => {
		window.print();
	});
</script>

<svelte:head>
	<title>Invoice {invoice.invoiceNumber}</title>
	<style>
		@page {
			size: A4;
			margin: 15mm 15mm 15mm 15mm;
		}

		* {
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}

		body {
			margin: 0;
			padding: 16px;
			background: white;
			font-family: Arial, sans-serif;
		}

		.no-print {
			display: flex;
		}

		@media print {
			.no-print {
				display: none !important;
			}
			body {
				padding: 40px 20px;
			}
		}
	</style>
</svelte:head>

<!-- Print / Close buttons (hidden when printing) -->
<div class="no-print" style="position: fixed; top: 12px; right: 12px; z-index: 50; gap: 8px;">
	<button
		onclick={() => window.print()}
		style="background:#111; color:white; border:none; padding:8px 16px; border-radius:6px; font-size:13px; cursor:pointer; font-weight:500;"
	>
		🖨️ Print / Save as PDF
	</button>
	<button
		onclick={() => window.close()}
		style="background:white; color:#555; border:1px solid #d1d5db; padding:8px 16px; border-radius:6px; font-size:13px; cursor:pointer;"
	>
		Close
	</button>
</div>

<!-- Invoice Paper -->
<div style="max-width: 180mm; margin: 0 auto; background: white; font-family: Arial, sans-serif; font-size: 11px; color: #000;">

	<!-- 1. Header: Logo + Invoice meta -->
	<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
		<div style="width: 50%;">
			<FastBreakLogo />
		</div>
		<div style="text-align: right;">
			<div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">{l.invoice}</div>
			<table style="border-collapse: collapse; font-size: 11px; min-width: 200px; margin-left: auto;">
				<tbody>
					<tr>
						<td style="padding: 2px 8px; font-weight: bold; background: #f9fafb; border: 1px solid #000;">{l.date}:</td>
						<td style="padding: 2px 8px; text-align: right; border: 1px solid #000;">{formatDate(invoice.issueDate)}</td>
					</tr>
					<tr>
						<td style="padding: 2px 8px; font-weight: bold; background: #f9fafb; border: 1px solid #000;">{l.invoiceNr}:</td>
						<td style="padding: 2px 8px; text-align: right; font-weight: bold; border: 1px solid #000;">{invoice.invoiceNumber}</td>
					</tr>
					<tr>
						<td style="padding: 2px 8px; font-weight: bold; background: #f9fafb; border: 1px solid #000;">{l.dueDate}:</td>
						<td style="padding: 2px 8px; text-align: right; border: 1px solid #000;">{formatDate(invoice.dueDate)}</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>

	<!-- 2. Supplier -->
	<div style="margin-bottom: 12px; font-size: 11px;">
		<div style="display: flex;">
			<div style="width: 120px; font-weight: bold;">{l.supplier}</div>
			<div style="font-weight: bold;">{company?.name}</div>
		</div>
		{#if company?.registrationNumber}
			<div style="display: flex;">
				<div style="width: 120px; color: #555;">{l.regNo}</div>
				<div>{company.registrationNumber}</div>
			</div>
		{/if}
		{#if company?.vatNumber}
			<div style="display: flex;">
				<div style="width: 120px; color: #555;">{l.vatNo}</div>
				<div>{company.vatNumber}</div>
			</div>
		{/if}
		{#if company?.address}
			<div style="display: flex;">
				<div style="width: 120px; color: #555;">{l.address}</div>
				<div>{company.address}</div>
			</div>
		{/if}
		{#if company?.bankName}
			<div style="display: flex;">
				<div style="width: 120px; color: #555;">{l.bank}</div>
				<div>{company.bankName}</div>
			</div>
		{/if}
		{#if company?.bankCode}
			<div style="display: flex;">
				<div style="width: 120px; color: #555;">{l.code}</div>
				<div>{company.bankCode}</div>
			</div>
		{/if}
		{#if company?.bankAccount}
			<div style="display: flex;">
				<div style="width: 120px; color: #555;">{l.account}</div>
				<div>{company.bankAccount}</div>
			</div>
		{/if}
	</div>

	<!-- 3. Client (Payer) -->
	<div style="margin-bottom: 16px; font-size: 11px;">
		<div style="display: flex;">
			<div style="width: 120px; font-weight: bold;">{l.payer}</div>
			<div style="font-weight: bold;">{invoice.client?.name}</div>
		</div>
		{#if invoice.client?.registrationNumber}
			<div style="display: flex;">
				<div style="width: 120px; color: #555;">{l.regNo}</div>
				<div>{invoice.client.registrationNumber}</div>
			</div>
		{/if}
		{#if invoice.client?.vatNumber}
			<div style="display: flex;">
				<div style="width: 120px; color: #555;">{l.vatNo}</div>
				<div>{invoice.client.vatNumber}</div>
			</div>
		{/if}
		{#if invoice.client?.address}
			<div style="display: flex;">
				<div style="width: 120px; color: #555;">{l.address}</div>
				<div>{invoice.client.address}</div>
			</div>
		{/if}
	</div>


	<!-- 5. Items Table -->
	<table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10px;">
		<thead>
			<tr style="background: #f3f4f6;">
				<th style="border: 1px solid #000; padding: 4px 6px; text-align: center; width: 28px;">{l.itemNr}</th>
				<th style="border: 1px solid #000; padding: 4px 6px; text-align: left;">{l.description}</th>
				<th style="border: 1px solid #000; padding: 4px 6px; text-align: center; width: 50px;">{l.unit}</th>
				<th style="border: 1px solid #000; padding: 4px 6px; text-align: center; width: 55px;">{l.quantity}</th>
				<th style="border: 1px solid #000; padding: 4px 6px; text-align: right; width: 65px;">{l.price} €</th>
				<th style="border: 1px solid #000; padding: 4px 6px; text-align: right; width: 65px;">{l.amount} €</th>
			</tr>
		</thead>
		<tbody>
			{#each invoice.items as item, i}
				<tr>
					<td style="border: 1px solid #000; padding: 3px 6px; text-align: center;">{i + 1}</td>
					<td style="border: 1px solid #000; padding: 3px 6px;">{item.description}</td>
					<td style="border: 1px solid #000; padding: 3px 6px; text-align: center;">{item.unit || '-'}</td>
					<td style="border: 1px solid #000; padding: 3px 6px; text-align: center;">{item.quantity}</td>
					<td style="border: 1px solid #000; padding: 3px 6px; text-align: right;">{formatMoney(item.price)}</td>
					<td style="border: 1px solid #000; padding: 3px 6px; text-align: right; font-weight: bold;">{formatMoney(item.quantity * item.price)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
	<!-- 4. Notes -->
	{#if invoice.notes}
		<div style="margin-bottom: 12px; font-size: 10px; font-style: italic; color: #555;">{invoice.notes}</div>
	{/if}


	<!-- 6. Totals -->
	<div style="display: flex; justify-content: flex-end; margin-bottom: 16px;">
		<table style="border-collapse: collapse; font-size: 11px; min-width: 220px;">
			<tbody>
				<tr>
					<td style="padding: 3px 10px; font-weight: bold;">{l.subtotal}</td>
					<td style="padding: 3px 10px; text-align: right;">{formatMoney(subtotal)} €</td>
				</tr>
				<tr>
					<td style="padding: 3px 10px; font-weight: bold;">{l.vat} {invoice.taxRate ?? 21}%</td>
					<td style="padding: 3px 10px; text-align: right;">{formatMoney(taxAmount)} €</td>
				</tr>
				<tr style="border-top: 2px solid #000;">
					<td style="padding: 4px 10px; font-weight: bold; font-size: 12px;">{l.total}</td>
					<td style="padding: 4px 10px; text-align: right; font-weight: bold; font-size: 12px;">{formatMoney(total)} €</td>
				</tr>
			</tbody>
		</table>
	</div>

	<!-- 7. Total in words -->
	<div style="margin-bottom: 16px; font-size: 10px; font-style: italic;">
		<span style="font-weight: bold;">{l.totalInWords}:</span> {totalInWords}
	</div>

	<!-- 8. Footer -->
	<div style="margin-top: 24px; font-size: 9px; font-style: italic;">
		{l.footer}
	</div>
</div>
