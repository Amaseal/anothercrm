import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

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

const client = postgres(databaseUrl);
const db = drizzle(client, { schema });

async function main() {
    const groups = await db.query.tabGroupTranslation.findMany({
        where: eq(schema.tabGroupTranslation.name, 'Legacy Import')
    });
    console.log(`Found ${groups.length} groups.`);

    const activity = await db.execute(sql`
        SELECT pid, state, query, wait_event_type, wait_event 
        FROM pg_stat_activity 
        WHERE pid != pg_backend_pid();
    `);

    for (const row of activity) {
        // truncate query
        const q = String(row.query).substring(0, 50);
        console.log(`PID: ${row.pid} | State: ${row.state} | Wait: ${row.wait_event} | Query: ${q}`);
    }

    process.exit(0);
}

main();
