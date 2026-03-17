import { db } from '$lib/server/db';
import { invoice } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals }) => {
    if (!locals.user || locals.user.type !== 'admin') {
        return json({ error: 'Forbidden' }, { status: 403 });
    }

    const id = Number(params.id);
    if (isNaN(id)) {
        return json({ error: 'Invalid invoice ID' }, { status: 400 });
    }

    const existing = await db.query.invoice.findFirst({
        where: eq(invoice.id, id)
    });

    if (!existing) {
        return json({ error: 'Invoice not found' }, { status: 404 });
    }

    const userInitial = locals.user?.name ? locals.user.name.charAt(0).toUpperCase() : '';
    const dateStr = new Date()
        .toLocaleDateString('lv-LV', { day: '2-digit', month: '2-digit', year: 'numeric' })
        .replace(/\./g, '');

    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
        try {
            const count = await db.$count(invoice);
            const invoiceNumber = `${dateStr}-${count + attempts}${userInitial}`;

            await db
                .update(invoice)
                .set({ invoiceNumber })
                .where(eq(invoice.id, id));

            return json({ invoiceNumber });
        } catch (error: any) {
            if (error.code === '23505') {
                attempts++;
                continue;
            }
            console.error(error);
            return json({ error: 'Failed to regenerate invoice number' }, { status: 500 });
        }
    }

    return json({ error: 'Failed to generate a unique invoice number' }, { status: 500 });
};
