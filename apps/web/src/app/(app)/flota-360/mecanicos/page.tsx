'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { HardHat, Plus, X, Pencil, Trash2, QrCode, Printer, Copy, Check } from 'lucide-react';

type Mecanico = {
  id: string; code: string; name: string; email: string | null; phone: string | null;
  specialization: string | null; certification: string | null;
  isActive: boolean; availabilityStatus: string; dailyCapacityHours: number;
};

type MecanicoQR = {
  id: string; token: string; isActive: boolean; technicianId: string;
  useCount: number; lastUsedAt: string | null; publicUrl: string;
};

const FORM_VACIO = {
  name: '', email: '', phone: '', specialization: '', certification: '',
  isActive: true, availabilityStatus: 'AVAILABLE', dailyCapacityHours: 8,
};

const AVAILABILITY: Record<string, string> = {
  AVAILABLE: 'Disponible',
  BUSY: 'Ocupado',
  OFF: 'Fuera de servicio',
};

export default function MecanicosPage() {
  const [mecanicos, setMecanicos] = useState<Mecanico[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<Mecanico | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>(FORM_VACIO);
  const [qrs, setQrs] = useState<Record<string, MecanicoQR>>({});
  const [qrActivo, setQrActivo] = useState<Mecanico | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [res, resQr] = await Promise.all([
        apiFetch<{ technicians: Mecanico[] }>('/maintenance/technicians?scope=fleet'),
        apiFetch<{ qrs: MecanicoQR[] }>('/mecanico-qr/qrs?scope=fleet').catch(() => ({ qrs: [] })),
      ]);
      setMecanicos(res.technicians || []);
      const map: Record<string, MecanicoQR> = {};
      (resQr.qrs || []).forEach((q) => { if (q.isActive) map[q.technicianId] = q; });
      setQrs(map);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(FORM_VACIO);
    setError(null);
    setShowForm(true);
  };

  const abrirEdicion = (m: Mecanico) => {
    setEditando(m);
    setForm({
      name: m.name, email: m.email || '', phone: m.phone || '',
      specialization: m.specialization || '', certification: m.certification || '',
      isActive: m.isActive, availabilityStatus: m.availabilityStatus || 'AVAILABLE',
      dailyCapacityHours: m.dailyCapacityHours ?? 8,
    });
    setError(null);
    setShowForm(true);
  };

  const guardar = async () => {
    if (!form.name) { setError('El nombre es obligatorio'); return; }
    setBusy(true);
    setError(null);
    try {
      const payload: any = {
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        specialization: form.specialization || undefined,
        certification: form.certification || undefined,
        isActive: form.isActive,
        availabilityStatus: form.availabilityStatus,
        dailyCapacityHours: Number(form.dailyCapacityHours) || 8,
      };
      if (editando) {
        await apiFetch(`/maintenance/technicians/${editando.id}`, { method: 'PUT', json: payload });
      } else {
        await apiFetch('/maintenance/technicians', { method: 'POST', json: { ...payload, scope: 'FLEET' } });
      }
      setShowForm(false);
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };

  const eliminar = async (id: string) => {
    setBusy(true);
    try {
      await apiFetch(`/maintenance/technicians/${id}`, { method: 'DELETE' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const abrirQR = async (m: Mecanico) => {
    setQrActivo(m);
    setCopiado(false);
    if (!qrs[m.id]) {
      setQrBusy(true);
      try {
        const res = await apiFetch<{ qr: MecanicoQR }>('/mecanico-qr/qrs', { method: 'POST', json: { technicianId: m.id } });
        setQrs((prev) => ({ ...prev, [m.id]: res.qr }));
      } catch (e: any) {
        setError(e?.message || 'No se pudo generar el QR');
      } finally {
        setQrBusy(false);
      }
    }
  };

  const copiarLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const imprimirCartel = (m: Mecanico, qr: MecanicoQR) => {
    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qr.publicUrl)}&bgcolor=ffffff&color=1a1a2e&qzone=2`;
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>QR Mecánico - ${m.name}</title>
<style>
body{font-family:-apple-system,'Segoe UI',sans-serif;display:flex;justify-content:center;padding:20px;background:#f5f5f5}
.poster{background:#fff;border:2px solid #1a1a2e;border-radius:16px;padding:32px;max-width:420px;text-align:center}
.badge{display:inline-block;background:#2563eb;color:#fff;font-size:12px;font-weight:700;padding:4px 14px;border-radius:999px;margin-bottom:12px}
.titulo{font-size:24px;font-weight:700;margin:0 0 4px}
.codigo{color:#6b7280;font-size:14px;margin:0 0 16px}
.qr-wrap{display:flex;justify-content:center;margin:16px 0}
.steps{text-align:left;margin:16px 0;font-size:13px;color:#374151}
.step{display:flex;align-items:center;gap:10px;padding:6px 0}
.num{background:#2563eb;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
.footer{border-top:1px solid #e5e7eb;padding-top:12px;font-size:11px;color:#9ca3af}
.print-btn{position:fixed;top:12px;right:12px;background:#2563eb;color:#fff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px}
@media print{.print-btn{display:none}body{background:#fff}}
</style></head>
<body><button class="print-btn" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
<div class="poster">
<span class="badge">QR del Mecánico</span>
<p class="titulo">${m.name}</p>
<p class="codigo">${m.code}${m.specialization ? ' · ' + m.specialization : ''}</p>
<div class="qr-wrap"><img src="${qrImgUrl}" width="220" height="220" alt="QR" style="display:block;"/></div>
<div class="steps">
<div class="step"><span class="num">1</span>Al empezar la jornada, escaneá este QR</div>
<div class="step"><span class="num">2</span>Vas a ver tus tareas asignadas (OT, unidad, prioridad)</div>
<div class="step"><span class="num">3</span>Marcá "Iniciar" cuando empieces a trabajar</div>
<div class="step"><span class="num">4</span>Marcá "Finalizar" y dejá tus observaciones al terminar</div>
</div>
<div class="footer"><p>Centro de trabajo · Flota 360 · SGI360</p></div>
</div></body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Mecánicos</h1>
          <p className="text-sm text-neutral-500">Personal de taller de Flota 360 — independiente de los técnicos de Infraestructura</p>
        </div>
        <button onClick={abrirNuevo} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Nuevo mecánico
        </button>
      </div>

      {error && !showForm && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</p>}

      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-3 py-2">Nombre</th>
              <th className="text-left font-medium px-3 py-2">Especialidad</th>
              <th className="text-left font-medium px-3 py-2">Contacto</th>
              <th className="text-left font-medium px-3 py-2">Disponibilidad</th>
              <th className="text-left font-medium px-3 py-2">Hs/día</th>
              <th className="text-left font-medium px-3 py-2">Estado</th>
              <th className="text-left font-medium px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && <tr><td colSpan={7} className="px-3 py-6 text-center text-neutral-400">Cargando…</td></tr>}
            {!loading && mecanicos.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-neutral-400">Sin mecánicos registrados</td></tr>}
            {mecanicos.map((m) => (
              <tr key={m.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2 font-medium text-neutral-800">
                  <span className="flex items-center gap-1.5"><HardHat className="h-3.5 w-3.5 text-neutral-400" />{m.name}</span>
                  <span className="block text-[11px] text-neutral-400 font-normal">{m.code}</span>
                </td>
                <td className="px-3 py-2 text-neutral-600">{m.specialization || '—'}</td>
                <td className="px-3 py-2 text-neutral-600">
                  {m.email && <span className="block text-xs">{m.email}</span>}
                  {m.phone && <span className="block text-xs">{m.phone}</span>}
                  {!m.email && !m.phone && '—'}
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    m.availabilityStatus === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700' :
                    m.availabilityStatus === 'BUSY' ? 'bg-amber-50 text-amber-700' : 'bg-neutral-100 text-neutral-500'
                  }`}>{AVAILABILITY[m.availabilityStatus] || m.availabilityStatus}</span>
                </td>
                <td className="px-3 py-2 text-neutral-600">{m.dailyCapacityHours}</td>
                <td className="px-3 py-2 text-neutral-600">{m.isActive ? 'Activo' : 'Inactivo'}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button disabled={busy} onClick={() => abrirQR(m)} className="text-emerald-600 hover:text-emerald-800 disabled:opacity-50" title="QR del mecánico"><QrCode className="h-3.5 w-3.5" /></button>
                    <button disabled={busy} onClick={() => abrirEdicion(m)} className="text-blue-600 hover:text-blue-800 disabled:opacity-50" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                    <button disabled={busy} onClick={() => eliminar(m.id)} className="text-red-400 hover:text-red-600 disabled:opacity-50" title="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">{editando ? 'Editar mecánico' : 'Nuevo mecánico'}</h2>
              <button onClick={() => setShowForm(false)}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              {error && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</p>}
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Nombre *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Teléfono</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Especialidad</label>
                  <input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} placeholder="Motor, frenos, electricidad…" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Certificación</label>
                  <input value={form.certification} onChange={(e) => setForm({ ...form, certification: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Disponibilidad</label>
                  <select value={form.availabilityStatus} onChange={(e) => setForm({ ...form, availabilityStatus: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="AVAILABLE">Disponible</option>
                    <option value="BUSY">Ocupado</option>
                    <option value="OFF">Fuera de servicio</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Hs/día</label>
                  <input type="number" min={0} max={24} value={form.dailyCapacityHours} onChange={(e) => setForm({ ...form, dailyCapacityHours: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Estado</label>
                  <select value={form.isActive ? '1' : '0'} onChange={(e) => setForm({ ...form, isActive: e.target.value === '1' })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="1">Activo</option>
                    <option value="0">Inactivo</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={() => setShowForm(false)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700">Cancelar</button>
              <button onClick={guardar} disabled={busy} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{busy ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {qrActivo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setQrActivo(null)}>
          <div className="w-full max-w-sm rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">QR de {qrActivo.name}</h2>
              <button onClick={() => setQrActivo(null)}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-5 text-center">
              {qrBusy || !qrs[qrActivo.id] ? (
                <p className="py-10 text-sm text-neutral-400">Generando QR…</p>
              ) : (
                <>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrs[qrActivo.id].publicUrl)}&bgcolor=ffffff&color=1a1a2e&qzone=2`}
                    alt="QR mecánico" className="mx-auto rounded-lg border border-neutral-200"
                  />
                  <p className="mt-3 text-xs text-neutral-500">
                    Escaneado {qrs[qrActivo.id].useCount} {qrs[qrActivo.id].useCount === 1 ? 'vez' : 'veces'}
                    {qrs[qrActivo.id].lastUsedAt ? ` · último uso ${new Date(qrs[qrActivo.id].lastUsedAt as string).toLocaleDateString('es-AR')}` : ''}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => imprimirCartel(qrActivo, qrs[qrActivo.id])} className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
                      <Printer className="h-3.5 w-3.5" /> Imprimir
                    </button>
                    <button onClick={() => copiarLink(qrs[qrActivo.id].publicUrl)} className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
                      {copiado ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />} {copiado ? 'Copiado' : 'Copiar link'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
