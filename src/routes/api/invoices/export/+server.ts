import { db } from '$lib/server/db';
import { invoice, companySettings } from '$lib/server/db/schema';
import { and, gte, lte } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import JSZip from 'jszip';
import { generateInvoicePdfBuffer } from '$lib/server/pdfmake';
import { numberToWordsEN, numberToWordsLV } from '@/numberToWords';



export const GET: RequestHandler = async ({ url, locals }) => {
    if (!locals.user || locals.user.type !== 'admin') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    if (!from || !to) {
        return new Response(JSON.stringify({ error: 'from and to query params are required' }), { status: 400 });
    }

    // Fetch all invoices in date range with client + items in one query
    const invoices = await db.query.invoice.findMany({
        where: and(
            gte(invoice.issueDate, from),
            lte(invoice.issueDate, to)
        ),
        with: {
            client: true,
            items: true
        }
    });

    if (invoices.length === 0) {
        return new Response(JSON.stringify({ error: 'No invoices found in this date range' }), { status: 404 });
    }

    const company = await db.query.companySettings.findFirst();

    // Generate PDFs and add to ZIP
    const zip = new JSZip();

    for (const inv of invoices) {
        // createPdf returns an OutputDocumentServer with getBuffer()
        const pdfBuffer: Buffer = await generateInvoicePdfBuffer(inv, inv.items, company);

        const safeName = inv.invoiceNumber.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
        zip.file(`${safeName}.pdf`, pdfBuffer);
    }

    const zipUint8 = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    // .slice(0) guarantees a plain ArrayBuffer (not SharedArrayBuffer) for BodyInit compatibility
    const zipBuffer = zipUint8.buffer.slice(0) as ArrayBuffer;

    const fromStr = from.replace(/-/g, '');
    const toStr = to.replace(/-/g, '');
    const filename = `invoices_${fromStr}-${toStr}.zip`;

    return new Response(zipBuffer, {
        headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': String(zipUint8.length)
        }
    });
};
