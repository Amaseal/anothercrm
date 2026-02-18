<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Separator } from '$lib/components/ui/separator';
	import { Badge } from '$lib/components/ui/badge';
	import Users from '@lucide/svelte/icons/users';
	import UserCheck from '@lucide/svelte/icons/user-check';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import DollarSign from '@lucide/svelte/icons/dollar-sign';
	import Clock from '@lucide/svelte/icons/clock';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import { AreaChart, BarChart } from 'layerchart';
	import { scaleLinear, scalePoint, scaleBand } from 'd3-scale';

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

	// Log chart data using an effect
	$effect(() => {
		console.log('Chart Data:', chartData);
	});

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
</script>

<svelte:head>
	<title>Panelis - Fastbreak CRM</title>
</svelte:head>

<header
	class=" bg-background flex h-(--header-height) shrink-0 items-center gap-2 rounded-lg border-b p-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)"
>
	<div class="flex w-full items-center gap-1 lg:gap-2">
		<Sidebar.Trigger class="-ml-1" />
		<Separator orientation="vertical" class="mx-2 data-[orientation=vertical]:h-4" />
		<h1 class="text-base font-medium">Panelis</h1>
	</div>
</header>
<div class="mb-4 space-y-4">
	<div id="dashboard" class="space-y-6">
		<!-- Header Stats -->
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
			<div class="grid gap-4">
				<Card.Root>
					<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
						<Card.Title class="text-sm font-medium">Šī mēneša peļņa</Card.Title>
						<DollarSign class="text-muted-foreground h-4 w-4" />
					</Card.Header>
					<Card.Content>
						<div class="text-2xl font-bold">
							{formatCurrency(data.currentMonthProfit as number)}
						</div>
					</Card.Content>
				</Card.Root>
				<Card.Root>
					<Card.Header>
						<Card.Title class="flex items-center gap-2">
							<Clock class="h-5 w-5" />
							Steidzami uzdevumi
						</Card.Title>
						<Card.Description>Uzdevumi ar beigu termiņu šodien, rīt vai kavētie</Card.Description>
					</Card.Header>
					<Card.Content>
						<div class="space-y-3">
							{#each data.urgentTasks as task}
								<div class="flex items-center justify-between">
									<div class="flex flex-col gap-1">
										<span class="text-sm font-medium">{task.title}</span>
										{#if task.clientName}
											<span class="text-muted-foreground text-xs">{task.clientName}</span>
										{/if}
									</div>
									<div class="flex flex-col items-end gap-1">
										{#if task.endDate}
											<Badge
												variant={isOverdue(task.endDate)
													? 'destructive'
													: isToday(task.endDate)
														? 'default'
														: 'secondary'}
												class="text-xs"
											>
												{#if isOverdue(task.endDate)}
													<AlertTriangle class="mr-1 h-3 w-3" />
													Kavēts
												{:else if isToday(task.endDate)}
													Šodien
												{:else}
													Rīt
												{/if}
											</Badge>
											<span class="text-muted-foreground text-xs">{formatDate(task.endDate)}</span>
										{:else}
											<Badge variant="outline" class="text-xs">Nav datuma</Badge>
										{/if}
									</div>
								</div>
							{:else}
								<p class="text-sm text-muted-foreground">Nav steidzamu uzdevumu</p>
							{/each}
						</div>
					</Card.Content>
				</Card.Root>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
			<div class="grid gap-4">
				<Card.Root>
					<Card.Header>
						<Card.Title class="flex items-center gap-2">
							<Users class="h-5 w-5" />
							Labākie vadītāji
						</Card.Title>
						<Card.Description>Vadītāji ar augstāko uzdevumu kopvērtību</Card.Description>
					</Card.Header>
					<Card.Content>
						<div class="space-y-3">
							{#each data.topManagers as manager, index}
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<Badge
											variant="secondary"
											class="flex h-6 w-6 items-center justify-center p-0 text-xs"
										>
											{index + 1}
										</Badge>
										<span class="font-medium">{manager.name || 'Nezināms'}</span>
									</div>
									<Badge variant="outline">{formatCurrency(manager.totalValue || 0)}</Badge>
								</div>
							{:else}
								<p class="text-sm text-muted-foreground">Nav datu šajā mēnesī</p>
							{/each}
						</div>
					</Card.Content>
				</Card.Root>
				<Card.Root>
					<Card.Header>
						<Card.Title class="flex items-center gap-2">
							<UserCheck class="h-5 w-5" />
							Labākās atbildīgās personas
						</Card.Title>
						<Card.Description>Personas ar visvairāk uzdevumiem</Card.Description>
					</Card.Header>
					<Card.Content>
						<div class="space-y-3">
							{#each data.topResponsiblePersons as person, index}
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<Badge
											variant="secondary"
											class="flex h-6 w-6 items-center justify-center p-0 text-xs"
										>
											{index + 1}
										</Badge>
										<span class="font-medium">{person.name || 'Nezināms'}</span>
									</div>
									<Badge variant="outline">{person.taskCount} uzdevumi</Badge>
								</div>
							{:else}
								<p class="text-sm text-muted-foreground">Nav datu šajā mēnesī</p>
							{/each}
						</div>
					</Card.Content>
				</Card.Root>
				<Card.Root>
					<Card.Header>
						<Card.Title class="flex items-center gap-2">
							<TrendingUp class="h-5 w-5" />
							Labākie klienti
						</Card.Title>
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
			<Card.Root class="">
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<TrendingUp class="h-5 w-5" />
						Mēneša peļņa
					</Card.Title>
					<Card.Description>Peļņas attīstība pēdējos 12 mēnešos</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if chartData.length > 0}
						<div class="h-[300px] w-full">
							<BarChart
								data={chartData}
								x="month"
								y="profit"
								xScale={scaleBand().padding(0.1)}
								yScale={scaleLinear().domain([0, Math.max(...chartData.map((d) => d.profit), 100)])}
								padding={{ top: 20, bottom: 40, left: 60, right: 20 }}
								series={[
									{
										key: 'profit',
										label: chartConfig.profit.label,
										color: chartConfig.profit.color
									}
								]}
								tooltip
							/>
						</div>
					{:else}
						<div class="text-muted-foreground flex h-[300px] items-center justify-center">
							Nav pietiekami daudz datu diagrammas attēlošanai
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>

		<!-- Monthly Profit Chart -->
	</div>
</div>
