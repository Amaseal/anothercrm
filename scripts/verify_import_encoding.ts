import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/lib/server/db/schema';
import { ilike, or } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

// Load env
const envPath = path.resolve('.env');
let databaseUrl = process.env.DATABASE_URL;

if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    for (const line of envConfig.split('\n')) {
        const [key, value] = line.split('=');
        if (key && value && key.trim() === 'DATABASE_URL') {
            databaseUrl = value.trim().replace(/"/g, '');
        }
    }
}

if (!databaseUrl) {
    console.error('DATABASE_URL not found in .env');
    process.exit(1);
}

const client = postgres(databaseUrl);
const db = drizzle(client, { schema });

async function main() {
    console.log('Verifying encoding...');

    // Check Client: 'Mārtiņš Ošenieks Moway'
    const client = await db.query.client.findFirst({
        where: ilike(schema.client.name, '%Mārtiņš%')
    });
    console.log('Client Search "Mārtiņš":', client ? `FOUND: ${client.name}` : 'NOT FOUND');

    // Check Material: 'CH softshell ar mīksto iekšu - nestaipīgs'
    const material = await db.query.material.findFirst({
        where: ilike(schema.material.title, '%mīksto%')
    });
    console.log('Material Search "mīksto":', material ? `FOUND: ${material.title}` : 'NOT FOUND');

    process.exit(0);
}

main();
