
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/lib/server/db/schema';
import { eq } from 'drizzle-orm';
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

async function verify() {
    console.log('Verifying import...');

    // Find task with title "Runcis" (from CSV line 2, expected endDate 2025-06-26)
    const task = await db.query.task.findFirst({
        where: eq(schema.task.title, 'Runcis')
    });

    if (task) {
        console.log(`Task found: ${task.title}`);
        console.log(`endDate: ${task.endDate}`);

        if (task.endDate === '2025-06-26') {
            console.log('SUCCESS: endDate is correct!');
        } else {
            console.log(`FAILURE: endDate is incorrect. Expected 2025-06-26, got ${task.endDate}`);
        }
    } else {
        console.log('Task "Runcis" not found!');
    }

    process.exit(0);
}

verify();
