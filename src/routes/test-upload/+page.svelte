<script lang="ts">
	import FileUpload from '$lib/components/file-upload.svelte';

	let files = $state([]);
</script>

<div class="container mx-auto max-w-2xl space-y-8 p-10">
	<h1 class="text-2xl font-bold">File Upload Component Test</h1>

	<div class="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
		<FileUpload bind:files label="Test File Upload" />
	</div>

	<div class="rounded-lg bg-muted p-4">
		<h2 class="mb-2 font-semibold">Files State:</h2>
		<pre class="max-h-60 overflow-auto rounded bg-black/10 p-2 text-xs">
			{JSON.stringify(files, null, 2)}
		</pre>
	</div>
</div>
