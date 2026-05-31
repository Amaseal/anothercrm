# Code Review — AnotherCRM

Date: 2026-05-31

> **Context:** Small internal app (~5 users). Already in production. Any fixes must be backward-compatible with existing data.

---

## Critical Security Issues

### 1. ✅ Unauthenticated API Routes — Fixed

**Files:** `src/routes/api/clients/+server.ts`, `src/routes/api/upload/+server.ts`, `src/routes/api/taskfiles/+server.ts`, `src/routes/api/remove/+server.ts`

**Note:** `src/routes/api/invoices/[id]/+server.ts` is **intentionally public** — invoice PDF links are shared directly with clients, so no auth is needed there.

The remaining routes have zero authentication. Any unauthenticated user can:

- Create clients
- Upload arbitrary files to the server
- Delete files from the server

**Fix:** Add an auth check at the top of each of those `RequestHandler`s:

```ts
if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });
```

---

### 2. ✅ Path Traversal in `/api/remove` — Fixed

**File:** `src/routes/api/remove/+server.ts`

The file path sanitization only strips a leading `/uploads/` prefix and leading slashes. It does **not** strip `../` sequences. An attacker can send a payload like `../../../etc/passwd` to delete arbitrary files on the server.

**Fix:** After stripping the prefix, validate that the resolved path is still inside the uploads directory:

```ts
import { resolve } from 'path';
const resolved = resolve(uploadDir, sanitizedFileName);
if (!resolved.startsWith(resolve(uploadDir))) {
	return new Response(JSON.stringify({ error: 'Invalid path' }), { status: 400 });
}
```

---

### 3. ✅ Password Reset Trusts Client-Supplied `user_id` — Fixed

**File:** `src/routes/(forms)/reset-password/+page.server.ts`

The reset action reads `user_id` directly from the POST form body and uses it to update the password — without verifying the reset token again in the action. An attacker who knows any user's ID can bypass the token entirely.

**Fix:** Re-validate the token in the action and derive `userId` solely from the token record, never from user input.

---

### 4. Nextcloud Password Stored in Plaintext

**File:** `src/lib/server/db/schema.ts` (`settings.nextcloud_password`)

The Nextcloud integration password is stored unencrypted in the database. Even the schema comment says _"should be encrypted!"_.

**Risk assessment for this specific app:** Low-medium. The Nextcloud account is only used to send task reminders via Nextcloud Talk — no confidential data is stored there. If someone gained DB access and extracted the password, they could post messages on Talk on your behalf. They could not access financial data, client PII, or invoices through Nextcloud alone. That said, DB access itself would already be a much larger breach (all invoices, client data, etc. live there unencrypted by nature of a relational DB).

**Verdict:** Not urgent given the use case. Worth adding a note to the schema and revisiting if Nextcloud usage expands.

**Fix (if desired):** Encrypt the value with AES-256 (using a server-side secret from env) before writing to the DB, and decrypt on read.

---

## Bugs

### 5. ✅ Typo in Forgot-Password Redirect — Fixed

**File:** `src/routes/(forms)/forgot-password/+page.server.ts`

```ts
return redirect(302, '/login?restet=sent'); // "restet" should be "reset"
```

---

### 6. ✅ `fail()` Called Inside a `load` Function — Fixed

**File:** `src/routes/(forms)/reset-password/+page.server.ts`

`fail()` is only valid inside form **actions**. Calling it inside `PageServerLoad` returns an `ActionFailure` object to the page instead of an error response, causing a runtime error.

**Fix:** Replace with `error()` from `@sveltejs/kit`:

```ts
import { error } from '@sveltejs/kit';
// ...
throw error(400, 'Invalid or expired token');
```

---

### 7. ✅ Multi-Step DB Operations Without Transactions — Fixed

**Files:** `src/routes/(app)/rekini/pievienot/+page.server.ts`, `src/routes/(app)/rekini/labot/[id]/+page.server.ts`

Invoice creation and editing perform multiple sequential DB operations (insert invoice → insert items → update client totalOrdered → update task) with no wrapping transaction. If any step fails mid-way, the database is left in an inconsistent state.

**Fix:** Wrap all related operations in a single transaction:

```ts
await db.transaction(async (tx) => {
	// all related inserts/updates here
});
```

---

### 8. ✅ `client.totalOrdered` Is an Unreliable Denormalized Field — Fixed

**File:** `src/lib/server/db/schema.ts`, all invoice CRUD server files

`totalOrdered` is manually incremented/decremented on each invoice create/edit/delete. Issues:

- Race conditions under concurrent requests
- The client list page already **ignores it** and recomputes revenue live from joins
- Not initialized when a client is created inline from the invoice form

**Fix:** Either remove the column entirely (live computation already exists), or replace all manual mutations with a single recalculation query: `UPDATE clients SET total_ordered = (SELECT COALESCE(SUM(total), 0) FROM invoices WHERE client_id = $1)`.

---

### 9. ~~Invoice Number Generation Is Not Atomic~~

**Dismissed.** The number format includes the date + user initial, making same-second collisions between the same user practically impossible for a 5-person team. The existing 3-attempt retry loop is sufficient.

---

## Design & Code Quality

### 10. ✅ Duplicate Latvian Text Normalization — Fixed

**Files:** `src/lib/utilities.ts` (`normalizeLatvianText`), `src/lib/server/dbUtils.ts` (`normalizeString`)

Both functions do the same Latvian character replacement independently. Neither imports from the other, so changes to one don't reflect in the other.

**Fix:** Move the normalization logic to one place and import it where needed.

---

### 11. ✅ Redundant Auth Guard in Rekini Layout — Fixed

**File:** `src/routes/(app)/rekini/+layout.server.ts`

This layout manually checks `if (!locals.user) throw redirect(302, '/login')`. The parent `(app)/+layout.server.ts` already performs this check for every route under `(app)/`. The child check is dead code.

---

### 12. ✅ Inefficient Two-Query Search — Fixed

**File:** `src/routes/(app)/rekini/+layout.server.ts`

When a search term is present, the code first runs a query to find matching invoice IDs, then uses `inArray(invoice.id, matchedIds)` in a second query. This is two round-trips to the database for what could be a single query with a join or subquery condition.

---

### 13. ✅ `inviteCodes.expiresAt` Stored as `text` — Fixed

**File:** `src/lib/server/db/schema.ts`

`inviteCodes.expiresAt` is `text('expires_at')` while `passwordResetToken.expiresAt` correctly uses `timestamp`. Text dates can't be compared, sorted, or indexed reliably at the DB level.

**Fix:** Change to `timestamp('expires_at', { withTimezone: true, mode: 'date' })` and run a migration.

---

### 14. ✅ Pervasive Use of `any` in Invoice Code — Fixed

**Files:** `src/routes/(app)/rekini/pievienot/+page.server.ts`, `src/routes/(app)/rekini/labot/[id]/+page.server.ts`

Items are typed as `any[]` and each item as `any` throughout. The item shape is well-known — define an interface:

```ts
interface InvoiceItemInput {
	description: string;
	unit: string;
	quantity: number;
	price: number;
	discountType: 'fixed' | 'percent';
	discountValue: number;
	section?: string;
}
```

---

### 15. ~~Filter Cookies Always Set with `secure: false`~~

**Dismissed.** These cookies only store UI state (search terms, pagination). There is no security risk in them being sent over HTTP. The `secure: false` is intentional.

---

### 16. ~~Inconsistent SQL Table Naming~~

**Dismissed.** `taskMaterials` and `taskProducts` use camelCase while other tables use `snake_case`. Minor cosmetic inconsistency, not worth a migration on a live database.

---

### 17. ~~No Password Length/Complexity Validation~~

**Dismissed.** Internal app with a known ~5-person user base. Registration requires an invite code, so random internet users can't self-register. A simple minimum is nice-to-have but not a priority.

---

### 18. ✅ Dates Stored as `text` in Task Table — Fixed

**File:** `src/lib/server/db/schema.ts` (`task.endDate`)

`task.endDate` is `text('end_date')`. Text dates can't be used for reliable DB-level filtering, sorting, or range queries.

**Fix:** Change to a proper `date` or `timestamp` column type.

---

## Performance Issues

### P1. ✅ Dashboard fires ~15+ sequential DB queries on every load — Fixed

**File:** `src/routes/(app)/+page.server.ts`

The dashboard page runs approximately 15 separate database queries to build one page: topManagers, topResponsiblePersons, activeProjectsCount, activeTasksCount, totalTasksSnapshot, urgentTasks, bestClients, monthlyProfitsFromTasks, monthlyProfitsFromStandaloneInvoices, monthlyTaskCounts, currentMonthTasksProfit, currentMonthStandaloneInvoices, previousMonthTasksProfit, previousMonthStandaloneInvoices, tabGroupsStatsData, allTabsForSelect, selectedTabTasksData — and many of them run **sequentially** rather than in parallel.

**Fixes:**

- Wrap all independent queries in a single `Promise.all([...])` so they run concurrently. Currently only a few pairs are parallelized.
- Combine `monthlyProfitsFromTasks` + `monthlyProfitsFromStandaloneInvoices` + `monthlyTaskCounts` into one `UNION ALL` query with a `TO_CHAR` group — eliminates 2 round trips.
- Combine `currentMonthTasksProfit` + `currentMonthStandaloneInvoices` + `previousMonthTasksProfit` + `previousMonthStandaloneInvoices` into one query using `FILTER (WHERE ...)` conditional aggregation — eliminates 3 round trips.

---

### P2. ✅ Task view/edit loads full tables as dropdown data — Fixed

**Files:** `src/routes/(app)/projekti/skatit/[id]/+page.server.ts`, `src/routes/(app)/projekti/labot/[id]/+page.server.ts`, `src/routes/(app)/projekti/pievienot/+page.server.ts`

Every time a task is opened or created, the server fetches:

- All clients (`client.findMany()` — no limit, no column restriction)
- All materials (`material.findMany()` — no limit)
- All products with translations and client prices

These are full table scans used only to populate dropdowns. As the number of clients, materials, and products grows, these will become noticeably slow.

**Fix:** Restrict columns to only what the dropdowns need. For clients and users: `columns: { id: true, name: true }`. For materials: `columns: { id: true, title: true, article: true }`. Products need more fields but `clientPrices` can be restricted to the current client only rather than fetching all prices for all clients.

Additionally, the 4 queries in `skatit` run **sequentially** one by one rather than in parallel. Wrap them in `Promise.all`.

---

### P3. ✅ SSE endpoint queries the DB on every task event for each client user — Fixed

**File:** `src/routes/api/events/+server.ts`

For client-type users, every single task event (create/update/delete) triggers a DB query to fetch the task's current assignees (`db.query.taskAssignee.findMany()`). With multiple client users connected via SSE and frequent task updates, this multiplies into N queries per event per connected client.

**Fix:** Emit the assignee list as part of the event payload when the task event is fired (from the mutation side), so the SSE handler can filter without hitting the DB.

---

### P4. ✅ `invalidateAll()` on every SSE event reloads the entire board — Fixed

**File:** `src/routes/(app)/projekti/+layout.svelte`

When any task changes, the layout calls `invalidateAll()`, which re-runs the full `getProjectBoardData` query — fetching all tasks, all tab groups, all translations, and re-doing all visibility logic — for every connected user. For a team actively working, this means constant full reloads.

**Fix (ideal):** Update the in-memory task list directly from the event payload instead of doing a full reload. The event already contains the task data.  
**Fix (simpler):** Use `invalidate('data:tasks')` with a scoped dependency key instead of `invalidateAll()`, so only task-related data reloads rather than the entire page.

---

### P5. ✅ Missing database indexes on frequently queried columns — Fixed

**File:** `src/lib/server/db/schema.ts`

The schema defines no explicit indexes beyond primary keys and unique constraints. The following columns are used in `WHERE`, `JOIN ON`, and `ORDER BY` clauses across almost every page:

- `tasks.client_id` — filtered/joined on client detail and board pages
- `tasks.is_done` — filtered on nearly every task query
- `tasks.tab_id` — joined on board to distribute tasks into columns
- `tasks.end_date` — sorted on board and dashboard urgent tasks
- `tasks.created_at` — filtered in monthly range queries and sorted on dashboard
- `invoices.client_id` — joined on client revenue queries
- `invoices.task_id` — joined on invoice-task revenue calculation
- `task_assignees.user_id` — used in EXISTS subqueries for visibility rules

Without indexes, PostgreSQL falls back to sequential scans on these columns. For a small dataset now it may not matter, but adding indexes is low risk and will make a measurable difference as data grows.

**Fix:** Add composite and single-column indexes in the schema:

```ts
// Example additions (create matching migration)
import { index } from 'drizzle-orm/pg-core';

export const task = pgTable('tasks', { ... }, (table) => [
    index('tasks_client_id_idx').on(table.clientId),
    index('tasks_is_done_idx').on(table.isDone),
    index('tasks_tab_id_idx').on(table.tabId),
    index('tasks_end_date_idx').on(table.endDate),
    index('tasks_created_at_idx').on(table.created_at),
]);
```

---

### P6. ✅ Task history fetched with full user object — Fixed

**Files:** `src/routes/(app)/projekti/skatit/[id]/+page.server.ts`, `src/routes/(app)/projekti/labot/[id]/+page.server.ts`

The task history relation is loaded with `with: { user: true }`, which returns all user columns (id, email, password hash, name, type). Only `name` is ever displayed.

**Fix:**

```ts
history: {
    with: {
        user: { columns: { name: true } }
    },
    orderBy: (history, { desc }) => [desc(history.createdAt)]
}
```

---

### P7. ✅ `Intl.DateTimeFormat` re-created on every date format call in task cards — Fixed

**File:** `src/lib/components/product-card.svelte`

`formatDate` calls `new Date(date).toLocaleDateString('lv-LV')` for every card render. `toLocaleDateString` internally creates a temporary `Intl.DateTimeFormat` object each call. With a board of 100 tasks, this is 100 formatter instantiations per render pass.

The `currencyFormatter` constant already shows the correct pattern — reuse it for dates too:

```ts
const dateFormatter = new Intl.DateTimeFormat('lv-LV');
const formatDate = (date: Date | string | null) => {
	if (!date) return '';
	return dateFormatter.format(new Date(date));
};
```

---

### P8. ✅ No connection pool configuration on the Postgres client — Fixed

**File:** `src/lib/server/db/index.ts`

The postgres client is created with defaults: `postgres(env.DATABASE_URL)`. The default max connections in `postgres.js` is 10. No `idle_timeout`, `connect_timeout`, or `max` is configured. For a small internal app this is fine today, but under the SSE keep-alive connections + concurrent page loads, you may approach the limit sooner than expected.

**Fix (optional, low urgency):** Set explicit pool options:

```ts
const client = postgres(env.DATABASE_URL, {
	max: 10,
	idle_timeout: 20,
	connect_timeout: 10
});
```

---

## Priority Order

| Priority | Issue                                               | Status                         |
| -------- | --------------------------------------------------- | ------------------------------ |
| 🔴 1     | Unauthenticated API routes (clients/upload/remove)  | ✅ Fixed                       |
| 🔴 2     | Path traversal in `/api/remove`                     | ✅ Fixed                       |
| 🔴 3     | Password reset trusts client `user_id`              | ✅ Fixed                       |
| 🟡 4     | Nextcloud password in plaintext                     | Low risk, monitor              |
| 🟡 5     | Typo in forgot-password redirect                    | ✅ Fixed                       |
| 🟡 6     | `fail()` in `load` function                         | ✅ Fixed                       |
| 🟡 7     | Missing DB transactions on invoice save             | ✅ Fixed                       |
| 🟡 8     | Unreliable `totalOrdered` field                     | ✅ Fixed                       |
| ~~9~~    | ~~Non-atomic invoice number generation~~            | Dismissed                      |
| 🟢 10    | Duplicate text normalization                        | ✅ Fixed                       |
| 🟢 11    | Redundant auth guard                                | ✅ Fixed                       |
| 🟢 12    | Inefficient two-query search                        | ✅ Fixed                       |
| 🟢 13    | `inviteCodes.expiresAt` as text                     | ✅ Fixed (migration 0031)      |
| 🟢 14    | Pervasive `any` types in invoice code               | ✅ Fixed                       |
| ~~15~~   | ~~Filter cookies `secure: false`~~                  | Dismissed                      |
| ~~16~~   | ~~Inconsistent SQL table naming~~                   | Dismissed                      |
| ~~17~~   | ~~No password length validation~~                   | Dismissed                      |
| 🟢 18    | Task dates stored as `text`                         | ✅ Fixed (migration 0032)      |
| 🔴 P1    | Dashboard ~15 sequential DB queries                 | ✅ Fixed                       |
| 🔴 P2    | Task view loads full client/material/product tables | ✅ Fixed                       |
| 🟡 P3    | SSE queries DB on every event per client user       | ✅ Fixed                       |
| 🟡 P4    | `invalidateAll()` on every SSE event                | ✅ Fixed                       |
| 🟡 P5    | Missing DB indexes on key columns                   | ✅ Fixed (migration generated) |
| 🟢 P6    | History fetched with full user object               | ✅ Fixed                       |
| 🟢 P7    | `Intl.DateTimeFormat` recreated per card render     | ✅ Fixed                       |
| 🟢 P8    | No Postgres connection pool config                  | ✅ Fixed                       |
