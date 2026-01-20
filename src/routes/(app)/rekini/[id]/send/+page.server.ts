import { db } from '$lib/server/db';
import { invoice } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { sendEmail } from '$lib/server/mailUtils';

export const load: PageServerLoad = async ({ params }) => {
	const item = await db.query.invoice.findFirst({
        where: eq(invoice.id, Number(params.id)),
		with: {
			client: true
		}
	});

    if (!item) throw redirect(303, '/rekini');

	return { item };
};

export const actions: Actions = {
	default: async ({ params, url }) => {
        const id = Number(params.id);
        
        // Fetch invoice with client email
        const item = await db.query.invoice.findFirst({
            where: eq(invoice.id, id),
            with: {
                client: true
            }
        });
        
        if (!item || !item.client?.email) {
            return fail(400, { message: 'Invoice or Client Email not found' });
        }

        // Construct Email
        const subject = `Invoice ${item.invoiceNumber} from Us`;
        const pdfLink = `${url.origin}/rekini/${id}/pdf`;
        
        const html = `
            <h1>New Invoice</h1>
            <p>Dear ${item.client.name},</p>
            <p>Please find attached your invoice #${item.invoiceNumber}.</p>
            <p><strong>Total: ${(item.total / 100).toFixed(2)} EUR</strong></p>
            <p>You can view and print the invoice here: <a href="${pdfLink}">View Invoice</a></p>
            <p>Thank you for your business!</p>
        `;

		try {
			await sendEmail(item.client.email, subject, html);
            
            // Update status to 'sent'
            await db.update(invoice)
                .set({ status: 'sent' })
                .where(eq(invoice.id, id));
                
		} catch (error) {
			console.error(error);
			return fail(500, { message: 'Failed to send email' });
		}
        
		return redirect(303, '/rekini');
	}
};
