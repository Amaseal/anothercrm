<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
    import * as Select from '$lib/components/ui/select';
    import { Textarea } from '$lib/components/ui/textarea';
    import { toast } from 'svelte-sonner';
    import { copyToClipboard } from '$lib/utilities';

	let { data, form } = $props();

    let inviteRole = $state<'admin' | 'client'>('client');
    let selectedClientId = $state('');

    // If an invite code was just generated, show it
    let generatedCode = $state(form?.code || '');

    $effect(() => {
        if (form?.success) {
            toast.success(m['components.saved_successfully']());
        }
        if (form?.code) {
             generatedCode = form.code;
        }
         if (form?.message) {
            toast.error(form.message);
        }
    });

    let selectedClientName = $derived(
		data.clients.find((c) => c.id.toString() === selectedClientId)?.name ||
			m['projects.client_label']()
	);

</script>

<div class="container mx-auto py-10 space-y-8">
	<h1 class="text-3xl font-bold">{m['settings.title']()}</h1>

    <!-- SECTION 1: Profile Settings (All Users) -->
    <Card.Root>
        <Card.Header>
            <Card.Title>{m['settings.profile_settings']()}</Card.Title>
            <Card.Description>{m['settings.profile_description']()}</Card.Description>
        </Card.Header>
        <Card.Content>
            <form method="POST" action="?/updateProfile" use:enhance class="space-y-4">
                 <div class="grid gap-2">
                    <Label for="name">{m['settings.name']()}</Label>
                    <Input id="name" value={data.user.name} disabled />
                </div>
                 <div class="grid gap-2">
                    <Label for="email">{m['settings.email']()}</Label>
                    <Input id="email" value={data.user.email} disabled />
                </div>
                 <div class="grid gap-2">
                    <Label for="password">{m['settings.new_password']()}</Label>
                    <Input id="password" name="password" type="password" />
                </div>
                 <div class="grid gap-2">
                    <Label for="confirm_password">{m['settings.confirm_password']()}</Label>
                    <Input id="confirm_password" name="confirm_password" type="password" />
                </div>
                <Button type="submit">{m['components.save']()}</Button>
            </form>
        </Card.Content>
    </Card.Root>

    <!-- SECTION 2: Admin Only Settings -->
    {#if data.user.type === 'admin'}
        <Card.Root>
            <Card.Header>
                <Card.Title>{m['settings.system_settings']()}</Card.Title>
                <Card.Description>{m['settings.system_settings_description']()}</Card.Description>
            </Card.Header>
            <Card.Content>
                <form method="POST" action="?/updateSettings" use:enhance class="space-y-4">
                    <div class="grid gap-2">
                        <Label for="nextcloud">{m['settings.nextcloud_url']()}</Label>
                        <Input id="nextcloud" name="nextcloud" value={data.userSettings?.nextcloud || ''} placeholder="https://nextcloud.example.com" />
                    </div>
                    <div class="grid gap-2">
                        <Label for="nextcloud_username">{m['settings.nextcloud_username']()}</Label>
                        <Input id="nextcloud_username" name="nextcloud_username" value={data.userSettings?.nextcloud_username || ''} />
                    </div>
                     <div class="grid gap-2">
                        <Label for="nextcloud_password">{m['settings.nextcloud_password']()}</Label>
                        <Input id="nextcloud_password" name="nextcloud_password" type="password" placeholder={data.userSettings?.nextcloud_password ? '********' : ''} />
                    </div>
                    <Button type="submit">{m['components.save']()}</Button>
                </form>
            </Card.Content>
        </Card.Root>

        <Card.Root>
            <Card.Header>
                <Card.Title>{m['settings.invite_codes']()}</Card.Title>
                 <Card.Description>{m['settings.invite_codes_description']()}</Card.Description>
            </Card.Header>
            <Card.Content>
                 <form method="POST" action="?/generateInvite" use:enhance class="space-y-4">
                    <div class="grid gap-2">
                         <Label>{m['settings.role']()}</Label>
                         <Select.Root type="single" bind:value={inviteRole}>
                            <Select.Trigger class="w-full">
                                {inviteRole === 'admin' ? m['roles.admin']() : m['roles.client']()}
                            </Select.Trigger>
                            <Select.Content>
                                <Select.Item value="admin" label={m['roles.admin']()} />
                                <Select.Item value="client" label={m['roles.client']()} />
                            </Select.Content>
                        </Select.Root>
                        <input type="hidden" name="role" value={inviteRole} />
                    </div>

                    {#if inviteRole === 'client'}
                         <div class="grid gap-2">
                            <Label>{m['projects.client_label']()}</Label>
                            <Select.Root type="single" bind:value={selectedClientId}>
                                <Select.Trigger class="w-full">
                                    {selectedClientName}
                                </Select.Trigger>
                                <Select.Content class="max-h-60 overflow-y-auto">
                                    {#each data.clients as client}
                                        <Select.Item value={client.id.toString()} label={client.name}>
                                            {client.name}
                                        </Select.Item>
                                    {/each}
                                </Select.Content>
                            </Select.Root>
                            <input type="hidden" name="clientId" value={selectedClientId} />
                        </div>
                    {/if}

                    <Button type="submit">{m['settings.generate_code']()}</Button>

                    {#if generatedCode}
                        <div class="mt-4 p-4 bg-muted rounded-md flex items-center justify-between">
                            <code class="text-lg font-mono font-bold">{generatedCode}</code>
                             <Button variant="ghost" size="sm" onclick={async () => {
                                await copyToClipboard(`${window.location.origin}/register?code=${generatedCode}`);
                             }}>
                                {m['components.copy_link']()}
                            </Button>
                        </div>
                    {/if}
                 </form>
            </Card.Content>
        </Card.Root>
    {/if}

    <!-- SECTION 3: Client Info (Client Only) -->
    {#if data.user.type === 'client' && data.linkedClient}
         <Card.Root>
            <Card.Header>
                <Card.Title>{m['settings.company_info']()}</Card.Title>
                <Card.Description>{m['settings.company_info_description']()}</Card.Description>
            </Card.Header>
            <Card.Content>
                 <form method="POST" action="?/updateClientInfo" use:enhance class="space-y-4">
                    <div class="grid gap-2">
                        <Label for="client_name">{m['clients.name']()}</Label>
                        <Input id="client_name" name="name" value={data.linkedClient.name} />
                    </div>
                     <div class="grid grid-cols-2 gap-4">
                        <div class="grid gap-2">
                            <Label for="reg_number">{m['clients.registration_number']()}</Label>
                            <Input id="reg_number" name="registrationNumber" value={data.linkedClient.registrationNumber || ''} />
                        </div>
                        <div class="grid gap-2">
                            <Label for="vat_number">{m['clients.vat_number']()}</Label>
                            <Input id="vat_number" name="vatNumber" value={data.linkedClient.vatNumber || ''} />
                        </div>
                    </div>
                     <div class="grid gap-2">
                        <Label for="address">{m['clients.address']()}</Label>
                        <Input id="address" name="address" value={data.linkedClient.address || ''} />
                    </div>
                     <div class="grid grid-cols-2 gap-4">
                        <div class="grid gap-2">
                            <Label for="bank">{m['clients.bank']()}</Label>
                            <Input id="bank" name="bankName" value={data.linkedClient.bankName || ''} />
                        </div>
                         <div class="grid gap-2">
                            <Label for="swift">{m['clients.swift']()}</Label>
                            <Input id="swift" name="bankCode" value={data.linkedClient.bankCode || ''} />
                        </div>
                    </div>
                     <div class="grid gap-2">
                        <Label for="bank_account">{m['clients.bank_account']()}</Label>
                        <Input id="bank_account" name="bankAccount" value={data.linkedClient.bankAccount || ''} />
                    </div>
                     <div class="grid grid-cols-2 gap-4">
                        <div class="grid gap-2">
                            <Label for="phone">{m['clients.phone']()}</Label>
                            <Input id="phone" name="phone" value={data.linkedClient.phone || ''} />
                        </div>
                        <div class="grid gap-2">
                             <Label for="client_email">{m['clients.email']()}</Label>
                            <Input id="client_email" name="email" value={data.linkedClient.email || ''} />
                        </div>
                    </div>
                     <div class="grid gap-2">
                        <Label for="description">{m['clients.description']()}</Label>
                        <Textarea id="description" name="description" value={data.linkedClient.description || ''} />
                    </div>
                    <Button type="submit">{m['components.save']()}</Button>
                 </form>
            </Card.Content>
        </Card.Root>
    {/if}
</div>
