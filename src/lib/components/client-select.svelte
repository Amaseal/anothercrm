<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { Check, ChevronsUpDown, Plus } from '@lucide/svelte';
	import * as Command from '$lib/components/ui/command';
	import * as Popover from '$lib/components/ui/popover';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { cn } from '$lib/utils';
	import * as Select from '$lib/components/ui/select';
	import FormError from '$lib/components/form-error.svelte';

	interface Client {
		id: number | string;
		name: string;
		[key: string]: any;
	}

	let { clients = $bindable([]), value = $bindable('') }: { clients: Client[]; value: string } =
		$props();

	let open = $state(false);
	let dialogOpen = $state(false);
	let loading = $state(false);

	// Form states
	let name = $state('');
	let email = $state('');
	let phone = $state('');
	let address = $state('');
	let type = $state('BTC');
	let registrationNumber = $state('');
	let vatNumber = $state('');
	let bankName = $state('');
	let bankCode = $state('');
	let bankAccount = $state('');
	let description = $state('');
	let error = $state('');

	let triggerRef = $state<HTMLElement | null>(null);
	let triggerWidth = $state(0);

	let selectedLabel = $derived(
		clients.find((c) => c.id.toString() === value)?.name || m['projects.client_label']()
	);

	// Sync width when opening
	$effect(() => {
		if (open && triggerRef) {
			triggerWidth = triggerRef.offsetWidth;
		}
	});

	// Reset form when dialog opens/closes
	$effect(() => {
		if (!dialogOpen) {
			name = '';
			email = '';
			phone = '';
			address = '';
			type = 'BTC';
			registrationNumber = '';
			vatNumber = '';
			bankName = '';
			bankCode = '';
			bankAccount = '';
			description = '';
			error = '';
		}
	});

	async function createClient() {
		error = '';
		if (!name) {
			error = m['clients.errors.name_required']();
			return;
		}
		if (!email && !phone) {
			error = m['clients.errors.contacts_invalid']();
			return;
		}

		loading = true;
		try {
			const response = await fetch('/api/clients', {
				method: 'POST',
				body: JSON.stringify({
					name,
					email,
					phone,
					address,
					type,
					registrationNumber,
					vatNumber,
					bankName,
					bankCode,
					bankAccount,
					description
				}),
				headers: { 'Content-Type': 'application/json' }
			});

			if (response.ok) {
				const newClient = await response.json();
				clients = [...clients, newClient];
				value = newClient.id.toString();
				open = false;
				dialogOpen = false;
			} else {
				const res = await response.json();
				error = res.error || m['clients.errors.something_went_wrong']();
			}
		} catch (e) {
			console.error(e);
			error = m['clients.errors.something_went_wrong']();
		} finally {
			loading = false;
		}
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger class={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-between')}>
		{selectedLabel}
		<ChevronsUpDown class="ml-2 h-4 w-4 opacity-50" />
	</Popover.Trigger>
	<Popover.Content class="w-[var(--bits-popover-anchor-width)] p-0">
		<Command.Root>
			<Command.Input placeholder={m['clients.search']()} />
			<Command.List class="w-full">
				<Command.Empty class="flex w-full flex-col items-center gap-2 p-4">
					<span class="text-sm text-muted-foreground">{m['clients.empty']()}</span>
					<Button variant="ghost" size="sm" class="w-full" onclick={() => (dialogOpen = true)}>
						<Plus class="mr-2 h-4 w-4" />
						{m['clients.add_client']()}
					</Button>
				</Command.Empty>
				<Command.Group>
					{#each clients as client}
						<Command.Item
							value={client.name}
							onSelect={() => {
								value = client.id.toString();
								open = false;
							}}
						>
							<Check
								class={cn(
									'mr-2 h-4 w-4',
									value === client.id.toString() ? 'opacity-100' : 'opacity-0'
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

<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Content class="max-h-[90vh] w-full max-w-md overflow-hidden p-0">
		<Dialog.Header class="px-6 pt-6">
			<Dialog.Title>{m['clients.add_client']()}</Dialog.Title>
		</Dialog.Header>
		<div class="custom-scroll max-h-[calc(90vh-80px)] overflow-y-auto px-6 pb-6">
			<div class="grid gap-4 py-4">
				<!-- Row 1: Name and Type -->
				<div class="flex items-center justify-stretch gap-2">
					<div class="flex-1">
						<Label for="name">{m['clients.name']()}</Label>
						<Input id="name" bind:value={name} placeholder={m['clients.name_placeholder']()} />
					</div>
					<div class="w-full flex-1">
						<Label>{m['clients.type']()}</Label>
						<Select.Root type="single" bind:value={type}>
							<Select.Trigger class="w-full">{type}</Select.Trigger>
							<Select.Content>
								<Select.Item value="BTC">BTC</Select.Item>
								<Select.Item value="BTB">BTB</Select.Item>
							</Select.Content>
						</Select.Root>
					</div>
				</div>

				<!-- Row 2: Registration and VAT -->
				<div class="flex items-center gap-2">
					<div class="flex-1">
						<Label for="reg_number">{m['clients.registration_number']()}</Label>
						<Input
							id="reg_number"
							bind:value={registrationNumber}
							placeholder={m['clients.registration_number_placeholder']()}
						/>
					</div>
					<div class="flex-1">
						<Label for="vat_number">{m['clients.vat_number']()}</Label>
						<Input
							id="vat_number"
							bind:value={vatNumber}
							placeholder={m['clients.vat_number_placeholder']()}
						/>
					</div>
				</div>

				<!-- Row 3: Address -->
				<div class="grid gap-2">
					<Label for="address">{m['clients.address']()}</Label>
					<Input
						id="address"
						bind:value={address}
						placeholder={m['clients.address_placeholder']()}
					/>
				</div>

				<!-- Row 4: Bank and Swift -->
				<div class="flex items-center gap-2">
					<div class="flex-1">
						<Label for="bank">{m['clients.bank']()}</Label>
						<Input id="bank" bind:value={bankName} placeholder={m['clients.bank_placeholder']()} />
					</div>
					<div class="flex-1">
						<Label for="swift">{m['clients.swift']()}</Label>
						<Input
							id="swift"
							bind:value={bankCode}
							placeholder={m['clients.swift_placeholder']()}
						/>
					</div>
				</div>

				<!-- Row 5: Bank Account -->
				<div class="grid gap-2">
					<Label for="bank_account">{m['clients.bank_account']()}</Label>
					<Input
						id="bank_account"
						bind:value={bankAccount}
						placeholder={m['clients.bank_account_placeholder']()}
					/>
				</div>

				<!-- Row 6: Phone -->
				<div class="grid gap-2">
					<Label for="phone">{m['clients.phone']()}</Label>
					<Input id="phone" bind:value={phone} placeholder={m['clients.phone_placeholder']()} />
				</div>

				<!-- Row 7: Email -->
				<div class="grid gap-2">
					<Label for="email">{m['clients.email']()}</Label>
					<Input id="email" bind:value={email} placeholder={m['clients.email_placeholder']()} />
				</div>

				<!-- Row 8: Description -->
				<div class="grid gap-2">
					<Label for="description">{m['clients.description']()}</Label>
					<Textarea
						id="description"
						bind:value={description}
						placeholder={m['clients.description_placeholder']()}
					/>
				</div>
				{#if error}
					<FormError {error} />
				{/if}
			</div>
			<div class="flex justify-end pt-4">
				<Button variant="outline" type="button" class="mr-2" onclick={() => (dialogOpen = false)}>
					{m['components.cancel']()}
				</Button>
				<Button onclick={createClient} type="button" disabled={loading}
					>{m['components.save']()}</Button
				>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
