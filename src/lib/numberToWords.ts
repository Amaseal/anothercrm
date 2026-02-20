export function numberToWordsLV(amountInCents: number): string {
    const units = ['', 'viens', 'divi', 'trīs', 'četri', 'pieci', 'seši', 'septiņi', 'astoņi', 'deviņi'];
    const teens = ['desmit', 'vienpadsmit', 'divpadsmit', 'trīspadsmit', 'četrpadsmit', 'piecpadsmit', 'sešpadsmit', 'septiņpadsmit', 'astoņpadsmit', 'deviņpadsmit'];
    const tens = ['', '', 'divdesmit', 'trīsdesmit', 'četrdesmit', 'piecdesmit', 'sešdesmit', 'septiņdesmit', 'astoņdesmit', 'deviņdesmit'];

    // Plural helpers
    // Not implementing full grammatical declensions for MVP, just basic readability.

    const euros = Math.floor(amountInCents / 100);
    const cents = amountInCents % 100;

    if (euros === 0) return `nulle eiro un ${cents} centi`;

    const convertChunk = (n: number): string => {
        if (n === 0) return '';

        let str = '';
        const h = Math.floor(n / 100);
        const t = Math.floor((n % 100) / 10);
        const u = n % 10;

        if (h > 0) {
            str += units[h] + (h === 1 ? ' simts ' : ' simti ');
        }

        if (t === 1) {
            str += teens[u] + ' ';
        } else {
            if (t > 1) str += tens[t] + ' ';
            if (u > 0) str += units[u] + ' ';
        }
        return str.trim();
    };

    let words = '';

    const thousands = Math.floor(euros / 1000);
    const remainder = euros % 1000;

    if (thousands > 0) {
        words += convertChunk(thousands) + (thousands === 1 ? ' tūkstotis ' : ' tūkstoši ');
    }

    words += convertChunk(remainder);

    words = words.trim() + ' eiro';
    words += ` un ${cents} centi`;

    // Capitalize first letter
    return words.charAt(0).toUpperCase() + words.slice(1);
}

export function numberToWordsEN(amountInCents: number): string {
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
        'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

    const euros = Math.floor(amountInCents / 100);
    const cents = amountInCents % 100;

    const convertChunk = (n: number): string => {
        if (n === 0) return '';
        if (n < 20) return ones[n];
        const t = Math.floor(n / 10);
        const u = n % 10;
        if (n < 100) return tens[t] + (u > 0 ? '-' + ones[u] : '');
        return ones[Math.floor(n / 100)] + ' hundred' + (n % 100 > 0 ? ' ' + convertChunk(n % 100) : '');
    };

    if (euros === 0) {
        return `Zero euros and ${cents} cents`;
    }

    let words = '';
    if (euros >= 1000000) {
        words += convertChunk(Math.floor(euros / 1000000)) + ' million ';
    }
    if (euros >= 1000) {
        words += convertChunk(Math.floor((euros % 1000000) / 1000)) + ' thousand ';
    }
    words += convertChunk(euros % 1000);
    words = words.trim() + (euros === 1 ? ' euro' : ' euros');
    words += ` and ${cents} cent${cents !== 1 ? 's' : ''}`;

    return words.charAt(0).toUpperCase() + words.slice(1);
}
