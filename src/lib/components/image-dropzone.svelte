<script lang="ts">
	import Upload from '@lucide/svelte/icons/upload';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import * as m from '$lib/paraglide/messages';
	import { browser } from '$app/environment';

	let { initialImagePath = null, ...restProps } = $props();
	let imagePath = $state(initialImagePath);
	let isUploading = $state(false);
	let uploadProgress = $state(0);
	let fileInputElement: HTMLInputElement;

	$effect(() => {
		imagePath = initialImagePath;
	});

	async function handleInputChange(event: Event) {
		if (!browser) return;

		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return; // Exit early if no file is selected

		// Only reset the old image if we have a new file to upload
		if (imagePath) {
			await resetImage();
		}

		const uploadData = new FormData();
		uploadData.append('file', file);

		isUploading = true;
		uploadProgress = 0;
		try {
			const res = await fetch('/api/upload', {
				method: 'POST',
				body: uploadData
			});
			const data = await res.json();
			if (data.success && data.path) {
				imagePath = data.path;

				uploadProgress = 100;
			} else {
			}
		} catch (e) {
		} finally {
			isUploading = false;
		}
	}

	async function resetImage() {
		if (!browser) return;
		if (imagePath) {
			try {
				await fetch('/api/remove', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ path: imagePath })
				});
			} catch (e) {}
		}
		imagePath = null;
		if (fileInputElement) fileInputElement.value = '';
	}
</script>

<!-- Drop Zone -->
<div
	class="input flex h-[100px] cursor-pointer items-center justify-center rounded-xl border border-dashed bg-input/30 px-2 text-center transition-colors"
	onclick={() => fileInputElement?.click()}
	onkeydown={() => fileInputElement?.click()}
	role="button"
	tabindex="0"
>
	<div class="flex items-center gap-4">
		{#if imagePath}
			<div class="relative">
				<img src={imagePath} alt="preview" class="h-14 w-14 rounded-full object-cover" />
			</div>
		{:else}
			<div class="grid h-14 w-14 place-items-center rounded-full border bg-muted">
				{#if isUploading}
					<Loader2 class="mb-1 animate-spin" />
				{:else}
					<Upload class="mb-1.5" />
				{/if}
			</div>
		{/if}
		<p class="text-center text-sm text-muted-foreground">
			{m[`components.image_dropzone.click_to_upload`]()}
		</p>
	</div>

	<!-- Hidden input for file uploads (just for selecting files) -->
	<input
		type="file"
		bind:this={fileInputElement}
		accept="image/*"
		class="hidden"
		onchange={handleInputChange}
	/>
	<input type="hidden" bind:value={imagePath} name="image" />
</div>
