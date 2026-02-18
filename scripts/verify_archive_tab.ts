
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
    console.log('Verifying import segregation...');

    // Find task "Runcis" (Done in CSV, should be in Legacy Archive)
    const task = await db.query.task.findFirst({
        where: eq(schema.task.title, 'Runcis'),
        with: {
            tab: {
                with: {
                    translations: true
                }
            }
        }
    });

    if (task) {
        console.log(`Task found: ${task.title}`);
        console.log(`isDone: ${task.isDone}`);
        const tabName = task.tab?.translations.find(t => t.language === 'lv')?.name;
        console.log(`Tab Name: ${tabName}`);

        if (task.isDone === true && tabName === 'Legacy Archive') {
            console.log('SUCCESS: Task is done and in "Legacy Archive" tab!');
        } else {
            console.log(`FAILURE: Expected isDone=true, Tab="Legacy Archive". Got isDone=${task.isDone}, Tab="${tabName}"`);
        }
    } else {
        console.log('Task "Runcis" not found!');
    }

    process.exit(0);
}

verify();
