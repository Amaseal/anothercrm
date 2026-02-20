<script lang="ts">
	import { onMount } from 'svelte';
	import Upload from '@lucide/svelte/icons/upload';
	import FileIcon from '@lucide/svelte/icons/file';
	import X from '@lucide/svelte/icons/x';
	import Download from '@lucide/svelte/icons/download';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import * as m from '$lib/paraglide/messages';
	import { browser } from '$app/environment';
	import JSZip from 'jszip';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils'; // Assuming this exists, standard shadcn

	type FileData = {
		name: string;
		path: string;
		size?: number;
		type?: string;
	};

	let {
		files = $bindable([]),
		label = '',
		readonly = false,
		...restProps
	} = $props<{
		files?: FileData[];
		label?: string;
		readonly?: boolean;
	}>();



	let isUploading = $state(false);
	let uploadProgress = $state<Record<string, number>>({});
	let fileInputElement: HTMLInputElement;
	let dragOver = $state(false);

	// Local list to track files currently being uploaded (before they are fully confirmed/added to main list potentially, or just to show progress)
	// Actually, we can just add them to the main list but maybe with a 'uploading' flag?
	// The requirement says "Files are uploaded as soon as they are added."
	// Let's keep track of uploading files separately or add a temporary status.
	// Since `files` prop expects `path`, and we don't have it yet, we better handle upload state locally.

	type UploadingFile = {
		id: string; // temp id
		file: File;
		progress: number;
		error?: string;
	};

	let uploadingFiles = $state<UploadingFile[]>([]);

	async function handleInputChange(event: Event) {
		if (!browser) return;
		const target = event.target as HTMLInputElement;
		if (target.files) {
			handleFiles(Array.from(target.files));
		}
		// Reset value to allow selecting same file again
		target.value = '';
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
		if (event.dataTransfer?.files) {
			handleFiles(Array.from(event.dataTransfer.files));
		}
	}

	function handleFiles(newFiles: File[]) {
		for (const file of newFiles) {
			uploadFile(file);
		}
	}

	function uploadFile(file: File) {
		const tempId = Math.random().toString(36).substring(7);
		const uploadingFile: UploadingFile = {
			id: tempId,
			file,
			progress: 0
		};

		uploadingFiles = [...uploadingFiles, uploadingFile];

		const formData = new FormData();
		formData.append('file', file);

		const xhr = new XMLHttpRequest();

		xhr.upload.addEventListener('progress', (event) => {
			if (event.lengthComputable) {
				const percent = Math.round((event.loaded / event.total) * 100);
				updateProgress(tempId, percent);
			}
		});

		xhr.addEventListener('load', () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				const response = JSON.parse(xhr.responseText);
				if (response.success && response.path) {
					// Add to main list
					const newFile: FileData = {
						name: file.name,
						path: response.path,
						size: file.size,
						type: file.type
					};
					files = [...files, newFile];
					// Remove from uploading list
					uploadingFiles = uploadingFiles.filter((f) => f.id !== tempId);
				} else {
					handleError(tempId, response.error || 'Upload failed');
				}
			} else {
				handleError(tempId, 'Upload failed');
			}
		});

		xhr.addEventListener('error', () => {
			handleError(tempId, 'Network error');
		});

		xhr.open('POST', '/api/upload');
		xhr.send(formData);
	}

	function updateProgress(id: string, progress: number) {
		uploadingFiles = uploadingFiles.map((f) => (f.id === id ? { ...f, progress } : f));
	}

	function handleError(id: string, error: string) {
		uploadingFiles = uploadingFiles.map((f) => (f.id === id ? { ...f, error, progress: 0 } : f));
		// Optionally remove after delay or let user dismiss
		console.error(`Upload error for ${id}:`, error);
	}

	async function deleteFile(index: number) {
		if (!browser) return;
		const fileToDelete = files[index];

		// Optimistic update? Or wait? Plan said "POST to /api/remove".
		// "Each file can be deleted with an X button."
		// Let's wait for success to be safe, or just remove if it fails (not essential to sync perfectly if UI shows it gone)

		try {
			const res = await fetch('/api/remove', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path: fileToDelete.path })
			});
			// Even if it fails (e.g. 404), we probably want to remove it from the list
		} catch (e) {
			console.error('Delete error', e);
		}

		files = files.filter((_: unknown, i: number) => i !== index);
	}

	async function downloadAll() {
		if (files.length === 0) return;

		const zip = new JSZip();
		const folder = zip.folder('files');

		// Fetch all files
		const promises = files.map(async (file: FileData) => {
			try {
				const response = await fetch(file.path);
				const blob = await response.blob();
				folder?.file(file.name, blob);
			} catch (e) {
				console.error(`Failed to download ${file.name}`, e);
			}
		});

		await Promise.all(promises);

		const content = await zip.generateAsync({ type: 'blob' });
		const url = URL.createObjectURL(content);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'files.zip';
		a.click();
		URL.revokeObjectURL(url);
	}

	function downloadFile(file: FileData) {
		const a = document.createElement('a');
		a.href = file.path;
		a.download = file.name;
		a.target = '_blank';
		a.click();
	}
	// Generate unique ID for label association
	const uniqueId = `file-upload-${Math.random().toString(36).slice(2)}`;
</script>

<div class="space-y-4">
	{#if label}
		<label
			for={uniqueId}
			class="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
		>
			{label}
		</label>
	{/if}

	<input type="hidden" name="files" value={JSON.stringify(files)} />

	{#if !readonly}
		<!-- Drop Zone -->
		<div
			class={cn(
				'input border-primar/70 flex h-[100px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed bg-input/30 px-2 text-center transition-colors',
				dragOver ? 'border-primary bg-primary/10' : 'bg-input/30',
				'hover:bg-accent/50'
			)}
			ondragover={(e) => {
				e.preventDefault();
				dragOver = true;
			}}
			ondragleave={() => (dragOver = false)}
			ondrop={handleDrop}
			onclick={() => fileInputElement?.click()}
			onkeydown={(e) => e.key === 'Enter' && fileInputElement?.click()}
			role="button"
			tabindex="0"
		>
			<div class="flex items-center gap-4 text-muted-foreground">
				<div class="grid h-14 w-14 place-items-center rounded-full border bg-muted">
					<Upload class="mb-1.5 h-6 w-6" />
				</div>
				<p class="text-sm">
					{m['components.file_dropzone.click_to_upload']() ?? 'Click or drop files here'}
				</p>
			</div>

			<input
				id={uniqueId}
				type="file"
				bind:this={fileInputElement}
				multiple
				class="hidden"
				onchange={handleInputChange}
			/>
		</div>
	{/if}

	<!-- File List -->
	{#if files.length > 0 || uploadingFiles.length > 0}
		<div class="grid gap-2">
			<!-- Existing Files -->
			{#each files as file, i}
				<div class="flex items-center justify-between rounded-lg border bg-card p-2 text-sm">
					<div class="flex items-center gap-3 overflow-hidden">
						<div class="grid h-8 w-8 place-items-center rounded bg-muted">
							<FileIcon class="h-4 w-4" />
						</div>
						<div class="flex flex-col truncate">
							<span class="truncate font-medium">{file.name}</span>
							{#if file.size}
								<span class="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span
								>
							{/if}
						</div>
					</div>
					<div class="flex items-center gap-1">
						<Button
							variant="ghost"
							size="icon"
							class="h-8 w-8 text-muted-foreground"
							onclick={() => downloadFile(file)}
						>
							<Download class="h-4 w-4" />
							<span class="sr-only">Download</span>
						</Button>
						{#if !readonly}
							<Button
								variant="ghost"
								size="icon"
								class="h-8 w-8 text-destructive hover:text-destructive"
								onclick={() => deleteFile(i)}
							>
								<X class="h-4 w-4" />
								<span class="sr-only">Remove</span>
							</Button>
						{/if}
					</div>
				</div>
			{/each}

			<!-- Uploading Files -->
			{#each uploadingFiles as file (file.id)}
				<div class="flex items-center justify-between rounded-lg border bg-card/50 p-2 text-sm">
					<div class="flex flex-1 items-center gap-3 overflow-hidden">
						<div class="grid h-8 w-8 place-items-center rounded bg-muted">
							<Loader2 class="h-4 w-4 animate-spin" />
						</div>
						<div class="flex flex-1 flex-col truncate pr-4">
							<span class="truncate font-medium">{file.file.name}</span>
							<!-- Progress Bar -->
							<div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
								<div
									class="h-full bg-primary transition-all duration-300"
									style="width: {file.progress}%"
								></div>
							</div>
						</div>
					</div>
					{#if file.error}
						<span class="text-xs text-destructive">{file.error}</span>
					{:else}
						<span class="text-xs text-muted-foreground">{file.progress}%</span>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Download All -->
	{#if files.length > 1}
		<Button variant="outline" size="sm" class="w-full" onclick={downloadAll}>
			<Download class="mr-2 h-4 w-4" />
			Download All ({files.length})
		</Button>
	{/if}
</div>
