<script lang="ts">
	import Input from './input.svelte';

	let {
		value = $bindable(),
		currency = 'EUR',
		locale = 'lv-LV',
		name = '',
		id = '',
		placeholder = '',
		disabled = false,
		className = ''
	} = $props();

	let rawValue = $state('');
	let inputValue = $state('');
	let inputRef: any;

	// Get currency symbol from locale/currency
	function getCurrencySymbol(locale: string, currency: string) {
		return (0)
			.toLocaleString(locale, {
				style: 'currency',
				currency,
				minimumFractionDigits: 0,
				maximumFractionDigits: 0
			})
			.replace(/\d|[.,\s]/g, '');
	}

	const currencySymbol = getCurrencySymbol(locale, currency);

	function formatNumber(val: number) {
		return val === null || isNaN(val)
			? ''
			: new Intl.NumberFormat(locale, {
					minimumFractionDigits: 2,
					maximumFractionDigits: 2
				}).format(val);
	}

	function parseValue(str: string): number {
		// Remove all non-numeric except comma, dot, and minus
		let cleaned = str.replace(/[^\d,.-]/g, '');
		cleaned = cleaned.replace(',', '.');
		const num = parseFloat(cleaned);
		return isNaN(num) ? 0 : num;
	}

	function formatDisplay(raw: string): string {
		if (raw.length === 0) return '';
		if (raw.length === 1) return '0,' + raw;
		if (raw.length === 2) return '0,' + raw;
		let intPart = raw.slice(0, raw.length - 2);
		let intWithSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
		return intWithSep + ',' + raw.slice(-2);
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		let raw = target.value.replace(/[^\d]/g, '');
		rawValue = raw;
		inputValue = formatDisplay(raw);
		// Underlying value for binding (amount in cents as integer)
		if (raw.length === 0) {
			value = 0;
		} else {
			value = parseInt(raw, 10);
		}
	}

	function handleBlur() {
		inputValue = formatDisplay(rawValue);
	}

	$effect(() => {
		// If value is changed externally, update rawValue and inputValue
		if (document.activeElement !== inputRef) {
			if (typeof value === 'number' && !isNaN(value)) {
				// value is in cents (integer)
				rawValue = value.toString();
				inputValue = formatDisplay(rawValue);
			} else {
				rawValue = '';
				inputValue = '';
			}
		}
	});
</script>

<div class="relative w-full">
	<input type="hidden" {name} bind:value={rawValue} />
	<Input
		bind:this={inputRef}
		class={`pr-2 pl-8 ${className}`}
		{id}
		{placeholder}
		{disabled}
		value={inputValue}
		oninput={handleInput}
		onblur={handleBlur}
		autocomplete="off"
		inputmode="decimal"
		type="text"
	/>
	<span class="pointer-events-none absolute top-1 left-2 py-1 text-muted-foreground select-none"
		>{currencySymbol}</span
	>
</div>
