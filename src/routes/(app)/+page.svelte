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

	let { data } = $props();

	// Chart configuration
	const chartConfig = {
		profit: {
			label: 'Peļņa',
			color: '#db2777'
		}
	};

	// Prepare chart data using $derived
	const chartData = $derived(
		data.chartData.map((item, index) => ({
			month: formatMonth(item.month),
			profit: Number(item.profit) / 100 || 0
		}))
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
		const headers = ['Month', 'Profit'];
		const rows = chartData.map((d) => [d.month, d.profit.toString()]);
		const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.setAttribute('href', url);
		link.setAttribute('download', `monthly_profit_${new Date().getFullYear()}.csv`);
		link.style.visibility = 'hidden';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
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
				<Card.Title class="text-sm font-medium">Šī mēneša peļņa</Card.Title>
				<DollarSign class="h-4 w-4 text-muted-foreground" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{formatCurrency(data.currentMonthProfit as number)}</div>
				<p class="text-xs text-muted-foreground">
					{#if data.profitChange > 0}
						<span class="text-green-600">+{data.profitChange.toFixed(1)}%</span> no pagājušā mēneša
					{:else if data.profitChange < 0}
						<span class="text-red-600">{data.profitChange.toFixed(1)}%</span> no pagājušā mēneša
					{:else}
						Nav izmaiņu pret pagājušo mēnesi
					{/if}
				</p>
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
			<Button variant="ghost" href="/projekti" class="text-sm font-medium text-primary">
				Skatīt visus
			</Button>
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
								<Button href={`/projekti/labot/${task.id}`} variant="link" size="sm" class="font-medium text-primary">Skatīt</Button>
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
		<!-- Row 1: Top Managers and Chart -->
		<div class="flex flex-col gap-4 lg:flex-row">
			<!-- Top Managers -->
			<Card.Root class="flex-1">
				<Card.Header>
					<Card.Title>Labākie vadītāji</Card.Title>
					<Card.Description>Pēc uzdevumu kopvērtības</Card.Description>
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
									<span class="text-sm font-bold">{formatCurrency(manager.totalValue || 0)}</span>
	
								</div>
							</div>
						{/each}
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Monthly Earnings Chart -->
			<Card.Root class="flex flex-[1.5] flex-col relative">
				<Card.Header class="flex shrink-0 flex-row items-center justify-between">
					<div>
						<Card.Title>Mēneša peļņa</Card.Title>
						<Card.Description>Attīstība pēdējos 12 mēnešos</Card.Description>
					</div>
					<div class="flex gap-2">
						<Button variant="outline" size="sm" onclick={exportToCSV}>Export CSV</Button>
						<Button variant="outline" size="sm">{new Date().getFullYear()}</Button>
					</div>
				</Card.Header>
				<Card.Content class="relative flex-1 min-h-0 p-0">
					<div class="absolute inset-0 flex flex-col p-6 pt-0">
						{#if chartData.length > 0}
							{@const yScale = scaleLinear()
								.domain([0, Math.max(...chartData.map((d) => d.profit), 100)])
								.range([100, 0])}
							{@const xScale = scaleBand()
								.domain(chartData.map((d) => d.month))
								.range([0, 100])
								.padding(0.3)}

							<div class="flex-1 w-full min-h-0 relative">
								<!-- Grid Background (SVG) -->
								<svg
									class="absolute inset-0 w-full h-full"
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
											class="absolute bottom-0 bg-primary transition-opacity hover:opacity-80 rounded-t-sm group"
											style="
												left: {xScale(d.month) ?? 0}%;
												width: {xScale.bandwidth()}%;
												height: {100 - yScale(d.profit)}%;
											"
										>
											<!-- Tooltip -->
											<div
												class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50"
											>
												<div class="flex justify-center">
													<div
														class="rounded border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md"
													>
														<div class="font-medium">{d.month}</div>
														<div>{formatCurrency(d.profit * 100)}</div>
													</div>
												</div>
											</div>
										</div>
									{/each}
								</div>
							</div>

							<!-- X Axis Labels (HTML) -->
							<div class="h-6 w-full relative mt-2 select-none">
								{#each chartData as d}
									<div
										class="absolute text-[10px] text-muted-foreground text-center -translate-x-1/2 whitespace-nowrap"
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

		<!-- Row 2: Top Responsible and Best Clients -->
		<div class="flex flex-col gap-4 md:flex-row">
			<!-- Top Responsible Persons -->
			<Card.Root class="flex-1">
				<Card.Header>
					<Card.Title>Labākās atbildīgās personas</Card.Title>
					<Card.Description>Pēc uzdevumu skaita daļas</Card.Description>
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
									>{person.share}% no visiem uzdevumiem</Badge
								>
							</div>
						{/each}
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Best Clients -->
			<Card.Root class="flex-1">
				<Card.Header>
					<Card.Title>Labākie klienti</Card.Title>
					<Card.Description>Pēc kopējā pasūtījumu apjoma</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="space-y-3">
						{#each data.bestClients as client, index}
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<Badge
										variant="secondary"
										class="flex h-6 w-6 items-center justify-center p-0 text-xs"
									>
										{index + 1}
									</Badge>
									<span class="font-medium">{client.name}</span>
								</div>
								<Badge variant="outline">{formatCurrency(client.totalOrdered || 0)}</Badge>
							</div>
						{:else}
							<p class="text-sm text-muted-foreground">Nav klientu ar pasūtījumiem</p>
						{/each}
					</div>
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
