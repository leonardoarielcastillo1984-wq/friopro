'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { HardHat, LogOut, Loader2, ShieldAlert, Siren, ListChecks, Scale, ClipboardCheck, GraduationCap, Bell } from 'lucide-react';

const API = '/api';
const portalFetch = async (path: string, init: RequestInit & { json?: any } = {}) => {
  const token = localStorage.getItem('seh_portal_token');
  const r = await fetch(`${API}${path}`, {
    method: init.method || 'GET',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
  });
  if (r.status === 401) { localStorage.removeItem('seh_portal_token'); throw new Error('Sesión expirada'); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `Error ${r.status}`);
  return data;
};

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500';
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('es-AR') : '—';

function Portal() {
  const params = useSearchParams();
  const resetToken = params.get('token');
  const [mode, setMode] = useState<'login' | 'reset' | 'dash'>(resetToken ? 'reset' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPass, setNewPass] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [me, setMe] = useState<any>(null);
  const [dash, setDash] = useState<any>(null);
  const [detailTab, setDetailTab] = useState('legal');
  const [detailRows, setDetailRows] = useState<any[]>([]);
  const [activeClient, setActiveClient] = useState('');

  async function doLogin(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      const r = await portalFetch('/seh360/auth/login', { method: 'POST', json: { email, password } });
      localStorage.setItem('seh_portal_token', r.token);
      setMode('dash');
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  async function doForgot(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setMsg(''); setLoading(true);
    try {
      await portalFetch('/seh360/auth/forgot-password', { method: 'POST', json: { email: forgotEmail } });
      setMsg('Si el email está registrado, recibirás un enlace para restablecer tu contraseña.');
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  async function doReset(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      await portalFetch('/seh360/auth/reset-password', { method: 'POST', json: { token: resetToken, password: newPass } });
      setMsg('Contraseña actualizada. Ingresá con tu nueva contraseña.');
      setMode('login');
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  async function loadDash() {
    try {
      const [m, d] = await Promise.all([
        portalFetch('/seh360/portal/me'),
        portalFetch('/seh360/portal/dashboard'),
      ]);
      setMe(m); setDash(d.dashboard);
      setActiveClient(m.clients?.[0]?.id || '');
    } catch { setMode('login'); }
  }

  async function loadDetail(clientId: string, tab: string) {
    if (!clientId) return;
    const r = await portalFetch(`/seh360/portal/${clientId}/${tab}`);
    setDetailRows(r.items || []);
  }

  useEffect(() => {
    if (localStorage.getItem('seh_portal_token') && mode === 'login') setMode('dash');
    if (mode === 'dash') loadDash();
  }, [mode]); // eslint-disable-line

  useEffect(() => { if (activeClient) loadDetail(activeClient, detailTab); }, [activeClient, detailTab]); // eslint-disable-line

  function logout() { localStorage.removeItem('seh_portal_token'); setMode('login'); setMe(null); setDash(null); }

  const TABS = [
    { k: 'legal', l: 'Matriz legal', i: Scale },
    { k: 'risks', l: 'Riesgos', i: ShieldAlert },
    { k: 'incidents', l: 'Incidentes', i: Siren },
    { k: 'inspections', l: 'Inspecciones', i: ClipboardCheck },
    { k: 'trainings', l: 'Capacitaciones', i: GraduationCap },
    { k: 'action-plans', l: 'Planes', i: ListChecks },
    { k: 'documents', l: 'Documentos', i: HardHat },
    { k: 'alerts', l: 'Alertas', i: Bell },
  ];

  // ── LOGIN / RESET ──────────────────────────────────────────────────
  if (mode === 'login' || mode === 'reset') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-orange-100 p-2.5"><HardHat className="h-6 w-6 text-orange-600" /></div>
          <div>
            <h1 className="font-bold text-gray-900">Portal SEH360</h1>
            <p className="text-xs text-gray-500">Seguridad e Higiene para tu empresa</p>
          </div>
        </div>

        {msg && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}
        {err && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}

        {mode === 'reset' ? (
          <form onSubmit={doReset} className="space-y-3">
            <p className="text-sm text-gray-600">Ingresá tu nueva contraseña:</p>
            <input type="password" required minLength={6} placeholder="Nueva contraseña (mín. 6)" className={inputCls} value={newPass} onChange={e => setNewPass(e.target.value)} />
            <button disabled={loading} className="w-full rounded-lg bg-orange-600 py-2.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50">
              {loading ? 'Guardando…' : 'Restablecer contraseña'}
            </button>
            <button type="button" onClick={() => setMode('login')} className="w-full text-center text-sm text-gray-500 hover:underline">Volver al ingreso</button>
          </form>
        ) : showForgot ? (
          <form onSubmit={doForgot} className="space-y-3">
            <p className="text-sm text-gray-600">Te enviaremos un enlace para restablecer tu contraseña:</p>
            <input type="email" required placeholder="Email" className={inputCls} value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} />
            <button disabled={loading} className="w-full rounded-lg bg-orange-600 py-2.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50">
              {loading ? 'Enviando…' : 'Enviar enlace'}
            </button>
            <button type="button" onClick={() => setShowForgot(false)} className="w-full text-center text-sm text-gray-500 hover:underline">Volver al ingreso</button>
          </form>
        ) : (
          <form onSubmit={doLogin} className="space-y-3">
            <input type="email" required placeholder="Email" className={inputCls} value={email} onChange={e => setEmail(e.target.value)} />
            <input type="password" required placeholder="Contraseña" className={inputCls} value={password} onChange={e => setPassword(e.target.value)} />
            <button disabled={loading} className="w-full rounded-lg bg-orange-600 py-2.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50">
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>
            <button type="button" onClick={() => setShowForgot(true)} className="w-full text-center text-sm text-gray-500 hover:underline">¿Olvidaste tu contraseña?</button>
          </form>
        )}
      </div>
    </div>
  );

  // ── DASHBOARD ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-orange-100 p-2"><HardHat className="h-5 w-5 text-orange-600" /></div>
          <div>
            <h1 className="font-bold text-gray-900">Portal SEH360</h1>
            {me?.user && <p className="text-xs text-gray-500">{me.user.firstName} {me.user.lastName} — {me.user.email}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {me?.clients?.length > 1 && (
            <select value={activeClient} onChange={e => setActiveClient(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {me.clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <button onClick={logout} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><LogOut className="h-5 w-5" /></button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-6 space-y-6">
        {!dash ? <p className="py-20 text-center text-gray-400"><Loader2 className="inline h-5 w-5 animate-spin mr-2" />Cargando…</p> : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { l: 'Riesgos registrados', v: dash.totalRisks, extra: `${dash.highRisks} altos`, icon: ShieldAlert, color: 'text-red-600' },
                { l: 'Incidentes abiertos', v: dash.openIncidents, icon: Siren, color: 'text-amber-600' },
                { l: 'Planes pendientes', v: dash.pendingPlans, icon: ListChecks, color: 'text-blue-600' },
                { l: 'Cumplimiento legal', v: dash.legalScore !== null ? `${dash.legalScore}%` : '—', icon: Scale, color: 'text-emerald-600' },
              ].map(k => (
                <div key={k.l} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between"><span className="text-xs text-gray-500">{k.l}</span><k.icon className={`h-4 w-4 ${k.color}`} /></div>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{k.v}</p>
                  {k.extra && <p className="text-xs text-red-500">{k.extra}</p>}
                </div>
              ))}
            </div>

            {/* Alertas */}
            {dash.unreadAlerts?.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="mb-2 flex items-center gap-2 font-medium text-amber-800"><Bell className="h-4 w-4" /> Alertas</h3>
                <ul className="space-y-1.5 text-sm text-amber-700">
                  {dash.unreadAlerts.slice(0, 5).map((a: any) => <li key={a.id}>• <b>{a.title}</b> — {a.message}</li>)}
                </ul>
              </div>
            )}

            {/* Detalle por pestañas */}
            <div>
              <div className="mb-3 flex gap-1.5 overflow-x-auto">
                {TABS.map(t => (
                  <button key={t.k} onClick={() => setDetailTab(t.k)}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${detailTab === t.k ? 'bg-orange-600 text-white' : 'border border-gray-200 bg-white text-gray-600'}`}>
                    <t.i className="h-4 w-4" /> {t.l}
                  </button>
                ))}
              </div>
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {detailRows.length === 0 && <tr><td className="px-4 py-10 text-center text-gray-400">Sin registros.</td></tr>}
                    {detailRows.map((r: any) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{r.normative || r.code || r.title || r.name}</td>
                        <td className="px-4 py-3 text-gray-600"><span className="line-clamp-1">{r.description || r.title || r.message || ''}</span></td>
                        <td className="px-4 py-3 text-right">
                          {r.status && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{r.status}</span>}
                          {r.riskLevel != null && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.riskLevel >= 15 ? 'bg-red-100 text-red-700' : r.riskLevel >= 8 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{r.riskLevel}</span>}
                          {(r.plannedDate || r.scheduledDate || r.dueDate) && <span className="ml-2 text-xs text-gray-400">{fmtDate(r.plannedDate || r.scheduledDate || r.dueDate)}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function SehPortalPage() {
  return <Suspense fallback={<div className="min-h-screen bg-slate-900" />}><Portal /></Suspense>;
}
