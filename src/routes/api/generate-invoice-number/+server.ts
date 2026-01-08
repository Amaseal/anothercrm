import { json } from '@sveltejs/kit';
import { generateInvoiceNumber } from '$lib/utils/invoice-number';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { date } = await request.json();

		// Parse the date or use current date
		const targetDate = date ? new Date(date) : new Date();

		// Generate invoice number
		const invoiceNumber = await generateInvoiceNumber(targetDate);

		return json({ invoiceNumber });
	} catch (error) {
		console.error('Error generating invoice number:', error);
		return json({ error: 'Failed to generate invoice number' }, { status: 500 });
	}
};
