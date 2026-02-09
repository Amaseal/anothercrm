<script lang="ts">
	import '../../app.css';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import background from '$lib/assets/background.svg';

	import { Toaster } from 'svelte-sonner';

	import { ModeWatcher } from 'mode-watcher';
	let { children, data } = $props();
</script>

<Toaster />
<ModeWatcher track={false} defaultMode="light" lightClassNames={['light']} />
<Sidebar.Provider
	style="--sidebar-width: calc(var(--spacing) * 54); --header-height: calc(var(--spacing) * 12); "
>
	<AppSidebar {data} />
	<Sidebar.Inset class="m-0 p-0">
		<div class="relative flex flex-1 flex-col">
			<div
				class=" @container/main relative z-10 m-0 flex flex-1 flex-col gap-2 rounded-md border bg-card p-4"
			>
				{@render children()}
			</div>
		</div></Sidebar.Inset
	>
</Sidebar.Provider>
