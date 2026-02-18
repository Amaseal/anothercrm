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

export function normalizeLatvianText(text: string): string {
	if (!text) return '';

	return text
		.toLowerCase()
		.replace(/ā/g, 'a')
		.replace(/č/g, 'c')
		.replace(/ē/g, 'e')
		.replace(/ģ/g, 'g')
		.replace(/ī/g, 'i')
		.replace(/ķ/g, 'k')
		.replace(/ļ/g, 'l')
		.replace(/ņ/g, 'n')
		.replace(/š/g, 's')
		.replace(/ū/g, 'u')
		.replace(/ž/g, 'z')
		// Also handle uppercase versions
		.replace(/Ā/g, 'a')
		.replace(/Č/g, 'c')
		.replace(/Ē/g, 'e')
		.replace(/Ģ/g, 'g')
		.replace(/Ī/g, 'i')
		.replace(/Ķ/g, 'k')
		.replace(/Ļ/g, 'l')
		.replace(/Ņ/g, 'n')
		.replace(/Š/g, 's')
		.replace(/Ū/g, 'u')
		.replace(/Ž/g, 'z');
}

