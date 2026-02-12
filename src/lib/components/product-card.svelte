<script lang="ts">
	import { cn } from '$lib/utils';
	import {
		Clock,
		Hourglass,
		User,
		Check,
		Trash,
		Building2,
		UserPlus,
		Pencil,
		GripVertical,
		Link
	} from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';

	import { Button } from '$lib/components/ui/button';
	import { Card } from './ui/card';
	import { isClient, user } from '$lib/stores/user';

	let {
		task,
		class: className,
		dragHandleAction
	} = $props<{
		task: {
			title: string;
			price: number | null;
			endDate: string | null;
			createdAt: Date | string;
			client?: { name: string } | null;
			assignedToUser?: { name: string } | null;
			createdById?: string | null;
			creator?: { name: string; type?: string } | null;
		};
		class?: string;
		dragHandleAction?: any;
	}>();

	const formatCurrency = (cents: number | null) => {
		if (cents === null || cents === undefined) return '€0.00';
		return new Intl.NumberFormat('lv-LV', { style: 'currency', currency: 'EUR' }).format(
			cents / 100
		);
	};

	const formatDate = (date: Date | string | null) => {
		if (!date) return '';
		return new Date(date).toLocaleDateString('lv-LV');
	};

	const getActiveDuration = (createdAt: Date | string) => {
		const start = new Date(createdAt);
		const now = new Date();
		const diffTime = Math.abs(now.getTime() - start.getTime());
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

		// Approximate months and days
		const months = Math.floor(diffDays / 30);
		const days = diffDays % 30;

		const monthStr =
			months % 10 === 1 && months !== 11
				? m['product_card.month_singular']()
				: m['product_card.month_plural']();
		const dayStr =
			days % 10 === 1 && days !== 11
				? m['product_card.day_singular']()
				: m['product_card.day_plural']();

		if (months > 0) {
			return `${months} ${monthStr}, ${days} ${dayStr}`;
		}
		return `${days} ${dayStr}`;
	};

	const activeDuration = $derived(task.createdAt ? getActiveDuration(task.createdAt) : '');

	let copied = $state(false);
</script>

<Card
	class={cn(
		'flex w-full max-w-sm flex-col gap-3 rounded-xl border p-5 shadow-sm transition-shadow hover:shadow-md',
		task.creator?.type === 'client' && $user?.id !== task.createdById && 'border-4 border-primary',
		className
	)}
>
	<!-- Title Section -->
	<div class="flex items-start justify-between gap-2">
		<h3 class="line-clamp-2 text-lg leading-tight font-semibold">{task.title}</h3>
		{#if dragHandleAction && !$isClient && task.assignedToUserId}
			<div
				use:dragHandleAction
				data-drag-handle="true"
				class="mt-1 cursor-grab active:cursor-grabbing"
			>
				<GripVertical class="h-5 w-5 " />
			</div>
		{/if}
		<!-- Optional Priority Icon could go here -->
	</div>

	<!-- Price and Created Date -->
	<div class="flex items-center justify-between text-sm">
		<span class="font-medium">{formatCurrency(task.price)}</span>
		<span class="">{formatDate(task.createdAt)}</span>
	</div>

	<!-- Details List -->
	<div class="mt-1 flex flex-col gap-2">
		<!-- Deadline -->
		{#if task.endDate}
			<div class="flex items-center gap-2 text-sm">
				<Clock class="h-4 w-4 shrink-0 " />
				<span>{m['product_card.deadline']()}: {formatDate(task.endDate)}</span>
			</div>
		{/if}

		<!-- Active Duration -->
		<div class="flex items-center gap-2 text-sm">
			<Hourglass class="h-4 w-4 shrink-0 " />
			<span>{m['product_card.active']()}: {activeDuration}</span>
		</div>

		<!-- Manager -->
		{#if task.creator}
			<div class="flex items-center gap-2 text-sm font-medium">
				<User class="h-4 w-4 shrink-0 " />
				<span>{m['product_card.created_by']()}: {task.creator.name}</span>
			</div>
		{/if}

		<!-- Client -->
		{#if task.client}
			<div class="flex items-center gap-2 text-sm">
				<Building2 class="h-4 w-4 shrink-0 " />
				<span>{m['product_card.client']()}: {task.client.name}</span>
			</div>
		{/if}

		<!-- Creator/Assignee (if different or user wants to see it) -->
		{#if task.assignedToUser}
			<div class="flex items-center gap-2 text-sm">
				<UserPlus class="h-4 w-4 shrink-0 " />
				<span>{m['product_card.assignee']()}: {task.assignedToUser.name}</span>
			</div>
		{/if}
	</div>

	<hr class="mt-1 border-gray-100" />

	<!-- Bottom Actions -->
	<div class="flex items-center justify-between pt-1">
		<div class="relative flex gap-3">
			<Button
				title={m['components.copy_link']()}
				variant="ghost"
				class="dark:hover:text-white"
				onclick={(e: Event) => {
					e.preventDefault();
					navigator.clipboard.writeText(`${window.location.origin}/projekti/labot/${task.id}`);
					copied = true;
					setTimeout(() => {
						copied = false;
					}, 2000);
				}}
			>
				{#if copied}
					<Check class="h-4 w-4" />
				{:else}
					<Link class="h-4 w-4" />
				{/if}
			</Button>
			<!-- Edit Button (Explicitly requested) -->
			<Button
				title={m['components.edit']()}
				variant="ghost"
				class="dark:hover:text-white"
				href={`/projekti/labot/${task.id}`}
			>
				<Pencil class="h-4 w-4" />
			</Button>

			<Button
				title={m['components.complete']()}
				variant="ghost"
				class="hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900 dark:hover:text-green-400"
				href={`/projekti/pabeigt/${task.id}`}
			>
				<Check class="h-4 w-4" />
			</Button>
			<Button
				title={m['components.delete']()}
				variant="ghost"
				class="hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900 dark:hover:text-red-400"
				href={`/projekti/izdzest/${task.id}`}
			>
				<Trash class="h-4 w-4" />
			</Button>
		</div>
	</div>
</Card>
