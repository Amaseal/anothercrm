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
