<script lang="ts">
	import Upload from '@lucide/svelte/icons/upload';
	import FileIcon from '@lucide/svelte/icons/file';
	import X from '@lucide/svelte/icons/x';
	import Download from '@lucide/svelte/icons/download';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import * as m from '$lib/paraglide/messages';
	import { browser } from '$app/environment';
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { cn } from '$lib/utils'; // Assuming this exists, standard shadcn

	type FileData = {
		name: string;
		path: string;
		size?: number;
		type?: string;
	};
	let {
		files = $bindable([]),
		uploading = $bindable(false),
		label = '',
		readonly = false,
		zipFilename = 'files'
	} = $props<{
		files?: FileData[];
		uploading?: boolean;
		label?: string;
		readonly?: boolean;
		zipFilename?: string;
	}>();

	let isZipping = $state(false);
	let fileInputElement = $state<HTMLInputElement | undefined>(undefined);
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

	$effect(() => {
		uploading = uploadingFiles.some((file) => !file.error);
	});

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

	let activeUploads = 0;
	const uploadQueue: UploadingFile[] = [];

	function handleFiles(newFiles: File[]) {
		for (const file of newFiles) {
			const entry: UploadingFile = { id: crypto.randomUUID(), file, progress: 0 };
			uploadingFiles = [...uploadingFiles, entry];
			uploadQueue.push(entry);
		}
		startUploads();
	}

	function startUploads() {
		while (activeUploads < 2 && uploadQueue.length) {
			const entry = uploadQueue.shift()!;
			activeUploads++;
			uploadFile(entry);
		}
	}

	function uploadFile({ id: tempId, file }: UploadingFile) {
		const xhr = new XMLHttpRequest();
		xhr.upload.addEventListener('progress', (event) => {
			if (event.lengthComputable)
				updateProgress(tempId, Math.round((event.loaded / event.total) * 100));
		});
		xhr.addEventListener('load', () => {
			try {
				const response = JSON.parse(xhr.responseText);
				if (xhr.status < 200 || xhr.status >= 300 || !response.success || !response.path)
					throw new Error('Upload failed');
				files = [
					...files,
					{ name: file.name, path: response.path, size: file.size, type: file.type }
				];
				uploadingFiles = uploadingFiles.filter((entry) => entry.id !== tempId);
			} catch {
				handleError(tempId, 'Upload failed');
			}
		});
		xhr.addEventListener('error', () => handleError(tempId, 'Network error'));
		xhr.addEventListener('abort', () => handleError(tempId, 'Upload cancelled'));
		xhr.addEventListener('loadend', () => {
			activeUploads--;
			startUploads();
		});
		xhr.open('POST', `/api/upload?filename=${encodeURIComponent(file.name)}`);
		xhr.setRequestHeader('Content-Type', 'application/octet-stream');
		xhr.send(file);
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
			await fetch('/api/remove', {
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
	function downloadAll() {
		if (files.length === 0 || isZipping) return;
		isZipping = true;
		// A native form download lets the browser stream straight to disk.
		const form = document.createElement('form');
		form.method = 'POST';
		form.action = '/api/taskfiles/download';
		form.target = '_blank';
		for (const [name, value] of Object.entries({
			files: JSON.stringify(files.map(({ name, path }: FileData) => ({ name, path }))),
			filename: zipFilename
		})) {
			const input = document.createElement('input');
			input.type = 'hidden';
			input.name = name;
			input.value = value;
			form.appendChild(input);
		}
		document.body.appendChild(form);
		form.submit();
		form.remove();
		// Download completion is managed by the browser, outside this page.
		setTimeout(() => {
			isZipping = false;
		}, 1000);
	}

	function downloadFile(file: FileData) {
		const a = document.createElement('a');
		const url = new URL(file.path, window.location.origin);
		url.searchParams.set('download', file.name);
		a.href = url.href;
		a.download = file.name;
		a.target = '_blank';
		a.click();
	}

	const MAX_FILENAME_DISPLAY = 52;

	function truncateFileName(name: string): string {
		if (name.length <= MAX_FILENAME_DISPLAY) return name;

		const lastDot = name.lastIndexOf('.');
		const hasValidExt = lastDot > 0 && lastDot < name.length - 1;

		if (!hasValidExt) {
			return `${name.slice(0, MAX_FILENAME_DISPLAY - 1)}...`;
		}

		const ext = name.slice(lastDot);
		const maxBaseLength = Math.max(8, MAX_FILENAME_DISPLAY - ext.length - 3);
		return `${name.slice(0, maxBaseLength)}...${ext}`;
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
			{#each files as file, i (file)}
				<div
					class="grid grid-cols-[minmax(0,1fr)_auto] items-center rounded-lg border bg-card p-2 text-sm"
				>
					<div class="flex min-w-0 items-center gap-3 overflow-hidden">
						<div class="grid h-8 w-8 place-items-center rounded bg-muted">
							<FileIcon class="h-4 w-4" />
						</div>
						<div class="flex min-w-0 flex-col truncate">
							<Tooltip.Provider>
								<Tooltip.Root>
									<Tooltip.Trigger class="block w-full min-w-0 truncate text-left font-medium"
										>{truncateFileName(file.name)}</Tooltip.Trigger
									>
									<Tooltip.Content>
										<p>{file.name}</p>
									</Tooltip.Content>
								</Tooltip.Root>
							</Tooltip.Provider>
							{#if file.size}
								<span class="text-xs text-muted-foreground"
									>{file.size >= 1024 * 1024
										? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
										: `${(file.size / 1024).toFixed(1)} KB`}</span
								>
							{/if}
						</div>
					</div>
					<div class="ml-2 flex shrink-0 items-center gap-1">
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
				<div
					class="grid grid-cols-[minmax(0,1fr)_auto] items-center rounded-lg border bg-card/50 p-2 text-sm"
				>
					<div class="flex min-w-0 items-center gap-3 overflow-hidden">
						<div class="grid h-8 w-8 place-items-center rounded bg-muted">
							<Loader2 class="h-4 w-4 animate-spin" />
						</div>
						<div class="flex flex-1 flex-col truncate pr-4">
							<Tooltip.Provider>
								<Tooltip.Root>
									<Tooltip.Trigger class="block w-full min-w-0 truncate text-left font-medium"
										>{truncateFileName(file.file.name)}</Tooltip.Trigger
									>
									<Tooltip.Content>
										<p>{file.file.name}</p>
									</Tooltip.Content>
								</Tooltip.Root>
							</Tooltip.Provider>
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
						<span class="ml-2 max-w-[120px] shrink-0 truncate text-xs text-destructive"
							>{file.error}</span
						>
					{:else}
						<span class="ml-2 shrink-0 text-xs text-muted-foreground">{file.progress}%</span>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
	<!-- Download All -->
	{#if files.length > 1}
		<Button variant="outline" size="sm" class="w-full" onclick={downloadAll} disabled={isZipping}>
			{#if isZipping}
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				Starting download...
			{:else}
				<Download class="mr-2 h-4 w-4" />
				Download All ({files.length})
			{/if}
		</Button>
	{/if}
</div>
