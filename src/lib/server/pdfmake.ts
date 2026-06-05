import { createRequire } from 'module';
import { numberToWordsLV, numberToWordsEN } from '$lib/numberToWords';

// pdfmake exports a singleton instance (not a class)
const _require = createRequire(import.meta.url);
const pdfInstance = _require('pdfmake/js/index');

// Roboto is bundled with pdfmake
const robotoDir = _require.resolve('pdfmake/fonts/Roboto/Roboto-Regular.ttf')
    .replace(/Roboto-Regular\.ttf$/, '');

const fonts = {
    Roboto: {
        normal: robotoDir + 'Roboto-Regular.ttf',
        bold: robotoDir + 'Roboto-Medium.ttf',
        italics: robotoDir + 'Roboto-Italic.ttf',
        bolditalics: robotoDir + 'Roboto-MediumItalic.ttf'
    }
};

// FastBreak SVG logo
const FASTBREAK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" width="53.135mm" height="14.2219mm" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 235.45 63.02" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><style type="text/css"><![CDATA[.fil0 {fill:#1C1715} .fil1 {fill:#1C1715;fill-rule:nonzero}]]></style></defs><g id="Layer_x0020_1"><g id="_2689248214384"><path class="fil0" d="M28.95 62.98l-15 0 0.88 -2.88 10.11 0 0.46 -1.5 -10.1 0 1.69 -5.54 -1.55 -1.73 17.07 0 -0.89 2.91 -10.1 0 -0.45 1.48 10.1 0 -2.23 7.27zm21.45 -11.66l-2.42 7.92 -10.12 0 -1.15 3.73 -4.89 0 3.05 -9.92 -1.55 -1.73 17.09 0zm-11.01 2.91l-0.65 2.13 5.23 0 0.65 -2.13 -5.23 0zm13.34 -1.17l-3.05 9.92 15.01 0 3.57 -11.66 -17.09 0 1.55 1.73zm4.53 1.17l5.23 0 -1.8 5.87 -5.23 0 1.8 -5.87zm28.89 -2.91l-2.32 7.62 -2.69 0 1.43 4.04 -4.91 0 -1.5 -4.04 -2.45 0 -1.25 4.04 -4.89 0 3.05 -9.92 -1.55 -1.73 17.09 0zm-11.01 2.91l-0.55 1.82 5.23 0 0.55 -1.82 -5.23 0zm14.25 0l-2.47 -2.91 16.31 0 -0.89 2.91 -4.8 0 -2.69 8.75 -4.89 0 2.69 -8.75 -3.27 0zm28.13 8.75l-15 0 0.88 -2.88 10.11 0 0.46 -1.5 -10.1 0 1.69 -5.54 -1.55 -1.73 17.07 0 -0.89 2.91 -10.1 0 -0.45 1.48 10.1 0 -2.23 7.27zm2.87 0l3.05 -9.92 -1.55 -1.73 6.97 0 -2.69 8.77 3.21 0 2.69 -8.77 4.89 0 -2.69 8.77 3.23 0 2.68 -8.77 4.89 0 -3.57 11.66 -21.11 0zm31.55 -8.75l-0.45 1.48 10.12 0 -0.89 2.89 -10.12 0 -0.47 1.5 10.12 0 -0.89 2.88 -15.01 0 3.05 -9.92 -1.55 -1.73 17.09 0 -0.89 2.91 -10.12 0zm28.89 -2.91l-3.57 11.66 -4.89 0 1.15 -3.73 -5.23 0 -1.15 3.73 -4.89 0 3.05 -9.92 -1.55 -1.73 17.09 0zm-11.01 2.91l-0.65 2.13 5.23 0 0.65 -2.13 -5.23 0zm28.87 -2.91l-2.32 7.62 -2.69 0 1.43 4.04 -4.91 0 -1.5 -4.04 -2.45 0 -1.25 4.04 -4.89 0 3.05 -9.92 -1.55 -1.73 17.09 0zm-11.01 2.91l-0.55 1.82 5.23 0 0.55 -1.82 -5.23 0z"/><g><path class="fil0" d="M88.41 47.29c-0.27,-0.07 -0.2,-0.29 -0.14,-0.53 1.22,-3.99 2.42,-7.98 3.63,-11.98 0.75,-2.48 1.49,-4.97 2.28,-7.61 0.32,0.46 0.58,0.85 0.83,1.23 0.69,1.02 1.36,2.05 2.07,3.06 0.18,0.25 0.17,0.5 0.08,0.87 -0.72,2.28 -1.4,4.56 -2.06,6.84 -0.05,0.15 -0.02,0.37 0.08,0.46 1.33,1.19 2.7,2.37 4.07,3.56 1.46,-0.81 2.91,-1.62 4.36,-2.43 0.05,-0.04 0.1,-0.07 0.14,-0.09 1.24,-0.41 1.76,-1.24 1.97,-2.33 0.12,-0.66 0.38,-1.33 0.53,-1.99 0.06,-0.25 0.08,-0.57 -0.05,-0.74 -0.9,-1.41 -1.84,-2.78 -2.78,-4.17 -0.05,-0.05 -0.05,-0.12 -0.11,-0.23 3.75,0.01 7.44,0.01 11.26,0.02 -0.71,0.54 -1.32,1.04 -1.94,1.52 -1.24,0.98 -2.51,1.96 -3.77,2.95 -0.16,0.12 -0.32,0.33 -0.37,0.5 -0.36,1.11 -0.71,2.22 -1.01,3.33 -0.05,0.16 0,0.39 0.12,0.48 1.15,1 2.33,1.98 3.49,2.97 0.19,0.18 0.36,0.21 0.69,0.02 1.92,-1.12 3.86,-2.21 5.79,-3.34 0.16,-0.08 0.33,-0.31 0.39,-0.48 0.57,-1.83 1.12,-3.67 1.68,-5.51 0.16,-0.52 0.28,-1.06 0.46,-1.59 0.06,-0.15 0.21,-0.33 0.34,-0.44 1.84,-1.45 3.68,-2.88 5.61,-4.39 -2.04,6.7 -4.02,13.3 -6.02,19.96 -0.35,0.03 -0.73,0.08 -1.1,0.12 -10.17,-0.03 -20.33,-0.05 -30.51,-0.06z"/><path class="fil0" d="M99.24 19.17c2.89,0.55 5.8,1.09 8.77,1.65 -0.79,1.76 -1.58,3.47 -2.43,5.35 -0.06,-0.58 -0.11,-1.02 -0.17,-1.46 0,-0.04 0.01,-0.1 -0,-0.14 -0.03,-2.02 -0.03,-2.03 -1.68,-2.9 -1.42,-0.76 -2.85,-1.48 -4.28,-2.23 -0.1,-0.06 -0.18,-0.14 -0.26,-0.19 0.01,-0.03 0.03,-0.06 0.05,-0.07z"/><path class="fil0" d="M115.3 26.05c0.27,-1.72 0.52,-3.44 0.78,-5.21 3.29,-0.54 6.53,-1.08 9.76,-1.62 0.02,0.02 0.01,0.06 0.01,0.08 -0.45,0.18 -0.86,0.37 -1.32,0.55 -2.04,0.81 -4.09,1.62 -6.13,2.4 -0.44,0.17 -0.67,0.42 -0.9,0.78 -0.69,1.01 -1.41,2.02 -2.11,3.03 -0.03,0 -0.05,0.01 -0.1,-0z"/><path class="fil0" d="M114.05 8.59c0.25,-0.79 0.46,-1.5 0.67,-2.23 -2.24,0.19 -3.83,-0.45 -4.66,-2.28 1.73,-0.19 3.34,-0.25 4.83,0.16 -0.48,-0.74 -0.35,-1.55 0.53,-2.29 0.84,-0.71 1.84,-1.28 2.76,-1.9 0.09,-0.07 0.31,-0.06 0.41,-0 0.69,0.53 1.35,1.11 1.68,1.97 0.29,0.76 0.07,1.37 -0.63,2.05 1.48,-0 2.98,0 4.51,0.01 -0.82,1.42 -3.7,2.51 -5.88,2.26 -0.2,0.73 -0.43,1.46 -0.67,2.26 0.21,-0 0.41,0 0.62,0.01 3.27,0 6.52,-0.01 9.78,0.03 0.58,0.01 0.88,-0.23 1.11,-0.75 -1.97,0.02 -3.44,-0.63 -4.15,-2.33 1.95,-0.24 3.75,-0.27 5.37,0.36 -0.15,-0.98 0.18,-1.7 1.23,-2.28 0.8,-0.47 1.67,-0.8 2.52,-1.09 0.95,-0.32 1.93,-0.53 2.99,-0.81 -0.57,0.75 -1.08,1.41 -1.6,2.08 -2.82,3.77 -5.62,7.54 -8.42,11.31 -0.27,0.36 -0.49,0.49 -0.88,0.49 -8.35,-0.03 -16.68,-0.05 -25.04,-0.06 -0.37,0.01 -0.49,-0.1 -0.54,-0.45 -0.63,-4.38 -1.26,-8.75 -1.88,-13.14 -0.01,-0.05 -0.01,-0.12 -0,-0.26 0.28,0.08 0.55,0.14 0.79,0.23 1,0.35 2.01,0.67 2.94,1.11 0.42,0.21 0.77,0.61 0.97,1.03 0.31,0.69 0.13,1.11 -0.62,1.83 2.03,-0.68 3.84,-0.65 5.7,-0.39 -1.75,1.72 -3.6,2.33 -5.54,2.3 -0.05,0.74 -0.04,0.75 0.69,0.75 3.27,0 6.5,0.02 9.77,0.03 0.22,-0 0.44,0 0.63,-0z"/><path class="fil1" d="M26.69 48.13l6.36 0 3.05 -6.42 -2.41 -4.16 4.3 0 4.85 -10.46 -0.04 0.8 -1.57 10.71 -5.32 0 4.14 6.8 -0.29 2.73 6.36 0 3.78 -28.26 -9.72 0 -13.48 28.26zm37.79 0l3.86 -12.58 -7.7 -7.44 0.84 -2.79 4.1 0 -0.7 2.31 4.68 3.88 3.01 -9.79c0.03,-0.03 0.04,-0.1 0.04,-0.23 0,-0.15 -0.04,-0.33 -0.11,-0.52 -0.08,-0.19 -0.17,-0.37 -0.27,-0.55 -0.11,-0.17 -0.24,-0.31 -0.38,-0.42 -0.15,-0.1 -0.3,-0.15 -0.45,-0.15l-14.15 0 -3.56 11.65 7.73 7.44 -1.13 3.72 -4.16 0 0.89 -2.98 -4.65 -3.85 -3.17 10.42c-0.03,0.03 -0.04,0.1 -0.04,0.23 0,0.32 0.12,0.67 0.35,1.06 0.24,0.39 0.52,0.58 0.84,0.58l14.14 0zm27.44 -20.18l2.46 -8.08 -20.5 0 2.86 5.46 2.76 0 -6.96 22.81 5.87 0 6.97 -22.81 1.47 0 -0.8 2.63 5.87 0zm47.04 20.18c0.17,0 0.39,-0.07 0.64,-0.21 0.25,-0.14 0.48,-0.31 0.72,-0.5 0.23,-0.19 0.44,-0.39 0.62,-0.61 0.18,-0.21 0.29,-0.39 0.34,-0.55l3.06 -10.04 -2.03 -1.73 3.11 -1.8 3.37 -10.97c0.02,-0.03 0.03,-0.1 0.03,-0.23 0,-0.15 -0.04,-0.33 -0.11,-0.52 -0.07,-0.19 -0.16,-0.37 -0.27,-0.55 -0.11,-0.17 -0.24,-0.31 -0.38,-0.42 -0.15,-0.1 -0.3,-0.15 -0.45,-0.15l-17.81 0 2.03 3.95 -7.45 24.32 14.6 0zm1.76 -19.32l-5.55 3.53 0.61 5.77 2.54 -1.41 -1.83 5.97 -4.59 0 2.31 -7.54 -0.35 -3.43 1.8 -1.32 1.54 -5.07 4.59 0 -1.06 3.49zm13.64 7.06l1.37 15.37 6.19 -3.27 -0.7 -9.79 3.34 -1.92 4.46 -14.53c0.02,-0.03 0.03,-0.1 0.03,-0.23 0,-0.15 -0.04,-0.33 -0.11,-0.52 -0.07,-0.19 -0.16,-0.37 -0.27,-0.55 -0.11,-0.17 -0.24,-0.31 -0.38,-0.42 -0.15,-0.1 -0.3,-0.15 -0.45,-0.15l-17.81 0 2.03 3.95 -7.45 24.32 5.87 0 2.88 -9.43 -0.35 -3.44 1.79 -1.35 2.63 -8.59 4.59 0 -2.28 7.5 -5.38 3.05zm33.2 -16.01l-17.32 0 2.03 3.95 -7.45 24.32 14.11 0 2.47 -8.12 -5.84 0 -0.8 2.66 -2.41 0 1.86 -6.13 2.37 0 6.8 -5.45 -7.51 0 1.76 -5.77 2.41 0 -0.8 2.63 5.84 0 2.46 -8.08zm-5.71 28.26l6.36 0 3.05 -6.42 -2.41 -4.16 4.3 0 4.85 -10.46 -0.04 0.8 -1.57 10.71 -5.32 0 4.14 6.8 -0.29 2.73 6.36 0 3.78 -28.26 -9.72 0 -13.48 28.26z"/><polygon class="fil1" points="34.73,19.79 8.32,19.79 11.37,25.79 -0,62.9 8.93,62.9 14.3,45.22 17.97,45.22 28.3,36.92 16.88,36.92 19.57,28.11 23.22,28.11 22.01,32.15 30.94,32.15 "/><path class="fil1" d="M213.77 39.71l12.92 -19.79 8.77 0 -12.21 18.82 0.21 19.79 -8.46 4.5 -1.24 -23.31zm5.82 -19.79l-4.9 16.09 -3.26 4.45 1.01 2.82 -4.71 15.47 -8.02 0 10.22 -33.41 -2.77 -5.42 12.43 0z"/></g></g></g></svg>`;

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
        discount: 'Atlaide',
        amount: 'Summa',
        subtotal: 'Summa bez PVN',
        vat: 'PVN',
        total: 'Summa apmaksai',
        totalInWords: 'Summa vārdiem',
        footer: 'Rēķins/pavadzīme ir izrakstīts elektroniski un ir derīgs bez paraksta',
        terms: 'Apmaksas un piegādes noteikumi: Veicot šī rēķina apmaksu, klients apstiprina rēķina datu pareizību un piekrīt SIA "FAST BREAK" noteikumiem (fastbreak.lv/noteikumi). Klients uzņemas pilnu atbildību par jebkādiem muitas nodokļiem, nodevām vai papildu izmaksām, kas var rasties, piegādājot preces ārvalstīs. SIA "FAST BREAK" neuzņemas atbildību par piegādes termiņu kavēšanos, ja tā radusies piegādes operatoru (kurjeru dienestu) darbības rezultātā.'
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
        discount: 'Discount',
        amount: 'Amount',
        subtotal: 'Subtotal',
        vat: 'VAT',
        total: 'Total Due',
        totalInWords: 'Amount in words',
        footer: 'This invoice is generated electronically and is valid without signature.',
        terms: 'Payment and Delivery Terms: By paying this invoice, the client confirms the accuracy of the invoice details and agrees to the SIA "FAST BREAK" terms and conditions (fastbreak.lv/noteikumi). The client assumes full responsibility for any customs duties, taxes, or additional charges that may arise when shipping goods internationally. SIA "FAST BREAK" is not liable for any delivery delays caused by delivery operators (courier services).'
    }
};

const formatDate = (d: string | Date | null): string => {
    if (!d) return '';
    const date = new Date(d);
    return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
};

const formatMoney = (cents: number): string => (cents / 100).toFixed(2);

function itemLineTotal(item: any): number {
    const raw = item.quantity * item.price;
    if (!item.discountValue) return raw;
    if (item.discountType === 'fixed') return Math.max(0, raw - item.discountValue);
    return Math.round(raw * (1 - item.discountValue / 100));
}

// Build a pdfmake document definition that matches the layout
export function buildInvoiceDocDefinition(inv: any, items: any[], company: any): any {
    const lang = (inv.language as 'lv' | 'en') || 'lv';
    const l = labels[lang];

    const hasDiscount = items.some((item: any) => (item.discountValue ?? 0) > 0);
    const subtotal = items.reduce((acc: number, item: any) => acc + itemLineTotal(item), 0);
    const taxAmount = Math.round(subtotal * ((inv.taxRate ?? 21) / 100));
    const total = subtotal + taxAmount;
    const totalInWords = lang === 'en' ? numberToWordsEN(total) : numberToWordsLV(total);

    // Cell style helpers
    const headerCell = (text: string) => ({
        text,
        bold: true,
        fillColor: '#f3f4f6',
        fontSize: 9,
        border: [true, true, true, true]
    });

    const bodyCell = (text: string, alignment: string = 'left', bold = false) => ({
        text,
        fontSize: 9,
        alignment,
        bold,
        border: [true, true, true, true]
    });

    // Supplier section rows
    const supplierRows: any[] = [
        [{ text: l.supplier, bold: true, fontSize: 10, border: [false, false, false, false] }, { text: company?.name || '', bold: true, fontSize: 10, border: [false, false, false, false] }]
    ];
    if (company?.registrationNumber) supplierRows.push([{ text: l.regNo, color: '#555555', fontSize: 9, border: [false, false, false, false] }, { text: company.registrationNumber, fontSize: 9, border: [false, false, false, false] }]);
    if (company?.vatNumber) supplierRows.push([{ text: l.vatNo, color: '#555555', fontSize: 9, border: [false, false, false, false] }, { text: company.vatNumber, fontSize: 9, border: [false, false, false, false] }]);
    if (company?.address) supplierRows.push([{ text: l.address, color: '#555555', fontSize: 9, border: [false, false, false, false] }, { text: company.address, fontSize: 9, border: [false, false, false, false] }]);
    if (company?.bankName) supplierRows.push([{ text: l.bank, color: '#555555', fontSize: 9, border: [false, false, false, false] }, { text: company.bankName, fontSize: 9, border: [false, false, false, false] }]);
    if (company?.bankCode) supplierRows.push([{ text: l.code, color: '#555555', fontSize: 9, border: [false, false, false, false] }, { text: company.bankCode, fontSize: 9, border: [false, false, false, false] }]);
    if (company?.bankAccount) supplierRows.push([{ text: l.account, color: '#555555', fontSize: 9, border: [false, false, false, false] }, { text: company.bankAccount, fontSize: 9, border: [false, false, false, false] }]);

    // Payer section rows
    const payerRows: any[] = [
        [{ text: l.payer, bold: true, fontSize: 10, border: [false, false, false, false] }, { text: inv.client?.name || '', bold: true, fontSize: 10, border: [false, false, false, false] }]
    ];
    if (inv.client?.registrationNumber) payerRows.push([{ text: l.regNo, color: '#555555', fontSize: 9, border: [false, false, false, false] }, { text: inv.client.registrationNumber, fontSize: 9, border: [false, false, false, false] }]);
    if (inv.client?.vatNumber) payerRows.push([{ text: l.vatNo, color: '#555555', fontSize: 9, border: [false, false, false, false] }, { text: inv.client.vatNumber, fontSize: 9, border: [false, false, false, false] }]);
    if (inv.client?.address) payerRows.push([{ text: l.address, color: '#555555', fontSize: 9, border: [false, false, false, false] }, { text: inv.client.address, fontSize: 9, border: [false, false, false, false] }]);
    if (inv.client?.bankName) payerRows.push([{ text: l.bank, color: '#555555', fontSize: 9, border: [false, false, false, false] }, { text: inv.client.bankName, fontSize: 9, border: [false, false, false, false] }]);
    if (inv.client?.bankCode) payerRows.push([{ text: l.code, color: '#555555', fontSize: 9, border: [false, false, false, false] }, { text: inv.client.bankCode, fontSize: 9, border: [false, false, false, false] }]);
    if (inv.client?.bankAccount) payerRows.push([{ text: l.account, color: '#555555', fontSize: 9, border: [false, false, false, false] }, { text: inv.client.bankAccount, fontSize: 9, border: [false, false, false, false] }]);

    // Items table rows
    const itemRows = items.map((item: any, i: number) => {
        const discountDisplay = (item.discountValue ?? 0) > 0
            ? (item.discountType === 'fixed' ? `-€${formatMoney(item.discountValue)}` : `-${item.discountValue}%`)
            : '-';
        const row: any[] = [
            bodyCell(String(i + 1), 'center'),
            bodyCell(item.description || ''),
            bodyCell(item.unit || '-', 'center'),
            bodyCell(String(item.quantity), 'center'),
            bodyCell(formatMoney(item.price), 'right'),
            ...(hasDiscount ? [bodyCell(discountDisplay, 'right')] : []),
            bodyCell(formatMoney(itemLineTotal(item)), 'right', true)
        ];
        return row;
    });

    return {
        pageSize: 'A4',
        pageMargins: [42, 42, 42, 42], // ~15mm
        defaultStyle: {
            font: 'Roboto',
            fontSize: 10,
            color: '#000000'
        },
        content: [
            // Header: Logo text + Invoice meta table
            {
                columns: [
                    // Left: FastBreak SVG logo
                    {
                        svg: FASTBREAK_SVG,
                        width: 150,
                        margin: [0, 0, 0, 0]
                    },
                    // Spacer to ensure space-between layout
                    { text: '', width: '*' },
                    // Right: Invoice meta table
                    {
                        width: 'auto',
                        stack: [
                            { text: l.invoice, bold: true, fontSize: 14, alignment: 'right', margin: [0, 0, 0, 6] },
                            {
                                table: {
                                    widths: ['auto', 'auto'],
                                    body: [
                                        [
                                            { text: `${l.date}:`, bold: true, fontSize: 9, margin: [4, 2, 4, 2] },
                                            { text: formatDate(inv.issueDate), fontSize: 9, alignment: 'right', margin: [4, 2, 4, 2] }
                                        ],
                                        [
                                            { text: `${l.invoiceNr}:`, bold: true, fontSize: 9, margin: [4, 2, 4, 2] },
                                            { text: inv.invoiceNumber, bold: true, fontSize: 9, alignment: 'right', margin: [4, 2, 4, 2] }
                                        ],
                                        [
                                            { text: `${l.dueDate}:`, bold: true, fontSize: 9, margin: [4, 2, 4, 2] },
                                            { text: formatDate(inv.dueDate), fontSize: 9, alignment: 'right', margin: [4, 2, 4, 2] }
                                        ]
                                    ]
                                }
                            }
                        ]
                    }
                ],
                margin: [0, 0, 0, 12]
            },

            // Supplier section
            {
                table: {
                    widths: [80, '*'],
                    body: supplierRows
                },
                layout: 'noBorders',
                margin: [0, 0, 0, 8]
            },

            // Payer section
            {
                table: {
                    widths: [80, '*'],
                    body: payerRows
                },
                layout: 'noBorders',
                margin: [0, 0, 0, 12]
            },

            // Notes (above items table, shown if present)
            ...(inv.notes ? [{ text: inv.notes, fontSize: 9, italics: true, color: '#555555', margin: [0, 0, 0, 8] }] : []),

            // Items table
            {
                table: {
                    widths: hasDiscount ? [20, '*', 35, 45, 50, 45, 50] : [20, '*', 35, 45, 50, 50],
                    headerRows: 1,
                    body: [
                        [
                            headerCell(l.itemNr),
                            headerCell(l.description),
                            { ...headerCell(l.unit), alignment: 'center' },
                            { ...headerCell(l.quantity), alignment: 'center' },
                            { ...headerCell(`${l.price} €`), alignment: 'right' },
                            ...(hasDiscount ? [{ ...headerCell(l.discount), alignment: 'right' }] : []),
                            { ...headerCell(`${l.amount} €`), alignment: 'right' }
                        ],
                        ...itemRows
                    ]
                },
                margin: [0, 0, 0, 12]
            },

            // Totals block (right-aligned)
            {
                columns: [
                    { width: '*', text: '' },
                    {
                        width: 'auto',
                        table: {
                            widths: [120, 70],
                            body: [
                                [
                                    { text: l.subtotal, bold: true, fontSize: 10, margin: [0, 4, 20, 4] },
                                    { text: `${formatMoney(subtotal)} €`, fontSize: 10, alignment: 'right', margin: [0, 4, 0, 4] }
                                ],
                                [
                                    { text: `${l.vat} ${inv.taxRate ?? 21}%`, bold: true, fontSize: 10, margin: [0, 4, 20, 4] },
                                    { text: `${formatMoney(taxAmount)} €`, fontSize: 10, alignment: 'right', margin: [0, 4, 0, 4] }
                                ],
                                [
                                    { text: l.total, bold: true, fontSize: 11, margin: [0, 6, 20, 2] },
                                    { text: `${formatMoney(total)} €`, bold: true, fontSize: 11, alignment: 'right', margin: [0, 6, 0, 2] }
                                ]
                            ]
                        },
                        layout: {
                            hLineWidth: (i: number, node: any) => (i === node.table.body.length - 1 ? 1 : 0),
                            vLineWidth: () => 0,
                            hLineColor: () => '#000000'
                        }
                    }
                ],
                margin: [0, 0, 0, 12]
            },

            // Total in words
            {
                text: [{ text: `${l.totalInWords}: `, bold: true, fontSize: 9 }, { text: totalInWords, fontSize: 9, italics: true }],
                margin: [0, 0, 0, 20]
            },

            // Footer
            { text: l.footer, fontSize: 8, italics: true, color: '#555555', margin: [0, 12, 0, 4] },

            // Payment & Delivery Terms
            { text: l.terms, fontSize: 7, color: '#666666', margin: [0, 0, 0, 0] }
        ]
    };
}

// Generate the PDF and return a standard Blob/Buffer
export async function generateInvoicePdfBuffer(inv: any, items: any[], company: any): Promise<Buffer> {
    pdfInstance.setFonts(fonts);
    const docDefinition = buildInvoiceDocDefinition(inv, items, company);
    return await pdfInstance.createPdf(docDefinition).getBuffer();
}
