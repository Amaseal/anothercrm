import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/lib/server/db/schema';
import { isNotNull, sql } from 'drizzle-orm';
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

const client = postgres(databaseUrl!);
const db = drizzle(client, { schema });

async function main() {
    console.log('Verifying Task EndDates...');

    // Fetch all tasks with non-null endDate
    const tasks = await db.query.task.findMany({
        columns: {
            id: true,
            title: true,
            endDate: true
        }
    });

    let validCount = 0;
    let nullCount = 0;
    let invalidCount = 0;

    for (const t of tasks) {
        if (!t.endDate) {
            nullCount++;
            continue;
        }

        // Try to parse
        const d = new Date(t.endDate);
        if (isNaN(d.getTime())) {
            console.error(`INVALID END DATE: Task ID ${t.id} ("${t.title}") has endDate: "${t.endDate}"`);
            invalidCount++;
        } else {
            // Also check if it looks like an ISO string
            if (!t.endDate.includes('T') && !t.endDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                // It might be valid date but not ISO format we wanted?
                // But schema is text, so we put ISO string in it.
                // console.log(`Non-standard format: ${t.endDate}`);
            }
            validCount++;
        }
    }

    console.log(`Summary:`);
    console.log(`  Total Tasks: ${tasks.length}`);
    console.log(`  Valid Dates: ${validCount}`);
    console.log(`  Null Dates:  ${nullCount}`);
    console.log(`  Invalid Dates: ${invalidCount}`);

    if (invalidCount === 0) {
        console.log('SUCCESS: All end dates are valid or null.');
    } else {
        console.log('FAILURE: Found invalid end dates.');
        process.exit(1);
    }
    process.exit(0);
}

main();
