'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, CheckSquare, Quote,
  Heading1, Heading2, Heading3,
  Undo, Redo, X, Save, Download, Loader2,
  Link as LinkIcon, Highlighter, Palette, FileText,
  RefreshCw, ChevronDown, Table, Minus
} from 'lucide-react';

interface DocumentEditorProps {
  documentId: string;
  documentTitle: string;
  onClose: () => void;
  onSaved?: () => void;
}

export default function DocumentEditor({ documentId, documentTitle, onClose, onSaved }: DocumentEditorProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [changeNote, setChangeNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [showChangeNote, setShowChangeNote] = useState(false);
  const [source, setSource] = useState<string>('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-blue-600 underline' } }),
      Image,
      Placeholder.configure({ placeholder: 'Comenzá a escribir el contenido del documento...' }),
      CharacterCount,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      setWordCount(editor.storage.characterCount?.words() ?? 0);
      setSaved(false);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[500px] px-8 py-6',
      },
    },
  });

  useEffect(() => {
    loadContent();
  }, [documentId]);

  const loadContent = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ htmlContent: string; source: string }>(`/documents/${documentId}/content`);
      editor?.commands.setContent(res.htmlContent || '<p></p>');
      setSource(res.source);
      setWordCount(editor?.storage.characterCount?.words() ?? 0);
    } catch (err: any) {
      setError('Error al cargar el contenido del documento.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editor) return;
    setSaving(true);
    setError(null);
    try {
      const htmlContent = editor.getHTML();
      await apiFetch(`/documents/${documentId}/content`, {
        method: 'PUT',
        json: { htmlContent, changeNote: changeNote || undefined },
      });
      setSaved(true);
      setShowChangeNote(false);
      setChangeNote('');
      onSaved?.();
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExportDocx = async () => {
    setExporting(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
      const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') || '' : '';
      const res = await fetch(`/api/documents/${documentId}/export-docx`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-tenant-id': tenantId,
        },
      });
      if (!res.ok) throw new Error('Error al exportar');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${documentTitle.replace(/[^a-zA-Z0-9._-]/g, '_')}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError('Error al exportar: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const setLink = () => {
    const previousUrl = editor?.getAttributes('link').href;
    const url = window.prompt('URL del enlace:', previousUrl);
    if (url === null) return;
    if (url === '') { editor?.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  if (!editor) return null;

  const ToolbarBtn = ({ onClick, active, title, children }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${active ? 'bg-blue-100 text-blue-700' : 'text-gray-600'}`}
    >
      {children}
    </button>
  );

  const Divider = () => <div className="w-px h-5 bg-gray-200 mx-1" />;

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-blue-600" />
          <div>
            <h1 className="text-sm font-semibold text-gray-900 max-w-xl truncate">{documentTitle}</h1>
            <p className="text-xs text-gray-400">
              {source === 'edited' ? 'Versión editada' : source === 'file' ? 'Extraído del archivo' : 'Texto del documento'}
              {' · '}{wordCount} palabras
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
              <CheckSquare className="w-3.5 h-3.5" /> Guardado
            </span>
          )}
          <button
            onClick={handleExportDocx}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Exportar DOCX
          </button>
          {showChangeNote ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={changeNote}
                onChange={e => setChangeNote(e.target.value)}
                placeholder="Nota del cambio (opcional)"
                className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar
              </button>
              <button onClick={() => setShowChangeNote(false)} className="p-1.5 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowChangeNote(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Save className="w-4 h-4" /> Guardar
            </button>
          )}
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            <X className="w-4 h-4" /> Cerrar
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center flex-wrap gap-0.5 px-4 py-2 bg-white border-b border-gray-200 sticky top-0 z-10">
        <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} title="Deshacer"><Undo className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} title="Rehacer"><Redo className="w-4 h-4" /></ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Título 1"><Heading1 className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Título 2"><Heading2 className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Título 3"><Heading3 className="w-4 h-4" /></ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Negrita"><Bold className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Cursiva"><Italic className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Subrayado"><UnderlineIcon className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Tachado"><Strikethrough className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHighlight({ color: '#FEF08A' }).run()} active={editor.isActive('highlight')} title="Resaltar"><Highlighter className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={setLink} active={editor.isActive('link')} title="Enlace"><LinkIcon className="w-4 h-4" /></ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Izquierda"><AlignLeft className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Centrado"><AlignCenter className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Derecha"><AlignRight className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justificado"><AlignJustify className="w-4 h-4" /></ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Lista"><List className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista numerada"><ListOrdered className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Lista de tareas"><CheckSquare className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Cita"><Quote className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Línea horizontal"><Minus className="w-4 h-4" /></ToolbarBtn>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Editor body */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
              <p className="text-sm text-gray-500">Cargando contenido del documento...</p>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto my-6 bg-white rounded-xl shadow-sm border border-gray-200 min-h-[600px]">
            <EditorContent editor={editor} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-white border-t border-gray-200 flex items-center justify-between text-xs text-gray-400">
        <span>{wordCount} palabras · {editor.storage.characterCount?.characters() ?? 0} caracteres</span>
        <span>Ctrl+Z deshacer · Ctrl+Y rehacer · Ctrl+S guardar</span>
      </div>
    </div>
  );
}
