<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import { Separator } from '$lib/components/ui/separator';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import Users from '@lucide/svelte/icons/users';
	import UserCheck from '@lucide/svelte/icons/user-check';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import DollarSign from '@lucide/svelte/icons/dollar-sign';
	import Clock from '@lucide/svelte/icons/clock';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import Folder from '@lucide/svelte/icons/folder';
	import Zap from '@lucide/svelte/icons/zap';
	import ListTodo from '@lucide/svelte/icons/list-todo';
	import { scaleLinear, scaleBand } from 'd3-scale';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import Filter from '@lucide/svelte/icons/filter';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';

	let { data } = $props();
	// Chart configuration
	const chartConfig = {
		profit: {
			label: 'Peļņa',
			color: '#db2777'
		}
	};
	// Toggle between showing profit (revenue - costs) or raw revenue
	// Driven by URL param + cookie on the server, reflected here as derived state
	const profitMode = $derived(data.profitMode);
	// Toggle between task prices only, invoice data only, or both merged (server-driven, cookie-persisted)
	const revenueSource = $derived(data.revenueSource);

	// Prepare chart data using $derived
	const chartData = $derived(
		data.chartData.map((item) => ({
			month: formatMonth(item.month),
			profit: Number(item.profit) / 100 || 0,
			revenue: Number(item.revenue) / 100 || 0,
			taskCount: Number(item.taskCount) || 0
		}))
	);
	// The value used in the earnings chart depending on current mode
	const currentMonthValue = $derived(
		profitMode === 'profit' ? data.currentMonthProfit : data.currentMonthRevenue
	);
	const currentMonthChange = $derived(
		profitMode === 'profit' ? data.profitChange : data.revenueChange
	);

	// Format month for display (helper functions omitted)
	function formatMonth(monthStr: string) {
		const [year, month] = monthStr.split('-');
		const date = new Date(parseInt(year), parseInt(month) - 1);
		return date.toLocaleDateString('lv-LV', { month: 'short', year: '2-digit' });
	}

	// Format currency
	function formatCurrency(amount: number) {
		let number = amount / 100;
		return new Intl.NumberFormat('lv-LV', {
			style: 'currency',
			currency: 'EUR'
		}).format(number);
	}

	// Format date
	function formatDate(dateStr: string) {
		const date = new Date(dateStr);
		return date.toLocaleDateString('lv-LV');
	}

	// Check if date is overdue
	function isOverdue(dateStr: string | null) {
		if (!dateStr) return false;
		const date = new Date(dateStr);
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		return date < today;
	}

	// Check if date is today
	function isToday(dateStr: string | null) {
		if (!dateStr) return false;
		const date = new Date(dateStr);
		const today = new Date();
		return date.toDateString() === today.toDateString();
	}

	// Check if date is tomorrow
	function isTomorrow(dateStr: string | null) {
		if (!dateStr) return false;
		const date = new Date(dateStr);
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		return date.toDateString() === tomorrow.toDateString();
	}

	function getInitials(name: string) {
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase()
			.substring(0, 2);
	}
	function exportToCSV() {
		const label = profitMode === 'profit' ? 'Profit' : 'Revenue';
		const headers = ['Month', label];
		const rows = chartData.map((d) => [
			d.month,
			(profitMode === 'profit' ? d.profit : d.revenue).toString()
		]);
		const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.setAttribute('href', url);
		link.setAttribute('download', `monthly_${profitMode}_${new Date().getFullYear()}.csv`);
		link.style.visibility = 'hidden';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	function exportTaskCountToCSV() {
		const headers = ['Month', 'Tasks'];
		const rows = chartData.map((d) => [d.month, d.taskCount.toString()]);
		const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.setAttribute('href', url);
		link.setAttribute('download', `monthly_tasks_${new Date().getFullYear()}.csv`);
		link.style.visibility = 'hidden';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	const conicGradient = $derived.by(() => {
		let total = data.tabGroupsStats.reduce((sum, g) => sum + g.taskCount, 0);
		if (total === 0) return '';
		let currentAngle = 0;
		let stops: string[] = [];
		data.tabGroupsStats.forEach((g) => {
			if (g.taskCount === 0) return;
			const percentage = (g.taskCount / total) * 100;
			const endAngle = currentAngle + percentage;
			stops.push(`${g.color || '#ccc'} ${currentAngle}% ${endAngle}%`);
			currentAngle = endAngle;
		});
		return `conic-gradient(${stops.join(', ')})`;
	});

	const currentTabId = $derived(data.selectedTabTasks.id.toString());
	const lang = getLocale();

	function getGroupTranslation(group: { translations: any[]; id: number | string }) {
		const trans = group.translations.find((t: any) => t.language === lang);
		return trans ? trans.name : group.id.toString();
	}

	function getTabTranslation(tab: { translations: any[]; id: number | string }) {
		const trans = tab.translations.find((t: any) => t.language === lang);
		return trans ? trans.name : tab.id.toString();
	}

	function setProfitMode(mode: 'profit' | 'revenue') {
		const u = new URL(page.url);
		u.searchParams.set('profitMode', mode);
		goto(u.toString(), { keepFocus: true, noScroll: true });
	}

	function setRevenueSource(source: 'tasks' | 'invoices' | 'both') {
		const u = new URL(page.url);
		u.searchParams.set('revenueSource', source);
		goto(u.toString(), { keepFocus: true, noScroll: true });
	}

	const revenueSourceLabel = $derived(
		revenueSource === 'tasks' ? 'uzdevumi' : revenueSource === 'invoices' ? 'rēķini' : 'abi'
	);

	function toggleGroupVisibility(groupId: number) {
		let newHiddenGroups = [...data.hiddenTabGroups];
		if (newHiddenGroups.includes(groupId)) {
			newHiddenGroups = newHiddenGroups.filter((id) => id !== groupId);
		} else {
			newHiddenGroups.push(groupId);
		}
		document.cookie = `hiddenTabGroups=${JSON.stringify(newHiddenGroups)}; path=/; max-age=31536000`;
		invalidateAll();
	}
</script>

<svelte:head>
	<title>Panelis - Fastbreak CRM</title>
</svelte:head>

<header
	class=" flex h-(--header-height) shrink-0 items-center gap-2 rounded-lg border-b bg-background p-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)"
>
	<div class="flex w-full items-center gap-1 lg:gap-2">
		<Sidebar.Trigger class="-ml-1" />
		<Separator orientation="vertical" class="mx-2 data-[orientation=vertical]:h-4" />
		<h1 class="text-base font-medium">Panelis</h1>
	</div>
</header>
<div class="mt-4 flex flex-1 flex-col gap-4 overflow-hidden p-4 pt-0">
	<!-- Top Stats Row -->
	<div class="flex shrink-0 flex-col gap-4 md:flex-row">
		<Card.Root class="flex-1">
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">
					{profitMode === 'profit' ? 'Šī mēneša peļņa' : 'Šī mēneša apgrozījums'}
					<span class="font-normal text-muted-foreground">({revenueSourceLabel})</span>
				</Card.Title>
				<DollarSign class="h-4 w-4 text-muted-foreground" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{formatCurrency(currentMonthValue as number)}</div>
				<div class="mt-1 flex items-center justify-between">
					<p class="text-xs text-muted-foreground">
						{#if currentMonthChange > 0}
							<span class="text-green-600">+{currentMonthChange}%</span> no pagājušā mēneša
						{:else if currentMonthChange < 0}
							<span class="text-red-600">{currentMonthChange}%</span> no pagājušā mēneša
						{:else}
							Nav izmaiņu pret pagājušo mēnesi
						{/if}
					</p>
					<div class="flex gap-0.5 rounded-md border p-0.5">
						<button
							class="rounded px-2 py-0.5 text-[10px] font-medium transition-colors {profitMode ===
							'profit'
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:text-foreground'}"
							onclick={() => setProfitMode('profit')}>Peļņa</button
						>
						<button
							class="rounded px-2 py-0.5 text-[10px] font-medium transition-colors {profitMode ===
							'revenue'
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:text-foreground'}"
							onclick={() => setProfitMode('revenue')}>Apgrozījums</button
						>
					</div>
				</div>
				<div class="mt-2 flex items-center justify-between">
					<span class="text-xs text-muted-foreground">Datu avots:</span>
					<div class="flex gap-0.5 rounded-md border p-0.5">
						<button
							class="rounded px-2 py-0.5 text-[10px] font-medium transition-colors {revenueSource ===
							'tasks'
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:text-foreground'}"
							onclick={() => setRevenueSource('tasks')}>Uzdevumi</button
						>
						<button
							class="rounded px-2 py-0.5 text-[10px] font-medium transition-colors {revenueSource ===
							'invoices'
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:text-foreground'}"
							onclick={() => setRevenueSource('invoices')}>Rēķini</button
						>
						<button
							class="rounded px-2 py-0.5 text-[10px] font-medium transition-colors {revenueSource ===
							'both'
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:text-foreground'}"
							onclick={() => setRevenueSource('both')}>Abi</button
						>
					</div>
				</div>
			</Card.Content>
		</Card.Root>
		<Card.Root class="flex-1">
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Aktīvie uzdevumi</Card.Title>
				<ListTodo class="h-4 w-4 text-muted-foreground" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{data.activeTasksCount}</div>
				<p class="text-xs text-muted-foreground">
					{data.urgentTasks.filter((t) => isOverdue(t.endDate)).length} kavēti uzdevumi
				</p>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Urgent Tasks Table -->
	<Card.Root class="shrink-0">
		<Card.Header class="flex flex-row items-center justify-between py-4">
			<div>
				<Card.Title>Steidzami uzdevumi</Card.Title>
				<Card.Description>Uzdevumi ar beigu termiņu šodien, rīt vai kavētie</Card.Description>
			</div>
			<div class="flex items-center gap-2">
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Button {...props} variant="outline" size="sm" class="flex items-center gap-2">
								<Filter class="h-4 w-4" />
								Filtrs
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="max-h-[300px] w-56 overflow-y-auto">
						<DropdownMenu.Label>Grupas (rindas)</DropdownMenu.Label>
						<DropdownMenu.Separator />
						{#each data.tabGroupsStats as group}
							{#if group.id !== 41 && group.id !== 62}
								<DropdownMenu.CheckboxItem
									checked={!data.hiddenTabGroups.includes(group.id)}
									onCheckedChange={() => toggleGroupVisibility(group.id)}
								>
									{getGroupTranslation(group)}
								</DropdownMenu.CheckboxItem>
							{/if}
						{/each}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
				<Button variant="ghost" href="/projekti" class="text-sm font-medium text-primary">
					Skatīt visus
				</Button>
			</div>
		</Card.Header>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="pl-6">UZDEVUMA NOSAUKUMS</Table.Head>
						<Table.Head>ATBILDĪGAIS</Table.Head>
						<Table.Head>TERMIŅŠ</Table.Head>
						<Table.Head>STATUSS</Table.Head>
						<Table.Head class="pr-6 text-right">DARBĪBA</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.urgentTasks as task}
						<Table.Row>
							<Table.Cell class="pl-6 font-medium">
								<div class="flex flex-col">
									<span>{task.title}</span>
									{#if task.clientName}
										<span class="text-xs text-muted-foreground">{task.clientName}</span>
									{/if}
								</div>
							</Table.Cell>
							<Table.Cell>
								<div class="flex items-center gap-2">
									<Avatar.Root class="h-8 w-8">
										<Avatar.Fallback>{getInitials(task.responsibleName || '?')}</Avatar.Fallback>
									</Avatar.Root>
									<span class="text-sm text-foreground/80"
										>{task.responsibleName || 'Nezināms'}</span
									>
								</div>
							</Table.Cell>
							<Table.Cell class="text-muted-foreground">
								{formatDate(task.endDate as string)}
							</Table.Cell>
							<Table.Cell>
								<Badge
									variant={isOverdue(task.endDate)
										? 'destructive'
										: isToday(task.endDate)
											? 'default'
											: 'secondary'}
									class="uppercase"
								>
									{#if isOverdue(task.endDate)}
										KAVĒTS
									{:else if isToday(task.endDate)}
										ŠODIEN
									{:else}
										RĪT
									{/if}
								</Badge>
							</Table.Cell>
							<Table.Cell class="pr-6 text-right">
								<Button
									href={`/projekti/labot/${task.id}`}
									variant="link"
									size="sm"
									class="font-medium text-primary">Skatīt</Button
								>
							</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={5} class="text-center text-muted-foreground py-8"
								>Nav steidzamu uzdevumu</Table.Cell
							>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>

	<!-- Bottom Section - Flex Grow to fill remaining space -->
	<div class="flex flex-col gap-4">
		<!-- Row 1: Charts -->
		<div class="flex flex-col gap-4 lg:flex-row">
			<!-- Monthly Earnings Chart -->
			<Card.Root class="relative flex min-h-[350px] flex-1 flex-col">
				<Card.Header class="flex shrink-0 flex-row items-center justify-between">
					<div>
						<Card.Title>
							{profitMode === 'profit' ? 'Mēneša peļņa' : 'Mēneša apgrozījums'}
							<span class="font-normal text-muted-foreground">({revenueSourceLabel})</span>
						</Card.Title>
						<Card.Description>Attīstība pēdējos 12 mēnešos</Card.Description>
					</div>
					<div class="flex items-center gap-2">
						<Button variant="outline" size="sm" onclick={exportToCSV}>Export CSV</Button>
						<Button variant="outline" size="sm">{new Date().getFullYear()}</Button>
					</div>
				</Card.Header>
				<Card.Content class="relative min-h-0 flex-1 p-0">
					<div class="absolute inset-0 flex flex-col p-6 pt-0">
						{#if chartData.length > 0}
							{@const yValues = chartData.map((d) =>
								profitMode === 'profit' ? d.profit : d.revenue
							)}
							{@const yScale = scaleLinear()
								.domain([0, Math.max(...yValues, 100)])
								.range([100, 0])}
							{@const xScale = scaleBand()
								.domain(chartData.map((d) => d.month))
								.range([0, 100])
								.padding(0.3)}

							<div class="relative min-h-0 w-full flex-1">
								<!-- Grid Background (SVG) -->
								<svg
									class="absolute inset-0 h-full w-full"
									viewBox="0 0 100 100"
									preserveAspectRatio="none"
								>
									{#each yScale.ticks(5) as tick}
										<line
											x1="0"
											x2="100"
											y1={yScale(tick)}
											y2={yScale(tick)}
											stroke="currentColor"
											stroke-opacity="0.1"
											stroke-width="0.1"
											vector-effect="non-scaling-stroke"
										/>
									{/each}
								</svg>

								<!-- HTML Bars & Tooltips -->
								<div class="absolute inset-0">
									{#each chartData as d}
										{@const barValue = profitMode === 'profit' ? d.profit : d.revenue}
										<div
											class="group absolute bottom-0 rounded-t-sm bg-primary transition-opacity hover:opacity-80"
											style="
												left: {xScale(d.month) ?? 0}%;
												width: {xScale.bandwidth()}%;
												height: {100 - yScale(barValue)}%;
											"
										>
											<!-- Tooltip -->
											<div
												class="absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 group-hover:block"
											>
												<div class="flex justify-center">
													<div
														class="rounded border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md"
													>
														<div class="font-medium">{d.month}</div>
														{#if profitMode === 'profit'}
															<div>{formatCurrency(d.profit * 100)}</div>
															<div class="text-muted-foreground">
																Apgrozījums: {formatCurrency(d.revenue * 100)}
															</div>
														{:else}
															<div>{formatCurrency(d.revenue * 100)}</div>
															<div class="text-muted-foreground">
																Peļņa: {formatCurrency(d.profit * 100)}
															</div>
														{/if}
													</div>
												</div>
											</div>
										</div>
									{/each}
								</div>
							</div>

							<!-- X Axis Labels (HTML) -->
							<div class="relative mt-2 h-6 w-full select-none">
								{#each chartData as d}
									<div
										class="absolute -translate-x-1/2 text-center text-[10px] whitespace-nowrap text-muted-foreground"
										style="left: {(xScale(d.month) ?? 0) + xScale.bandwidth() / 2}%; width: auto;"
									>
										{d.month}
									</div>
								{/each}
							</div>
						{:else}
							<div class="flex h-full items-center justify-center text-muted-foreground">
								Nav pietiekami daudz datu diagrammas attēlošanai
							</div>
						{/if}
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Monthly Tasks Chart -->
			<Card.Root class="relative flex min-h-[350px] flex-1 flex-col">
				<Card.Header class="flex shrink-0 flex-row items-center justify-between">
					<div>
						<Card.Title>Mēneša uzdevumi</Card.Title>
						<Card.Description>Attīstība pēdējos 12 mēnešos</Card.Description>
					</div>
					<div class="flex gap-2">
						<Button variant="outline" size="sm" onclick={exportTaskCountToCSV}>Export CSV</Button>
						<Button variant="outline" size="sm">{new Date().getFullYear()}</Button>
					</div>
				</Card.Header>
				<Card.Content class="relative min-h-0 flex-1 p-0">
					<div class="absolute inset-0 flex flex-col p-6 pt-0">
						{#if chartData.length > 0}
							{@const yScale = scaleLinear()
								.domain([0, Math.max(...chartData.map((d) => d.taskCount), 10)])
								.range([100, 0])}
							{@const xScale = scaleBand()
								.domain(chartData.map((d) => d.month))
								.range([0, 100])
								.padding(0.3)}

							<div class="relative min-h-0 w-full flex-1">
								<!-- Grid Background (SVG) -->
								<svg
									class="absolute inset-0 h-full w-full"
									viewBox="0 0 100 100"
									preserveAspectRatio="none"
								>
									<!-- Grid lines -->
									{#each yScale.ticks(5) as tick}
										<line
											x1="0"
											x2="100"
											y1={yScale(tick)}
											y2={yScale(tick)}
											stroke="currentColor"
											stroke-opacity="0.1"
											stroke-width="0.1"
											vector-effect="non-scaling-stroke"
										/>
									{/each}
								</svg>

								<!-- HTML Bars & Tooltips -->
								<div class="absolute inset-0">
									{#each chartData as d}
										<div
											class="group absolute bottom-0 rounded-t-sm bg-primary transition-opacity hover:opacity-80"
											style="
												left: {xScale(d.month) ?? 0}%;
												width: {xScale.bandwidth()}%;
												height: {100 - yScale(d.taskCount)}%;
											"
										>
											<!-- Tooltip -->
											<div
												class="absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 group-hover:block"
											>
												<div class="flex justify-center">
													<div
														class="rounded border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md"
													>
														<div class="font-medium">{d.month}</div>
														<div>{d.taskCount} uzdevumi</div>
													</div>
												</div>
											</div>
										</div>
									{/each}
								</div>
							</div>

							<!-- X Axis Labels (HTML) -->
							<div class="relative mt-2 h-6 w-full select-none">
								{#each chartData as d}
									<div
										class="absolute -translate-x-1/2 text-center text-[10px] whitespace-nowrap text-muted-foreground"
										style="left: {(xScale(d.month) ?? 0) + xScale.bandwidth() / 2}%; width: auto;"
									>
										{d.month}
									</div>
								{/each}
							</div>
						{:else}
							<div class="flex h-full items-center justify-center text-muted-foreground">
								Nav pietiekami daudz datu diagrammas attēlošanai
							</div>
						{/if}
					</div>
				</Card.Content>
			</Card.Root>
		</div>
		<!-- Row 2: Top Managers, Top Responsible and Best Clients -->
		<div class="flex flex-col gap-4 md:h-[382px] md:flex-row">
			<!-- Top Managers -->
			<Card.Root class="flex-1">
				<Card.Header class="flex flex-row items-start justify-between gap-2">
					<div>
						<Card.Title>Labākie vadītāji</Card.Title>
						<Card.Description>
							{data.managersRange === 'month'
								? 'Šis mēnesis (aktīvie uzdevumi)'
								: data.managersRange === 'month-all'
									? 'Šis mēnesis (visi uzdevumi)'
									: 'Visu laiku (visi uzdevumi)'} ·
							{profitMode === 'profit' ? 'peļņa' : 'apgrozījums'}
						</Card.Description>
					</div>
					<div class="flex shrink-0 gap-1 rounded-md border p-0.5">
						<Button
							variant={data.managersRange === 'month' ? 'default' : 'ghost'}
							size="sm"
							class="h-7 px-2 text-xs"
							onclick={() => {
								const u = new URL(page.url);
								u.searchParams.set('managersRange', 'month');
								goto(u.toString(), { keepFocus: true, noScroll: true });
							}}>Mēnesis</Button
						>
						<Button
							variant={data.managersRange === 'month-all' ? 'default' : 'ghost'}
							size="sm"
							class="h-7 px-2 text-xs"
							onclick={() => {
								const u = new URL(page.url);
								u.searchParams.set('managersRange', 'month-all');
								goto(u.toString(), { keepFocus: true, noScroll: true });
							}}>Mēnesis (visi)</Button
						>
						<Button
							variant={data.managersRange === 'alltime' ? 'default' : 'ghost'}
							size="sm"
							class="h-7 px-2 text-xs"
							onclick={() => {
								const u = new URL(page.url);
								u.searchParams.set('managersRange', 'alltime');
								goto(u.toString(), { keepFocus: true, noScroll: true });
							}}>Visu laiku</Button
						>
					</div>
				</Card.Header>
				<Card.Content>
					<div class="space-y-4">
						{#each data.topManagers as manager, index}
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-3">
									<div
										class="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground"
									>
										{index + 1}
									</div>
									<div class="flex flex-col">
										<span class="text-sm font-medium">{manager.name || 'Nezināms'}</span>
										<span class="text-xs text-muted-foreground">Vadītājs</span>
									</div>
								</div>
								<div class="flex flex-col items-end">
									<span class="text-sm font-bold"
										>{formatCurrency(Number(manager.totalValue) || 0)}</span
									>
								</div>
							</div>
						{/each}
					</div>
				</Card.Content>
			</Card.Root>
			<!-- Top Responsible Persons -->
			<Card.Root class="flex-1 overflow-hidden">
				<Card.Header class="flex flex-row items-start justify-between gap-2">
					<div>
						<Card.Title>Labākās atbildīgās personas</Card.Title>
						<Card.Description>
							{data.assigneesRange === 'month'
								? 'Šis mēnesis (aktīvie uzdevumi)'
								: data.assigneesRange === 'month-all'
									? 'Šis mēnesis (visi uzdevumi)'
									: 'Visu laiku (visi uzdevumi)'}
						</Card.Description>
					</div>
					<div class="flex shrink-0 gap-1 rounded-md border p-0.5">
						<Button
							variant={data.assigneesRange === 'month' ? 'default' : 'ghost'}
							size="sm"
							class="h-7 px-2 text-xs"
							onclick={() => {
								const u = new URL(page.url);
								u.searchParams.set('assigneesRange', 'month');
								goto(u.toString(), { keepFocus: true, noScroll: true });
							}}>Mēnesis</Button
						>
						<Button
							variant={data.assigneesRange === 'month-all' ? 'default' : 'ghost'}
							size="sm"
							class="h-7 px-2 text-xs"
							onclick={() => {
								const u = new URL(page.url);
								u.searchParams.set('assigneesRange', 'month-all');
								goto(u.toString(), { keepFocus: true, noScroll: true });
							}}>Mēnesis (visi)</Button
						>
						<Button
							variant={data.assigneesRange === 'alltime' ? 'default' : 'ghost'}
							size="sm"
							class="h-7 px-2 text-xs"
							onclick={() => {
								const u = new URL(page.url);
								u.searchParams.set('assigneesRange', 'alltime');
								goto(u.toString(), { keepFocus: true, noScroll: true });
							}}>Visu laiku</Button
						>
					</div>
				</Card.Header>
				<Card.Content>
					<div class="space-y-4">
						{#each data.topResponsiblePersons as person, index}
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-3">
									<Avatar.Root class="h-9 w-9">
										<Avatar.Fallback>{getInitials(person.name || '?')}</Avatar.Fallback>
									</Avatar.Root>
									<div class="flex flex-col">
										<span class="text-sm font-medium">{person.name || 'Nezināms'}</span>
										<span class="text-xs text-muted-foreground">{person.taskCount} uzdevumi</span>
									</div>
								</div>
								<Badge variant="secondary" class="bg-green-100 text-green-800 hover:bg-green-100"
									>{person.share}% no {data.assigneesRange === 'month'
										? 'aktīvajiem'
										: 'visiem'}</Badge
								>
							</div>
						{/each}
					</div>
				</Card.Content>
			</Card.Root>
			<!-- Best Clients -->
			<Card.Root class="flex h-full flex-1 flex-col overflow-hidden">
				<Card.Header class="flex shrink-0 flex-row items-start justify-between gap-2">
					<div>
						<Card.Title>Labākie klienti</Card.Title>
						<Card.Description>
							{profitMode === 'profit' ? 'Pēc peļņas (apgrozījums − izmaksas)' : 'Pēc apgrozījuma'}
						</Card.Description>
					</div>
					<div class="flex shrink-0 items-center gap-1">
						<span class="text-xs text-muted-foreground">Rādīt:</span>
						<select
							class="h-7 rounded-md border bg-background px-2 text-xs"
							value={data.clientsLimit}
							onchange={(e) => {
								const u = new URL(page.url);
								u.searchParams.set('clientsLimit', (e.target as HTMLSelectElement).value);
								goto(u.toString(), { keepFocus: true, noScroll: true });
							}}
						>
							{#each [5, 10, 20, 30, 50] as n}
								<option value={n}>{n}</option>
							{/each}
						</select>
					</div>
				</Card.Header>
				<Card.Content class="min-h-0 flex-1 p-0 pb-4">
					<div class="custom-scroll h-full overflow-y-auto px-6">
						<div class="space-y-1">
							{#each data.bestClients as client, index}
								<div class="flex items-center justify-between py-1.5">
									<div class="flex items-center gap-3">
										<div
											class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground"
										>
											{index + 1}
										</div>
										<div class="flex flex-col">
											<span class="text-sm font-medium">{client.name}</span>
											<span class="text-xs text-muted-foreground"
												>{Number(client.taskCount)} uzdevumi</span
											>
										</div>
									</div>
									<span class="shrink-0 text-sm font-bold"
										>{formatCurrency(client.totalValue || 0)}</span
									>
								</div>
							{:else}
								<p class="py-4 text-center text-sm text-muted-foreground">
									Nav klientu ar pasūtījumiem
								</p>
							{/each}
						</div>
					</div>
				</Card.Content>
			</Card.Root>
		</div>
		<!-- Row 3: Tab Groups Pie Chart & Specific Tab Tasks -->
		<div class="flex flex-col gap-4 md:flex-row md:items-stretch">
			<!-- Pie chart for tabgroups -->
			<Card.Root class="flex flex-1 flex-col">
				<Card.Header class="shrink-0">
					<Card.Title>{m.dashboard_stats_tabgroups()}</Card.Title>
				</Card.Header>
				<Card.Content class="flex flex-1 items-center justify-center gap-8 py-6">
					{#if conicGradient}
						<div
							class="relative h-76 w-76 flex-shrink-0 overflow-hidden rounded-full border shadow-sm"
							style="background: {conicGradient}"
						>
							<div
								class="absolute inset-8 flex items-center justify-center rounded-full bg-card shadow-inner"
							>
								<div class="flex flex-col items-center text-sm font-semibold">
									<span>{data.tabGroupsStats.reduce((acc, g) => acc + g.taskCount, 0)}</span>
									<span class="text-[10px] text-muted-foreground uppercase"
										>{m.dashboard_tasks_count().replace(':', '')}</span
									>
								</div>
							</div>
						</div>
						<!-- Legend -->
						<div class="flex flex-col gap-4">
							{#each data.tabGroupsStats as group}
								{#if group.taskCount > 0}
									<div class="flex items-center justify-between gap-4">
										<div class="flex items-center gap-2">
											<div
												class="h-4 w-4 rounded-sm border"
												style="background-color: {group.color || '#ccc'}"
											></div>
											<span class="text-sm font-medium">{getGroupTranslation(group)}</span>
										</div>
										<span
											class="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
										>
											{group.taskCount}
										</span>
									</div>
								{/if}
							{/each}
						</div>
					{:else}
						<div class="flex h-48 items-center text-sm text-muted-foreground">
							{m.dashboard_no_tasks()}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<!-- Specific Tab tasks -->
			<Card.Root class="flex-1">
				<Card.Header class="pb-2">
					<div class="flex items-center justify-between gap-4">
						<Card.Title>{m.dashboard_stats_tabs()}</Card.Title>
						<Select.Root
							type="single"
							value={currentTabId}
							onValueChange={(val) => {
								const url = new URL(page.url);
								url.searchParams.set('tabId', val.toString());
								goto(url.toString(), { keepFocus: true, noScroll: true });
							}}
						>
							<Select.Trigger class="w-[220px]">
								{data.allTabsForSelect.find((t) => t.id.toString() === currentTabId)
									? getTabTranslation(
											data.allTabsForSelect.find((t) => t.id.toString() === currentTabId)!
										)
									: m.dashboard_no_tab_selected()}
							</Select.Trigger>
							<Select.Content class="max-h-[300px]">
								{#each data.allTabsForSelect as st}
									<Select.Item value={st.id.toString()} label={getTabTranslation(st)}
										>{getTabTranslation(st)}</Select.Item
									>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
				</Card.Header>
				<Card.Content>
					<div class="mb-4 flex items-center justify-between rounded-lg bg-muted/50 px-2 py-2">
						<div class="flex gap-2 text-sm font-medium">
							<span class="text-muted-foreground">{m.dashboard_tasks_count()}</span>
							<span>{data.selectedTabTasks.tasks.length}</span>
						</div>
						<div class="flex gap-2 text-sm font-bold">
							<span class="text-muted-foreground">{m.dashboard_total_price()}</span>
							<span class="text-primary">{formatCurrency(data.selectedTabTasks.totalPrice)}</span>
						</div>
					</div>
					<div class="custom-scroll max-h-[300px] overflow-auto rounded-md border">
						<Table.Root>
							<Table.Header class="sticky top-0 z-10 bg-background">
								<Table.Row>
									<Table.Head>UZDEVUMA NOSAUKUMS</Table.Head>
									<Table.Head class="text-right">SUMMA</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each data.selectedTabTasks.tasks as task}
									<Table.Row>
										<Table.Cell class="font-medium">
											<div class="flex flex-col">
												<a
													href={`/projekti/labot/${task.id}`}
													class="transition-colors hover:text-primary hover:underline"
													>{task.title}</a
												>
												{#if task.clientName}
													<span class="text-xs text-muted-foreground">{task.clientName}</span>
												{/if}
											</div>
										</Table.Cell>
										<Table.Cell class="text-right font-medium"
											>{formatCurrency(task.price || 0)}</Table.Cell
										>
									</Table.Row>
								{:else}
									<Table.Row>
										<Table.Cell colspan={2} class="text-center py-8 text-muted-foreground">
											<div class="flex flex-col items-center gap-2">
												<ListTodo class="w-8 h-8 opacity-20" />
												<span>{m.dashboard_no_tasks()}</span>
											</div>
										</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					</div>
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
