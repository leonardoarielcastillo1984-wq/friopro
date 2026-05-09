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
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { useEffect, useState, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, CheckSquare, Quote,
  Heading1, Heading2, Heading3,
  Undo, Redo, X, Save, Download, Loader2,
  Link as LinkIcon, Highlighter, FileText,
  Table as TableIcon, Minus, Sparkles, History,
  ChevronLeft, ChevronRight, RotateCcw, CheckCircle,
  Clock, AlertTriangle, Wand2, PanelRight, PanelRightClose,
  Cpu, RefreshCw, Send
} from 'lucide-react';

interface DocumentEditorProps {
  documentId: string;
  documentTitle: string;
  onClose: () => void;
  onSaved?: () => void;
}

interface Version {
  id: string;
  version: number;
  originalName?: string;
  fileSize?: number;
  createdAt: string;
  createdBy?: { email: string };
}

interface AiSuggestion {
  type: 'gap' | 'recommendation' | 'rewrite' | 'info';
  priority?: string;
  text: string;
  action?: string;
}

const AI_ACTIONS = [
  { id: 'improve', label: 'Mejorar redacción', icon: '✨' },
  { id: 'iso9001', label: 'Adaptar a ISO 9001', icon: '📋' },
  { id: 'rewrite', label: 'Reescribir profesionalmente', icon: '🖊️' },
  { id: 'objective', label: 'Generar objetivo', icon: '🎯' },
  { id: 'scope', label: 'Completar alcance', icon: '🔭' },
  { id: 'responsibilities', label: 'Generar responsabilidades', icon: '👥' },
  { id: 'indicators', label: 'Sugerir indicadores', icon: '📊' },
  { id: 'capa', label: 'Generar CAPA asociado', icon: '⚡' },
];

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
  // Panel IA
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [aiChat, setAiChat] = useState('');
  const [aiChatMessages, setAiChatMessages] = useState<{role:'user'|'ai'; text:string}[]>([]);
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const [activeAiAction, setActiveAiAction] = useState<string | null>(null);
  // Versiones
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [diffHtml, setDiffHtml] = useState<string | null>(null);
  const [restoringVersion, setRestoringVersion] = useState<string | null>(null);
  // Workflow
  const [docStatus, setDocStatus] = useState<string>('DRAFT');
  const [changingStatus, setChangingStatus] = useState(false);
  // Visor PDF
  const [showPdfViewer, setShowPdfViewer] = useState(true);
  const [pdfError, setPdfError] = useState(false);
  const [pdfKey, setPdfKey] = useState(Date.now());
  // Autosave
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      setWordCount(editor.storage.characterCount?.words() ?? 0);
      setSaved(false);
      // Autosave con debounce 30s
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(() => {
        const html = editor.getHTML();
        apiFetch(`/documents/${documentId}/content`, {
          method: 'PUT',
          json: { htmlContent: html, changeNote: 'Autoguardado' },
        }).then(() => setSaved(true)).catch(() => {});
      }, 30000);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[500px] px-8 py-6',
      },
    },
  });

  const [pendingContent, setPendingContent] = useState<string | null>(null);

  // Cuando el editor esté listo y haya contenido pendiente, aplicarlo
  useEffect(() => {
    if (editor && pendingContent !== null) {
      editor.commands.setContent(pendingContent || '<p></p>');
      setWordCount(editor.storage.characterCount?.words() ?? 0);
      setPendingContent(null);
    }
  }, [editor, pendingContent]);

  useEffect(() => {
    loadContent();
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [documentId]);

  const loadContent = async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/documents/${documentId}/content${refresh ? '?refresh=true' : ''}`;
      const res = await apiFetch<{ htmlContent: string; source: string; status?: string }>(url);
      setSource(res.source);
      if (res.status) setDocStatus(res.status);
      if (editor) {
        editor.commands.setContent(res.htmlContent || '<p></p>');
        setWordCount(editor.storage.characterCount?.words() ?? 0);
      } else {
        setPendingContent(res.htmlContent || '');
      }
    } catch {
      setError('Error al cargar el contenido del documento.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (note?: string) => {
    if (!editor) return;
    setSaving(true);
    setError(null);
    try {
      const htmlContent = editor.getHTML();
      await apiFetch(`/documents/${documentId}/content`, {
        method: 'PUT',
        json: { htmlContent, changeNote: note || changeNote || undefined },
      });
      setSaved(true);
      setShowChangeNote(false);
      setChangeNote('');
      onSaved?.();
      setTimeout(() => setSaved(false), 3000);
      // Recargar PDF ~8s después (tiempo para que LibreOffice genere el PDF)
      setTimeout(() => setPdfKey(Date.now()), 8000);
    } catch (err: any) {
      setError('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (format: 'docx' | 'pdf') => {
    setExporting(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
      const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') || '' : '';
      const endpoint = format === 'pdf' ? 'export-pdf' : 'export-docx';
      const res = await fetch(`/api/documents/${documentId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'x-tenant-id': tenantId },
      });
      if (!res.ok) throw new Error('Error al exportar');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${documentTitle.replace(/[^a-zA-Z0-9._-]/g, '_')}.${format}`;
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

  // ─── IA: Analizar documento completo ───
  const handleAiAnalyze = async () => {
    setAiLoading(true);
    setAiSuggestions([]);
    try {
      const res = await apiFetch<any>(`/documents/${documentId}/ai-validation`, { method: 'POST' });
      const sugs: AiSuggestion[] = [];
      if (res.gaps) res.gaps.forEach((g: string) => sugs.push({ type: 'gap', text: g, priority: 'ALTA' }));
      if (res.recommendations) res.recommendations.forEach((r: any) => sugs.push({ type: 'recommendation', text: r.action, priority: r.priority, action: r.moduleOrDocument }));
      if (res.summary) sugs.unshift({ type: 'info', text: res.summary });
      setAiSuggestions(sugs);
    } catch {
      setAiSuggestions([{ type: 'info', text: 'IA no disponible en este entorno.' }]);
    } finally {
      setAiLoading(false);
    }
  };

  // ─── IA: Validación cruzada Fase 4 ───
  const handleCrossValidate = async () => {
    setAiLoading(true);
    setAiSuggestions([]);
    try {
      const res = await apiFetch<any>(`/documents/${documentId}/cross-validate`, { method: 'POST' });
      const sugs: AiSuggestion[] = [];
      if (res.summary) sugs.push({ type: 'info', text: `📊 ${res.summary}` });
      if (res.compliance_risk) sugs.push({ type: res.compliance_risk === 'ALTO' ? 'gap' : 'recommendation', text: `Riesgo de cumplimiento: ${res.compliance_risk}`, priority: res.compliance_risk });
      if (res.inconsistencies) res.inconsistencies.forEach((i: string) => sugs.push({ type: 'gap', text: i }));
      if (res.missing_records) res.missing_records.forEach((m: string) => sugs.push({ type: 'recommendation', text: `Registro faltante: ${m}` }));
      if (res.recommendations) res.recommendations.forEach((r: string) => sugs.push({ type: 'info', text: r }));
      setAiSuggestions(sugs);
    } catch {
      setAiSuggestions([{ type: 'info', text: 'Validación cruzada no disponible.' }]);
    } finally {
      setAiLoading(false);
    }
  };

  // ─── IA: Acción sobre texto seleccionado o documento ───
  const handleAiAction = async (actionId: string) => {
    if (!editor) return;
    setActiveAiAction(actionId);
    const selectedText = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      ' '
    ) || editor.getText().slice(0, 2000);

    const prompts: Record<string, string> = {
      improve: `Mejorá la redacción del siguiente texto de un procedimiento ISO, sin cambiar el significado. Devolvé solo el texto mejorado:\n\n${selectedText}`,
      iso9001: `Adaptá el siguiente texto para que cumpla con los requisitos de ISO 9001:2015. Usá lenguaje normativo apropiado. Devolvé solo el texto adaptado:\n\n${selectedText}`,
      rewrite: `Reescribí el siguiente texto de forma profesional, clara y estructurada para un Sistema de Gestión de Calidad. Devolvé solo el texto:\n\n${selectedText}`,
      objective: `Generá un objetivo SMART apropiado para el siguiente procedimiento/proceso:\n\n${selectedText}`,
      scope: `Generá una sección de Alcance completa y profesional para el siguiente documento de gestión:\n\n${selectedText}`,
      responsibilities: `Generá una sección de Responsabilidades/Roles con matriz RACI para el siguiente procedimiento:\n\n${selectedText}`,
      indicators: `Sugerí 3-5 indicadores de desempeño (KPIs) medibles para controlar el cumplimiento del siguiente proceso:\n\n${selectedText}`,
      capa: `Basándote en las brechas detectadas en el siguiente documento, generá una descripción de CAPA (Corrección y Acción Preventiva) apropiada:\n\n${selectedText}`,
    };

    try {
      const res = await apiFetch<{ text: string }>(`/documents/${documentId}/ai-action`, {
        method: 'POST',
        json: { prompt: prompts[actionId] || prompts.improve, actionId },
      });
      if (res.text) {
        const newParagraphs = res.text.split('\n').filter(Boolean).map(l => `<p>${l}</p>`).join('');
        editor.chain().focus().insertContent(newParagraphs).run();
        setSaved(false);
      }
    } catch {
      setAiSuggestions(prev => [{ type: 'info', text: 'Error al procesar la acción IA.' }, ...prev]);
    } finally {
      setActiveAiAction(null);
    }
  };

  // ─── IA: Chat ───
  const handleAiChat = async () => {
    if (!aiChat.trim()) return;
    const userMsg = aiChat.trim();
    setAiChat('');
    setAiChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setAiChatLoading(true);
    try {
      const context = editor?.getText().slice(0, 1500) || '';
      const res = await apiFetch<{ text: string }>(`/documents/${documentId}/ai-action`, {
        method: 'POST',
        json: { prompt: `Contexto del documento:\n${context}\n\nPregunta: ${userMsg}`, actionId: 'chat' },
      });
      setAiChatMessages(prev => [...prev, { role: 'ai', text: res.text || 'Sin respuesta.' }]);
    } catch {
      setAiChatMessages(prev => [...prev, { role: 'ai', text: 'Error al conectar con la IA.' }]);
    } finally {
      setAiChatLoading(false);
    }
  };

  // ─── Versiones: cargar y mostrar diff ───
  const handleLoadVersions = async () => {
    setShowVersions(true);
    setLoadingVersions(true);
    setDiffHtml(null);
    try {
      const res = await apiFetch<{ versions: Version[] }>(`/documents/${documentId}/versions`);
      setVersions(res.versions || []);
    } catch {
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!confirm('¿Restaurar esta versión? Se creará un punto de restauración del estado actual.')) return;
    setRestoringVersion(versionId);
    try {
      const res = await apiFetch<{ htmlContent: string }>(`/documents/${documentId}/versions/${versionId}/restore`, { method: 'POST' });
      if (res.htmlContent) {
        editor?.commands.setContent(res.htmlContent);
        setSaved(false);
        setShowVersions(false);
        onSaved?.();
      }
    } catch (err: any) {
      setError('Error al restaurar: ' + err.message);
    } finally {
      setRestoringVersion(null);
    }
  };

  // ─── Workflow: cambiar estado ───
  const handleChangeStatus = async (newStatus: string) => {
    setChangingStatus(true);
    try {
      await apiFetch(`/documents/${documentId}`, {
        method: 'PATCH',
        json: { status: newStatus },
      });
      setDocStatus(newStatus);
      onSaved?.();
    } catch (err: any) {
      setError('Error al cambiar estado: ' + err.message);
    } finally {
      setChangingStatus(false);
    }
  };

  if (!editor) return null;

  const ToolbarBtn = ({ onClick, active, title, children, disabled }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode; disabled?: boolean }) => (
    <button type="button" onClick={onClick} title={title} disabled={disabled}
      className={`p-1.5 rounded hover:bg-gray-100 transition-colors disabled:opacity-40 ${active ? 'bg-blue-100 text-blue-700' : 'text-gray-600'}`}>
      {children}
    </button>
  );
  const Divider = () => <div className="w-px h-5 bg-gray-200 mx-1" />;

  const statusConfig: Record<string, { label: string; color: string; next?: string; nextLabel?: string }> = {
    DRAFT: { label: 'Borrador', color: 'bg-amber-100 text-amber-700', next: 'EFFECTIVE', nextLabel: 'Publicar' },
    EFFECTIVE: { label: 'Vigente', color: 'bg-green-100 text-green-700', next: 'OBSOLETE', nextLabel: 'Marcar obsoleto' },
    OBSOLETE: { label: 'Obsoleto', color: 'bg-gray-100 text-gray-500' },
  };
  const currentStatus = statusConfig[docStatus] || statusConfig.DRAFT;

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-gray-900 truncate max-w-md">{documentTitle}</h1>
            <p className="text-xs text-gray-400 flex items-center gap-2 flex-wrap">
              <span>{source === 'edited' ? 'Editado en línea' : source === 'file' ? 'Extraído del archivo' : 'Texto del documento'}</span>
              <span>· {wordCount} palabras</span>
              {saved && <span className="text-green-600">✓ Guardado</span>}
            </p>
            <button onClick={() => loadContent(true)}
              className="flex items-center gap-1 mt-0.5 px-2 py-0.5 text-xs bg-amber-50 border border-amber-300 text-amber-700 rounded-full hover:bg-amber-100 font-medium">
              <RefreshCw className="w-3 h-3" /> Re-extraer del archivo
            </button>
          </div>
          {/* Workflow badge */}
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${currentStatus.color} flex-shrink-0`}>
            {currentStatus.label}
          </span>
          {currentStatus.next && (
            <button onClick={() => handleChangeStatus(currentStatus.next!)} disabled={changingStatus}
              className="text-xs px-2 py-0.5 border border-gray-300 rounded-full text-gray-600 hover:bg-gray-50 disabled:opacity-50 flex-shrink-0">
              {changingStatus ? <Loader2 className="w-3 h-3 animate-spin" /> : currentStatus.nextLabel}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* IA Panel toggle */}
          <button onClick={() => { setShowAiPanel(p => !p); if (!aiSuggestions.length) handleAiAnalyze(); }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${showAiPanel ? 'bg-purple-600 text-white border-purple-600' : 'border-purple-300 text-purple-700 hover:bg-purple-50'}`}>
            <Sparkles className="w-3.5 h-3.5" /> IA
          </button>
          {/* Versiones */}
          <button onClick={handleLoadVersions}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
            <History className="w-3.5 h-3.5" /> Versiones
          </button>
          {/* Export */}
          <div className="relative group">
            <button disabled={exporting}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50">
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Exportar
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[120px] hidden group-hover:block">
              <button onClick={() => handleExport('docx')} className="w-full px-3 py-2 text-xs text-left hover:bg-gray-50 text-gray-700">📄 DOCX</button>
              <button onClick={() => handleExport('pdf')} className="w-full px-3 py-2 text-xs text-left hover:bg-gray-50 text-gray-700">📋 PDF</button>
            </div>
          </div>
          {/* Guardar */}
          {showChangeNote ? (
            <div className="flex items-center gap-1">
              <input type="text" value={changeNote} onChange={e => setChangeNote(e.target.value)}
                placeholder="Nota del cambio..." autoFocus
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                className="px-2 py-1 text-xs border border-gray-300 rounded-lg w-40 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <button onClick={() => handleSave()} disabled={saving}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Guardar
              </button>
              <button onClick={() => setShowChangeNote(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <button onClick={() => setShowChangeNote(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Save className="w-3.5 h-3.5" /> Guardar
            </button>
          )}
          <button onClick={onClose}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
            <X className="w-3.5 h-3.5" /> Cerrar
          </button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center flex-wrap gap-0.5 px-3 py-1.5 bg-white border-b border-gray-200 flex-shrink-0">
        <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} title="Deshacer"><Undo className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} title="Rehacer"><Redo className="w-4 h-4" /></ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="H1"><Heading1 className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="H2"><Heading2 className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="H3"><Heading3 className="w-4 h-4" /></ToolbarBtn>
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
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numerada"><ListOrdered className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Checklist"><CheckSquare className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Cita"><Quote className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Línea"><Minus className="w-4 h-4" /></ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insertar tabla"><TableIcon className="w-4 h-4" /></ToolbarBtn>
        {editor.isActive('table') && <>
          <ToolbarBtn onClick={() => editor.chain().focus().addColumnAfter().run()} title="Agregar columna"><ChevronRight className="w-4 h-4" /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().addRowAfter().run()} title="Agregar fila"><ChevronLeft className="w-4 h-4 rotate-90" /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().deleteTable().run()} title="Eliminar tabla" active><X className="w-4 h-4" /></ToolbarBtn>
        </>}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mx-4 mt-1 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between flex-shrink-0">
          {error}
          <button onClick={() => setError(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* ── Body: PDF Viewer + Editor + AI Panel ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Visor PDF ── */}
        {showPdfViewer && (
          <div className="flex flex-col border-r border-gray-200 bg-gray-100" style={{width: '48%', minWidth: 320}}>
            <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 text-white text-xs flex-shrink-0">
              <span className="font-medium flex items-center gap-1.5">📄 Vista original del documento</span>
              <button onClick={() => setShowPdfViewer(false)} className="text-gray-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {pdfError ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 gap-3">
                <FileText className="w-12 h-12 text-gray-400" />
                <p className="text-sm text-gray-500">Vista previa no disponible para este documento.<br/>Usá el editor de la derecha para editar el contenido.</p>
                <button onClick={() => { setPdfError(false); }} className="text-xs text-blue-600 underline">Reintentar</button>
              </div>
            ) : (
              <iframe
                key={pdfKey}
                src={`/api/documents/${documentId}/preview-pdf?t=${pdfKey}`}
                className="flex-1 w-full border-0"
                title="Vista previa del documento"
                onError={() => setPdfError(true)}
              />
            )}
          </div>
        )}

        {/* ── Editor area ── */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {!showPdfViewer && (
            <div className="px-3 py-1 bg-gray-50 border-b border-gray-200 flex-shrink-0">
              <button onClick={() => { setShowPdfViewer(true); setPdfError(false); }}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                <FileText className="w-3.5 h-3.5" /> Mostrar vista original
              </button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                <p className="text-sm text-gray-500">Cargando contenido del documento...</p>
              </div>
            </div>
          ) : (
            <div className="mx-auto my-4 bg-white rounded-xl shadow-sm border border-gray-200 min-h-[600px]" style={{maxWidth: showPdfViewer ? '100%' : '4xl'}}>
              <EditorContent editor={editor} />
            </div>
          )}
          </div>
        </div>

        {/* ── Panel IA lateral ── */}
        {showAiPanel && (
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col flex-shrink-0 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-semibold text-gray-800">Copilot IA</span>
              </div>
              <button onClick={() => setShowAiPanel(false)}><X className="w-4 h-4 text-gray-400 hover:text-gray-600" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {/* Acciones IA rápidas */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Acciones rápidas</p>
                <div className="grid grid-cols-2 gap-1">
                  {AI_ACTIONS.map(action => (
                    <button key={action.id} onClick={() => handleAiAction(action.id)}
                      disabled={activeAiAction !== null}
                      className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-purple-50 hover:border-purple-200 text-gray-700 disabled:opacity-50 transition-colors text-left">
                      {activeAiAction === action.id ? <Loader2 className="w-3 h-3 animate-spin text-purple-600" /> : <span>{action.icon}</span>}
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Análisis del documento */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Análisis ISO</p>
                  <div className="flex gap-1">
                    <button onClick={handleAiAnalyze} disabled={aiLoading}
                      className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 disabled:opacity-50">
                      {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      Analizar
                    </button>
                    <span className="text-gray-300">|</span>
                    <button onClick={handleCrossValidate} disabled={aiLoading}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50" title="Validar contra datos reales del sistema">
                      <Cpu className="w-3 h-3" /> Cruzar
                    </button>
                  </div>
                </div>
                {aiLoading && <div className="flex items-center gap-2 text-xs text-gray-500"><Loader2 className="w-3 h-3 animate-spin" /> Analizando documento...</div>}
                {aiSuggestions.map((s, i) => (
                  <div key={i} className={`mb-2 p-2 rounded-lg text-xs ${
                    s.type === 'gap' ? 'bg-red-50 border border-red-200 text-red-700' :
                    s.type === 'recommendation' ? 'bg-amber-50 border border-amber-200 text-amber-700' :
                    'bg-blue-50 border border-blue-200 text-blue-700'
                  }`}>
                    {s.priority && <span className="font-semibold">[{s.priority}] </span>}
                    {s.text}
                    {s.action && <div className="mt-0.5 text-gray-500 italic">→ {s.action}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Chat IA */}
            <div className="border-t border-gray-200 p-3">
              <p className="text-xs font-semibold text-gray-500 mb-2">Chat con el documento</p>
              <div className="space-y-1.5 mb-2 max-h-36 overflow-y-auto">
                {aiChatMessages.map((m, i) => (
                  <div key={i} className={`text-xs p-2 rounded-lg ${m.role === 'user' ? 'bg-blue-50 text-blue-800 text-right' : 'bg-gray-50 text-gray-700'}`}>
                    {m.text}
                  </div>
                ))}
                {aiChatLoading && <div className="text-xs text-gray-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Pensando...</div>}
              </div>
              <div className="flex gap-1">
                <input type="text" value={aiChat} onChange={e => setAiChat(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAiChat()}
                  placeholder="Preguntale al documento..." disabled={aiChatLoading}
                  className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50" />
                <button onClick={handleAiChat} disabled={aiChatLoading || !aiChat.trim()}
                  className="p-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal de Versiones ── */}
      {showVersions && (
        <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-gray-600" />
                <h2 className="font-semibold text-gray-900">Historial de versiones</h2>
              </div>
              <button onClick={() => { setShowVersions(false); setDiffHtml(null); }}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingVersions ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Cargando versiones...</div>
              ) : versions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No hay versiones anteriores guardadas.</p>
              ) : (
                <div className="space-y-2">
                  {versions.map(v => (
                    <div key={v.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">v{v.version}</span>
                          {v.originalName && <span className="text-xs text-gray-500">{v.originalName}</span>}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {new Date(v.createdAt).toLocaleString('es-AR')}
                          {v.createdBy && ` · ${v.createdBy.email}`}
                        </div>
                      </div>
                      <button onClick={() => handleRestoreVersion(v.id)} disabled={restoringVersion === v.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50">
                        {restoringVersion === v.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                        Restaurar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="px-4 py-1.5 bg-white border-t border-gray-200 flex items-center justify-between text-xs text-gray-400 flex-shrink-0">
        <span>{wordCount} palabras · {editor.storage.characterCount?.characters() ?? 0} caracteres · Autoguardado cada 30s</span>
        <span>Ctrl+Z deshacer · Ctrl+S guardar</span>
      </div>
    </div>
  );
}
