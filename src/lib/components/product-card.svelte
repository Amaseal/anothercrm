<script lang="ts">
	import { cn } from '$lib/utils';
	import {
		Clock,
		Hourglass,
		User,
		Printer,
		MessageSquare,
		Check,
		Trash,
		Building2,
		UserPlus,
		Pencil
	} from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import BreadcrumbItem from './ui/breadcrumb/breadcrumb-item.svelte';

	let {
		task,
		class: className,
		onEdit,
		onDelete
	} = $props<{
		task: {
			title: string;
			price: number | null;
			endDate: string | null;
			createdAt: Date | string;
			client?: { name: string } | null;
			assignedToUser?: { name: string } | null;
			// Creator might be different from assignedToUser, but based on schema we likely map one of these.
			// If creator is separate, we'd need that data. I'll assume we show what we have.
			creator?: { name: string } | null;
		};
		class?: string;
		onEdit?: () => void;
		onDelete?: () => void;
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

		const monthStr = months % 10 === 1 && months !== 11 ? 'mēnesis' : 'mēnešus';
		const dayStr = days % 10 === 1 && days !== 11 ? 'diena' : 'dienas';

		if (months > 0) {
			return `${months} ${monthStr}, ${days} ${dayStr}`;
		}
		return `${days} ${dayStr}`;
	};

	const activeDuration = $derived(task.createdAt ? getActiveDuration(task.createdAt) : '');
</script>

<div
	class={cn(
		'flex w-full max-w-sm flex-col gap-3 rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md',
		className
	)}
>
	<!-- Title Section -->
	<div class="flex items-start justify-between">
		<h3 class="line-clamp-2 text-lg leading-tight font-semibold text-gray-900">{task.title}</h3>
		<!-- Optional Priority Icon could go here -->
	</div>

	<!-- Price and Created Date -->
	<div class="flex items-center justify-between text-sm">
		<span class="font-medium text-gray-500">{formatCurrency(task.price)}</span>
		<span class="text-gray-400">{formatDate(task.createdAt)}</span>
	</div>

	<!-- Details List -->
	<div class="mt-1 flex flex-col gap-2">
		<!-- Deadline -->
		{#if task.endDate}
			<div class="flex items-center gap-2 text-sm text-gray-600">
				<Clock class="h-4 w-4 shrink-0 text-gray-400" />
				<span>Jānodod: {formatDate(task.endDate)}</span>
			</div>
		{/if}

		<!-- Active Duration -->
		<div class="flex items-center gap-2 text-sm text-gray-600">
			<Hourglass class="h-4 w-4 shrink-0 text-gray-400" />
			<span>Aktīvs: {activeDuration}</span>
		</div>

		<!-- Manager -->
		{#if task.creator}
			<div class="flex items-center gap-2 text-sm font-medium text-gray-900">
				<User class="h-4 w-4 shrink-0 text-gray-500" />
				<span>Atbildīgs: {task.creator.name}</span>
			</div>
		{/if}

		<!-- Client -->
		{#if task.client}
			<div class="flex items-center gap-2 text-sm text-gray-600">
				<Building2 class="h-4 w-4 shrink-0 text-gray-400" />
				<span>Klients: {task.client.name}</span>
			</div>
		{/if}

		<!-- Creator/Assignee (if different or user wants to see it) -->
		{#if task.assignedToUser}
			<div class="flex items-center gap-2 text-sm text-gray-600">
				<UserPlus class="h-4 w-4 shrink-0 text-gray-400" />
				<span>Izpildītājs: {task.assignedToUser.name}</span>
			</div>
		{/if}
	</div>

	<hr class="mt-1 border-gray-100" />

	<!-- Bottom Actions -->
	<div class="flex items-center justify-between pt-1">
		<div class="flex gap-3">
			<!-- Edit Button (Explicitly requested) -->
			<Button title="Rediģēt" variant="ghost" href={`/projekti/labot/${task.id}`}>
				<Pencil class="h-4 w-4" />
			</Button>

			<Button
				title="Complete"
				variant="ghost"
				class="hover:bg-green-100 hover:text-green-600"
				href={`/projekti/pabeigt/${task.id}`}
			>
				<Check class="h-4 w-4" />
			</Button>
			<Button
				title="Delete"
				variant="ghost"
				class="hover:bg-red-100 hover:text-red-600"
				href={`/projekti/izdzest/${task.id}`}
			>
				<Trash class="h-4 w-4" />
			</Button>
		</div>
	</div>
</div>
