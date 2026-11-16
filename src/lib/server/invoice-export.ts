import { eq, ne } from 'drizzle-orm';
import { invoice } from './db/schema';

export function invoiceExportFilter(type: string) {
	switch (type) {
		case 'all':
			return undefined;
		case 'invoice':
			return ne(invoice.documentType, 'proforma');
		case 'proforma':
			return eq(invoice.documentType, 'proforma');
		default:
			throw new Error('Invalid invoice export type');
	}
}
