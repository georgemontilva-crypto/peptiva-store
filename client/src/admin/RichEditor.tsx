import { useEffect, useState, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extension-placeholder";
import { MediaPicker } from "./mediaKit";
import { Button, Field, Modal, inputCls } from "./ui";

/**
 * Editor de texto con formato para artículos y fichas de producto.
 *
 * Guarda HTML limpio: párrafos, títulos H2/H3, negrita, cursiva, enlaces, listas, citas, tablas e
 * imágenes. No hay colores ni tamaños de letra a propósito: el aspecto lo pone la web, y así un
 * artículo pegado desde Word no rompe el diseño. El botón "HTML" deja ver y corregir el código.
 */
const isExternal = (href: string) => /^https?:\/\//i.test(href) && !/^https?:\/\/(www\.)?peptivasupplies\.com/i.test(href);

function Tool({ label, active = false, disabled = false, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // mousedown: así el botón no le quita la selección al texto antes de aplicar el formato
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-semibold transition-colors disabled:opacity-35 ${active ? "bg-navy text-white" : "text-slate hover:bg-mist hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-5 w-px bg-line" aria-hidden />;

function Toolbar({ editor, onImage, onLink, source, onToggleSource }: { editor: Editor; onImage: () => void; onLink: () => void; source: boolean; onToggleSource: () => void }) {
  // Se vuelve a pintar con cada cambio de selección, para que los botones reflejen el formato actual
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      p: e.isActive("paragraph"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      link: e.isActive("link"),
      ul: e.isActive("bulletList"),
      ol: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      table: e.isActive("table"),
      undo: e.can().undo(),
      redo: e.can().redo(),
    }),
  });
  const c = () => editor.chain().focus();
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-t-xl border-b border-line bg-white px-2 py-1.5">
      <Tool label="Paragraph" active={s.p && !source} disabled={source} onClick={() => c().setParagraph().run()}>¶</Tool>
      <Tool label="Section heading (H2)" active={s.h2} disabled={source} onClick={() => c().toggleHeading({ level: 2 }).run()}>H2</Tool>
      <Tool label="Sub-heading (H3)" active={s.h3} disabled={source} onClick={() => c().toggleHeading({ level: 3 }).run()}>H3</Tool>
      <Sep />
      <Tool label="Bold" active={s.bold} disabled={source} onClick={() => c().toggleBold().run()}><b>B</b></Tool>
      <Tool label="Italic" active={s.italic} disabled={source} onClick={() => c().toggleItalic().run()}><i>I</i></Tool>
      <Tool label="Link" active={s.link} disabled={source} onClick={onLink}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
      </Tool>
      <Sep />
      <Tool label="Bulleted list" active={s.ul} disabled={source} onClick={() => c().toggleBulletList().run()}>• ≡</Tool>
      <Tool label="Numbered list" active={s.ol} disabled={source} onClick={() => c().toggleOrderedList().run()}>1. ≡</Tool>
      <Tool label="Quote" active={s.quote} disabled={source} onClick={() => c().toggleBlockquote().run()}>❝</Tool>
      <Sep />
      <Tool label="Insert image" disabled={source} onClick={onImage}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m4 18 5-5 4 4 3-3 4 4" /></svg>
      </Tool>
      <Tool label="Insert table" disabled={source} onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M9 4v16M15 4v16" /></svg>
      </Tool>
      <Tool label="Divider line" disabled={source} onClick={() => c().setHorizontalRule().run()}>—</Tool>
      {s.table && !source ? (
        <>
          <Sep />
          <Tool label="Add row below" onClick={() => c().addRowAfter().run()}>+ row</Tool>
          <Tool label="Add column to the right" onClick={() => c().addColumnAfter().run()}>+ col</Tool>
          <Tool label="Delete row" onClick={() => c().deleteRow().run()}>− row</Tool>
          <Tool label="Delete column" onClick={() => c().deleteColumn().run()}>− col</Tool>
          <Tool label="Delete table" onClick={() => c().deleteTable().run()}>✕ table</Tool>
        </>
      ) : null}
      <span className="flex-1" />
      <Tool label="Undo" disabled={!s.undo || source} onClick={() => c().undo().run()}>↶</Tool>
      <Tool label="Redo" disabled={!s.redo || source} onClick={() => c().redo().run()}>↷</Tool>
      <Sep />
      <Tool label="Edit the HTML source" active={source} onClick={onToggleSource}>HTML</Tool>
    </div>
  );
}

export default function RichEditor({ value, onChange, placeholder = "Write here…", minHeight = 320 }: { value: string; onChange: (html: string) => void; placeholder?: string; minHeight?: number }) {
  const [source, setSource] = useState(false);
  const [raw, setRaw] = useState(value);
  const [picker, setPicker] = useState(false);
  const [link, setLink] = useState<{ href: string } | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Sin atributos por defecto: cada enlace conserva los suyos, y un enlace interno no se abre en otra pestaña
        link: { openOnClick: false, autolink: true, HTMLAttributes: { target: null, rel: null, class: null } },
      }),
      Image.configure({ HTMLAttributes: { loading: "lazy" } }),
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
  });

  // Si el contenido cambia desde fuera (al cargar el artículo), se refleja en el editor
  useEffect(() => {
    if (!editor || source) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (value !== current) editor.commands.setContent(value, { emitUpdate: false });
  }, [value, editor, source]);

  if (!editor) return <div className="rounded-xl border border-line bg-white" style={{ minHeight }} aria-busy="true" />;

  const toggleSource = () => {
    if (!source) {
      setRaw(editor.isEmpty ? "" : editor.getHTML());
      setSource(true);
    } else {
      editor.commands.setContent(raw, { emitUpdate: false });
      onChange(editor.isEmpty ? "" : editor.getHTML());
      setSource(false);
    }
  };

  const applyLink = () => {
    if (!link) return;
    const href = link.href.trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (!href) chain.unsetLink().run();
    else chain.setLink(isExternal(href) ? { href, target: "_blank", rel: "noopener" } : { href, target: null, rel: null }).run();
    setLink(null);
  };

  return (
    <div className="rounded-xl border border-slate-300 bg-white focus-within:border-teal focus-within:ring-2 focus-within:ring-teal/20">
      <Toolbar
        editor={editor}
        source={source}
        onToggleSource={toggleSource}
        onImage={() => setPicker(true)}
        onLink={() => setLink({ href: (editor.getAttributes("link").href as string | undefined) ?? "" })}
      />
      {source ? (
        <textarea
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            onChange(e.target.value);
          }}
          spellCheck={false}
          className="block w-full resize-y rounded-b-xl border-0 bg-slate-50 p-4 font-mono text-[0.8rem] leading-relaxed text-ink focus:outline-none"
          style={{ minHeight }}
          aria-label="HTML source"
        />
      ) : (
        <EditorContent editor={editor} className="rich-editor prose-copy max-w-none px-5 py-4" style={{ minHeight }} />
      )}

      <MediaPicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={(items) => {
          const img = items[0];
          if (img) editor.chain().focus().setImage({ src: img.url, alt: img.alt ?? "" }).run();
        }}
      />

      <Modal
        title="Link"
        open={Boolean(link)}
        onClose={() => setLink(null)}
        footer={
          <>
            {editor.isActive("link") ? <Button variant="danger" onClick={() => { editor.chain().focus().extendMarkRange("link").unsetLink().run(); setLink(null); }}>Remove link</Button> : null}
            <Button variant="ghost" onClick={() => setLink(null)}>Cancel</Button>
            <Button onClick={applyLink}>Apply</Button>
          </>
        }
      >
        <Field label="Address" hint="For pages of this site use the path: /coas, /shop, /product/ghk-cu-50mg, /blog/how-to-read-a-peptide-coa. Other sites need the full address and open in a new tab.">
          <input
            autoFocus
            value={link?.href ?? ""}
            onChange={(e) => setLink({ href: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
            }}
            placeholder="/coas or https://…"
            className={inputCls}
          />
        </Field>
      </Modal>
    </div>
  );
}
