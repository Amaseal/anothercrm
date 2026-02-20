import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { toCurrency } from '$lib/utilities';

// Initialize virtual file system for fonts
if (pdfMake.vfs == undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fonts = pdfFonts as any;
    pdfMake.vfs = fonts.pdfMake ? fonts.pdfMake.vfs : fonts.vfs;
}


type InvoiceData = {
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    subtotal: number;
    vatRate: number;
    taxAmount: number;
    total: number;
    totalInWords?: string;
    notes?: string;
    language: 'lv' | 'en';
    company: {
        name: string;
        registrationNumber: string;
        vatNumber: string;
        address: string;
        bankName: string;
        bankCode: string;
        bankAccount: string;
        email?: string;
        website?: string;
    };
    client: {
        name: string;
        registrationNumber?: string;
        vatNumber?: string;
        address?: string;
        bankName?: string;
        bankCode?: string;
        bankAccount?: string;
    };
    items: {
        description: string;
        unit: string;
        quantity: number;
        price: number;
        total: number;
    }[];
};

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
        itemNr: 'Nr.p.k.',
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

const formatDate = (date: string | Date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${day}.${month}.${year}`;
};

const formatMoney = (cents: number) => (cents / 100).toFixed(2) + ' €';

export const generatePdf = (data: InvoiceData) => {
    const l = labels[data.language || 'lv'];

    // Define styles
    const styles = {
        header: {
            fontSize: 22,
            bold: true,
            alignment: 'right',
            margin: [0, 0, 0, 10]
        },
        bold: {
            bold: true
        },
        label: {
            bold: true,
            fillColor: '#f9fafb',
            margin: [0, 2]
        },
        tableHeader: {
            bold: true,
            fontSize: 10,
            fillColor: '#f3f4f6',
            alignment: 'center'
        },
        small: {
            fontSize: 9
        },
        footer: {
            fontSize: 8,
            color: '#6b7280',
            alignment: 'center',
            margin: [0, 20, 0, 0]
        }
    };

    const docDefinition = {
        pageSize: 'A4',
        pageMargins: [40, 40, 40, 60],
        content: [
            // Header: Logo/Company Name vs Invoice Info
            {
                columns: [
                    {
                        width: '*',
                        stack: [
                            { text: data.company.name.toUpperCase(), fontSize: 16, bold: true, italics: true },
                        ]
                    },
                    {
                        width: 'auto',
                        stack: [
                            { text: l.invoice, style: 'header' },
                            {
                                table: {
                                    widths: ['auto', 100],
                                    body: [
                                        [{ text: l.date + ':', bold: true }, { text: formatDate(data.issueDate), alignment: 'right' }],
                                        [{ text: l.invoiceNr + ':', bold: true }, { text: data.invoiceNumber, alignment: 'right', bold: true }],
                                        [{ text: l.dueDate + ':', bold: true }, { text: formatDate(data.dueDate), alignment: 'right' }]
                                    ]
                                },
                                layout: 'noBorders'
                            }
                        ]
                    }
                ],
                margin: [0, 0, 0, 20]
            },

            // Supplier Info
            {
                text: l.supplier,
                bold: true,
                margin: [0, 0, 0, 5]
            },
            {
                columns: [
                    {
                        width: '*',
                        text: [
                            { text: data.company.name + '\n', bold: true },
                            `${l.regNo}: ${data.company.registrationNumber}\n`,
                            `${l.vatNo}: ${data.company.vatNumber}\n`,
                            `${l.address}: ${data.company.address}`
                        ],
                        style: 'small'
                    },
                    {
                        width: '*',
                        text: [
                            `${l.bank}: ${data.company.bankName}\n`,
                            `${l.code}: ${data.company.bankCode}\n`,
                            `${l.account}: ${data.company.bankAccount}`
                        ],
                        style: 'small',
                        alignment: 'right'
                    }
                ],
                margin: [0, 0, 0, 20]
            },

            // Client Info (Box)
            {
                table: {
                    widths: ['*'],
                    body: [
                        [
                            {
                                stack: [
                                    { text: l.payer, bold: true, margin: [0, 0, 0, 5] },
                                    { text: data.client.name, bold: true, fontSize: 11 },
                                    data.client.registrationNumber ? `${l.regNo}: ${data.client.registrationNumber}` : '',
                                    data.client.vatNumber ? `${l.vatNo}: ${data.client.vatNumber}` : '',
                                    data.client.address ? `${l.address}: ${data.client.address}` : '',
                                ].filter(Boolean),
                                fillColor: '#f8fafc',
                                border: [true, true, true, true],
                                borderStyle: 'dashed',
                                borderColor: '#cbd5e1',
                                margin: [5, 5, 5, 5]
                            }
                        ]
                    ]
                },
                layout: {
                    hLineWidth: (i: number) => 1,
                    vLineWidth: (i: number) => 1,
                    hLineColor: (i: number) => '#cbd5e1',
                    vLineColor: (i: number) => '#cbd5e1',
                    hLineStyle: (i: number) => { return { dash: { length: 4 } }; },
                    vLineStyle: (i: number) => { return { dash: { length: 4 } }; },
                },
                margin: [0, 0, 0, 20]
            },

            // Notes
            ...(data.notes ? [{ text: data.notes, margin: [0, 0, 0, 10], italics: true, fontSize: 9 }] : []),

            // Items Table
            {
                table: {
                    headerRows: 1,
                    widths: [20, '*', 40, 40, 50, 50],
                    body: [
                        [
                            { text: l.itemNr, style: 'tableHeader' },
                            { text: l.description, style: 'tableHeader', alignment: 'left' },
                            { text: l.unit, style: 'tableHeader' },
                            { text: l.quantity, style: 'tableHeader' },
                            { text: l.price, style: 'tableHeader', alignment: 'right' },
                            { text: l.amount, style: 'tableHeader', alignment: 'right' }
                        ],
                        ...data.items.map((item, i) => [
                            { text: (i + 1).toString(), alignment: 'center', fontSize: 9 },
                            { text: item.description, fontSize: 9 },
                            { text: item.unit || '-', alignment: 'center', fontSize: 9 },
                            { text: item.quantity.toString(), alignment: 'center', fontSize: 9 },
                            { text: formatMoney(item.price), alignment: 'right', fontSize: 9 },
                            { text: formatMoney(item.total), alignment: 'right', bold: true, fontSize: 9 }
                        ])
                    ]
                },
                layout: 'lightHorizontalLines',
                margin: [0, 0, 0, 20]
            },

            // Totals
            {
                columns: [
                    { width: '*', text: '' },
                    {
                        width: 200,
                        table: {
                            widths: ['*', 80],
                            body: [
                                [{ text: l.subtotal, bold: true }, { text: formatMoney(data.subtotal), alignment: 'right' }],
                                [{ text: `${l.vat} ${data.vatRate}%`, bold: true }, { text: formatMoney(data.taxAmount), alignment: 'right' }],
                                [{ text: l.total, bold: true, fontSize: 11 }, { text: formatMoney(data.total), alignment: 'right', bold: true, fontSize: 11 }]
                            ]
                        },
                        layout: 'noBorders'
                    }
                ]
            },

            // Total in words
            {
                text: `${l.totalInWords}: ` + (data.totalInWords || '-----------------'),
                margin: [0, 20, 0, 0],
                fontSize: 10,
                italics: true
            },

            // Footer
            {
                text: l.footer,
                style: 'footer',
                absolutePosition: { x: 40, y: 800 } // Stick to bottom roughly
            }

        ],
        styles: styles,
        defaultStyle: {
            font: 'Roboto'
        }
    };

    return pdfMake.createPdf(docDefinition as any);
};
