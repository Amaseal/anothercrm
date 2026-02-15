<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import * as Select from '$lib/components/ui/select/index.js';

	import * as Card from '$lib/components/ui/card/index.js';
	import X from '@lucide/svelte/icons/x';
	import { enhance } from '$app/forms';
	import Label from '@/components/ui/label/label.svelte';
	import type { ClientType } from '$lib/server/db/schema';
	import * as m from '$lib/paraglide/messages';
	import FormError from '$lib/components/form-error.svelte';

	let { data, form } = $props();

	const types: { value: ClientType; label: string }[] = [
		{ value: 'BTC', label: 'B2C' },
		{ value: 'BTB', label: 'B2B' }
	];

	let value = $state(data.item.type);

	const triggerContent = $derived(
		types.find((f) => f.value === value)?.label ?? m['clients.type_placeholder']()
	);
</script>

<svelte:head>
	<title>{m['clients.add_client']()}</title>
</svelte:head>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
	<div class="max-h-[90vh] w-full max-w-md overflow-hidden rounded-lg">
		<Card.Root class="custom-scroll relative max-h-[90vh] w-full max-w-md gap-2 overflow-y-auto">
			<Card.Header>
				<a
					href="/klienti"
					class="absolute top-7 right-5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
					><X /></a
				>

				<h2 class="text-lg font-semibold">{m['clients.add_client']()}</h2>
			</Card.Header>
			<Card.Content class="p-6 pb-2">
				<form method="POST" use:enhance>
					<div class="flex items-center justify-stretch gap-2">
						<div class="flex-1">
							<Label>{m['clients.name']()}</Label>
							<Input
								placeholder={m['clients.name_placeholder']()}
								required
								name="name"
								value={data.item.name}
							/>
						</div>
						<div class="flex-1">
							<Label>{m['clients.type']()}</Label>
							<Select.Root type="single" name="type" bind:value>
								<Select.Trigger class="w-full bg-background">
									{triggerContent}
								</Select.Trigger>
								<Select.Content>
									{#each types as type (type.value)}
										<Select.Item value={type.value} label={type.label} />
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<div class="flex-1">
							<Label>{m['clients.registration_number']()}</Label>
							<Input
								placeholder={m['clients.registration_number_placeholder']()}
								name="reg_number"
								value={data.item.registrationNumber}
							/>
						</div>
						<div class="flex-1">
							<Label>{m['clients.vat_number']()}</Label>
							<Input
								placeholder={m['clients.vat_number_placeholder']()}
								name="vat_number"
								value={data.item.vatNumber}
							/>
						</div>
					</div>

					<div class="flex-1">
						<Label>{m['clients.address']()}</Label>
						<Input
							placeholder={m['clients.address_placeholder']()}
							name="address"
							value={data.item.address}
						/>
					</div>
					<div class="flex items-center gap-2">
						<div class="flex-1">
							<Label>{m['clients.bank']()}</Label>
							<Input
								placeholder={m['clients.bank_placeholder']()}
								name="bank"
								value={data.item.bankName}
							/>
						</div>
						<div class="flex-1">
							<Label>{m['clients.swift']()}</Label>
							<Input
								placeholder={m['clients.swift_placeholder']()}
								name="swift"
								value={data.item.bankCode}
							/>
						</div>
					</div>

					<Label>{m['clients.bank_account']()}</Label>
					<Input
						placeholder={m['clients.bank_account_placeholder']()}
						name="bank_account"
						value={data.item.bankAccount}
					/>

					<Label>{m['clients.phone']()}</Label>
					<Input
						placeholder={m['clients.phone_placeholder']()}
						name="phone"
						value={data.item.phone}
					/>

					<Label>{m['clients.email']()}</Label>
					<Input
						placeholder={m['clients.email_placeholder']()}
						name="email"
						value={data.item.email}
					/>

					<Label>{m['clients.sport_type']()}</Label>
					<Input
						placeholder={m['clients.sport_type_placeholder']()}
						name="sport_type"
						value={data.item.sportType}
					/>

					<Label>{m['clients.description']()}</Label>
					<Textarea
						class=""
						placeholder={m['clients.description_placeholder']()}
						name="description"
						value={data.item.description}
					/>
					{#if form?.message}
						<FormError error={form?.message} />
					{/if}
					<div class="mt-6 flex justify-end">
						<Button type="submit">{m['components.save']()}</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>
	</div>
</div>
