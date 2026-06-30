# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A CRM app for a sports embroidery company built with SvelteKit 5 and PostgreSQL. UI and routes are in **Latvian** (audumi = materials, klienti = clients, projekti = tasks/projects, rekini = invoices, pabeigtie = completed tasks, produkti = products). The app is live in production.

## Production Environment

- **Hosting**: Coolify (self-hosted PaaS), running as a Docker container
- **Database**: Separate PostgreSQL instance on the same Coolify server
- **Deployment**: Coolify performs rolling deploys when the repo is pushed. The Dockerfile is a multi-stage build (`node:22-alpine`). Do **not** add a `HEALTHCHECK` — it caused rollbacks because the app boots in ~35s which exceeded the check window.
- **File uploads**: Written to an `uploads/` directory on disk inside the container. Served via `/uploads/[...path]`.
- **No test suite** is configured.

## Commands

```bash
pnpm dev            # Start dev server
pnpm build          # Production build (runs vite build)
pnpm check          # svelte-check type checking
pnpm lint           # prettier --check + eslint
pnpm format         # prettier --write

pnpm db:generate    # Generate Drizzle migration from schema changes
pnpm db:migrate     # Apply migrations (use this in prod flow, not db:push)
pnpm db:studio      # Open Drizzle Studio
```

> **DB changes**: After editing `src/lib/server/db/schema.ts`, run `pnpm db:generate` to create a migration file, then `pnpm db:migrate` to apply it. Do **not** run `pnpm db:push` against production.

## Architecture

### Route groups

```
src/routes/
  (app)/        # Authenticated app — guarded by +layout.server.ts redirect
  (forms)/      # Login, register, forgot-password, invoice print
  api/          # JSON/SSE API endpoints
  uploads/      # Serves uploaded files from disk
```

### List pages pattern

Every list route (`klienti`, `audumi`, `produkti`, `rekini`, `pabeigtie`) uses a **layout-level** load:
- `+layout.server.ts` — handles filtering, sorting, pagination, and cookie persistence via `handleListParams()` from `src/lib/server/paramState.ts`
- `+layout.svelte` — renders the header (search, add button) and the table; child `+page.svelte` is usually empty or a modal overlay

`handleListParams` saves/restores URL search params to a cookie so filters survive navigation. Passing `?clear=true` wipes the cookie and redirects.

### Auth

Session-based, implemented following the **Lucia auth guide** (lucia-auth.com — Lucia is no longer a package, it's a reference implementation). Uses `@oslojs/crypto` and `@oslojs/encoding` for token hashing. Sessions last 30 days, renewed at 15 days. Token is SHA256-hashed before storage. Set in `src/lib/server/auth.ts`, attached to `event.locals` in `src/hooks.server.ts`.

`locals.user` shape: `{ id: string, email: string, name: string, type: 'admin' | 'client' }`.

Client-side role checks use derived Svelte stores: `import { isAdmin, isClient } from '$lib/stores/user'`.

### Database

Drizzle ORM + PostgreSQL. Schema at `src/lib/server/db/schema.ts`. All tables use `const db = import { db } from '$lib/server/db'`. 

Latvian text search is diacritic-insensitive — always use `ilikeNormalize(column, term)` from `src/lib/server/dbUtils.ts` instead of raw `ilike`.

### i18n

Paraglide JS with two locales: `en` (base) and `lv`. Source messages are JSON files in `messages/{en,lv}/*.json`. Paraglide compiles them to `src/lib/paraglide/messages/` on build.

Usage: `import * as m from '$lib/paraglide/messages'; m['key']()`. Locale is stored in a cookie (`PARAGLIDE_LOCALE`). Server-side: `getLocale()` from `$lib/paraglide/runtime`. Do **not** put changelog or one-off content in paraglide — use typed config files instead (see `src/lib/config/changelog.ts`).

### Real-time updates

`src/routes/api/events/+server.ts` exposes a Server-Sent Events stream. The `projekti` layout subscribes and calls `invalidate('app:tasks')` on task mutations. The emitter singleton lives in `src/lib/server/events.ts`.

### Task history

Call `recordHistory(taskId, userId, changeType, changes[], description)` from `src/lib/server/history.ts` after any mutation to a task. Clients see a filtered view (seamstress field hidden).

### File uploads

Helper functions in `src/lib/server/upload-storage.ts` (`ensureUploadsDir`, `getUploadPath`, `toUploadsUrl`, `makeTaskFileFilename`). Files are deleted when a task is marked complete.

### Changelog / "What's New" modal

Add a new entry to the **top** of the `CHANGELOG` array in `src/lib/config/changelog.ts` with a new `version` string (use date format `YYYY-MM-DD`). The modal will reappear for all users automatically. Seen state is tracked per-user in the `settings` table (`lastSeenChangelogVersion` column).

## Key UI patterns

- **Svelte 5 runes**: `$state`, `$derived`, `$effect`, `$props()`, `$bindable()` — no legacy `writable` stores in new code.
- **Component library**: **shadcn-svelte** — Tailwind-styled components in `src/lib/components/ui/`, backed by Bits UI primitives. Import as `import * as Dialog from '$lib/components/ui/dialog/index.js'`.
- **Icons**: `@lucide/svelte` — import individual icons: `import X from '@lucide/svelte/icons/x'`.
- **Tailwind**: v4 — configured via `@plugin` in CSS, no `tailwind.config.js`.
- **Search inputs**: Use `<SearchInput>` from `$lib/components/search-input.svelte` (includes clear button). Backed by a `debounce()` from `$lib/utilities` that has a `.cancel()` method.
- **Prices**: Stored as integer cents. `toCurrency(cents)` from `$lib/utilities` converts to display string.
