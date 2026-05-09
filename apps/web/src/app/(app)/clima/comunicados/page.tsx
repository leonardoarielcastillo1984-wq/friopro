'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Megaphone, Send, Trash2, Eye, FileText,
  ImageIcon, X, Users, Mail, CheckCircle2, Clock, Loader2,
  Paperclip, ChevronDown
} from 'lucide-react';
import { apiFetch, getCsrfToken, getTenantId } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  BORRADOR: 'bg-gray-100 text-gray-600',
  ENVIADO: 'bg-emerald-100 text-emerald-700',
};

export default function ComunicadosPage() {
  const router = useRouter();
  const [comms, setComms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [views, setViews] = useState<any[]>([]);
  const [loadingViews, setLoadingViews] = useState(false);
  const [resendsResult, setResendsResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    title: '',
    body: '',
    attachments: [] as { name: string; url: string; type: string }[],
    recipients: [] as { type: 'employee' | 'email'; id?: string; email: string; name?: string }[],
    extraEmails: [] as string[],
  });
  const [extraEmailInput, setExtraEmailInput] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signature, setSignature] = useState<string>('');
  const [showSigEditor, setShowSigEditor] = useState(false);
  const [savingSig, setSavingSig] = useState(false);
  const sigEditorRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadComms(); loadEmployees(); loadSignature(); }, []);

  async function loadComms() {
    setLoading(true);
    try {
      const data = await apiFetch('/clima/comunicados') as any;
      setComms(data.comms || []);
    } catch { setComms([]); } finally { setLoading(false); }
  }

  async function loadEmployees() {
    try {
      const data = await apiFetch('/hr/employees') as any;
      setEmployees(data.employees || data.data || []);
    } catch { setEmployees([]); }
  }

  async function loadSignature() {
    try {
      const data = await apiFetch('/company/settings') as any;
      setSignature(data.settings?.commSignature || '');
    } catch {}
  }

  async function saveSignature() {
    setSavingSig(true);
    const html = sigEditorRef.current ? sigEditorRef.current.innerHTML : signature;
    try {
      await apiFetch('/company/settings', { method: 'PUT', json: { commSignature: html } });
      setSignature(html);
      setShowSigEditor(false);
    } catch { alert('Error al guardar firma'); } finally { setSavingSig(false); }
  }

  function resetForm() {
    setForm({ title: '', body: '', attachments: [], recipients: [], extraEmails: [] });
    setExtraEmailInput('');
    setSendResult(null);
    if (editorRef.current) editorRef.current.innerHTML = '';
  }

  function openNewForm() {
    resetForm();
    if (signature) {
      setTimeout(() => {
        if (editorRef.current) {
          const html = '<div><br></div><hr style="border:none;border-top:1px solid #E5E7EB;margin:12px 0;"/>' + signature;
          editorRef.current.innerHTML = html;
          setForm(p => ({ ...p, body: editorRef.current!.innerHTML }));
        }
      }, 50);
    }
    setShowForm(true);
  }

  const handleEditorPaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          document.execCommand('insertImage', false, dataUrl);
          if (editorRef.current) setForm(p => ({ ...p, body: editorRef.current!.innerHTML }));
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  }, []);

  function execFormat(cmd: string, value?: string) {
    document.execCommand(cmd, false, value);
    if (editorRef.current) setForm(p => ({ ...p, body: editorRef.current!.innerHTML }));
    editorRef.current?.focus();
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const headers: Record<string, string> = {};
      const token = typeof window !== 'undefined' ? window.localStorage.getItem('accessToken') : null;
      if (token) headers['authorization'] = `Bearer ${token}`;
      const csrf = getCsrfToken();
      if (csrf) headers['x-csrf-token'] = csrf;
      const tenantId = getTenantId();
      if (tenantId) headers['x-tenant-id'] = tenantId;
      const res = await fetch(`/api/clima/comunicados/upload`, {
        method: 'POST',
        body: fd,
        headers,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Error al subir archivo'); return; }
      if (data.url) {
        setForm(p => ({ ...p, attachments: [...p.attachments, { name: data.name, url: data.url, type: data.type }] }));
      }
    } catch { alert('Error al subir archivo'); } finally { setUploadingFile(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  }

  function toggleEmployee(emp: any) {
    const exists = form.recipients.find(r => r.id === emp.id);
    if (exists) {
      setForm(p => ({ ...p, recipients: p.recipients.filter(r => r.id !== emp.id) }));
    } else {
      if (!emp.email) return;
      setForm(p => ({ ...p, recipients: [...p.recipients, { type: 'employee', id: emp.id, email: emp.email, name: `${emp.firstName} ${emp.lastName}` }] }));
    }
  }

  function addExtraEmail() {
    const email = extraEmailInput.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (form.extraEmails.includes(email)) return;
    setForm(p => ({ ...p, extraEmails: [...p.extraEmails, email] }));
    setExtraEmailInput('');
  }

  async function handleSave(e: React.FormEvent, sendNow = false) {
    e.preventDefault();
    const currentBody = editorRef.current ? editorRef.current.innerHTML : form.body;
    const bodyText = currentBody.replace(/<[^>]*>/g, '').trim();
    const hasImage = /<img/i.test(currentBody);
    if (!form.title.trim() || (!bodyText && !hasImage)) {
      alert('Completá el asunto y el mensaje antes de continuar.');
      return;
    }
    const payload = { ...form, body: currentBody };
    setSaving(true);
    try {
      const data = await apiFetch('/clima/comunicados', { method: 'POST', json: payload }) as any;
      setComms(p => [data.comm, ...p]);
      setShowForm(false);
      resetForm();
      if (sendNow && data.comm?.id) {
        setSending(true);
        try {
          const res = await apiFetch(`/clima/comunicados/${data.comm.id}/enviar`, { method: 'POST' }) as any;
          setSendResult(res);
          setSelected({ ...data.comm, status: 'ENVIADO' });
          loadComms();
        } catch (e: any) { setSendResult({ error: e.message }); } finally { setSending(false); }
      }
    } catch { alert('Error al guardar'); } finally { setSaving(false); }
  }

  async function handleSend(id: string) {
    setSending(true);
    setSendResult(null);
    try {
      const res = await apiFetch(`/clima/comunicados/${id}/enviar`, { method: 'POST' }) as any;
      setSendResult(res);
      loadComms();
      if (selected?.id === id) setSelected((p: any) => ({ ...p, status: 'ENVIADO' }));
    } catch (e: any) { setSendResult({ error: e.message }); } finally { setSending(false); }
  }

  async function handleResend(id: string) {
    setSending(true);
    setResendsResult(null);
    try {
      const res = await apiFetch(`/clima/comunicados/${id}/reenviar`, { method: 'POST' }) as any;
      setResendsResult(res);
      loadComms();
    } catch (e: any) { setResendsResult({ error: e.message }); } finally { setSending(false); }
  }

  async function handleLoadViews(id: string) {
    setLoadingViews(true);
    try {
      const res = await apiFetch(`/clima/comunicados/${id}/vistas`) as any;
      setViews(res.views || []);
    } catch { setViews([]); } finally { setLoadingViews(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este comunicado?')) return;
    setDeletingId(id);
    try {
      await apiFetch(`/clima/comunicados/${id}`, { method: 'DELETE' });
      setComms(p => p.filter(c => c.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch { alert('Error al eliminar'); } finally { setDeletingId(null); }
  }

  const totalRecipients = (form.recipients.length + form.extraEmails.length);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Comunicación y Difusión</h1>
          <p className="text-sm text-gray-500 mt-0.5">Enviá comunicados, documentos e imágenes a tu equipo</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSigEditor(true)}
            className="flex items-center gap-1.5 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium px-3 py-2.5 rounded-xl transition-colors" title="Editar firma">
            <FileText className="w-4 h-4" />
            Firma
          </button>
          <button onClick={openNewForm}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow transition-colors">
            <Plus className="w-4 h-4" />
            Nuevo comunicado
          </button>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}</div>
      ) : comms.length === 0 ? (
        <div className="text-center py-20">
          <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No hay comunicados creados</p>
          <p className="text-sm text-gray-400 mt-1">Creá tu primer comunicado para enviar a tu equipo</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comms.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Megaphone className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelected(c)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{c.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                    {c.sentAt && <span className="flex items-center gap-1"><Send className="w-3 h-3" />Enviado {new Date(c.sentAt).toLocaleDateString('es-AR')}</span>}
                    {c.sentCount > 0 && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{c.sentCount} destinatarios</span>}
                    {(c.attachments as any[])?.length > 0 && <span className="flex items-center gap-1"><Paperclip className="w-3 h-3" />{(c.attachments as any[]).length} adjunto(s)</span>}
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(c.createdAt).toLocaleDateString('es-AR')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setSelected(c)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-indigo-600 transition-colors" title="Ver">
                    <Eye className="w-4 h-4" />
                  </button>
                  {c.status === 'BORRADOR' && (
                    <button onClick={() => handleSend(c.id)} disabled={sending} className="p-2 hover:bg-indigo-50 rounded-lg text-gray-500 hover:text-indigo-600 transition-colors" title="Enviar">
                      <Send className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => handleDelete(c.id)} disabled={deletingId === c.id} className="p-2 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-500 transition-colors" title="Eliminar">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal detalle */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900">{selected.title}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[selected.status]}`}>{selected.status}</span>
              </div>
              <button onClick={() => { setSelected(null); setSendResult(null); }} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-sm text-gray-700 bg-gray-50 rounded-xl p-4 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: selected.body }} />

              {/* Adjuntos */}
              {(selected.attachments as any[])?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">ADJUNTOS</p>
                  <div className="space-y-1">
                    {(selected.attachments as any[]).map((a: any, i: number) => (
                      <a key={i} href={a.url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors">
                        {a.type?.startsWith('image') ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        {a.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Destinatarios */}
              {(selected.recipients as any[])?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">DESTINATARIOS INTERNOS</p>
                  <div className="flex flex-wrap gap-1">
                    {(selected.recipients as any[]).map((r: any, i: number) => (
                      <span key={i} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{r.name || r.email}</span>
                    ))}
                  </div>
                </div>
              )}
              {(selected.extraEmails as string[])?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">EMAILS EXTERNOS</p>
                  <div className="flex flex-wrap gap-1">
                    {(selected.extraEmails as string[]).map((e: string, i: number) => (
                      <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{e}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Resultado de envío */}
              {sendResult && (
                <div className={`rounded-xl px-4 py-3 text-sm ${sendResult.error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {sendResult.error ? `Error: ${sendResult.error}` : `✓ Enviado a ${sendResult.sentCount} de ${sendResult.totalTargets} destinatarios`}
                  {sendResult.errors?.length > 0 && <div className="mt-1 text-xs opacity-70">{sendResult.errors.join(', ')}</div>}
                </div>
              )}

              {selected.status === 'BORRADOR' && (
                <button onClick={() => handleSend(selected.id)} disabled={sending}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? 'Enviando...' : 'Enviar ahora (interno + email)'}
                </button>
              )}
              {selected.status === 'ENVIADO' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-2.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Enviado el {selected.sentAt ? new Date(selected.sentAt).toLocaleDateString('es-AR') : '—'} · {selected.sentCount} destinatarios</span>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => handleResend(selected.id)} disabled={sending}
                      className="flex-1 flex items-center justify-center gap-2 border border-indigo-300 text-indigo-700 hover:bg-indigo-50 disabled:opacity-60 text-sm font-medium py-2.5 rounded-xl transition-colors">
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {sending ? 'Reenviando...' : 'Reenviar a todos'}
                    </button>
                    <button onClick={() => handleLoadViews(selected.id)}
                      className="flex-1 flex items-center justify-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium py-2.5 rounded-xl transition-colors">
                      {loadingViews ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                      Ver quién lo vio
                    </button>
                  </div>

                  {resendsResult && (
                    <div className={`rounded-xl px-4 py-3 text-sm ${resendsResult.error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {resendsResult.error ? `Error: ${resendsResult.error}` : `✓ Reenviado a ${resendsResult.sentCount} de ${resendsResult.totalTargets} destinatarios`}
                    </div>
                  )}

                  {views.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2">VISTO POR ({views.length})</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {views.map((v: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-xs px-3 py-1.5 bg-gray-50 rounded-lg">
                            <span className="text-gray-700 font-medium">{v.name || v.email}</span>
                            <span className="text-gray-400">{new Date(v.viewedAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {views.length === 0 && !loadingViews && (
                    <p className="text-xs text-gray-400 text-center py-1">Hacé clic en "Ver quién lo vio" para cargar</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal editor de firma */}
      {showSigEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900">Firma de comunicados</h3>
                <p className="text-xs text-gray-400 mt-0.5">Se insertará automáticamente al crear un nuevo comunicado</p>
              </div>
              <button onClick={() => setShowSigEditor(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-1 border border-gray-200 border-b-0 rounded-t-xl px-2 py-1.5 bg-gray-50">
                {[{cmd:'bold',label:<strong>B</strong>},{cmd:'italic',label:<em>I</em>},{cmd:'underline',label:<span className="underline">U</span>}].map(({cmd,label})=>(
                  <button key={cmd} type="button" onMouseDown={e=>{e.preventDefault();sigEditorRef.current?.focus();document.execCommand(cmd,false,undefined);}}
                    className="w-7 h-7 rounded hover:bg-gray-200 text-sm font-medium text-gray-700 flex items-center justify-center">{label}</button>
                ))}
              </div>
              <div
                ref={sigEditorRef}
                contentEditable
                suppressContentEditableWarning
                dangerouslySetInnerHTML={{ __html: signature }}
                data-placeholder="Ej: Saludos, Leonardo Castillo | Gerente de Calidad | Tel: +54 9 11..."
                className="min-h-[100px] text-sm border border-gray-200 rounded-b-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/30 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
              />
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowSigEditor(false)}
                  className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50">Cancelar</button>
                <button onClick={saveSignature} disabled={savingSig}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
                  {savingSig ? 'Guardando...' : 'Guardar firma'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear comunicado */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Nuevo Comunicado</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-5">
              {/* Título */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Asunto / Título *</label>
                <input type="text" required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="ej: Actualización de procedimiento de seguridad"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400" />
              </div>

              {/* Cuerpo — editor rich text */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Mensaje *</label>
                {/* Toolbar */}
                <div className="flex items-center gap-1 border border-gray-200 border-b-0 rounded-t-xl px-2 py-1.5 bg-gray-50">
                  {[
                    { cmd: 'bold', label: <strong>B</strong> },
                    { cmd: 'italic', label: <em>I</em> },
                    { cmd: 'underline', label: <span className="underline">U</span> },
                  ].map(({ cmd, label }) => (
                    <button key={cmd} type="button" onMouseDown={e => { e.preventDefault(); execFormat(cmd); }}
                      className="w-7 h-7 rounded hover:bg-gray-200 text-sm font-medium text-gray-700 flex items-center justify-center transition-colors">
                      {label}
                    </button>
                  ))}
                  <div className="w-px h-4 bg-gray-300 mx-1" />
                  {['1', '2', '3'].map(n => (
                    <button key={n} type="button" onMouseDown={e => { e.preventDefault(); execFormat('formatBlock', `h${n}`); }}
                      className="px-2 h-7 rounded hover:bg-gray-200 text-xs font-medium text-gray-700 transition-colors">
                      H{n}
                    </button>
                  ))}
                  <div className="w-px h-4 bg-gray-300 mx-1" />
                  <button type="button" onMouseDown={e => { e.preventDefault(); execFormat('insertUnorderedList'); }}
                    className="px-2 h-7 rounded hover:bg-gray-200 text-xs text-gray-700 transition-colors">• Lista</button>
                  <div className="w-px h-4 bg-gray-300 mx-1" />
                  <span className="text-xs text-gray-400 ml-1">Pegá imágenes con Ctrl+V</span>
                </div>
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={() => { if (editorRef.current) setForm(p => ({ ...p, body: editorRef.current!.innerHTML })); }}
                  onPaste={handleEditorPaste}
                  data-placeholder="Escribí el contenido del comunicado..."
                  className="w-full min-h-[140px] text-sm border border-gray-200 rounded-b-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 prose prose-sm max-w-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
                  style={{ whiteSpace: 'pre-wrap' }}
                />
              </div>

              {/* Adjuntos */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Adjuntos (PDF, imágenes)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.attachments.map((a, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1.5 rounded-lg">
                      {a.type?.startsWith('image') ? <ImageIcon className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                      <span className="max-w-[120px] truncate">{a.name}</span>
                      <button type="button" onClick={() => setForm(p => ({ ...p, attachments: p.attachments.filter((_, j) => j !== i) }))}>
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  className="flex items-center gap-2 text-sm text-indigo-600 border border-indigo-200 hover:bg-indigo-50 px-3 py-2 rounded-xl transition-colors">
                  {uploadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                  {uploadingFile ? 'Subiendo...' : 'Adjuntar archivo'}
                </button>
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xlsx,.xls,.ppt,.pptx,.txt,image/*" className="hidden" onChange={handleUpload} />
              </div>

              {/* Destinatarios empleados */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Empleados destinatarios</label>
                <div className="border border-gray-200 rounded-xl max-h-40 overflow-y-auto divide-y divide-gray-50">
                  {employees.length === 0 && <p className="text-xs text-gray-400 p-3">No hay empleados cargados</p>}
                  {employees.map(emp => (
                    <label key={emp.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox"
                        checked={form.recipients.some(r => r.id === emp.id)}
                        onChange={() => toggleEmployee(emp)}
                        className="rounded border-gray-300" />
                      <span className="text-sm text-gray-700">{emp.firstName} {emp.lastName}</span>
                      <span className="text-xs text-gray-400 ml-auto">{emp.email}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Emails externos */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Emails adicionales (externos)</label>
                <div className="flex gap-2 mb-2">
                  <input type="email" value={extraEmailInput} onChange={e => setExtraEmailInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addExtraEmail(); } }}
                    placeholder="email@ejemplo.com"
                    className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400" />
                  <button type="button" onClick={addExtraEmail}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm transition-colors">
                    Agregar
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {form.extraEmails.map((e, i) => (
                    <span key={i} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      <Mail className="w-3 h-3" />{e}
                      <button type="button" onClick={() => setForm(p => ({ ...p, extraEmails: p.extraEmails.filter((_, j) => j !== i) }))}><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              </div>

              {totalRecipients > 0 && (
                <div className="text-xs text-indigo-600 bg-indigo-50 rounded-xl px-3 py-2">
                  <Users className="w-3.5 h-3.5 inline mr-1" />
                  {totalRecipients} destinatario(s) seleccionado(s)
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="text-sm text-gray-600 border border-gray-200 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 border border-indigo-300 text-indigo-700 hover:bg-indigo-50 disabled:opacity-60 text-sm font-medium py-2.5 rounded-xl transition-colors">
                  {saving ? 'Guardando...' : 'Guardar borrador'}
                </button>
                <button type="button" disabled={saving || sending}
                  onClick={e => handleSave(e as any, true)}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5">
                  {saving || sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {saving ? 'Guardando...' : sending ? 'Enviando...' : 'Enviar ahora'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
