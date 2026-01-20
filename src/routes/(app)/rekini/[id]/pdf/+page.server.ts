import { db } from '$lib/server/db';
import { invoice, invoiceItems, taskProduct } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
    // 1. Fetch Invoice with basic relations AND invoice items
	const invoiceItem = await db.query.invoice.findFirst({
        where: eq(invoice.id, Number(params.id)),
		with: {
			client: true,
			task: true,
            items: true // Fetch the new invoiceItems
		}
	});

    if (!invoiceItem) throw redirect(303, '/rekini');

    let items: any[] = [];
    
    // Priority 1: Use direct Invoice Items (the new way)
    if (invoiceItem.items && invoiceItem.items.length > 0) {
        items = invoiceItem.items.map(i => ({
            description: i.description,
            unit: i.unit || 'gab.',
            quantity: i.quantity,
            price: i.price,
            total: i.total
        }));
    } 
    // Priority 2: Fallback to Task Products (legacy / auto-linked way if no manual items)
    else if (invoiceItem.taskId) {
        const products = await db.query.taskProduct.findMany({
            where: eq(taskProduct.taskId, invoiceItem.taskId),
            with: {
                product: true
            }
        });
        
        items = products.map(tp => ({
            description: tp.product.title,
            unit: 'gab.', // Default for products
            quantity: tp.count,
            price: tp.product.cost,
            total: (tp.count || 0) * tp.product.cost
        }));
    }
    
    // Priority 3: Fallback Service line
    if (items.length === 0) {
        items.push({
            description: invoiceItem.notes || "Services",
            unit: 'gab.',
            quantity: 1,
            price: invoiceItem.subtotal,
            total: invoiceItem.subtotal
        });
    }

    // 3. Fetch Company Settings
    const company = await db.query.companySettings.findFirst();

    // 4. Calculate Words
    if (!invoiceItem.totalInWords) {
        const { numberToWordsLV } = await import('$lib/numberToWords');
        invoiceItem.totalInWords = numberToWordsLV(invoiceItem.total);
    }

	return {
		invoice: invoiceItem,
        items,
        company
	};
};
