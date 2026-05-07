'use client';

import { useState, useEffect, useRef } from 'react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => { loadComms(); loadEmployees(); }, []);

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

  function resetForm() {
    setForm({ title: '', body: '', attachments: [], recipients: [], extraEmails: [] });
    setExtraEmailInput('');
    setSendResult(null);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
      const headers: Record<string, string> = {};
      const token = typeof window !== 'undefined' ? window.localStorage.getItem('accessToken') : null;
      if (token) headers['authorization'] = `Bearer ${token}`;
      const csrf = getCsrfToken();
      if (csrf) headers['x-csrf-token'] = csrf;
      const tenantId = getTenantId();
      if (tenantId) headers['x-tenant-id'] = tenantId;
      const res = await fetch(`${apiBase}/clima/comunicados/upload`, {
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    setSaving(true);
    try {
      const data = await apiFetch('/clima/comunicados', { method: 'POST', json: form }) as any;
      setComms(p => [data.comm, ...p]);
      setShowForm(false);
      resetForm();
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
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow transition-colors">
          <Plus className="w-4 h-4" />
          Nuevo comunicado
        </button>
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
              <div className="text-sm text-gray-700 whitespace-pre-line bg-gray-50 rounded-xl p-4">{selected.body}</div>

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
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-2.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Enviado el {selected.sentAt ? new Date(selected.sentAt).toLocaleDateString('es-AR') : '—'} · {selected.sentCount} destinatarios</span>
                </div>
              )}
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

              {/* Cuerpo */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Mensaje *</label>
                <textarea required value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                  rows={5} placeholder="Escribí el contenido del comunicado..."
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 resize-none" />
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
                <input ref={fileInputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleUpload} />
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

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 text-sm text-gray-600 border border-gray-200 py-2.5 rounded-xl hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
                  {saving ? 'Guardando...' : 'Guardar como borrador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
