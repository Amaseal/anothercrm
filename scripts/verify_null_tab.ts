
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/lib/server/db/schema';
import { eq, isNull } from 'drizzle-orm';
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

    // Find task "Runcis" (Done in CSV, id=1, tabId=1)
    const task = await db.query.task.findFirst({
        where: eq(schema.task.title, 'Runcis')
    });

    if (task) {
        console.log(`Task found: ${task.title}`);
        console.log(`isDone: ${task.isDone}`);
        console.log(`tabId: ${task.tabId}`);

        if (task.isDone === true && task.tabId === null) {
            console.log('SUCCESS: Task is done and tabId is null!');
        } else {
            console.log(`FAILURE: Expected isDone=true, tabId=null. Got isDone=${task.isDone}, tabId=${task.tabId}`);
        }
    } else {
        console.log('Task "Runcis" not found!');
    }

    process.exit(0);
}

verify();
