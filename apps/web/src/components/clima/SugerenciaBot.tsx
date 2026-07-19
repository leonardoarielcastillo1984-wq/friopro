'use client';

import { useState, useEffect } from 'react';
import { MessageSquarePlus, X, Send, CheckCircle, CalendarPlus, ClipboardList, Wallet, ChevronLeft, Loader2, AlertTriangle, Check } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const TIPOS = [
  { value: 'SUGERENCIA', label: '💡 Sugerencia', desc: 'Idea para mejorar algo' },
  { value: 'RECLAMO',    label: '⚠️ Reclamo',    desc: 'Algo que no está bien' },
  { value: 'INQUIETUD',  label: '🤔 Inquietud',  desc: 'Algo que me preocupa' },
  { value: 'MEJORA',     label: '🚀 Mejora',     desc: 'Propuesta de optimización' },
  { value: 'ALERTA',     label: '🔴 Alerta',     desc: 'Situación urgente' },
];

const PRIORIDADES = [
  { value: 'BAJA',   label: 'Baja' },
  { value: 'MEDIA',  label: 'Media' },
  { value: 'ALTA',   label: 'Alta' },
  { value: 'CRITICA', label: 'Crítica' },
];

type Step = 'closed' | 'menu' | 'type' | 'form' | 'done' | 'portal';

export function SugerenciaBot() {
  const [step, setStep] = useState<Step>('closed');
  const [tipo, setTipo] = useState('SUGERENCIA');
  const [form, setForm] = useState({ title: '', content: '', priority: 'MEDIA', isAnonymous: true });
  const [sending, setSending] = useState(false);

  function reset() {
    setStep('closed');
    setTipo('SUGERENCIA');
    setForm({ title: '', content: '', priority: 'MEDIA', isAnonymous: true });
    setSending(false);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;
    setSending(true);
    try {
      await apiFetch('/clima/sugerencias', {
        method: 'POST',
        json: { ...form, type: tipo },
      });
      setStep('done');
    } catch {
      alert('Error al enviar. Intentá de nuevo.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

      {/* Panel */}
      {step !== 'closed' && (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-80 overflow-hidden animate-in slide-in-from-bottom-4 duration-200">

          {/* Header */}
          <div className="bg-gradient-to-r from-teal-500 to-cyan-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquarePlus className="w-4 h-4 text-white" />
              <span className="text-sm font-semibold text-white">
                {step === 'done' ? '¡Enviado!' : (step === 'portal' || step === 'menu') ? 'Portal del empleado' : 'Buzón de sugerencias'}
              </span>
            </div>
            <button onClick={reset} className="text-white/70 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Step: menú principal */}
          {step === 'menu' && (
            <div className="p-4 space-y-3">
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase mb-2">Portal del empleado</p>
                <button onClick={() => setStep('portal')} className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition-all">
                  <CalendarPlus className="w-4 h-4 text-indigo-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">Ausencias y disponibilidad</p>
                    <p className="text-xs text-gray-400">Solicitar, ver saldos y mis solicitudes</p>
                  </div>
                </button>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase mb-2">Buzón</p>
                <div className="space-y-1.5">
                  {TIPOS.map(t => (
                    <button
                      key={t.value}
                      onClick={() => { setTipo(t.value); setStep('form'); }}
                      className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl hover:bg-teal-50 border border-transparent hover:border-teal-200 transition-all group"
                    >
                      <span className="text-lg">{t.label.split(' ')[0]}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-800 group-hover:text-teal-700">{t.label.split(' ').slice(1).join(' ')}</p>
                        <p className="text-xs text-gray-400">{t.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step: portal del empleado */}
          {step === 'portal' && <EmployeePortal onBack={() => setStep('menu')} />}

          {/* Step: tipo */}
          {step === 'type' && (
            <div className="p-4 space-y-2">
              <p className="text-xs text-gray-500 mb-3">¿Qué querés comunicar?</p>
              {TIPOS.map(t => (
                <button
                  key={t.value}
                  onClick={() => { setTipo(t.value); setStep('form'); }}
                  className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl hover:bg-teal-50 border border-transparent hover:border-teal-200 transition-all group"
                >
                  <span className="text-lg">{t.label.split(' ')[0]}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800 group-hover:text-teal-700">{t.label.split(' ').slice(1).join(' ')}</p>
                    <p className="text-xs text-gray-400">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step: form */}
          {step === 'form' && (
            <form onSubmit={handleSend} className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setStep('menu')} className="text-xs text-gray-400 hover:text-gray-600">← Volver</button>
                <span className="text-xs text-gray-500">·</span>
                <span className="text-xs font-medium text-teal-700">{TIPOS.find(t => t.value === tipo)?.label}</span>
              </div>

              <div>
                <input
                  type="text"
                  required
                  placeholder="Título breve *"
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all"
                />
              </div>

              <div>
                <textarea
                  required
                  placeholder="Contanos más detalles... *"
                  rows={3}
                  value={form.content}
                  onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 resize-none transition-all"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={form.priority}
                  onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none flex-1"
                >
                  {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.isAnonymous}
                    onChange={e => setForm(p => ({ ...p, isAnonymous: e.target.checked }))}
                    className="rounded text-teal-500"
                  />
                  Anónimo
                </label>
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
              >
                {sending ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                {sending ? 'Enviando...' : 'Enviar'}
              </button>
            </form>
          )}

          {/* Step: done */}
          {step === 'done' && (
            <div className="p-6 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">¡Gracias por tu mensaje!</p>
                <p className="text-xs text-gray-500 mt-1">Tu {TIPOS.find(t => t.value === tipo)?.label.split(' ').slice(1).join(' ').toLowerCase()} fue registrada correctamente.</p>
              </div>
              <button onClick={reset} className="text-sm text-teal-600 hover:text-teal-800 font-medium">
                Cerrar
              </button>
            </div>
          )}
        </div>
      )}

      {/* FAB Button */}
      <button
        onClick={() => step === 'closed' ? setStep('menu') : reset()}
        className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 ${step !== 'closed' ? 'bg-gray-600 hover:bg-gray-700 rotate-0' : 'bg-gradient-to-br from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 hover:scale-105'}`}
        title="Buzón de sugerencias"
      >
        {step !== 'closed'
          ? <X className="w-5 h-5 text-white" />
          : <MessageSquarePlus className="w-6 h-6 text-white" />
        }
      </button>
    </div>
  );
}

/* ─────────── Portal del Empleado ─────────── */
const portalInp = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/30';

function PortalStatus({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    DRAFT: { label: 'Borrador', cls: 'bg-gray-100 text-gray-600' },
    SUBMITTED: { label: 'Enviada', cls: 'bg-blue-100 text-blue-700' },
    PENDING_APPROVAL: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-800' },
    PENDING_DOCS: { label: 'Falta doc.', cls: 'bg-orange-100 text-orange-800' },
    PENDING_COVERAGE: { label: 'Falta cob.', cls: 'bg-orange-100 text-orange-800' },
    APPROVED: { label: 'Aprobada', cls: 'bg-green-100 text-green-700' },
    REJECTED: { label: 'Rechazada', cls: 'bg-red-100 text-red-700' },
    CANCELLED: { label: 'Cancelada', cls: 'bg-gray-100 text-gray-500' },
    IN_PROGRESS: { label: 'En curso', cls: 'bg-indigo-100 text-indigo-700' },
    FINISHED: { label: 'Finalizada', cls: 'bg-slate-200 text-slate-700' },
  };
  const s = map[status] || { label: status, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${s.cls}`}>{s.label}</span>;
}

function EmployeePortal({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<'home' | 'request' | 'mine' | 'balances'>('home');
  const [me, setMe] = useState<any>(null);
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setMe(await apiFetch<any>('/absences/me')); } catch { setMe({ linked: false }); } finally { setLoading(false); }
  };
  useEffect(() => {
    load();
    apiFetch<any>('/absences/types?active=true')
      .then((r) => setTypes((r?.items || []).filter((t: any) => t.allowsSelfService !== false)))
      .catch(() => {});
  }, []);

  if (loading) return <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-indigo-500" /></div>;
  if (!me?.linked) {
    return (
      <div className="p-5 text-center space-y-2">
        <p className="text-sm text-gray-600">Tu usuario no está vinculado a un legajo de empleado.</p>
        <p className="text-xs text-gray-400">Contactá a RRHH para acceder a tu portal de ausencias.</p>
        <button onClick={onBack} className="text-xs text-indigo-600 hover:underline">← Volver</button>
      </div>
    );
  }

  const back = () => (view === 'home' ? onBack() : setView('home'));

  return (
    <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto">
      <button onClick={back} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"><ChevronLeft className="w-3 h-3" /> Volver</button>

      {view === 'home' && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Hola, {me.employee?.firstName} 👋</p>
          <button onClick={() => setView('request')} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-indigo-50 border border-gray-100"><CalendarPlus className="w-4 h-4 text-indigo-600" /><span className="text-sm">Solicitar vacaciones / licencia</span></button>
          <button onClick={() => setView('mine')} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 border border-gray-100"><ClipboardList className="w-4 h-4 text-gray-600" /><span className="text-sm">Mis solicitudes ({me.requests?.length || 0})</span></button>
          <button onClick={() => setView('balances')} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 border border-gray-100"><Wallet className="w-4 h-4 text-teal-600" /><span className="text-sm">Mis saldos</span></button>
        </div>
      )}

      {view === 'request' && <PortalRequestForm types={types} onDone={() => { setView('mine'); load(); }} />}
      {view === 'mine' && <PortalMine me={me} reload={load} />}
      {view === 'balances' && <PortalBalances me={me} />}
    </div>
  );
}

function PortalRequestForm({ types, onDone }: { types: any[]; onDone: () => void }) {
  const [f, setF] = useState<any>({ absenceTypeId: '', startDate: '', endDate: '', halfDay: false, reason: '', substituteEmployeeId: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const [subs, setSubs] = useState<any[]>([]);
  const sel = types.find((t) => t.id === f.absenceTypeId);
  useEffect(() => {
    if (!f.startDate || !f.endDate || f.startDate > f.endDate) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await apiFetch<any>(`/absences/me/substitutes?from=${f.startDate}&to=${f.endDate}`);
        if (!cancelled) setSubs(r?.items || []);
      } catch { if (!cancelled) setSubs([]); }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [f.startDate, f.endDate]);
  const selSub = subs.find((s) => s.id === f.substituteEmployeeId);
  const submit = async () => {
    setErr('');
    if (!f.absenceTypeId || !f.startDate || !f.endDate) { setErr('Completá tipo y fechas.'); return; }
    setSaving(true);
    try {
      await apiFetch('/absences/me/requests', { method: 'POST', json: { absenceTypeId: f.absenceTypeId, startDate: f.startDate, endDate: f.endDate, halfDay: !!f.halfDay, reason: f.reason || undefined, substituteEmployeeId: f.substituteEmployeeId || undefined } });
      setOk(true); setTimeout(onDone, 900);
    } catch (e: any) { setErr(e?.message || 'Error al enviar'); } finally { setSaving(false); }
  };
  if (ok) return <div className="text-center py-6"><CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" /><p className="text-sm text-gray-700">¡Solicitud enviada!</p></div>;
  return (
    <div className="space-y-2">
      {err && <p className="text-xs text-red-600 bg-red-50 rounded p-2">{err}</p>}
      <select value={f.absenceTypeId} onChange={(e) => setF({ ...f, absenceTypeId: e.target.value })} className={portalInp}>
        <option value="">Tipo de ausencia…</option>
        {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} className={portalInp} />
        <input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} className={portalInp} />
      </div>
      <PortalTeamOverlap from={f.startDate} to={f.endDate} />
      {sel?.allowsHalfDay && <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={f.halfDay} onChange={(e) => setF({ ...f, halfDay: e.target.checked })} /> Media jornada</label>}
      <div className="space-y-1">
        <label className="text-xs text-gray-500">¿Quién te reemplaza?{sel?.requiresSubstitute ? ' *' : ' (opcional)'}</label>
        <select value={f.substituteEmployeeId} onChange={(e) => setF({ ...f, substituteEmployeeId: e.target.value })} className={portalInp}>
          <option value="">Sin reemplazo</option>
          {subs.map((s) => <option key={s.id} value={s.id} disabled={s.busy}>{s.name}{s.position ? ` · ${s.position}` : ''}{s.busy ? ' — ocupado en esas fechas' : ''}</option>)}
        </select>
        {selSub?.busy && <p className="text-[11px] text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {selSub.name} también estará ausente en ese período.</p>}
        {selSub && !selSub.busy && <p className="text-[11px] text-green-600 flex items-center gap-1"><Check className="w-3 h-3" /> {selSub.name} está disponible para reemplazarte.</p>}
      </div>
      <textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} rows={2} placeholder="Motivo (opcional)" className={portalInp} />
      <button onClick={submit} disabled={saving} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-2 rounded-lg">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Enviar solicitud</button>
    </div>
  );
}

function PortalTeamOverlap({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!from || !to || from > to) { setData(null); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await apiFetch<any>(`/absences/me/team-overlap?from=${from}&to=${to}`);
        if (!cancelled) setData(r);
      } catch { if (!cancelled) setData(null); } finally { if (!cancelled) setLoading(false); }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [from, to]);

  if (!from || !to) return null;
  if (loading) return <p className="text-[11px] text-gray-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Verificando tu sector…</p>;
  if (!data || !data.department) return null;
  const overlaps: any[] = data.overlaps || [];
  if (overlaps.length === 0) {
    return (
      <div className="text-[11px] bg-green-50 border border-green-200 text-green-700 rounded px-2 py-1.5 flex items-center gap-1.5">
        <Check className="w-3 h-3" /> Nadie más de {data.department.name} tiene ausencias en esas fechas.
      </div>
    );
  }
  const byEmp = new Map<string, any[]>();
  overlaps.forEach((o) => { const a = byEmp.get(o.employeeName) || []; a.push(o); byEmp.set(o.employeeName, a); });
  const fmtD = (d: string) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  return (
    <div className="text-[11px] bg-amber-50 border border-amber-200 text-amber-800 rounded px-2 py-1.5 space-y-1">
      <div className="flex items-center gap-1.5 font-medium">
        <AlertTriangle className="w-3 h-3" />
        {data.overlapCount} de tu sector ({data.department.name}) ya {data.overlapCount === 1 ? 'tiene' : 'tienen'} ausencias en esas fechas
      </div>
      <ul className="space-y-0.5">
        {[...byEmp.entries()].map(([name, list]) => (
          <li key={name}><span className="font-medium">{name}</span>: {list.map((o) => `${fmtD(o.startDate)}–${fmtD(o.endDate)}${o.confirmed ? '' : ' (pend.)'}`).join(', ')}</li>
        ))}
      </ul>
      <p className="text-[10px] text-amber-600">Solo informativo — podés enviar la solicitud igual.</p>
    </div>
  );
}

function PortalMine({ me, reload }: { me: any; reload: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const cancel = async (id: string) => {
    if (!confirm('¿Cancelar esta solicitud?')) return;
    setBusy(id);
    try { await apiFetch(`/absences/me/requests/${id}/cancel`, { method: 'POST', json: {} }); reload(); }
    catch (e: any) { alert(e?.message || 'Error'); } finally { setBusy(null); }
  };
  const reqs = me.requests || [];
  if (reqs.length === 0) return <p className="text-sm text-gray-400 text-center py-4">No tenés solicitudes.</p>;
  return (
    <div className="space-y-2">
      {reqs.map((r: any) => (
        <div key={r.id} className="border border-gray-100 rounded-lg p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-800">{r.absenceType?.name}</span>
            <PortalStatus status={r.status} />
          </div>
          <p className="text-xs text-gray-500">{new Date(r.startDate).toLocaleDateString('es-AR')} → {new Date(r.endDate).toLocaleDateString('es-AR')} · {r.computedDays}d</p>
          {['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED'].includes(r.status) && (
            <button disabled={busy === r.id} onClick={() => cancel(r.id)} className="mt-1 text-xs text-red-500 hover:underline">Cancelar</button>
          )}
        </div>
      ))}
    </div>
  );
}

function PortalBalances({ me }: { me: any }) {
  const bals = me.balances || [];
  if (bals.length === 0) return <p className="text-sm text-gray-400 text-center py-4">Sin saldos asignados.</p>;
  return (
    <div className="space-y-2">
      {bals.map((b: any) => (
        <div key={b.id} className="border border-gray-100 rounded-lg p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-800">{b.absenceType?.name}</span>
            <span className="text-xs text-gray-400">{b.period}</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-1">
            <span>Disp: <b className="text-green-600">{b._available ?? 0}</b></span>
            <span>Usado: {b.usedDays}</span>
            <span>Reserv: {b.reservedDays}</span>
            <span>Pend: {b.pendingDays}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
