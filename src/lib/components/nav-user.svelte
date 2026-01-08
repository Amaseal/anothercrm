<script lang="ts">
	import BadgeCheckIcon from '@lucide/svelte/icons/badge-check';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import LanguagesIcon from '@lucide/svelte/icons/languages';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MonitorIcon from '@lucide/svelte/icons/monitor';
	import CheckIcon from '@lucide/svelte/icons/check';
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { useSidebar } from '$lib/components/ui/sidebar/index.js';
	import { setLocale, getLocale } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages';
	import { mode, setMode } from 'mode-watcher';

	let { user }: { user: { name: string; email: string; type: string } } = $props();
	const sidebar = useSidebar();
</script>

<Sidebar.Menu>
	<Sidebar.MenuItem>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Sidebar.MenuButton
						{...props}
						size="lg"
						class="cursor-pointer hover:bg-secondary hover:text-secondary-foreground data-[state=open]:bg-secondary data-[state=open]:text-secondary-foreground"
					>
						<Avatar.Root class="size-8 rounded-lg">
							<Avatar.Fallback class="rounded-lg">
								{user.name.slice(0, 2).toUpperCase()}
							</Avatar.Fallback>
						</Avatar.Root>
						<div class="grid flex-1 text-left text-sm leading-tight">
							<span class="truncate font-medium">{user.name}</span>
							<span class="truncate text-xs text-muted-foreground">{user.email}</span>
						</div>
					</Sidebar.MenuButton>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content
				class="w-56"
				side={sidebar.isMobile ? 'bottom' : 'right'}
				align="end"
				sideOffset={4}
			>
				<DropdownMenu.Label class="font-normal">
					<div class="flex flex-col space-y-1">
						<p class="text-sm leading-none font-medium">{user.name}</p>
						<p class="text-xs leading-none text-muted-foreground">{user.email}</p>
					</div>
				</DropdownMenu.Label>
				<DropdownMenu.Separator />

				<!-- Theme Submenu with checkmarks -->
				<DropdownMenu.Sub>
					<DropdownMenu.SubTrigger>
						{#if mode.current === 'light'}
							<SunIcon class="mr-2 h-4 w-4" />
						{:else if mode.current === 'dark'}
							<MoonIcon class="mr-2 h-4 w-4" />
						{:else}
							<MonitorIcon class="mr-2 h-4 w-4" />
						{/if}
						<span>{m['components.user.theme']()}</span>
					</DropdownMenu.SubTrigger>
					<DropdownMenu.SubContent>
						<DropdownMenu.Item onclick={() => setMode('light')}>
							<SunIcon class="mr-2 h-4 w-4" />
							<span>{m['components.user.light']()}</span>
							{#if mode.current === 'light'}
								<CheckIcon class="ml-auto h-4 w-4" />
							{/if}
						</DropdownMenu.Item>
						<DropdownMenu.Item onclick={() => setMode('dark')}>
							<MoonIcon class="mr-2 h-4 w-4" />
							<span>{m['components.user.dark']()}</span>
							{#if mode.current === 'dark'}
								<CheckIcon class="ml-auto h-4 w-4" />
							{/if}
						</DropdownMenu.Item>
					</DropdownMenu.SubContent>
				</DropdownMenu.Sub>

				<!-- Language Submenu with checkmarks -->
				<DropdownMenu.Sub>
					<DropdownMenu.SubTrigger>
						<LanguagesIcon class="mr-2 h-4 w-4" />
						<span>{m['components.user.language']()}</span>
					</DropdownMenu.SubTrigger>
					<DropdownMenu.SubContent>
						<DropdownMenu.Item onclick={() => setLocale('en')}>
							<span>English</span>
							{#if getLocale() === 'en'}
								<CheckIcon class="ml-auto h-4 w-4" />
							{/if}
						</DropdownMenu.Item>
						<DropdownMenu.Item onclick={() => setLocale('lv')}>
							<span>Latviešu</span>
							{#if getLocale() === 'lv'}
								<CheckIcon class="ml-auto h-4 w-4" />
							{/if}
						</DropdownMenu.Item>
					</DropdownMenu.SubContent>
				</DropdownMenu.Sub>

				<DropdownMenu.Separator />

				<!-- Settings & Account -->
				<DropdownMenu.Item>
					<a href="/settings" class="flex items-center gap-2">
						<SettingsIcon class="mr-2 h-4 w-4" />
						<span>{m['components.user.settings']()}</span></a
					>
				</DropdownMenu.Item>

				<DropdownMenu.Separator />

				<!-- Logout -->
				<DropdownMenu.Item>
					<form action="/logout" method="post" class="w-full">
						<button type="submit" class="flex w-full items-center">
							<LogOutIcon class="mr-2 h-4 w-4" />
							<span>{m['components.user.logout']()}</span>
						</button>
					</form>
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</Sidebar.MenuItem>
</Sidebar.Menu>
