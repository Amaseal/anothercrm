import { db } from '$lib/server/db';
import { invoice, invoiceItems, companySettings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

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

    return json({
        invoice: inv,
        items,
        company
    });
};
