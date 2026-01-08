<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { page } from '$app/stores';
	let { items }: { items: { title: string; url: string; icon?: any }[] } = $props();
</script>

<Sidebar.Group class="mt-8">
	<Sidebar.GroupContent class="flex flex-col">
		<Sidebar.Menu class="flex flex-col gap-0">
			{#each items as item (item.title)}
				<Sidebar.MenuItem class="gap-0">
					<Sidebar.MenuButton tooltipContent={item.title}>
						{#snippet child({ props })}
							<a
								href={item.url}
								{...props}
								class="{$page.url.pathname === item.url
									? 'bg-accent font-bold text-accent-foreground'
									: ''} flex items-end gap-4 rounded-sm p-3 hover:bg-accent hover:text-accent-foreground"
							>
								{#if item.icon}
									<item.icon class="h-5 w-5" />
								{/if}
								<span>{item.title}</span>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			{/each}
		</Sidebar.Menu>
	</Sidebar.GroupContent>
</Sidebar.Group>
