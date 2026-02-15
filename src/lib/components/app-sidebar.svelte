<script lang="ts">
	import BrickWall from '@lucide/svelte/icons/brick-wall';
	import SquareKanban from '@lucide/svelte/icons/square-kanban';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import User from '@lucide/svelte/icons/user';
	import Blocks from '@lucide/svelte/icons/blocks';
	import Check from '@lucide/svelte/icons/check';
	import NavMain from './nav-main.svelte';
	import * as m from '$lib/paraglide/messages';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import Save from '@lucide/svelte/icons/save';
	import FileText from '@lucide/svelte/icons/file-text';
	import Logo from './logo.svelte';
	import NavUser from './nav-user.svelte';
	import { isClient } from '$lib/stores/user';

	const { data, ...restProps } = $props();

	const items = $derived(
		[
			{
				title: m['menu.dashboard'](),
				url: '/',
				icon: LayoutDashboard
			},
			{
				title: m['menu.projects'](),
				url: '/projekti',
				icon: SquareKanban
			},
			{
				title: m['menu.done'](),
				url: '/pabeigtie',
				icon: Check
			},
			{
				title: m['menu.clients'](),
				url: '/klienti',
				icon: User
			},
			{
				title: m['menu.fabrics'](),
				url: '/audumi',
				icon: BrickWall
			},
			{
				title: m['menu.products'](),
				url: '/produkti',
				icon: Blocks
			},
			{
				title: m['menu.files'](),
				url: '/faili',
				icon: Save
			},
			{
				title: m['menu.invoices'](),
				url: '/rekini',
				icon: FileText
			}
		].filter((item) => {
			if ($isClient) {
				return !['/klienti', '/audumi', '/produkti', '/faili'].includes(item.url);
			}
			return true;
		})
	);
</script>

<Sidebar.Root collapsible="offcanvas" {...restProps} variant="inset">
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<div class="mb-2 flex items-center gap-2 p-2">
					<Logo></Logo>
					<span class="mt-2 text-base font-bold">Fastbreak CRM</span>
				</div>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>
	<Sidebar.Content>
		<NavMain {items} />
	</Sidebar.Content>
	<Sidebar.Footer>
		<Sidebar.MenuItem>
			<NavUser user={data.user} />
		</Sidebar.MenuItem>
	</Sidebar.Footer>
</Sidebar.Root>
