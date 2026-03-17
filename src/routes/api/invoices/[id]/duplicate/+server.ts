import { db } from '$lib/server/db';
import { invoice, invoiceItems } from '$lib/server/db/schema';
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

    const original = await db.query.invoice.findFirst({
        where: eq(invoice.id, id),
        with: { items: true }
    });

    if (!original) {
        return json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Generate a new invoice number
    const userInitial = locals.user?.name ? locals.user.name.charAt(0).toUpperCase() : '';
    const dateStr = new Date()
        .toLocaleDateString('lv-LV', { day: '2-digit', month: '2-digit', year: 'numeric' })
        .replace(/\./g, '');

    let newInvoiceId: number | null = null;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
        try {
            const count = await db.$count(invoice);
            const invoiceNumber = `${dateStr}-${count + 1 + attempts}${userInitial}`;

            const [newInvoice] = await db
                .insert(invoice)
                .values({
                    invoiceNumber,
                    clientId: original.clientId,
                    taskId: original.taskId,
                    issueDate: new Date().toISOString().split('T')[0],
                    dueDate: original.dueDate,
                    subtotal: original.subtotal,
                    taxRate: original.taxRate,
                    taxAmount: original.taxAmount,
                    total: original.total,
                    notes: original.notes,
                    language: original.language,
                    status: 'draft'
                })
                .returning({ id: invoice.id });

            newInvoiceId = newInvoice.id;
            break;
        } catch (error: any) {
            if (error.code === '23505') {
                attempts++;
                continue;
            }
            console.error(error);
            return json({ error: 'Failed to duplicate invoice' }, { status: 500 });
        }
    }

    if (!newInvoiceId) {
        return json({ error: 'Failed to generate a unique invoice number' }, { status: 500 });
    }

    // Duplicate items
    if (original.items && original.items.length > 0) {
        await db.insert(invoiceItems).values(
            original.items.map((item: any) => ({
                invoiceId: newInvoiceId!,
                description: item.description,
                unit: item.unit,
                quantity: item.quantity,
                price: item.price,
                total: item.total
            }))
        );
    }

    return json({ id: newInvoiceId });
};
