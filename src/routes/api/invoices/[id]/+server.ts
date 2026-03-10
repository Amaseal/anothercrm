import { db } from '$lib/server/db';
import { invoice, invoiceItems, companySettings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateInvoicePdfBuffer } from '$lib/server/pdfmake';

export const GET: RequestHandler = async ({ params }) => {
    const id = Number(params.id);

    if (isNaN(id)) {
        return json({ error: 'Invalid invoice ID' }, { status: 400 });
    }

    const inv = await db.query.invoice.findFirst({
        where: eq(invoice.id, id),
        with: {
            client: true
        }
    });

    if (!inv) {
        return json({ error: 'Invoice not found' }, { status: 404 });
    }

    const items = await db.query.invoiceItems.findMany({
        where: eq(invoiceItems.invoiceId, id)
    });

    const company = await db.query.companySettings.findFirst();

    const pdfBuffer: Buffer = await generateInvoicePdfBuffer(inv, items, company);
    const pdfArrayBuffer = pdfBuffer.buffer.slice(0) as ArrayBuffer;

    const safeName = inv.invoiceNumber.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

    return new Response(pdfArrayBuffer, {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${safeName}.pdf"`
        }
    });
};
