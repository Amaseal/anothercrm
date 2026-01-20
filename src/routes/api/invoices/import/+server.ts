import { json } from '@sveltejs/kit';
import { read, utils } from 'xlsx';
import { db } from '$lib/server/db';
import { client, invoice, invoiceItems } from '$lib/server/db/schema';
import { eq, ilike, or, sql } from 'drizzle-orm';

export const POST = async ({ request }) => {
	try {
		const formData = await request.formData();
		const files = formData.getAll('files');
		const results = [];

		if (!files || files.length === 0) {
			return json({ error: 'No files uploaded' }, { status: 400 });
		}

		for (const file of files) {
			if (!(file instanceof File)) continue;
			
			const buffer = await file.arrayBuffer();
			const workbook = read(buffer);
			const sheetName = workbook.SheetNames[0];
			const sheet = workbook.Sheets[sheetName];

			// Helper to get cell value safely
			const getVal = (cell: string) => {
				const v = sheet[cell]?.v;
				return v !== undefined ? String(v).trim() : '';
			};
            
            // Helper to get date from Excel serial date or string
            const getDate = (cell: string) => {
                const c = sheet[cell];
                if(!c) return '';
                
                let date;
                // If it's a number, parse common excel date
                if(c.t === 'n') {
                    // Excel date to JS date
                    date = new Date((c.v - (25567 + 2)) * 86400 * 1000);
                } else {
                    // Start by trying to parse text
                    const txt = String(c.v).trim();
                    // Regex for DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY, DD_MM_YYYY, etc.
                    const parts = txt.match(/^(\d{1,2})[.\/, -_](\d{1,2})[.\/, -_](\d{4})$/);
                    if (parts) {
                        date = new Date(`${parts[3]}-${parts[2]}-${parts[1]}`);
                    } else {
                         // Fallback to standard parse
                         date = new Date(txt);
                    }
                }

                if (isNaN(date.getTime())) return ''; // Invalid date

                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                return `${year}-${month}-${day}`;
            }

			// 1. Extract Header Data
			const issueDate = getDate('F4'); // F4:G4 merged usually
			const invoiceNumber = getVal('F5');
			const dueDate = getDate('F6');

			// 2. Extract Client Data
			const clientName = getVal('C17');
			const clientRegNo = getVal('C18');
			const clientVatNo = getVal('C19');
			const clientAddress = getVal('C20');
			const clientBankName = getVal('C21');
			const clientBankCode = getVal('C22'); // C22:? 
			const clientBankAccount = getVal('C23');

            // Skip if critical info missing (optional, per user "lenient" request we continue)
            if (!invoiceNumber) {
                results.push({ file: file.name, status: 'error', message: 'Missing invoice number' });
                continue;
            }

            // 3. Find or Create Client
            let clientId: number;
            let existingClient;

            if (clientRegNo) {
                // Try finding by Reg No first
                existingClient = await db.query.client.findFirst({
                    where: eq(client.registrationNumber, clientRegNo)
                });
            }

            if (!existingClient && clientName) {
                // Try finding by Name if not found by reg no
                existingClient = await db.query.client.findFirst({
                     where: ilike(client.name, clientName)
                });
            }

            if (existingClient) {
                clientId = existingClient.id;
            } else {
                // Create new client
                const [newClient] = await db.insert(client).values({
                    name: clientName || 'Unknown Client',
                    registrationNumber: clientRegNo || null,
                    vatNumber: clientVatNo || null,
                    address: clientAddress || null,
                    bankName: clientBankName || null,
                    bankCode: clientBankCode || null,
                    bankAccount: clientBankAccount || null,
                    type: 'BTC',
                    email: 'addanemail@orphone.com'
                }).returning({ id: client.id });
                clientId = newClient.id;
            }

            // 4. Create Invoice
            // Check if invoice exists
            const existingInvoice = await db.query.invoice.findFirst({
                where: eq(invoice.invoiceNumber, invoiceNumber)
            });

            if (existingInvoice) {
                 results.push({ file: file.name, status: 'skipped', message: `Invoice ${invoiceNumber} already exists` });
                 continue;
            }
            
            // Parse totals if possible, or calculate from items later. 
            // User said: "from that row come the 3 total values, all in g collumn."
            // We'll iterate items first to find the end.

            const items = [];
            let currentRow = 29; // 1-based index in User prompt, but xlsx uses A1 notation. 
            // Excel row 29 is index 28 if 0-based, or just constructing cell addresses like "A29"
            
            let totalRowIndex = -1;

            while (true) {
                const rowNum = currentRow;
                
                // 1. Check for "Total" marker in columns A-F
                let isTotalRow = false;
                const colsToCheck = ['A', 'B', 'C', 'D', 'E', 'F'];
                for (const col of colsToCheck) {
                    const val = getVal(`${col}${rowNum}`);
                    if (val && (val.toLowerCase().includes('total') || val.toLowerCase().includes('kopā'))) {
                        isTotalRow = true;
                        break;
                    }
                }

                if (isTotalRow) {
                    totalRowIndex = rowNum;
                    break;
                }
                
                // 2. Extract item data
                const desc = getVal(`B${rowNum}`);
                // Only treat as item if there is a description
                if (desc) {
                    items.push({
                        description: desc,
                        unit: getVal(`D${rowNum}`),
                        quantity: parseFloat(getVal(`E${rowNum}`)) || 1,
                        price: parseFloat(getVal(`F${rowNum}`)) || 0,
                        total: parseFloat(getVal(`G${rowNum}`)) || 0
                    });
                }
                
                // Continue scanning even if empty (skip empty rows)
                currentRow++;
                if (currentRow > 150) break; // Safety break (reasonable limit for invoice items)
            }

            // Extract Totals
            // "from that row come the 3 total values, all in g collumn."
            // Assuming: Subtotal, VAT, Grand Total
            let subtotal = 0;
            let vatAmount = 0;
            let grandTotal = 0;

            if (totalRowIndex !== -1) {
                 subtotal = parseFloat(getVal(`G${totalRowIndex}`)) || 0;
                 vatAmount = parseFloat(getVal(`G${totalRowIndex + 1}`)) || 0;
                 grandTotal = parseFloat(getVal(`G${totalRowIndex + 2}`)) || 0;
            } else {
                // Calculate from items if we couldn't find totals row
                 subtotal = items.reduce((acc, item) => acc + item.total, 0);
                 // Estimate VAT? Better to leave 0 or calc 21%
                 vatAmount = subtotal * 0.21; 
                 grandTotal = subtotal + vatAmount;
            }

            // Insert Invoice
            const [newInvoice] = await db.insert(invoice).values({
                invoiceNumber: invoiceNumber,
                issueDate: issueDate || new Date().toISOString(), // Fallback? should probably strict check date
                dueDate: dueDate || new Date().toISOString(),
                clientId: clientId,
                status: 'paid', // Imported as draft? or sent? 
                // "old invoices that are still in xlsx" -> probably 'sent' or 'paid' actually.
                // But let's safe default to 'draft' or maybe 'sent'. User didn't specify. 'draft' is safest.
                subtotal: Math.round(subtotal * 100), // Cents
                taxAmount: Math.round(vatAmount * 100),
                total: Math.round(grandTotal * 100),
                currency: 'EUR',
            }).returning({ id: invoice.id });

            // Update Client Total Ordered
            await db.update(client)
                .set({ 
                    totalOrdered: sql`COALESCE(${client.totalOrdered}, 0) + ${Math.round(grandTotal * 100)}` 
                })
                .where(eq(client.id, clientId));

            // Insert Items
            for (const item of items) {
                await db.insert(invoiceItems).values({
                    invoiceId: newInvoice.id,
                    description: item.description,
                    unit: item.unit,
                    quantity: item.quantity,
                    price: Math.round(item.price * 100),
                    total: Math.round(item.total * 100)
                });
            }

            results.push({ file: file.name, status: 'success', id: newInvoice.id });
		}
        
        return json({ results });

	} catch (err) {
		console.error('Import error:', err);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};
