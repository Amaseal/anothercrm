import { db } from '$lib/server/db';
import { invoice, client, task, invoiceItems } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';

interface InvoiceItemInput {
    description: string;
    unit: string;
    quantity: number;
    price: number;
    discountType: 'fixed' | 'percent';
    discountValue: number;
    section?: string;
}

export const load: PageServerLoad = async ({ url }) => {
    const taskId = url.searchParams.get('taskId');
    const duplicateId = url.searchParams.get('duplicateId');

    // Run all independent queries in parallel
    const [clients, company, products, prefillTaskRaw, prefillInvoiceRaw] = await Promise.all([
        db.query.client.findMany({ orderBy: [desc(client.created_at)] }),
        db.query.companySettings.findFirst(),
        db.query.product.findMany({ with: { clientPrices: true, translations: true } }),
        taskId
            ? db.query.task.findFirst({
                  where: eq(task.id, parseInt(taskId)),
                  with: {
                      client: true,
                      taskProducts: {
                          with: {
                              product: {
                                  with: { clientPrices: true, translations: true }
                              }
                          }
                      }
                  }
              })
            : Promise.resolve(null),
        duplicateId
            ? db.query.invoice.findFirst({
                  where: eq(invoice.id, parseInt(duplicateId)),
                  with: { items: true, client: true }
              })
            : Promise.resolve(null)
    ]);

    const prefillTask = prefillTaskRaw ?? null;
    if (prefillTask?.taskProducts) {
        prefillTask.taskProducts = prefillTask.taskProducts.map((tp) => {
            const clientPriceEntry = tp.product.clientPrices?.find(
                (cp) => cp.clientId === prefillTask!.clientId
            );
            tp.product.effectivePrice = clientPriceEntry ? clientPriceEntry.price : tp.product.price;
            return tp;
        });
    }

    return { clients, company, products, prefillTask, prefillInvoice: prefillInvoiceRaw ?? null };
};

export const actions: Actions = {
    default: async ({ request, locals }) => {
        const formData = await request.formData();

        // --- 1. Client Handling ---
        let clientId = formData.get('clientId') ? Number(formData.get('clientId')) : null;
        const isNewClient = formData.get('isNewClient') === 'true';

        if (isNewClient) {
            const newClientName = formData.get('newClientName') as string;
            const newClientEmail = (formData.get('newClientEmail') as string) || null;
            const newClientPhone = (formData.get('newClientPhone') as string) || null;
            // Basic validation for new client
            if (!newClientName) return fail(400, { message: 'Client Name is required' });
            if (!newClientEmail && !newClientPhone) return fail(400, { message: 'Email or phone is required for new clients' });

            const [createdClient] = await db.insert(client).values({
                name: newClientName,
                address: formData.get('newClientAddress') as string,
                registrationNumber: formData.get('newClientRegNo') as string,
                vatNumber: formData.get('newClientVatNo') as string,
                email: newClientEmail,
                phone: newClientPhone,
                // Add defaults for required fields if needed
            }).returning({ id: client.id });

            clientId = createdClient.id;
        } else if (clientId) {
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
        }

        if (!clientId) {
            return fail(400, { message: 'Client is required' });
        }


        // --- 2. Invoice Details ---
        const taskId = formData.get('taskId') ? Number(formData.get('taskId')) : null;
        const issueDate = formData.get('issueDate') as string;
        const dueDate = formData.get('dueDate') as string;
        const notes = formData.get('notes') as string;
        const language = (formData.get('language') as string) || 'lv';

        // --- 3. Items Handling ---
        // Expecting items to be passed as a JSON string 'items'
        const itemsRaw = formData.get('items');
        let items: InvoiceItemInput[] = [];
        try {
            items = itemsRaw ? JSON.parse(itemsRaw as string) : [];
        } catch (e) {
            return fail(400, { message: 'Invalid items data' });
        }

        if (items.length === 0) {
            return fail(400, { message: 'At least one item is required' });
        }

        // --- 4. Calculations ---
        // Recalculate server-side to be safe
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


        // --- 5. Invoice Number Generation ---
        // Simple generation: Date + Count. Ideally this should be more robust (transactional)
        const dateStr = new Date().toLocaleDateString('lv-LV', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '');
        // format ddmmyyyy - check clashes
        // For now, let's keep the existing logic or simple increment
        // User said: "Invoice number should be autogenerated. Date aswell."

        // Get user's first letter (if user exists in locals)
        const userInitial = locals.user?.name ? locals.user.name.charAt(0).toUpperCase() : '';

        // --- 6. Database Insert ---
        let newInvoiceId: number | null = null;
        let attempts = 0;
        const maxAttempts = 3;

        // Each attempt is wrapped in a transaction so a failed items insert
        // or task sync rolls back the invoice insert automatically.
        while (attempts < maxAttempts) {
            try {
                await db.transaction(async (tx) => {
                    const count = await tx.$count(invoice);
                    const invoiceNumber = `${dateStr}-${count + 1 + attempts}${userInitial}`;

                    const [newInvoice] = await tx.insert(invoice).values({
                        invoiceNumber,
                        taskId,
                        clientId,
                        issueDate,
                        dueDate,
                        subtotal,
                        taxRate,
                        taxAmount,
                        total,
                        notes,
                        language,
                        status: 'draft'
                    }).returning({ id: invoice.id });
                    newInvoiceId = newInvoice.id;

                    if (processedItems.length > 0) {
                        await tx.insert(invoiceItems).values(
                            processedItems.map((item) => ({
                                invoiceId: newInvoice.id,
                                ...item
                            }))
                        );
                    }

                    if (taskId) {
                        await tx.update(task).set({
                            clientId: clientId,
                            price: subtotal
                        }).where(eq(task.id, taskId));
                    }
                });
                break;
            } catch (error: unknown) {
                if ((error as { code?: string }).code === '23505') { // unique constraint violation
                    attempts++;
                    continue;
                }
                console.error(error);
                return fail(500, { message: 'Failed to create invoice' });
            }
        }

        if (!newInvoiceId) {
            return fail(500, { message: 'Failed to create invoice after multiple attempts' });
        }

        throw redirect(303, '/rekini');
    }
};
