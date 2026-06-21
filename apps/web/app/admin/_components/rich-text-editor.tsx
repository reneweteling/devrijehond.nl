'use client';

/**
 * Controlled TipTap rich-text editor for admin forms.
 * Toolbar: Bold, Italic, Bullet list, Numbered list, H3, Link, Clear formatting.
 * Allowed set: bold, italic, strike, bulletList, orderedList, listItem,
 * paragraph, heading(h3), blockquote, hardBreak, link.
 */

import { useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';

// ---------------------------------------------------------------------------
// Toolbar icons (minimal inline SVGs, same convention as the rest of the admin)
// ---------------------------------------------------------------------------

function TIcon({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const ICON_BOLD = 'M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6zM6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z';
const ICON_ITALIC = 'M19 4h-9M14 20H5M15 4 9 20';
const ICON_BULLET = 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01';
const ICON_ORDERED = 'M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-2-2-2';
const ICON_H3 = 'M4 12h8M4 6v12M12 6v12M17 10l2-2v8M15 18h4';
const ICON_LINK =
  'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1';
const ICON_CLEAR = 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4ZM15 5l3 3';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

// ---------------------------------------------------------------------------
// Toolbar button
// ---------------------------------------------------------------------------

function ToolBtn({
  active,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault(); // keep editor focus
        onClick();
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 28,
        borderRadius: 6,
        border: active ? '1.5px solid var(--moss)' : '1.5px solid transparent',
        background: active ? 'var(--moss-soft)' : 'transparent',
        color: active ? 'var(--moss-700)' : 'var(--ink-2)',
        cursor: 'pointer',
        transition: 'background 0.1s, border-color 0.1s',
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bold: {},
        italic: {},
        strike: {},
        bulletList: {},
        orderedList: {},
        listItem: {},
        paragraph: {},
        heading: { levels: [3] },
        blockquote: {},
        hardBreak: {},
        // disable unused nodes/marks from the kit
        code: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
        },
      }),
    ],
    content: value,
    onUpdate({ editor: e }) {
      onChange(e.getHTML());
    },
  });

  // Keep content in sync when value changes externally (e.g. form reset).
  // Only call setContent when the serialised HTML actually differs, to avoid
  // resetting the cursor while the user is typing.
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value, false);
    }
  }, [editor, value]);

  const handleLinkClick = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL invoeren:', prev ?? 'https://');
    if (url === null) return; // cancelled
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  }, [editor]);

  if (!editor) return null;

  return (
    <div
      style={{
        border: '1px solid var(--line)',
        borderRadius: 8,
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '5px 8px',
          borderBottom: '1px solid var(--line)',
          background: 'var(--sand)',
          flexWrap: 'wrap',
        }}
      >
        <ToolBtn
          title="Vet (Ctrl+B)"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <TIcon d={ICON_BOLD} />
        </ToolBtn>

        <ToolBtn
          title="Cursief (Ctrl+I)"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <TIcon d={ICON_ITALIC} />
        </ToolBtn>

        <div
          aria-hidden="true"
          style={{ width: 1, height: 16, background: 'var(--line)', margin: '0 4px' }}
        />

        <ToolBtn
          title="Opsommingslijst"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <TIcon d={ICON_BULLET} />
        </ToolBtn>

        <ToolBtn
          title="Genummerde lijst"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <TIcon d={ICON_ORDERED} />
        </ToolBtn>

        <div
          aria-hidden="true"
          style={{ width: 1, height: 16, background: 'var(--line)', margin: '0 4px' }}
        />

        <ToolBtn
          title="Koptekst"
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <TIcon d={ICON_H3} />
        </ToolBtn>

        <ToolBtn
          title="Link invoegen / bewerken"
          active={editor.isActive('link')}
          onClick={handleLinkClick}
        >
          <TIcon d={ICON_LINK} />
        </ToolBtn>

        <div
          aria-hidden="true"
          style={{ width: 1, height: 16, background: 'var(--line)', margin: '0 4px' }}
        />

        <ToolBtn
          title="Opmaak wissen"
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        >
          <TIcon d={ICON_CLEAR} />
        </ToolBtn>
      </div>

      {/* Editable area */}
      <EditorContent
        editor={editor}
        style={
          {
            '--rte-placeholder': placeholder ? `"${placeholder}"` : '"Schrijf hier…"',
          } as React.CSSProperties
        }
        className="rte-content"
      />
    </div>
  );
}
