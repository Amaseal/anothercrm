<script lang="ts">
	import { toCurrency } from '$lib/utilities';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card/index.js';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import AlertTriangle from '@lucide/svelte/icons/triangle-alert';
	import Pencil from '@lucide/svelte/icons/pencil';
	import X from '@lucide/svelte/icons/x';
	import * as m from '$lib/paraglide/messages';

	let { data } = $props();

	let expandedTasks = $state<Set<number>>(new Set());

	function toggleExpand(id: number) {
		const next = new Set(expandedTasks);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		expandedTasks = next;
	}

	const fmt = (cents: number | null | undefined) =>
		cents == null ? '-' : toCurrency(cents) + ' €';

	const profitClass = (profit: number) =>
		profit < 0
			? 'text-red-600 font-semibold'
			: profit === 0
				? 'text-muted-foreground'
				: 'text-green-600 font-semibold';
</script>

<svelte:head>
	<title>{data.client.name} — {m['clients.breakdown.title']()}</title>
</svelte:head>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
	<div class="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-lg">
		<Card.Root
			class="custom-scroll relative flex max-h-[90vh] w-full flex-col gap-0 overflow-y-auto"
		>
			<Card.Header class="sticky top-0 z-10 border-b bg-card pb-4">
				<a
					href="/klienti"
					class="absolute top-0 right-5 text-muted-foreground transition-colors hover:text-foreground"
				>
					<X />
				</a>
				<div class="flex items-start justify-between gap-4 pr-8">
					<div>
						<h2 class="text-lg font-semibold">{data.client.name}</h2>
						<p class="text-sm text-muted-foreground">{m['clients.breakdown.title']()}</p>
					</div>
					<Button
						href="/klienti/labot/{data.client.id}"
						variant="outline"
						size="sm"
						class="mt-0.5 flex shrink-0 items-center gap-2"
					>
						<Pencil class="h-4 w-4" />
						{m['components.edit']()}
					</Button>
				</div>

				<!-- Summary row -->
				<div class="mt-4 grid grid-cols-3 gap-3">
					<div class="rounded-lg border p-3">
						<p class="text-xs text-muted-foreground">{m['clients.breakdown.revenue']()}</p>
						<p class="mt-0.5 text-xl font-semibold">{fmt(data.totalRevenue)}</p>
					</div>
					<div class="rounded-lg border p-3">
						<p class="text-xs text-muted-foreground">{m['clients.breakdown.costs']()}</p>
						<p class="mt-0.5 text-xl font-semibold text-orange-600">{fmt(data.totalCost)}</p>
					</div>
					<div class="rounded-lg border p-3">
						<p class="text-xs text-muted-foreground">{m['clients.breakdown.profit']()}</p>
						<p class="mt-0.5 text-xl {profitClass(data.totalProfit)}">{fmt(data.totalProfit)}</p>
					</div>
				</div>
			</Card.Header>

			<Card.Content class="space-y-5 p-6">
				<!-- Tasks table -->
				{#if data.tasks.length > 0}
					<div>
						<h3 class="mb-2 text-sm font-medium text-muted-foreground">
							{m['clients.breakdown.tasks']()}
						</h3>
						<div class="rounded-md border">
							<Table.Root>
								<Table.Header>
									<Table.Row>
										<Table.Head class="w-6"></Table.Head>
										<Table.Head>{m['clients.breakdown.task_title']()}</Table.Head>
										<Table.Head class="text-right">{m['clients.breakdown.revenue']()}</Table.Head>
										<Table.Head class="text-right">{m['clients.breakdown.costs']()}</Table.Head>
										<Table.Head class="text-right">{m['clients.breakdown.profit']()}</Table.Head>
										<Table.Head class="w-28 text-center"
											>{m['clients.breakdown.source']()}</Table.Head
										>
										<Table.Head class="w-10"></Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#each data.tasks as t (t.taskId)}
										<Table.Row
											class="cursor-pointer hover:bg-muted/50 {t.isProblematic
												? 'bg-red-50/50 dark:bg-red-950/20'
												: ''}"
											onclick={() => t.products.length > 0 && toggleExpand(t.taskId)}
										>
											<Table.Cell>
												{#if t.products.length > 0}
													{#if expandedTasks.has(t.taskId)}
														<ChevronDown class="h-4 w-4 text-muted-foreground" />
													{:else}
														<ChevronRight class="h-4 w-4 text-muted-foreground" />
													{/if}
												{/if}
											</Table.Cell>
											<Table.Cell>
												<div class="flex items-center gap-2">
													{#if t.isProblematic}
														<AlertTriangle class="h-4 w-4 shrink-0 text-red-500" />
													{/if}
													<a
														href="/projekti/{t.taskId}"
														class="hover:underline"
														onclick={(e) => e.stopPropagation()}>{t.taskTitle}</a
													>
													{#if t.isDone}
														<Badge variant="secondary" class="text-xs"
															>{m['clients.breakdown.done']()}</Badge
														>
													{/if}
												</div>
											</Table.Cell>
											<Table.Cell class="text-right">
												{#if t.invoiceSubtotal != null}
													<span class="text-sm">{fmt(t.invoiceSubtotal)}</span>
												{:else if t.taskPrice != null}
													<span class="text-sm text-muted-foreground">{fmt(t.taskPrice)}</span>
												{:else}
													<span class="text-sm text-red-500"
														>{m['clients.breakdown.no_price']()}</span
													>
												{/if}
											</Table.Cell>
											<Table.Cell class="text-right text-sm">
												{t.productCost > 0 ? fmt(t.productCost) : '-'}
											</Table.Cell>
											<Table.Cell class="text-right text-sm {profitClass(t.profit)}">
												{fmt(t.profit)}
											</Table.Cell>
											<Table.Cell class="text-center">
												{#if t.invoiceId}
													<Badge variant="outline" class="text-xs">
														<a href="/rekini/{t.invoiceId}" onclick={(e) => e.stopPropagation()}>
															{t.invoiceNumber}
														</a>
													</Badge>
												{:else}
													<span class="text-xs text-muted-foreground"
														>{m['clients.breakdown.no_invoice']()}</span
													>
												{/if}
											</Table.Cell>
											<Table.Cell>
												<Button
													href="/projekti/{t.taskId}"
													variant="ghost"
													size="icon"
													onclick={(e) => e.stopPropagation()}
												>
													<Pencil class="h-4 w-4" />
												</Button>
											</Table.Cell>
										</Table.Row>

										{#if expandedTasks.has(t.taskId) && t.products.length > 0}
											<Table.Row class="bg-muted/30">
												<Table.Cell colspan={7} class="py-0">
													<div class="my-2 ml-8 overflow-hidden rounded border bg-background">
														<Table.Root>
															<Table.Header>
																<Table.Row class="border-b">
																	<Table.Head class="py-2 text-xs"
																		>{m['clients.breakdown.product']()}</Table.Head
																	>
																	<Table.Head class="py-2 text-right text-xs"
																		>{m['clients.breakdown.count']()}</Table.Head
																	>
																	<Table.Head class="py-2 text-right text-xs"
																		>{m['clients.breakdown.unit_cost']()}</Table.Head
																	>
																	<Table.Head class="py-2 text-right text-xs"
																		>{m['clients.breakdown.unit_price']()}</Table.Head
																	>
																	<Table.Head class="py-2 text-right text-xs"
																		>{m['clients.breakdown.total_cost']()}</Table.Head
																	>
																</Table.Row>
															</Table.Header>
															<Table.Body>
																{#each t.products as p (p.productId)}
																	<Table.Row>
																		<Table.Cell class="py-1.5 text-sm">{p.productTitle}</Table.Cell>
																		<Table.Cell class="py-1.5 text-right text-sm"
																			>{p.count ?? 1}</Table.Cell
																		>
																		<Table.Cell class="py-1.5 text-right text-sm"
																			>{fmt(p.cost)}</Table.Cell
																		>
																		<Table.Cell class="py-1.5 text-right text-sm"
																			>{fmt(p.price)}</Table.Cell
																		>
																		<Table.Cell class="py-1.5 text-right text-sm font-medium"
																			>{fmt((p.count ?? 1) * p.cost)}</Table.Cell
																		>
																	</Table.Row>
																{/each}
															</Table.Body>
														</Table.Root>
													</div>
												</Table.Cell>
											</Table.Row>
										{/if}
									{/each}
								</Table.Body>
							</Table.Root>
						</div>
					</div>
				{/if}

				<!-- Standalone invoices -->
				{#if data.standaloneInvoices.length > 0}
					<div>
						<h3 class="mb-2 text-sm font-medium text-muted-foreground">
							{m['clients.breakdown.standalone_invoices']()}
						</h3>
						<div class="rounded-md border">
							<Table.Root>
								<Table.Header>
									<Table.Row>
										<Table.Head>{m['clients.breakdown.invoice_number']()}</Table.Head>
										<Table.Head>{m['clients.breakdown.issue_date']()}</Table.Head>
										<Table.Head>{m['clients.breakdown.status']()}</Table.Head>
										<Table.Head class="text-right">{m['clients.breakdown.revenue']()}</Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#each data.standaloneInvoices as inv (inv.id)}
										<Table.Row class="hover:bg-muted/50">
											<Table.Cell>
												<a href="/rekini/{inv.id}" class="hover:underline">{inv.invoiceNumber}</a>
											</Table.Cell>
											<Table.Cell class="text-sm text-muted-foreground">{inv.issueDate}</Table.Cell>
											<Table.Cell
												><Badge variant="outline" class="text-xs">{inv.status}</Badge></Table.Cell
											>
											<Table.Cell class="text-right text-sm">{fmt(inv.subtotal)}</Table.Cell>
										</Table.Row>
									{/each}
								</Table.Body>
							</Table.Root>
						</div>
					</div>
				{/if}

				{#if data.tasks.length === 0 && data.standaloneInvoices.length === 0}
					<p class="py-8 text-center text-muted-foreground">{m['clients.breakdown.empty']()}</p>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</div>
