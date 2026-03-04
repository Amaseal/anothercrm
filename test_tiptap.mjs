import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';

const editor = new Editor({
    extensions: [StarterKit, Highlight],
    content: '<p>Hello world</p>',
});

editor.commands.selectAll();
editor.commands.setBold();
editor.commands.setHighlight();
console.log(editor.getHTML());
