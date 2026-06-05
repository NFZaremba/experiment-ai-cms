"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { toInlineHtml } from "@/lib/studio/sanitize";

/**
 * Minimal inline rich-text editor (bold / italic / link) built on the same
 * Tiptap stack as the beta app. Block elements (headings, lists, blockquote…)
 * are disabled to keep marketing copy inline. Emits sanitized inline HTML.
 */
export function RichTextEditor({
  initialHtml,
  onChange,
}: {
  initialHtml: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false, // required for Next SSR
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
      }),
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: initialHtml,
    onUpdate: ({ editor }) => onChange(toInlineHtml(editor.getHTML())),
  });

  if (!editor) return null;

  const toggleLink = () => {
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt("Link URL (leave blank to cancel)");
    if (url) editor.chain().focus().setLink({ href: url }).run();
  };

  const btn = (active: boolean) =>
    `rounded px-2 py-1 text-sm ${active ? "bg-cyan-700 text-white" : "text-gray-700 hover:bg-gray-100"}`;

  return (
    <div className="rounded-md border border-gray-200">
      <div className="flex items-center gap-1 border-b border-gray-100 p-1">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btn(editor.isActive("bold"))}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btn(editor.isActive("italic"))}
        >
          <em>i</em>
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={toggleLink}
          className={btn(editor.isActive("link"))}
        >
          🔗
        </button>
      </div>
      <EditorContent
        editor={editor}
        className="prose-sm max-h-48 overflow-y-auto p-2 text-sm text-gray-900 [&_a]:text-cyan-700 [&_a]:underline [&_.ProseMirror]:outline-none"
      />
    </div>
  );
}
