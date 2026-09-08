# Repository Guidelines

## Project Structure & Module Organization

This is a SvelteKit 5 CRM written in TypeScript. Page, layout, form, and API routes live in `src/routes/`; authenticated screens are grouped under `(app)`, while authentication and printable forms are under `(forms)`. Put reusable UI in `src/lib/components`, browser state and helpers in `src/lib/stores` and `src/lib`, and server-only code in `src/lib/server`. The Drizzle schema is `src/lib/server/db/schema.ts`; generated SQL migrations belong in `drizzle/`. Translation sources are in `messages/{en,lv}`, and static assets belong in `static/`. Treat `src/lib/paraglide`, `build/`, uploads, and other generated output as non-source files.

## Build, Test, and Development Commands

- `pnpm install` installs the locked dependencies.
- `pnpm dev` starts the local Vite development server.
- `pnpm check` runs Svelte and TypeScript diagnostics.
- `pnpm lint` checks Prettier formatting and ESLint rules.
- `pnpm format` rewrites files with Prettier.
- `pnpm build` creates the production Node build; `pnpm preview` serves it locally.
- `pnpm db:generate` creates a migration after schema changes; `pnpm db:migrate` applies migrations.

## Coding Style & Naming Conventions

Follow `.prettierrc`: tabs, single quotes, no trailing commas, and a 100-character print width. Keep TypeScript strict and use Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) for new components. Follow SvelteKit names such as `+page.svelte`, `+page.server.ts`, and `+server.ts`. Component filenames use lowercase kebab-case; exported TypeScript types use PascalCase. Reuse existing shadcn-svelte components and `$lib` imports.

## Testing Guidelines

No automated test suite or coverage threshold is configured. Before submitting, run `pnpm check`, `pnpm lint`, and `pnpm build`. Manually exercise affected routes, authentication/authorization paths, and database mutations. Include clear reproduction and verification steps in the pull request.

## Commit & Pull Request Guidelines

Recent commits use short, lowercase, topic-focused subjects such as `bugfixes` and `floats in invoices`; keep commits concise and scoped. Pull requests should explain the behavior change, link relevant issues, list manual checks, call out migrations or configuration changes, and include screenshots for visible UI changes.

## Security & Configuration

Never commit `.env`, credentials, customer exports, or uploaded files. Local database commands require `DATABASE_URL`. Generate and review migrations rather than using `pnpm db:push` in production. Do not add a Docker `HEALTHCHECK`; the documented production startup time can cause rolling deployments to fail.
