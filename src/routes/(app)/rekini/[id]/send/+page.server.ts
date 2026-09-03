import { db } from '$lib/server/db';
import { invoice } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { sendEmail } from '$lib/server/mailUtils';
import * as m from '$lib/paraglide/messages';
import { generateInvoicePdfBuffer } from '$lib/server/pdfmake';

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmails(raw: FormDataEntryValue | null): string[] {
    if (!raw) return [];
    return String(raw)
        .split(/[,;\s]+/)
        .map((e) => e.trim())
        .filter(Boolean);
}

export const actions: Actions = {
    default: async ({ params, url, request }) => {
        const id = Number(params.id);

        const formData = await request.formData();
        const toList = parseEmails(formData.get('to'));
        const ccList = parseEmails(formData.get('cc'));

        if (toList.length === 0) {
            return fail(400, { message: 'Recipient email is required' });
        }

        const invalid = [...toList, ...ccList].filter((e) => !EMAIL_RE.test(e));
        if (invalid.length) {
            return fail(400, { message: `Invalid email address: ${invalid.join(', ')}` });
        }

        // Fetch invoice with client email
        const item = await db.query.invoice.findFirst({
            where: eq(invoice.id, id),
            with: {
                client: true,
                items: true
            }
        });

        if (!item) {
            return fail(400, { message: 'Invoice not found' });
        }

        const company = await db.query.companySettings.findFirst();

        const lang = (item.language as 'lv' | 'en') || 'lv';
        const totalFormatted = (item.total / 100).toFixed(2);

        // Construct Email
        const subject = m["invoices.send.email_subject"](
            { number: item.invoiceNumber, company: company?.name || 'FastBreak' },
            { locale: lang }
        );
        const pdfLink = `${url.origin}/api/invoices/${id}`;

        const html = `
            <p>${m["invoices.send.email_greeting"]({ client: item.client?.name || '' }, { locale: lang })}</p>
            <p>${m["invoices.send.email_attached"]({ number: item.invoiceNumber }, { locale: lang })}</p>
            <p><strong>${m["invoices.send.email_total"]({ total: totalFormatted }, { locale: lang })}</strong></p>
            <p>${m["invoices.send.email_view"]({}, { locale: lang })} <a href="${pdfLink}">${m["invoices.send.email_view_link"]({}, { locale: lang })}</a></p>
            <p>${m["invoices.send.email_thanks"]({}, { locale: lang })}</p>
        `;

        const pdfBuffer: Buffer = await generateInvoicePdfBuffer(item, item.items || [], company);
        const attachment = {
            filename: `Invoice_${item.invoiceNumber.replace(/[^a-zA-Z0-9_\-\.]/g, '_')}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
        };

        try {
            await sendEmail(toList, subject, html, [attachment], ccList);

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
