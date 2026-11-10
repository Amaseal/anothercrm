<script lang="ts">
	import { getInvoiceSignatures } from '$lib/invoice-signatures';

	let { language, companyName }: { language: string; companyName: string } = $props();
	const columns = $derived(getInvoiceSignatures(language, companyName));
</script>

<div class="invoice-signatures">
	{#each columns as column (column.title)}
		<div>
			<strong>{column.title}</strong>
			{#each column.fields as field (field.label)}
				<div class="signature-value">{field.value || '\u00a0'}</div>
				<div class="signature-label">{field.label}</div>
			{/each}
		</div>
	{/each}
</div>

<style>
	.invoice-signatures {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 40px;
		margin-top: 24px;
		break-inside: avoid;
		font-size: 12px;
		color: black;
	}

	.signature-value {
		min-height: 28px;
		margin-top: 12px;
		border-bottom: 1px solid black;
	}

	.signature-label {
		margin-top: 2px;
		font-size: 10px;
	}
</style>
