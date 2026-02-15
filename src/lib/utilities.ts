export function formatDate(dateString: number | Date | string | null | undefined) {
	if (!dateString) return '';
	const date = new Date(dateString);
	if (isNaN(date.getTime())) {
		console.warn('Invalid date passed to formatDate:', dateString);
		return '';
	}
	const options: Intl.DateTimeFormatOptions = {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		timeZone: 'Europe/Riga'
	};
	const formattedDate = new Intl.DateTimeFormat('lv-LV', options).format(date);
	return formattedDate;
}

export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number
): (...args: Parameters<T>) => void {
	let timeout: ReturnType<typeof setTimeout> | null = null;

	return function (...args: Parameters<T>): void {
		const later = () => {
			timeout = null;
			func(...args);
		};

		if (timeout !== null) {
			clearTimeout(timeout);
		}
		timeout = setTimeout(later, wait);
	};
}

export function toCurrency(number: number) {
	const currency = (number / 100).toFixed(2);
	return currency;
}
