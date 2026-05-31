import { sql } from 'drizzle-orm';
import type { AnyColumn } from 'drizzle-orm';
import { normalizeLatvianText } from '$lib/utilities';

// Single canonical normalizer — delegates to the shared utility so both code paths stay in sync
export const normalizeString = normalizeLatvianText;

export const ilikeNormalize = (column: AnyColumn, searchTerm: string) => {
    const normalizedSearch = `%${normalizeString(searchTerm)}%`;
    return sql`translate(lower(${column}), 'āčēģīķļņšūž', 'acegiklnsuz') ILIKE ${normalizedSearch}`;
};
