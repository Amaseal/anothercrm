import { sql } from 'drizzle-orm';
import type { AnyColumn } from 'drizzle-orm';

export const normalizeString = (term: string) => {
    if (!term) return term;
    return term
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
};

export const ilikeNormalize = (column: AnyColumn, searchTerm: string) => {
    const normalizedSearch = `%${normalizeString(searchTerm)}%`;
    return sql`translate(lower(${column}), 'āčēģīķļņšūž', 'acegiklnsuz') ILIKE ${normalizedSearch}`;
};
