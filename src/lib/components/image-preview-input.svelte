<script lang="ts">
	import { onMount } from 'svelte';
	import Image from '@lucide/svelte/icons/image';
	import Upload from '@lucide/svelte/icons/upload';
	import X from '@lucide/svelte/icons/x';
	import * as m from '$lib/paraglide/messages';
	import { browser } from '$app/environment';
	import { cn } from '$lib/utils';
	import { Label } from '$lib/components/ui/label';

	let {
		name = 'preview',
		id = 'preview',
		label = '',
		class: className,
		preview = null,
		readonly = false,
		...restProps
	} = $props<{
		name?: string;
		id?: string;
		label?: string;
		class?: string;
		preview?: string | null;
		readonly?: boolean;
	}>();

	let fileInputElement: HTMLInputElement;
	let previewUrl = $state<string | null>(preview);
	let dragOver = $state(false);

	function revokePreviewUrl(url: string | null) {
		if (url && url.startsWith('blob:')) {
			URL.revokeObjectURL(url);
		}
	}

	function handleFiles(files: FileList | File[]) {
		if (!files || files.length === 0) return;

		const file = files[0];
		if (!file.type.startsWith('image/')) return;

		// Create preview
		const url = URL.createObjectURL(file);

		// Revoke old URL if exists to avoid memory leaks
		revokePreviewUrl(previewUrl);
		previewUrl = url;

		// Update input files if this came from drop/paste
		if (fileInputElement && files instanceof FileList === false) {
			const dt = new DataTransfer();
			dt.items.add(file);
			fileInputElement.files = dt.files;
		}
	}

	function handleInputChange(event: Event) {
		if (readonly) return;
		const target = event.target as HTMLInputElement;
		if (target.files) {
			handleFiles(target.files);
		}
	}

	function handleDrop(event: DragEvent) {
		if (readonly) return;
		event.preventDefault();
		dragOver = false;
		if (event.dataTransfer?.files) {
			handleFiles(event.dataTransfer.files);
		}
	}

	function handlePaste(event: ClipboardEvent) {
		if (readonly) return;
		if (event.clipboardData?.files) {
			handleFiles(Array.from(event.clipboardData.files));
		}
	}

	function clear(e: Event) {
		e.stopPropagation(); // Prevent triggering click on container
		revokePreviewUrl(previewUrl);
		previewUrl = null;
		if (fileInputElement) fileInputElement.value = '';
	}

	$effect(() => {
		return () => {
			revokePreviewUrl(previewUrl);
		};
	});
	let isHovering = $state(false);

	function handleWindowPaste(event: ClipboardEvent) {
		if (readonly) return;
		if (isHovering && event.clipboardData?.files) {
			handleFiles(Array.from(event.clipboardData.files));
		}
	}
</script>

<svelte:window onpaste={handleWindowPaste} />

<div class={cn('grid gap-2', className)}>
	{#if label}
		<Label for={id}>{label}</Label>
	{/if}

	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<!-- svelte-ignore a11y_role_has_required_aria_props -->
	<div
		class={cn(
			'relative flex aspect-video cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
			dragOver ? 'border-primary bg-primary/10' : (!readonly ? 'bg-input/20 hover:bg-accent/50' : 'bg-input/10 cursor-default border-solid'),
			previewUrl ? 'bg-background' : ''
		)}
		onmouseenter={() => (isHovering = true)}
		onmouseleave={() => {
			isHovering = false;
			dragOver = false;
		}}
		ondragover={(e) => {
			if (readonly) return;
			e.preventDefault();
			dragOver = true;
		}}
		ondragleave={() => (dragOver = false)}
		ondrop={handleDrop}
		onclick={() => !readonly && fileInputElement?.click()}
		onkeydown={(e) => {
			if (readonly) return;
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				fileInputElement?.click();
			}
		}}
		tabindex="0"
		role="button"
		onpaste={handlePaste}
	>
		{#if previewUrl}
			<div class="relative h-full w-full overflow-hidden rounded-lg">
				<img src={previewUrl} alt="Preview" class="h-full w-full object-contain" />
				{#if !readonly}
					<button
						type="button"
						class="absolute top-2 right-2 rounded-full bg-background/80 p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
						onclick={clear}
					>
						<X class="h-4 w-4" />
						<span class="sr-only">Remove image</span>
					</button>
				{/if}
			</div>
		{:else}
			<div
				class="flex flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground"
			>
				<div class="rounded-full bg-background p-3 shadow-sm">
					<Image class="h-6 w-6" />
				</div>
				<p class="text-sm font-medium">
					{m['components.file_dropzone.click_drop_paste']?.() ?? 'Click, drop or paste image here'}
				</p>
			</div>
		{/if}

		<input
			type="file"
			bind:this={fileInputElement}
			{name}
			{id}
			accept="image/*"
			class="hidden"
			onchange={handleInputChange}
		/>
	</div>
</div>
