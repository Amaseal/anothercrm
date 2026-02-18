import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { client } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const data = await request.json();
        const {
            name,
            email,
            phone,
            address,
            type,
            registrationNumber,
            vatNumber,
            bankName,
            bankCode,
            bankAccount,
            description,
            sportType
        } = data;

        // Validation
        if (!name) {
            return json({ error: 'Name is required' }, { status: 400 });
        }
        if (!email && !phone) {
            return json({ error: 'Email or Phone is required' }, { status: 400 });
        }

        // Insert
        const [newClient] = await db
            .insert(client)
            .values({
                name,
                email,
                phone,
                address,
                type: type || 'BTC',
                registrationNumber,
                vatNumber,
                bankName,
                bankCode,
                bankAccount,
                description,
                sportType
            })
            .returning();

        return json(newClient);
    } catch (error) {
        console.error('Error creating client:', error);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};
