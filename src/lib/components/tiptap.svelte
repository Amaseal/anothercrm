<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Readable } from 'svelte/store';
	import { createEditor, Editor, EditorContent } from 'svelte-tiptap';
	import type { Editor as CoreEditor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Image from '@tiptap/extension-image';
	import { Table } from '@tiptap/extension-table';
	import TableRow from '@tiptap/extension-table-row';
	import TableCell from '@tiptap/extension-table-cell';
	import TableHeader from '@tiptap/extension-table-header';
	import Highlight from '@tiptap/extension-highlight';
	import { TextStyle } from '@tiptap/extension-text-style';
	import { Color } from '@tiptap/extension-color';
	import { Button } from '$lib/components/ui/button';
	import { Toggle } from '$lib/components/ui/toggle';
	import * as Popover from '$lib/components/ui/popover';
	import { cn } from '$lib/utils';
	import Bold from '@lucide/svelte/icons/bold';
	import Italic from '@lucide/svelte/icons/italic';
	import Strikethrough from '@lucide/svelte/icons/strikethrough';
	import List from '@lucide/svelte/icons/list';
	import ListOrdered from '@lucide/svelte/icons/list-ordered';
	import Highlighter from '@lucide/svelte/icons/highlighter';
	import Palette from '@lucide/svelte/icons/palette';
	import ImageIcon from '@lucide/svelte/icons/image';
	import TableIcon from '@lucide/svelte/icons/table';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Plus from '@lucide/svelte/icons/plus';
	import Minus from '@lucide/svelte/icons/minus';
	import Columns2 from '@lucide/svelte/icons/columns-2';
	import Rows2 from '@lucide/svelte/icons/rows-2';
	import { X } from '@lucide/svelte';

	let { value = $bindable(''), class: className } = $props<{ value?: string; class?: string }>();
	let editor = $state() as Readable<Editor | null>;
	let isInternalUpdate = false;
	let skipNextUpdate = false;
	let fileInput = $state<HTMLInputElement>();

	async function uploadImage(file: File) {
		const formData = new FormData();
		formData.append('file', file);
		try {
			const res = await fetch('/api/upload', {
				method: 'POST',
				body: formData
			});
			const data = await res.json();
			if (data.success && data.path) {
				return data.path;
			}
		} catch (e) {
			console.error('Upload failed', e);
		}
		return null;
	}

	function addImage() {
		fileInput?.click();
	}

	async function handleImageSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files?.length) {
			const file = target.files[0];
			const url = await uploadImage(file);
			const editorInstance = $editor;
			if (url && editorInstance) {
				// @ts-ignore - Extension commands overlap
				editorInstance.chain().focus().setImage({ src: url }).run();
			}
		}
		target.value = '';
	}

	function addTable() {
		// @ts-ignore
		$editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
	}

	function addColumn() {
		// @ts-ignore
		$editor?.chain().focus().addColumnAfter().run();
	}

	function deleteColumn() {
		// @ts-ignore
		$editor?.chain().focus().deleteColumn().run();
	}

	function addRow() {
		// @ts-ignore
		$editor?.chain().focus().addRowAfter().run();
	}

	function deleteRow() {
		// @ts-ignore
		$editor?.chain().focus().deleteRow().run();
	}

	function deleteTable() {
		// @ts-ignore
		$editor?.chain().focus().deleteTable().run();
	}

	onMount(() => {
		editor = createEditor({
			extensions: [
				StarterKit,
				Image,
				Table.configure({
					resizable: true
				}),
				TableRow,
				TableHeader,
				TableCell,
				Highlight.configure({ multicolor: true }),
				TextStyle,
				Color
			],
			content: value,
			onUpdate: ({ editor }: { editor: CoreEditor }) => {
				if (skipNextUpdate) {
					skipNextUpdate = false;
					return;
				}
				isInternalUpdate = true;
				value = editor.getHTML();
			},
			editorProps: {
				attributes: {
					class: cn(
						'prose dark:prose-invert max-w-none focus:outline-none min-h-[150px] p-4',
						className
					)
				},
				handlePaste: (view, event) => {
					const items = Array.from(event.clipboardData?.items || []);
					const images = items.filter((item) => item.type.indexOf('image') === 0);

					if (images.length > 0) {
						event.preventDefault();
						images.forEach(async (item) => {
							const file = item.getAsFile();
							if (file) {
								const url = await uploadImage(file);
								if (url) {
									const { schema } = view.state;
									const node = schema.nodes.image.create({ src: url });
									const transaction = view.state.tr.replaceSelectionWith(node);
									view.dispatch(transaction);
								}
							}
						});
						return true;
					}
					return false;
				},
				handleDrop: (view, event, slice, moved) => {
					if (
						!moved &&
						event.dataTransfer &&
						event.dataTransfer.files &&
						event.dataTransfer.files.length > 0
					) {
						const files = Array.from(event.dataTransfer.files);
						const images = files.filter((file) => file.type.startsWith('image/'));

						if (images.length > 0) {
							event.preventDefault();
							images.forEach(async (file) => {
								const url = await uploadImage(file);
								if (url) {
									const { schema } = view.state;
									const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
									if (coordinates) {
										const node = schema.nodes.image.create({ src: url });
										const transaction = view.state.tr.insert(coordinates.pos, node);
										view.dispatch(transaction);
									}
								}
							});
							return true;
						}
					}
					return false;
				}
			}
		});
	});

	// $effect(() => {
	// 	if (isInternalUpdate) {
	// 		isInternalUpdate = false;
	// 		return;
	// 	}

	// 	if ($editor && value !== undefined && value !== $editor.getHTML()) {
	// 		// Only update if content is sufficiently different to avoid cursor jumps or loops
	// 		// Simple check: content length or straight comparison
	// 		skipNextUpdate = true;
	// 		$editor.commands.setContent(value, { emitUpdate: false });
	// 	}
	// });
</script>

{#if $editor}
	<div class="flex flex-wrap items-center gap-1 border-b bg-muted/40 p-1">
		<!-- Formatting -->
		<Toggle
			size="sm"
			pressed={$editor.isActive('bold')}
			onPressedChange={() => $editor.chain().focus().toggleBold().run()}
			aria-label="Bold"
		>
			<Bold class="h-4 w-4" />
		</Toggle>
		<Toggle
			size="sm"
			pressed={$editor.isActive('italic')}
			onPressedChange={() => $editor.chain().focus().toggleItalic().run()}
			aria-label="Italic"
		>
			<Italic class="h-4 w-4" />
		</Toggle>
		<Toggle
			size="sm"
			pressed={$editor.isActive('strike')}
			onPressedChange={() => $editor.chain().focus().toggleStrike().run()}
			aria-label="Strikethrough"
		>
			<Strikethrough class="h-4 w-4" />
		</Toggle>

		<div class="mx-1 h-4 w-[1px] bg-border"></div>

		<!-- Lists -->
		<Toggle
			size="sm"
			pressed={$editor.isActive('bulletList')}
			onPressedChange={() => $editor.chain().focus().toggleBulletList().run()}
			aria-label="Bullet List"
		>
			<List class="h-4 w-4" />
		</Toggle>
		<Toggle
			size="sm"
			pressed={$editor.isActive('orderedList')}
			onPressedChange={() => $editor.chain().focus().toggleOrderedList().run()}
			aria-label="Ordered List"
		>
			<ListOrdered class="h-4 w-4" />
		</Toggle>

		<div class="mx-1 h-4 w-[1px] bg-border"></div>

		<!-- Colors & Highlight -->
		<Toggle
			size="sm"
			pressed={$editor.isActive('highlight')}
			onPressedChange={() => $editor.chain().focus().toggleHighlight().run()}
			aria-label="Highlight"
		>
			<Highlighter class="h-4 w-4" />
		</Toggle>

		<Popover.Root>
			<Popover.Trigger>
				<Button
					variant="ghost"
					size="sm"
					class={$editor.isActive('textStyle', { color: /.*/ }) ? 'bg-accent' : ''}
				>
					<Palette class="h-4 w-4" />
				</Button>
			</Popover.Trigger>
			<Popover.Content class="w-40 p-2">
				<div class="grid grid-cols-5 gap-1">
					{#each ['#000000', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#94a3b8'] as color}
						<button
							class="h-6 w-6 rounded-full border border-muted ring-offset-background transition-all hover:scale-110 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
							style="background-color: {color}"
							onclick={() => $editor.chain().focus().setColor(color).run()}
							aria-label="Color {color}"
						></button>
					{/each}
					<button
						class="flex h-6 w-6 items-center justify-center rounded-full border border-muted bg-transparent"
						onclick={() => $editor.chain().focus().unsetColor().run()}
						title="Reset"
					>
						<X class="h-3 w-3" />
					</button>
				</div>
			</Popover.Content>
		</Popover.Root>

		<div class="mx-1 h-4 w-[1px] bg-border"></div>

		<!-- Media & Tables -->
		<Button variant="ghost" size="sm" onclick={addImage} title="Add Image">
			<ImageIcon class="h-4 w-4" />
		</Button>

		<Popover.Root>
			<Popover.Trigger>
				<Button
					variant="ghost"
					size="sm"
					class={$editor.isActive('table') ? 'bg-accent' : ''}
					title="Table"
				>
					<TableIcon class="h-4 w-4" />
				</Button>
			</Popover.Trigger>
			<Popover.Content class="w-48 p-1">
				<div class="flex flex-col gap-1">
					<Button
						variant="ghost"
						size="sm"
						class="h-8 w-full justify-start gap-2 px-2"
						onclick={addTable}
					>
						<Plus class="h-3 w-3" /> Insert Table
					</Button>
					<Button
						variant="ghost"
						size="sm"
						class="h-8 w-full justify-start gap-2 px-2"
						onclick={addColumn}
						disabled={!$editor?.can().addColumnAfter()}
					>
						<Columns2 class="h-3 w-3" /> Add Column
					</Button>
					<Button
						variant="ghost"
						size="sm"
						class="h-8 w-full justify-start gap-2 px-2"
						onclick={deleteColumn}
						disabled={!$editor?.can().deleteColumn()}
					>
						<Trash2 class="h-3 w-3" /> Delete Column
					</Button>
					<Button
						variant="ghost"
						size="sm"
						class="h-8 w-full justify-start gap-2 px-2"
						onclick={addRow}
						disabled={!$editor?.can().addRowAfter()}
					>
						<Rows2 class="h-3 w-3" /> Add Row
					</Button>
					<Button
						variant="ghost"
						size="sm"
						class="h-8 w-full justify-start gap-2 px-2"
						onclick={deleteRow}
						disabled={!$editor?.can().deleteRow()}
					>
						<Trash2 class="h-3 w-3" /> Delete Row
					</Button>
					<Button
						variant="ghost"
						size="sm"
						class="h-8 w-full justify-start gap-2 px-2 text-destructive hover:text-destructive"
						onclick={deleteTable}
						disabled={!$editor?.can().deleteTable()}
					>
						<Trash2 class="h-3 w-3" /> Delete Table
					</Button>
				</div>
			</Popover.Content>
		</Popover.Root>
	</div>
	<EditorContent class="h-full max-h-full" editor={$editor} />
{/if}
<input
	type="file"
	class="hidden"
	accept="image/*"
	bind:this={fileInput}
	onchange={handleImageSelect}
/>
