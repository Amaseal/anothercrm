<script lang="ts">
	import { onMount } from 'svelte';
	import type { Readable } from 'svelte/store';
	import { createEditor, Editor, EditorContent } from 'svelte-tiptap';
	import StarterKit from '@tiptap/starter-kit';

	let { value = $bindable(), class: className } = $props();
	let editor = $state() as Readable<Editor>;
	let isInternalUpdate = false;

	onMount(() => {
		editor = createEditor({
			extensions: [StarterKit],
			content: value,
			onUpdate: ({ editor }) => {
				isInternalUpdate = true;
				value = editor.getHTML();
			},
			editorProps: {
				attributes: {
					class: className
				}
			}
		});
	});

	// $effect(() => {
	// 	if ($editor && value !== $editor.getHTML() && !isInternalUpdate) {
	// 		$editor.commands.setContent(value);
	// 	}
	// 	isInternalUpdate = false;
	// });
</script>

<!-- <EditorContent editor={$editor} /> -->
