import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { client, invoice, task, invoiceItems } from '$lib/server/db/schema';
import { desc, eq, sql } from 'drizzle-orm';

interface InvoiceItemInput {
    description: string;
    unit: string;
    quantity: number;
    price: number;
    discountType: 'fixed' | 'percent';
    discountValue: number;
    section?: string;
}

export const load: PageServerLoad = async ({ params }) => {
    // Fetch the invoice first (needed to redirect early if not found)
    const item = await db.query.invoice.findFirst({
        where: eq(invoice.id, Number(params.id)),
        with: {
            client: true,
            task: true,
            items: true
        }
    });

    if (!item) {
        throw redirect(303, '/rekini');
    }

    // Run all remaining independent queries in parallel
    const [clients, products, company] = await Promise.all([
        db.query.client.findMany({ orderBy: desc(client.id) }),
        db.query.product.findMany({ with: { clientPrices: true, translations: true } }),
        db.query.companySettings.findFirst()
    ]);

    return {
        item,
        clients,
        products,
        company
    };
};

export const actions: Actions = {
    default: async ({ request, params }) => {
        const formData = await request.formData();
        const invoiceId = Number(params.id);

        const taskId = formData.get('taskId') ? parseInt(formData.get('taskId') as string) : null;
        const clientId = formData.get('clientId') ? parseInt(formData.get('clientId') as string) : null;

        // Handle new client creation if needed (though usually distinct for edit)
        // ... Assuming for now we pick from existing or just use the ID provided.
        // If we want to support "New Client" in edit mode, copy logic from create.

        const issueDate = formData.get('issueDate') as string;
        const dueDate = formData.get('dueDate') as string;
        const notes = formData.get('notes') as string;
        // Status might be editable, or inferred. Let's keep it if passed
        const status = formData.get('status') as "draft" | "sent" | "paid" | "overdue" | "cancelled" || 'draft';

        const language = (formData.get('language') as string) || 'lv';

        const itemsRaw = formData.get('items');
        let items: InvoiceItemInput[] = [];
        try {
            items = itemsRaw ? JSON.parse(itemsRaw as string) : [];
        } catch (e) {
            return fail(400, { message: 'Invalid items data' });
        }

        if (!clientId) return fail(400, { message: 'Client is required' });

        // Update existing client details IF checkbox is checked
        const updateClientDetails = formData.get('updateClientDetails') === 'on';

        if (updateClientDetails) {
            const clientRegNo = formData.get('clientRegNo') as string;
            const clientVatNo = formData.get('clientVatNo') as string;
            const clientAddress = formData.get('clientAddress') as string;
            const clientEmail = formData.get('clientEmail') as string;

            await db.update(client).set({
                registrationNumber: clientRegNo,
                vatNumber: clientVatNo,
                address: clientAddress,
                email: clientEmail
            }).where(eq(client.id, clientId));
        }

        if (items.length === 0) return fail(400, { message: 'At least one item is required' });

        // Recalculate totals
        let subtotal = 0;
        const processedItems = items.map((item: InvoiceItemInput) => {
            const qty = Number(item.quantity) || 1;
            const price = Number(item.price) || 0; // In cents
            const discountType = item.discountType === 'fixed' ? 'fixed' : 'percent';
            const discountValue = Number(item.discountValue) || 0;
            let total: number;
            if (!discountValue) {
                total = qty * price;
            } else if (discountType === 'fixed') {
                total = Math.max(0, qty * price - discountValue);
            } else {
                total = Math.round(qty * price * (1 - discountValue / 100));
            }
            subtotal += total;
            return {
                description: item.description,
                unit: item.unit,
                quantity: qty,
                price,
                discountType,
                discountValue,
                total
            };
        });

        const rawTaxRate = parseFloat(formData.get('vatRate') as string);
        const taxRate = isNaN(rawTaxRate) ? 21.0 : rawTaxRate;
        const taxAmount = Math.round(subtotal * (taxRate / 100));
        const total = subtotal + taxAmount;

        try {
            await db.transaction(async (tx) => {
                // Fetch only what we need to detect a client change
                const [existingInvoice] = await tx
                    .select({ clientId: invoice.clientId })
                    .from(invoice)
                    .where(eq(invoice.id, invoiceId))
                    .limit(1);

                // Update Invoice first so the recalculation below sees the new total
                await tx.update(invoice)
                    .set({
                        taskId,
                        clientId,
                        status,
                        issueDate,
                        dueDate,
                        subtotal,
                        taxRate,
                        taxAmount,
                        total,
                        notes,
                        language
                    })
                    .where(eq(invoice.id, invoiceId));

                // Recalculate totalOrdered from live data — avoids error-prone manual math
                const clientsToRecalculate = new Set<number>([clientId!]);
                if (existingInvoice && existingInvoice.clientId !== clientId) {
                    clientsToRecalculate.add(existingInvoice.clientId);
                }
                for (const cid of clientsToRecalculate) {
                    await tx.update(client)
                        .set({ totalOrdered: sql`(SELECT COALESCE(SUM(total), 0) FROM invoices WHERE client_id = ${cid})` })
                        .where(eq(client.id, cid));
                }

                // Handle Items: Delete all and re-insert
                await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));

                if (processedItems.length > 0) {
                    await tx.insert(invoiceItems).values(
                        processedItems.map((item) => ({
                            invoiceId: invoiceId,
                            ...item
                        }))
                    );
                }

                // Sync with Task if taskId exists
                if (taskId) {
                    await tx.update(task).set({
                        clientId: clientId,
                        price: subtotal
                    }).where(eq(task.id, taskId));
                }
            });
        } catch (e) {
            console.error(e);
            return fail(500, { message: 'Failed to update invoice' });
        }

        return redirect(303, '/rekini');
    }
};
