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
	import { Badge } from '$lib/components/ui/badge';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Card } from './ui/card';
	import { isClient, user } from '$lib/stores/user';

	const currencyFormatter = new Intl.NumberFormat('lv-LV', { style: 'currency', currency: 'EUR' });

	let {
		task,
		class: className,
		dragHandleAction
	} = $props<{
		task: {
			id: string;
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
		return currencyFormatter.format(cents / 100);
	};

	const formatDate = (date: Date | string | null) => {
		if (!date) return '';
		// Optimization: minimal date formatting without creating new Intl instances if possible,
		// but toLocaleDateString is decent if we don't do it too often.
		// For lists, it might be better to cache or use a shared formatter if toLocaleDateString is heavy.
		// sticking to native for now but reusing the date object logic might be better if we parsed it once.
		return new Date(date).toLocaleDateString('lv-LV');
	};

	const getActiveDuration = (createdAt: Date | string) => {
		const start = new Date(createdAt).getTime();
		const now = Date.now();
		const diffTime = Math.abs(now - start);
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

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

	const getDeadlineStatus = (endDate: string | null) => {
		if (!endDate) return 'normal';
		const end = new Date(endDate).getTime();

		// Reset time part efficiently?
		// Actually, let's just compare dates.
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		const midnightNow = now.getTime();

		const endDateObj = new Date(endDate);
		endDateObj.setHours(0, 0, 0, 0);
		const midnightEnd = endDateObj.getTime();

		if (midnightEnd < midnightNow) return 'overdue';

		const diffTime = midnightEnd - midnightNow;
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

		if (diffDays <= 2 && diffDays >= 0) return 'near';

		return 'normal';
	};

	let deadlineStatus = $derived(getDeadlineStatus(task.endDate));
	let copied = $state(false);
</script>

<Card
	class={cn(
		'flex w-full max-w-sm flex-col gap-3 rounded-xl border p-5 shadow-sm transition-shadow hover:shadow-md',
		deadlineStatus === 'overdue' && 'border-l-4 border-red-500', // Example styling for overdue
		deadlineStatus === 'near' && 'border-l-4 border-orange-400', // Example styling for near
		// Keep the original client border logic only if it doesn't conflict or maybe prioritize deadline?
		// User asked for "If the task is overdue... red outline. If near... orange."
		// And "If task created by client... badge". The original code had a border for client tasks.
		// "task.creator?.type === 'client' && $user?.id !== task.createdById && 'border-4 border-primary'"
		// I will remove the original client border logic as the user now requests a badge for this.
		// But maybe I should check if they want BOTH. The prompt says "If task is created by a client, we add a badge."
		// It doesn't explicitly say "remove the border", but usually "redesign" implies replacing old cues.
		// However, the red/orange outline request specifically mentions "If task is overdue...".
		// Let's implement the Deadline outlines.
		className
	)}
	style={deadlineStatus === 'overdue'
		? 'border-color: #ef4444;'
		: deadlineStatus === 'near'
			? 'border-color: #fb923c;'
			: ''}
>
	<!-- Title Section -->
	<div class="flex items-start justify-between gap-2">
		<div class="flex w-full flex-col gap-1 overflow-hidden">
			<div class="flex items-center gap-2">
				<Tooltip.Provider>
					<Tooltip.Root>
						<Tooltip.Trigger class="text-left">
							<h3 class="text-md truncate leading-tight font-semibold">{task.title}</h3>
						</Tooltip.Trigger>
						<Tooltip.Content>
							<p>{task.title}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>
			</div>
		</div>

		{#if dragHandleAction && !$isClient && (task.creator?.type !== 'client' || task.assignedToUser)}
			<div
				use:dragHandleAction
				data-drag-handle="true"
				class="mt-1 shrink-0 cursor-grab active:cursor-grabbing"
			>
				<GripVertical class="h-5 w-5 " />
			</div>
		{/if}
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
			<div
				class={cn(
					'flex items-center gap-2 text-sm',
					deadlineStatus === 'overdue' && 'font-medium text-red-600',
					deadlineStatus === 'near' && 'font-medium text-orange-600'
				)}
			>
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
			<div
				class={cn(
					'-ml-1.5 flex w-fit max-w-full items-center gap-2 overflow-hidden rounded-md px-1.5 py-0.5 text-sm font-medium transition-colors',
					task.creator.type === 'client' &&
						'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
				)}
			>
				<User class="h-4 w-4 shrink-0 " />
				<Tooltip.Provider>
					<Tooltip.Root>
						<Tooltip.Trigger class="truncate text-left">
							<span>{m['product_card.created_by']()}: {task.creator.name}</span>
						</Tooltip.Trigger>
						<Tooltip.Content>
							<p>{task.creator.name}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>
			</div>
		{/if}

		<!-- Client -->
		{#if task.client}
			<div class="flex items-center gap-2 overflow-hidden text-sm">
				<Building2 class="h-4 w-4 shrink-0 " />
				<Tooltip.Provider>
					<Tooltip.Root>
						<Tooltip.Trigger class="truncate text-left">
							<span>{m['product_card.client']()}: {task.client.name}</span>
						</Tooltip.Trigger>
						<Tooltip.Content>
							<p>{task.client.name}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>
			</div>
		{/if}

		<!-- Creator/Assignee (if different or user wants to see it) -->
		{#if task.assignedToUser}
			<div class="flex items-center gap-2 overflow-hidden text-sm">
				<UserPlus class="h-4 w-4 shrink-0 " />
				<Tooltip.Provider>
					<Tooltip.Root>
						<Tooltip.Trigger class="truncate text-left">
							<span>{m['product_card.assignee']()}: {task.assignedToUser.name}</span>
						</Tooltip.Trigger>
						<Tooltip.Content>
							<p>{task.assignedToUser.name}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>
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
