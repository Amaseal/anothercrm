<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { cn } from '$lib/utils.js';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Check from '@lucide/svelte/icons/check';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import FormError from '$lib/components/form-error.svelte';
	import { toCurrency } from '$lib/utilities';
	import FastBreakLogo from '$lib/components/fastbreak-logo.svelte';
	import * as m from '$lib/paraglide/messages';

	let { data, form } = $props();
	const { company, clients, products, item: invoice } = data;

	// State - Initialize from existing Invoice
	let isNewClient = $state(false); // Edit mode usually dealing with existing clients
	let selectedClientId = $state(invoice.clientId.toString());
	let clientOpen = $state(false);

	// Initialize items from invoice data
	let items = $state(
		invoice.items.length > 0
			? invoice.items.map((i: any) => ({
					description: i.description,
					unit: i.unit,
					quantity: i.quantity,
					price: i.price // Already in cents? Yes, schema says integer.
				}))
			: [{ description: '', unit: 'gab.', quantity: 1, price: 0 }]
	);

	// Derived Calculations
	let subtotal = $derived(items.reduce((acc, item) => acc + item.quantity * item.price, 0));
	let vatRate = $state(invoice.taxRate ?? 21);
    let language = $state(invoice.language ?? 'lv');

	let taxAmount = $derived(subtotal * (vatRate / 100));
	let total = $derived(subtotal + taxAmount);

	function addItem() {
		items = [...items, { description: '', unit: 'gab.', quantity: 1, price: 0 }];
	}

	function removeItem(index: number) {
		items = items.filter((_, i) => i !== index);
	}

	function handlePriceInput(e: Event, index: number) {
		const input = e.target as HTMLInputElement;
		const val = parseFloat(input.value);
		items[index].price = Math.round(val * 100);
	}

	function handleQtyInput(e: Event, index: number) {
		const input = e.target as HTMLInputElement;
		items[index].quantity = parseFloat(input.value);
	}

	// Auto-fill logic for products
	function handleDescriptionInput(e: Event, index: number) {
		const input = e.target as HTMLInputElement;
		const val = input.value;
		items[index].description = val;

		// Check for exact match in products
		const match = products.find((p) => p.title === val);
		if (match) {
			items[index].price = match.cost;
		}
	}

	// Auto-fill client details when existing client is selected
	let selectedClientDetails = $derived(
		selectedClientId ? clients.find((c) => c.id.toString() === selectedClientId) : null
	);

	const formatMoney = (cents: number) => (cents / 100).toFixed(2);

	// Date formatting helper for input value
	const formatDateInput = (d: string | Date | null) => {
		if (!d) return '';
		if (d instanceof Date) return d.toISOString().split('T')[0];
		return new Date(d).toISOString().split('T')[0];
	};
</script>

<svelte:head>
	<title>{m['invoices.edit_invoice']()}</title>
</svelte:head>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
	<div class="max-h-[90vh] w-full max-w-[70vw] overflow-y-scroll custom-scroll rounded-lg">

		

			<!-- Paper Container -->
			<div
				class="relative mx-auto bg-white p-12 font-sans text-black shadow-md"
				style="font-family: Arial, sans-serif;"
			>
				<form method="POST" use:enhance>
					{#if form?.message}
						<div class="absolute top-0 right-0 left-0 -mt-12">
							<FormError error={form.message} />
						</div>
					{/if}

					<!-- 1. Header Row -->
					<div class="mb-8 flex items-start justify-between">
						<!-- Logo -->
					
						<div class="w-1/2">
							<FastBreakLogo />
						</div>

						<!-- Invoice Meta Table -->
						<div class="flex w-1/2 flex-col items-end">
							<h1 class="mb-2 text-xl font-bold">Rēķins/Pavadzīme</h1>
							<table class="w-full max-w-[400px] border-collapse border border-black text-sm">
								<tbody>
									<tr>
										<td class="border border-black bg-gray-50 px-2 py-0.5 font-bold">Datums:</td>
										<td class="border border-black px-0 py-0" dir="rtl">
											<input
												
												type="date"
												name="issueDate"
												class="w-full border-none bg-transparent px-4 pl-6 py-0.5 text-end text-sm focus:ring-0 relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-0"
												value={formatDateInput(invoice.issueDate)}
												required
											/>
										</td>
									</tr>
									<tr>
										<td class="border border-black bg-gray-50 px-2 py-0.5 font-bold">Rēķina Nr.:</td
										>
										<td
											class="border border-black px-2 py-0.5 text-right font-bold text-gray-400 italic"
										>
											{invoice.invoiceNumber}
										</td>
									</tr>
									<tr>
										<td class="border border-black bg-gray-50 px-2 py-0.5 font-bold"
											>Apmaksas termiņš:</td
										>
										<td class="border border-black px-0 py-0">
											<input
												dir="rtl"
												type="date"
												name="dueDate"
												class="w-full border-none bg-transparent px-2 pl-6 py-0.5 text-right text-sm focus:ring-0 relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-0"
												value={formatDateInput(invoice.dueDate)}
												required
											/>
										</td>
									</tr>
                                    <tr>
										<td class="border border-black bg-gray-50 px-2 py-0.5 font-bold"
											>Language:</td
										>
										<td class="border border-black px-0 py-0">
											<select
                                                name="language"
                                                bind:value={language}
                                                class="w-full border-none bg-transparent px-1 py-0.5 text-right text-sm focus:ring-0 appearance-none"
                                            >
                                                <option value="lv">Latviešu</option>
                                                <option value="en">English</option>
                                            </select>
										</td>
									</tr>
                                     <tr>
										<td class="border border-black bg-gray-50 px-2 py-0.5 font-bold"
											>VAT (%):</td
										>
										<td class="border border-black px-0 py-0">
											<input
												type="number"
                                                step="0.1"
												name="vatRate"
                                                bind:value={vatRate}
												class="w-full border-none bg-transparent px-2 py-0.5 text-right text-sm focus:ring-0"
												required
											/>
										</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>

					<!-- 2. Supplier (Piegādātājs) -->
					<div class="mb-6">
						<div class="flex">
							<div class="w-32 font-bold">{m['invoices.supplier']()}</div>
							<div class="font-bold">{company?.name}</div>
						</div>
						<div class="flex text-sm">
							<div class="w-32">{m['clients.registration_number']()}</div>
							<div>{company?.registrationNumber}</div>
						</div>
						<div class="flex text-sm">
							<div class="w-32">{m['clients.vat_number']()}</div>
							<div>{company?.vatNumber}</div>
						</div>
						<div class="flex text-sm">
							<div class="w-32">{m['clients.address']()}</div>
							<div>{company?.address}</div>
						</div>
					</div>

					<!-- 3. Client (Maksātājs) - EDITABLE -->
					<div class="mb-8">
						<div class="mb-2 flex items-center justify-between">
							<div class="flex items-center">
								<div class="w-32 font-bold">{m['invoices.payer']()}</div>

								{#if !isNewClient}
									<Popover.Root bind:open={clientOpen}>
										<Popover.Trigger>
											{#snippet child({ props })}
												<Button
													variant="outline"
													role="combobox"
													aria-expanded={clientOpen}
													class="w-[300px] justify-between font-bold"
													{...props}
												>
													{selectedClientId
														? clients.find((c) => c.id.toString() === selectedClientId)?.name
														: 'Select Client...'}
													<ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
												</Button>
											{/snippet}
										</Popover.Trigger>
										<Popover.Content class="w-[300px] p-0">
											<Command.Root>
												<Command.Input placeholder="Search client..." />
												<Command.List>
													<Command.Empty>No client found.</Command.Empty>
													<Command.Group>
														{#each clients as client}
															<Command.Item
																value={client.name}
																onSelect={() => {
																	selectedClientId = client.id.toString();
																	clientOpen = false;
																}}
															>
																<Check
																	class={cn(
																		'mr-2 h-4 w-4',
																		selectedClientId === client.id.toString()
																			? 'opacity-100'
																			: 'opacity-0'
																	)}
																/>
																{client.name}
															</Command.Item>
														{/each}
													</Command.Group>
												</Command.List>
											</Command.Root>
										</Popover.Content>
									</Popover.Root>
									<input type="hidden" name="clientId" value={selectedClientId} />
								{:else}
									<Input
										name="newClientName"
										placeholder="Enter Client Name"
										class="h-8 w-[300px] border-gray-400 bg-white font-bold"
										required
									/>
								{/if}
							</div>

							<!-- Hidden switch for edit mode simplicity, maybe user wants to create new here? 
                                 Let's keep it consistent. -->
							<div class="flex items-center gap-2 text-xs">
								<Label for="new-client-mode">Create New Client?</Label>
								<Switch
									id="new-client-mode"
									checked={isNewClient}
									onCheckedChange={(v) => {
										isNewClient = v;
										if (v) selectedClientId = '';
									}}
								/>
								<input type="hidden" name="isNewClient" value={isNewClient} />
							</div>
						</div>

						<!-- Client Details Display/Edit -->
						{#if isNewClient}
							<!-- Editable Fields for New Client -->
							<div class="ml-32 space-y-1">
								<div class="flex items-center gap-2 text-sm">
									<Label class="w-24 text-gray-500">Reg. No.</Label>
									<Input name="newClientRegNo" class="h-6 w-48 text-sm" placeholder="Reg. Number" />
								</div>
								<div class="flex items-center gap-2 text-sm">
									<Label class="w-24 text-gray-500">VAT No.</Label>
									<Input name="newClientVatNo" class="h-6 w-48 text-sm" placeholder="VAT Number" />
								</div>
								<div class="flex items-center gap-2 text-sm">
									<Label class="w-24 text-gray-500">Address</Label>
									<Input
										name="newClientAddress"
										class="h-6 w-full max-w-md text-sm"
										placeholder="Full Address"
									/>
								</div>
								<div class="flex items-center gap-2 text-sm">
									<Label class="w-24 text-gray-500">Email</Label>
									<Input
										name="newClientEmail"
										type="email"
										class="h-6 w-64 text-sm"
										placeholder="Email (for sending)"
									/>
								</div>
							</div>
						{:else if selectedClientDetails}
							<!-- Read-only View for Selected Client -->
							<div class="ml-32 space-y-0.5 text-sm text-gray-700">
								<div>Reģ.Nr.: {selectedClientDetails.registrationNumber || '-'}</div>
								<div>PVN Nr.: {selectedClientDetails.vatNumber || '-'}</div>
								<div>Adrese: {selectedClientDetails.address || '-'}</div>
								<div class="mt-1 text-xs text-gray-400">{selectedClientDetails.email}</div>
							</div>
						{:else}
							<div class="ml-32 text-sm text-gray-400 italic">
								Select a client to see details...
							</div>
						{/if}
					</div>

					<!-- Datalist for Items -->
					<datalist id="products-list">
						{#each products as product}
							<option value={product.title}>{product.title} - {toCurrency(product.cost)} €</option>
						{/each}
					</datalist>

					<!-- 4. Items Table (Interactive) -->
					<table class="mb-4 w-full border-collapse border border-black bg-white">
						<thead>
							<tr class="bg-gray-50 text-sm">
								<th class="w-10 border border-black px-2 py-1 text-center italic"
									>{m['invoices.items.nr']()}</th
								>
								<th class="border border-black px-2 py-1 text-left italic"
									>{m['invoices.items.description']()}</th
								>
								<th class="w-24 border border-black px-2 py-1 text-center italic"
									>{m['invoices.items.unit']()}</th
								>
								<th class="w-20 border border-black px-2 py-1 text-center italic"
									>{m['invoices.items.quantity']()}</th
								>
								<th class="w-24 border border-black px-2 py-1 text-center italic"
									>{m['invoices.items.price']()} €</th
								>
								<th class="w-24 border border-black px-2 py-1 text-center italic"
									>{m['invoices.items.amount']()} €</th
								>
								<th
									class="w-8 border border-t-0 border-r-0 border-b-0 border-l-0 border-black bg-transparent"
								></th>
							</tr>
						</thead>
						<tbody class="text-sm">
							{#each items as item, i}
								<tr class="group hover:bg-slate-50">
									<td class="border border-black px-2 py-1 text-center">{i + 1}</td>
									<td class="border border-black px-0 py-0">
										<input
											value={item.description}
											oninput={(e) => handleDescriptionInput(e, i)}
											placeholder="Description"
											list="products-list"
											class="h-full w-full border-none bg-transparent px-2 py-1 text-sm focus:bg-white focus:ring-0"
										/>
									</td>
									<td class="border border-black px-0 py-0">
										<input
											bind:value={item.unit}
											placeholder="gab."
											class="h-full w-full border-none bg-transparent px-2 py-1 text-center text-sm focus:bg-white focus:ring-0"
										/>
									</td>
									<td class="border border-black px-0 py-0">
										<input
											type="number"
											step="0.01"
											value={item.quantity}
											oninput={(e) => handleQtyInput(e, i)}
											class="h-full w-full border-none bg-transparent px-2 py-1 text-center text-sm focus:bg-white focus:ring-0"
										/>
									</td>
									<td class="border border-black px-0 py-0">
										<input
											type="number"
											step="0.01"
											value={item.price / 100}
											oninput={(e) => handlePriceInput(e, i)}
											class="h-full w-full border-none bg-transparent px-2 py-1 text-right text-sm focus:bg-white focus:ring-0"
										/>
									</td>
									<td class="border border-black px-2 py-1 text-right font-bold">
										{formatMoney(item.quantity * item.price)}
									</td>
									<td class="border-none pl-2">
										<button
											type="button"
											onclick={() => removeItem(i)}
											class="text-gray-300 transition-colors hover:text-red-500"
										>
											<Trash2 size="16" />
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>

					<Button
						type="button"
						variant="outline"
						size="sm"
						class="mb-6 w-full border-dashed"
						onclick={addItem}
					>
						<Plus size="14" class="mr-2" /> {m['invoices.items.add_row']()}
					</Button>

					<div class="flex gap-4">
					<div class="mb-4 w-full">
						<Label class="mb-1 block text-sm font-bold">{m['invoices.notes']()}:</Label>
						<Textarea
							name="notes"
							placeholder="Optional notes..."
							class="h-16 resize-none text-sm"
							value={m['invoices.notes']()}
						/>
					</div>
					<!-- 5. Totals -->
					<div class="mb-6 flex flex-col items-end text-sm font-bold">
						<Label class="mb-1 block text-sm font-bold">{m['invoices.total']()}:</Label>
						<div
							class="flex w-64 justify-between border-r border-b border-l border-t border-black bg-white px-2"
						>
							<span>{m['invoices.total']()}</span>
							<span>{formatMoney(subtotal)}</span>
						</div>
						<div
							class="flex w-64 justify-between border-r border-b border-l border-black bg-white px-2"
						>
							<span>{m['invoices.summary.vat']()} {vatRate}%</span>
							<span>{formatMoney(taxAmount)}</span>
						</div>
						<div
							class="flex w-64 justify-between border-r border-b border-l border-black bg-white px-2"
						>
							<span>{m['invoices.summary.total']()} EUR</span>
							<span>{formatMoney(total)}</span>
						</div>
					</div>
					</div>


					<!-- Footer / Submit Area -->
					<div class="mt-12 flex justify-end gap-4 border-t pt-6 print:hidden">
						<!-- Hidden Task Linker -->
						<input type="hidden" name="items" value={JSON.stringify(items)} />

						<Button href="/rekini" variant="outline">{m['components.delete_modal.cancel']()}</Button>
						<Button type="submit" size="lg" class="px-8"
							>{invoice.status === 'draft' ? 'Update Draft' : 'Update Invoice'}</Button
						>
					</div>
				</form>
			</div>
		</div>

</div>
