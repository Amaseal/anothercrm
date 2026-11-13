# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Documents editor

The `/dokumenti` route embeds `ranuts/document` from this same app. Run `pnpm office:prepare` before local development or a non-Docker build; Docker prepares the pinned static editor bundle automatically. No separate editor service or hostname is needed. See [docs/office-editor.md](docs/office-editor.md).

## Production size-list parsing

Staff can use **Generate size list** on task pages: select a source, click **Generate**, then see the automatically saved draft in a scrollable preview modal with **Edit**. Standard tables parse locally; other inputs disclose paid Gemini use beside Generate. No source-preview gate, approval checkbox or separate Save step is required. Configure the shared Gemini key/model in **Settings → Gemini settings**; changes apply without restarting the server, and no paid calls run on Save, model refresh, source selection or preview. Apply the production/Gemini settings migrations before using task workbooks. See [docs/production-parsing.md](docs/production-parsing.md) for setup, supported formats, cost/privacy limits and verification.

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
