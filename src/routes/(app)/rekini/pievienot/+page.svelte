<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
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
	import * as m from '$lib/paraglide/messages';
	import FastBreakLogo from '$lib/components/fastbreak-logo.svelte';

	let { data, form } = $props();
	const { company, clients, products } = data;

	// State
	let isNewClient = $state(false);
	let selectedClientId = $state('');
	let clientOpen = $state(false); // Popover state
	let items = $state([
		{
			description: '',
			unit: 'gab.',
			quantity: 1,
			price: 0,
			discountType: 'percent',
			discountValue: 0,
			isAutoFilled: false
		}
	]);
	let vatRate = $state(21);
	let language = $state('lv');

	// Editable Client Details State
	let clientRegNo = $state('');
	let clientVatNo = $state('');
	let clientAddress = $state('');
	let clientEmail = $state('');
	let clientBankName = $state('');
	let clientBankCode = $state('');
	let clientBankAccount = $state('');

	function itemLineTotal(item: {
		quantity: number;
		price: number;
		discountType: string;
		discountValue: number;
	}): number {
		const raw = item.quantity * item.price;
		if (!item.discountValue) return raw;
		if (item.discountType === 'fixed') return Math.max(0, raw - item.discountValue);
		return Math.round(raw * (1 - item.discountValue / 100));
	}

	// Derived Calculations
	let subtotal = $derived(items.reduce((acc, item) => acc + itemLineTotal(item), 0));
	let taxAmount = $derived(subtotal * (vatRate / 100));
	let total = $derived(subtotal + taxAmount);

	function addItem() {
		items = [
			...items,
			{
				description: '',
				unit: 'gab.',
				quantity: 1,
				price: 0,
				discountType: 'percent',
				discountValue: 0,
				isAutoFilled: false
			}
		];
	}

	function removeItem(index: number) {
		items = items.filter((_, i) => i !== index);
	}

	function handlePriceInput(e: Event, index: number) {
		const input = e.target as HTMLInputElement;
		const val = parseFloat(input.value);
		items[index].price = Math.round(val * 100);
		items[index].isAutoFilled = false;
	}

	function handleQtyInput(e: Event, index: number) {
		const input = e.target as HTMLInputElement;
		items[index].quantity = parseFloat(input.value);
	}

	function handleDiscountInput(e: Event, index: number) {
		const input = e.target as HTMLInputElement;
		const val = parseFloat(input.value) || 0;
		items[index].discountValue =
			items[index].discountType === 'fixed' ? Math.round(val * 100) : val;
	}

	function toggleDiscountType(index: number) {
		items[index].discountType = items[index].discountType === 'percent' ? 'fixed' : 'percent';
		items[index].discountValue = 0;
	}

	function handleDescriptionInput(e: Event, index: number) {
		const input = e.target as HTMLInputElement;
		const val = input.value;
		items[index].description = val;

		// Check for exact match in products (by default title or translated title)
		const match = products.find(
			(p: any) =>
				p.title === val ||
				p.translations?.find((t: any) => t.language === language && t.title === val)
		);
		if (match) {
			const clientPriceEntry = selectedClientId
				? match.clientPrices?.find((cp: any) => cp.clientId.toString() === selectedClientId)
				: null;
			items[index].price = clientPriceEntry ? clientPriceEntry.price : match.price;
			items[index].isAutoFilled = true;
		}
	}

	// Auto-fill client details when existing client is selected
	let selectedClientDetails = $derived(
		selectedClientId ? clients.find((c) => c.id.toString() === selectedClientId) : null
	);

	$effect(() => {
		if (selectedClientDetails) {
			vatRate = selectedClientDetails.vatRate;
			clientRegNo = selectedClientDetails.registrationNumber || '';
			clientVatNo = selectedClientDetails.vatNumber || '';
			clientAddress = selectedClientDetails.address || '';
			clientEmail = selectedClientDetails.email || '';
			clientBankName = selectedClientDetails.bankName || '';
			clientBankCode = selectedClientDetails.bankCode || '';
			clientBankAccount = selectedClientDetails.bankAccount || '';

			// Recalculate auto-filled item prices for the new client.
			// Read items via untrack so this effect doesn't subscribe to `items` as a
			// dependency � otherwise writing items would immediately re-trigger the effect.
			const snapshot = untrack(() => items);
			items = snapshot.map((item) => {
				if (item.isAutoFilled) {
					const match = products.find((p: any) => p.title === item.description);
					if (match) {
						const clientPriceEntry = match.clientPrices?.find(
							(cp: any) => cp.clientId === selectedClientDetails!.id
						);
						item.price = clientPriceEntry ? clientPriceEntry.price : match.price;
					}
				}
				return item;
			});
		} else if (!isNewClient) {
			// Reset if no client selected and not in new client mode
			clientRegNo = '';
			clientVatNo = '';
			clientAddress = '';
			clientEmail = '';
			clientBankName = '';
			clientBankCode = '';
			clientBankAccount = '';
		}
	});

	$effect(() => {
		// Auto-fill from task if provided � run once on mount using untrack for all state assignments
		// to prevent reactive writes from re-triggering this effect (avoids effect_update_depth_exceeded).
		if (data.prefillTask) {
			untrack(() => {
				if (!selectedClientId && data.prefillTask!.clientId) {
					selectedClientId = data.prefillTask!.clientId.toString();
				}

				if (data.prefillTask!.taskProducts && data.prefillTask!.taskProducts.length > 0) {
					items = data.prefillTask!.taskProducts.map((tp: any) => ({
						description: tp.product.title,
						unit: 'gab.',
						quantity: tp.count || 1,
						price: tp.product.effectivePrice ?? tp.product.price, // price in cents
						discountType: 'percent',
						discountValue: 0,
						isAutoFilled: true
					}));
				} else {
					// If no products, use task title as description with task price
					items = [
						{
							description: data.prefillTask!.title,
							unit: 'gab.',
							quantity: 1,
							price: data.prefillTask!.price || 0,
							discountType: 'percent',
							discountValue: 0,
							isAutoFilled: false
						}
					];
				}
			});
		}
	});

	$effect(() => {
		// Auto-fill from a duplicated invoice � run once on mount.
		if (data.prefillInvoice) {
			untrack(() => {
				const src = data.prefillInvoice!;
				if (src.clientId) selectedClientId = src.clientId.toString();
				if (src.taxRate != null) vatRate = src.taxRate;
				if (src.language) language = src.language;
				if (src.items && src.items.length > 0) {
					items = src.items.map((i: any) => ({
						description: i.description,
						unit: i.unit,
						quantity: i.quantity,
						price: i.price,
						discountType: i.discountType ?? 'percent',
						discountValue: i.discountValue ?? 0,
						isAutoFilled: false
					}));
				}
			});
		}
	});

	const formatMoney = (cents: number) => (cents / 100).toFixed(2);

	let pickerOpen = $state<Record<number, boolean>>({});

	function normalizeText(text: string): string {
		return text
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9\s]/g, '')
			.trim();
	}

	function getFilteredProducts(search: string) {
		if (!search) return products;
		const norm = normalizeText(search);
		return products.filter((p: any) => normalizeText(getProductTitle(p, language)).includes(norm));
	}

	function selectProduct(index: number, product: any) {
		items[index].description = getProductTitle(product, language);
		const clientPriceEntry = selectedClientId
			? product.clientPrices?.find((cp: any) => cp.clientId.toString() === selectedClientId)
			: null;
		items[index].price = clientPriceEntry ? clientPriceEntry.price : product.price;
		items[index].isAutoFilled = true;
		pickerOpen[index] = false;
	}

	function getProductTitle(product: any, lang: string): string {
		const translation = product.translations?.find((t: any) => t.language === lang);
		return translation?.title || product.title;
	}

	function findProductByAnyTitle(title: string): any {
		return products.find(
			(p: any) => p.title === title || p.translations?.some((t: any) => t.title === title)
		);
	}

	// When language changes, re-translate descriptions of auto-filled items
	$effect(() => {
		const lang = language;
		const snapshot = untrack(() => items);
		const updated = snapshot.map((item) => {
			if (!item.isAutoFilled) return item;
			const match = findProductByAnyTitle(item.description);
			if (match) {
				return { ...item, description: getProductTitle(match, lang) };
			}
			return item;
		});
		// Only write back if something actually changed
		if (updated.some((item, i) => item.description !== snapshot[i].description)) {
			items = updated;
		}
	});
</script>

<svelte:head>
	<title>Create Invoice</title>
</svelte:head>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
	<div class="custom-scroll max-h-[90vh] w-full max-w-[70vw] overflow-y-scroll rounded-lg">
		<!-- Paper Container -->
		<div
			class="relative mx-auto bg-white p-12 font-sans text-black shadow-md"
			style="font-family: Arial, sans-serif;"
		>
			<form method="POST" use:enhance>
				{#if form?.message}
					<div class="mb-4">
						<FormError error={form.message} />
					</div>
				{/if}

				{#if data.prefillTask}
					<input type="hidden" name="taskId" value={data.prefillTask.id} />
				{/if}

				<!-- 1. Header Row -->
				<div class="mb-2 flex items-start justify-between">
					<!-- Logo -->
					<div class="w-1/2">
						<FastBreakLogo />
					</div>

					<!-- Invoice Meta Table -->
					<div class="flex w-1/2 flex-col items-end">
						<h1 class="mb-2 text-xl font-bold">Rekins/Pavadzime</h1>
						<table class="w-full max-w-[300px] border-collapse border border-black text-sm">
							<tbody>
								<tr>
									<td class="border border-black bg-gray-50 px-2 py-0.5 font-bold"
										>{m['invoices.issue_date']()}:</td
									>
									<td class="border border-black px-0 py-0">
										<input
											type="date"
											name="issueDate"
											class="relative w-full border-none bg-transparent px-2 py-0.5 pl-6 text-right text-sm focus:ring-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-0"
											value={new Date().toISOString().split('T')[0]}
											required
										/>
									</td>
								</tr>
								<tr>
									<td class="border border-black bg-gray-50 px-2 py-0.5 font-bold"
										>{m['invoices.number']()}:</td
									>
									<td
										class="border border-black px-2 py-0.5 text-right font-bold text-gray-400 italic"
									>
										(Auto-generated)
									</td>
								</tr>
								<tr>
									<td class="border border-black bg-gray-50 px-2 py-0.5 font-bold"
										>{m['invoices.due_date']()}:</td
									>
									<td class="border border-black px-0 py-0">
										<input
											type="date"
											name="dueDate"
											class="relative w-full border-none bg-transparent px-2 py-0.5 pl-6 text-right text-sm focus:ring-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-0"
											value={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
												.toISOString()
												.split('T')[0]}
											required
										/>
									</td>
								</tr>
								<tr>
									<td class="border border-black bg-gray-50 px-2 py-0.5 font-bold"
										>{m['invoices.language']()}:</td
									>
									<td class="border border-black px-0 py-0">
										<select
											name="language"
											bind:value={language}
											class="w-full appearance-none border-none bg-transparent px-1 py-0.5 text-right text-sm focus:ring-0"
										>
											<option value="lv">Latviešu</option>
											<option value="en">English</option>
										</select>
									</td>
								</tr>
								<tr>
									<td class="border border-black bg-gray-50 px-2 py-0.5 font-bold">VAT (%):</td>
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

				<!-- 2. Supplier (Piegadatajs) -->
				<div class="mb-2">
					<div class="flex">
						<div class="w-32 font-bold">{m['invoices.supplier']()}</div>
						<div class="font-bold">{company?.name}</div>
					</div>
					<div class="flex text-sm">
						<div class="w-32">{m['invoices.registration_number']()}</div>
						<div>{company?.registrationNumber}</div>
					</div>
					<div class="flex text-sm">
						<div class="w-32">{m['invoices.vat_number']()}</div>
						<div>{company?.vatNumber}</div>
					</div>
					<div class="flex text-sm">
						<div class="w-32">{m['invoices.address']()}</div>
						<div>{company?.address}</div>
					</div>
				</div>

				<!-- 3. Client (Maksatajs) - EDITABLE -->
				<div class="mb-2">
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
													: m['clients.search']()}
												<ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
											</Button>
										{/snippet}
									</Popover.Trigger>
									<Popover.Content class="w-[300px] p-0">
										<Command.Root>
											<Command.Input placeholder="Search client..." />
											<Command.List>
												<Command.Empty>{m['clients.empty']()}</Command.Empty>
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
									placeholder={m['clients.name_placeholder']()}
									class="h-8 w-[300px] border-gray-400 bg-white font-bold"
									required
								/>
							{/if}
						</div>

						<div class="flex items-center gap-2 text-xs">
							<Label for="new-client-mode">{m['invoices.new_client']()}</Label>
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
						<div class="space-y-1">
							<div class="flex items-center text-sm">
								<Label class="w-32 text-gray-500">{m['invoices.registration_number']()}</Label>
								<Input
									name="newClientRegNo"
									class="h-6 w-48 text-sm"
									placeholder={m['clients.registration_number_placeholder']()}
								/>
							</div>
							<div class="flex items-center text-sm">
								<Label class="w-32 text-gray-500">{m['invoices.vat_number']()}</Label>
								<Input
									name="newClientVatNo"
									class="h-6 w-48 text-sm"
									placeholder={m['clients.vat_number_placeholder']()}
								/>
							</div>
							<div class="flex items-center text-sm">
								<Label class="w-32 text-gray-500">{m['invoices.address']()}</Label>
								<Input
									name="newClientAddress"
									class="h-6 w-full max-w-md text-sm"
									placeholder={m['clients.address_placeholder']()}
								/>
							</div>
							<div class="flex items-center text-sm">
								<Label class="w-32 text-gray-500">
									{m['invoices.email']()}<span class="ml-0.5 text-red-500">*</span>
								</Label>
								<Input
									name="newClientEmail"
									type="email"
									class="h-6 w-64 text-sm"
									placeholder={m['clients.email_placeholder']()}
								/>
							</div>
							<div class="flex items-center text-sm">
								<Label class="w-32 text-gray-500">
									{m['invoices.phone']()}<span class="ml-0.5 text-red-500">*</span>
								</Label>
								<Input
									name="newClientPhone"
									type="tel"
									class="h-6 w-64 text-sm"
									placeholder="+371 23456789"
								/>
							</div>
							<div class="flex items-center text-sm">
								<Label class="w-32 text-gray-500">{m['invoices.bank']()}</Label>
								<Input
									name="newClientBankName"
									class="h-6 w-48 text-sm"
									placeholder={m['clients.bank_placeholder']()}
								/>
							</div>
							<div class="flex items-center text-sm">
								<Label class="w-32 text-gray-500">{m['invoices.swift']()}</Label>
								<Input
									name="newClientBankCode"
									class="h-6 w-48 text-sm"
									placeholder={m['clients.swift_placeholder']()}
								/>
							</div>
							<div class="flex items-center text-sm">
								<Label class="w-32 text-gray-500">{m['invoices.bank_account']()}</Label>
								<Input
									name="newClientBankAccount"
									class="h-6 w-64 text-sm"
									placeholder={m['clients.bank_account_placeholder']()}
								/>
							</div>
							<p class="ml-32 text-xs text-gray-400">{m['invoices.phone_or_email_required']()}</p>
						</div>
					{:else if selectedClientDetails}
						<!-- Editable View for Selected Client -->
						<div class=" space-y-1">
							<div class="flex items-center text-sm">
								<Label class="w-32 text-gray-500">{m['invoices.registration_number']()}</Label>
								<Input
									name="clientRegNo"
									bind:value={clientRegNo}
									class="h-6 w-48 text-sm"
									placeholder="Reg. Number"
								/>
							</div>
							<div class="flex items-center text-sm">
								<Label class="w-32 text-gray-500">{m['invoices.vat_number']()}</Label>
								<Input
									name="clientVatNo"
									bind:value={clientVatNo}
									class="h-6 w-48 text-sm"
									placeholder="VAT Number"
								/>
							</div>
							<div class="flex items-center text-sm">
								<Label class="w-32 text-gray-500">{m['invoices.address']()}</Label>
								<Input
									name="clientAddress"
									bind:value={clientAddress}
									class="h-6 w-full max-w-md text-sm"
									placeholder={m['clients.address_placeholder']()}
								/>
							</div>
							<div class="flex items-center text-sm">
								<Label class="w-32 text-gray-500">{m['invoices.email']()}</Label>
								<Input
									name="clientEmail"
									type="email"
									bind:value={clientEmail}
									class="h-6 w-64 text-sm"
									placeholder="Email"
								/>
							</div>
							<div class="flex items-center text-sm">
								<Label class="w-32 text-gray-500">{m['invoices.bank']()}</Label>
								<Input
									name="clientBankName"
									bind:value={clientBankName}
									class="h-6 w-48 text-sm"
									placeholder="Bank name"
								/>
							</div>
							<div class="flex items-center text-sm">
								<Label class="w-32 text-gray-500">{m['invoices.swift']()}</Label>
								<Input
									name="clientBankCode"
									bind:value={clientBankCode}
									class="h-6 w-48 text-sm"
									placeholder={m['clients.swift_placeholder']()}
								/>
							</div>
							<div class="flex items-center text-sm">
								<Label class="w-32 text-gray-500">{m['invoices.bank_account']()}</Label>
								<Input
									name="clientBankAccount"
									bind:value={clientBankAccount}
									class="h-6 w-64 text-sm"
									placeholder={m['clients.bank_account_placeholder']()}
								/>
							</div>
							<div class="flex items-center pt-2">
								<div class="flex items-center space-x-2">
									<input
										type="checkbox"
										id="updateClientDetails"
										name="updateClientDetails"
										class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
										checked
									/>
									<label
										for="updateClientDetails"
										class="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
									>
										{m['invoices.update_client_details']()}
									</label>
								</div>
							</div>
						</div>
					{:else}
						<div class="ml-32 text-sm text-gray-400 italic">
							{m['invoices.select_client_to_see_details']()}
						</div>
					{/if}
				</div>

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
								>{m['invoices.items.price']()} �</th
							>
							<th class="w-32 border border-black px-2 py-1 text-center italic">Atlaide</th>
							<th class="w-24 border border-black px-2 py-1 text-center italic"
								>{m['invoices.items.amount']()} �</th
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
								<td class="relative border border-black px-0 py-0">
									<input
										value={item.description}
										onfocus={() => (pickerOpen[i] = true)}
										onblur={() => setTimeout(() => (pickerOpen[i] = false), 150)}
										oninput={(e) => {
											handleDescriptionInput(e, i);
											pickerOpen[i] = true;
										}}
										placeholder={m['invoices.items.description']()}
										class="h-full w-full border-none bg-transparent px-2 py-1 text-sm focus:bg-white focus:ring-0"
									/>
									{#if pickerOpen[i]}
										{@const filtered = getFilteredProducts(item.description)}
										{#if filtered.length > 0}
											<ul
												class="custom-scroll absolute top-full left-0 z-50 max-h-60 w-72 overflow-y-auto rounded border border-gray-200 bg-white py-1 text-sm shadow-lg"
											>
												{#each filtered as product (product.id)}
													{@const title = getProductTitle(product, language)}
													{@const clientPrice = selectedClientId
														? product.clientPrices?.find(
																(cp: any) => cp.clientId.toString() === selectedClientId
															)?.price
														: null}
													<li>
														<button
															type="button"
															onmousedown={() => selectProduct(i, product)}
															class="flex w-full items-center justify-between px-3 py-1.5 hover:bg-gray-100"
														>
															<span class="truncate">{title}</span>
															<span class="ml-2 shrink-0 text-xs text-gray-400"
																>{toCurrency(clientPrice ?? product.price)} €</span
															>
														</button>
													</li>
												{/each}
											</ul>
										{/if}
									{/if}
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
								<td class="border border-black px-0 py-0">
									<div class="flex h-full items-stretch">
										<button
											type="button"
											onclick={() => toggleDiscountType(i)}
											class="border-r border-black px-1.5 py-1 text-xs font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-800"
										>
											{item.discountType === 'percent' ? '%' : '�'}
										</button>
										<input
											type="number"
											step="0.01"
											min="0"
											value={item.discountType === 'percent'
												? item.discountValue
												: item.discountValue / 100}
											oninput={(e) => handleDiscountInput(e, i)}
											class="h-full w-full border-none bg-transparent px-2 py-1 text-right text-sm focus:bg-white focus:ring-0"
										/>
									</div>
								</td>
								<td class="border border-black px-2 py-1 text-right font-bold">
									{formatMoney(itemLineTotal(item))}
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
					<Plus size="14" class="mr-2" />
					{m['invoices.items.add_row']()}
				</Button>
				<div class="flex gap-4">
					<div class="mb-4 w-full">
						<Label class="mb-1 block text-sm font-bold">{m['invoices.notes']()}:</Label>
						<Textarea
							name="notes"
							placeholder={m['invoices.notes']()}
							class="h-16 resize-none text-sm"
						/>
					</div>
					<!-- 5. Totals -->
					<div class="mb-6 flex flex-col items-end text-sm font-bold">
						<Label class="mb-1 block text-sm font-bold">{m['invoices.total']()}:</Label>
						<div
							class="flex w-64 justify-between border-t border-r border-b border-l border-black bg-white px-2"
						>
							<span>{m['invoices.summary.subtotal']()}</span>
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

				<!-- Footnote -->
				<div class="mt-8 text-sm italic">
					Rekins/pavadzime ir izrakstits elektroniski un ir derigs bez paraksta
				</div>

				<!-- Payment & Delivery Terms -->
				<div class="mt-4 text-xs text-gray-600">
					{#if language === 'en'}
						Payment and Delivery Terms: By paying this invoice, the client confirms the accuracy of
						the invoice details and agrees to the SIA "FAST BREAK" terms and conditions
						(fastbreak.lv/noteikumi). The client assumes full responsibility for any customs duties,
						taxes, or additional charges that may arise when shipping goods internationally. SIA
						"FAST BREAK" is not liable for any delivery delays caused by delivery operators (courier
						services).
					{:else}
						Apmaksas un piegades noteikumi: Veicot šo rēķina apmaksu, klients apstiprina rēķina datu
						pareizību un piekrīt SIA "FAST BREAK" noteikumiem (fastbreak.lv/noteikumi). Klients
						uzņemas pilnu atbildību par jebkādiem muitas nodokļiem, nodevām vai papildu izmaksām,
						kas var rasties, piegādājot preces ārvalstīs. SIA "FAST BREAK" neuzņemas atbildību par
						piegādes termiņu kavēšanos, ja tā radusies piegādes operatoru (kurjeru dienestu)
						darbības rezultātā.
					{/if}
				</div>

				<!-- Footer / Submit Area -->
				<div class="mt-12 flex justify-end gap-4 border-t pt-6 print:hidden">
					<!-- Hidden Task Linker (Optional for this layout, maybe keep it simple) -->
					<input type="hidden" name="items" value={JSON.stringify(items)} />

					<Button href="/rekini" variant="outline">{m['components.delete_modal.cancel']()}</Button>
					<Button type="submit" class="cursor-pointer px-8">{m['components.save']()}</Button>
				</div>
			</form>
		</div>
	</div>
</div>
