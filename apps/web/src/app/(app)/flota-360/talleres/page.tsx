'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Building2, Plus, X, Pencil, Trash2, Search, Phone, Mail, MapPin,
  FileText, Clock, AlertTriangle, CheckCircle2, Wrench, DollarSign,
  History, BadgeCheck, ArrowRight, Landmark,
} from 'lucide-react';

type Taller = {
  id: string; nombre: string; razonSocial: string | null; identificacionFiscal: string | null;
  tipo: 'TALLER_EXTERNO' | 'SERVICE_OFICIAL';
  marcas: string[]; especialidades: string[];
  direccion: string | null; localidad: string | null;
  contactoNombre: string | null; telefono: string | null; email: string | null;
  observaciones: string | null; isActive: boolean; supplierId: string | null;
  otsAbiertas?: number;
};

type OtFicha = {
  id: string; code: string; title: string; status: string; type: string;
  vehiculo: { id: string; dominio: string } | null;
  fechaIngresoTaller: string | null; fechaEntregaEstimada: string | null; fechaDevolucion: string | null;
  recepcionResultado: string | null; sinCargo: boolean; reclamoDeOtId: string | null;
  costoExterno: number; totalCost: number; referenciaExterna: string | null;
};

type FacturaFicha = {
  id: string; tipoComprobante: string; numero: string | null; puntoVenta: string | null;
  fecha: string; total: number; moneda: string; concepto: string | null;
  workOrderId: string | null; fileUrl: string | null; montoRepuestosPropios: number;
};

type EventoTaller = { id: string; tipo: string; detalle: string | null; usuarioNombre: string | null; createdAt: string };

type Metricas = {
  otsAbiertas: number; otsTerminadas: number; otsTotal: number;
  costoPeriodo: number; periodoDias: number; hayFacturasOtraMoneda: boolean;
  permanenciaPromedioDias: number | null; permanenciasConDatos: number;
  fueraDeFecha: number; observados: number; reclamos: number;
};

const FORM_VACIO = {
  nombre: '', razonSocial: '', identificacionFiscal: '', tipo: 'TALLER_EXTERNO',
  marcas: '', especialidades: '', direccion: '', localidad: '',
  contactoNombre: '', telefono: '', email: '', observaciones: '',
};

const TIPO_LABEL: Record<string, string> = {
  TALLER_EXTERNO: 'Taller externo',
  SERVICE_OFICIAL: 'Service oficial',
};
const ESTADO_OT: Record<string, string> = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En proceso', COMPLETED: 'Completada',
  ON_HOLD: 'En espera', CANCELLED: 'Cancelada',
};
const RECEPCION_LABEL: Record<string, { label: string; cls: string }> = {
  CONFORME: { label: 'Conforme', cls: 'bg-emerald-50 text-emerald-700' },
  OBSERVADO: { label: 'Observado', cls: 'bg-amber-50 text-amber-700' },
  REQUIERE_CORRECCION: { label: 'Requiere corrección', cls: 'bg-red-50 text-red-600' },
};

function fmtFecha(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Separador simple de listas (comas o punto y coma) → array de strings
const toList = (s: string) => s.split(/[;,]/).map((x) => x.trim()).filter(Boolean);
const fromList = (a: string[] | null | undefined) => (a || []).join(', ');

export default function TalleresPage() {
  const [talleres, setTalleres] = useState<Taller[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [soloActivos, setSoloActivos] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Taller | null>(null);
  const [form, setForm] = useState<any>(FORM_VACIO);
  const [confirmarNombre, setConfirmarNombre] = useState(false);
  const [fichaId, setFichaId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ talleres: Taller[] }>(`/flota/talleres${busqueda ? `?q=${encodeURIComponent(busqueda)}` : ''}`);
      setTalleres(res.talleres || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const visibles = useMemo(
    () => talleres.filter((t) => !soloActivos || t.isActive),
    [talleres, soloActivos],
  );

  const abrirNuevo = () => {
    setEditando(null);
    setForm(FORM_VACIO);
    setConfirmarNombre(false);
    setError(null);
    setAviso(null);
    setShowForm(true);
  };

  const abrirEdicion = (t: Taller) => {
    setEditando(t);
    setForm({
      nombre: t.nombre, razonSocial: t.razonSocial || '', identificacionFiscal: t.identificacionFiscal || '',
      tipo: t.tipo, marcas: fromList(t.marcas), especialidades: fromList(t.especialidades),
      direccion: t.direccion || '', localidad: t.localidad || '',
      contactoNombre: t.contactoNombre || '', telefono: t.telefono || '', email: t.email || '',
      observaciones: t.observaciones || '',
    });
    setConfirmarNombre(false);
    setError(null);
    setAviso(null);
    setShowForm(true);
  };

  const guardar = async () => {
    if (!form.nombre) { setError('El nombre comercial es obligatorio'); return; }
    setBusy(true);
    setError(null);
    setAviso(null);
    const payload: any = {
      nombre: form.nombre,
      razonSocial: form.razonSocial || undefined,
      identificacionFiscal: form.identificacionFiscal || undefined,
      tipo: form.tipo,
      marcas: toList(form.marcas),
      especialidades: toList(form.especialidades),
      direccion: form.direccion || undefined,
      localidad: form.localidad || undefined,
      contactoNombre: form.contactoNombre || undefined,
      telefono: form.telefono || undefined,
      email: form.email || undefined,
      observaciones: form.observaciones || undefined,
      confirmarNombreDuplicado: confirmarNombre,
    };
    try {
      if (editando) {
        await apiFetch(`/flota/talleres/${editando.id}`, { method: 'PATCH', json: payload });
      } else {
        await apiFetch('/flota/talleres', { method: 'POST', json: payload });
      }
      setShowForm(false);
      await load();
    } catch (e: any) {
      const body = e?.body || {};
      if (body?.code === 'NOMBRE_DUPLICADO') {
        setError(null);
        setAviso(body.error);
        setConfirmarNombre(true); // el próximo guardar confirma la coincidencia
      } else {
        setError(e?.message || 'No se pudo guardar el taller');
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleActivo = async (t: Taller) => {
    setBusy(true);
    try {
      await apiFetch(`/flota/talleres/${t.id}`, { method: 'PATCH', json: { isActive: !t.isActive } });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const eliminar = async (t: Taller) => {
    if (!window.confirm(`¿Dar de baja "${t.nombre}"? Las OTs y el historial se conservan; no aceptará nuevas asignaciones.`)) return;
    setBusy(true);
    try {
      await apiFetch(`/flota/talleres/${t.id}`, { method: 'DELETE' });
      if (fichaId === t.id) setFichaId(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Talleres y services oficiales</h1>
          <p className="text-sm text-neutral-500">Ejecutores externos de órdenes de trabajo — costos, facturas y trazabilidad por taller</p>
        </div>
        <button onClick={abrirNuevo} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Nuevo taller
        </button>
      </div>

      {error && !showForm && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</p>}

      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Buscar por nombre, razón social o CUIT…"
            className="w-72 rounded-md border border-neutral-300 pl-8 pr-2.5 py-1.5 text-sm"
          />
        </div>
        <button onClick={load} className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">Buscar</button>
        <label className="flex items-center gap-1.5 text-xs text-neutral-600 cursor-pointer">
          <input type="checkbox" checked={soloActivos} onChange={(e) => setSoloActivos(e.target.checked)} className="h-3.5 w-3.5 rounded border-neutral-300 text-blue-600" />
          Solo activos
        </label>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-3 py-2">Taller</th>
              <th className="text-left font-medium px-3 py-2">Tipo</th>
              <th className="text-left font-medium px-3 py-2">Identificación fiscal</th>
              <th className="text-left font-medium px-3 py-2">Contacto</th>
              <th className="text-left font-medium px-3 py-2">Especialidades</th>
              <th className="text-left font-medium px-3 py-2">OTs abiertas</th>
              <th className="text-left font-medium px-3 py-2">Estado</th>
              <th className="text-left font-medium px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && <tr><td colSpan={8} className="px-3 py-6 text-center text-neutral-400">Cargando…</td></tr>}
            {!loading && visibles.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-neutral-400">Sin talleres registrados</td></tr>}
            {visibles.map((t) => (
              <tr key={t.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2">
                  <button onClick={() => setFichaId(t.id)} className="font-medium text-blue-700 hover:underline text-left flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-neutral-400" />{t.nombre}
                  </button>
                  {t.razonSocial && <span className="block text-[11px] text-neutral-400">{t.razonSocial}</span>}
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${t.tipo === 'SERVICE_OFICIAL' ? 'bg-indigo-50 text-indigo-700' : 'bg-neutral-100 text-neutral-600'}`}>
                    {t.tipo === 'SERVICE_OFICIAL' && <BadgeCheck className="h-3 w-3" />}
                    {TIPO_LABEL[t.tipo]}
                  </span>
                </td>
                <td className="px-3 py-2 text-neutral-600">{t.identificacionFiscal || '—'}</td>
                <td className="px-3 py-2 text-neutral-600 text-xs">
                  {t.contactoNombre && <span className="block font-medium">{t.contactoNombre}</span>}
                  {t.telefono && <span className="flex items-center gap-1"><Phone className="h-2.5 w-2.5" />{t.telefono}</span>}
                  {t.email && <span className="flex items-center gap-1"><Mail className="h-2.5 w-2.5" />{t.email}</span>}
                  {!t.contactoNombre && !t.telefono && !t.email && '—'}
                </td>
                <td className="px-3 py-2 text-neutral-600 text-xs max-w-[200px] truncate">{fromList(t.especialidades) || '—'}</td>
                <td className="px-3 py-2 text-neutral-600">{(t.otsAbiertas ?? 0) > 0 ? <span className="font-semibold text-blue-700">{t.otsAbiertas}</span> : '0'}</td>
                <td className="px-3 py-2">
                  <button onClick={() => toggleActivo(t)} disabled={busy} className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${t.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                    {t.isActive ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setFichaId(t.id)} className="text-xs font-medium text-blue-600 hover:underline">Ficha</button>
                    <button disabled={busy} onClick={() => abrirEdicion(t)} className="text-blue-600 hover:text-blue-800 disabled:opacity-50" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                    <button disabled={busy} onClick={() => eliminar(t)} className="text-red-400 hover:text-red-600 disabled:opacity-50" title="Dar de baja"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Modal alta/edición ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-blue-600" />{editando ? 'Editar taller' : 'Nuevo taller / service'}
              </h2>
              <button onClick={() => setShowForm(false)}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              {error && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</p>}
              {aviso && <p className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">{aviso} <b>Volvé a guardar para confirmar.</b></p>}
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Nombre comercial *</label>
                  <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Razón social</label>
                  <input value={form.razonSocial} onChange={(e) => setForm({ ...form, razonSocial: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Identificación fiscal (CUIT/RUT)</label>
                  <input value={form.identificacionFiscal} onChange={(e) => setForm({ ...form, identificacionFiscal: e.target.value })} placeholder="30-12345678-9" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Tipo</label>
                  <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="TALLER_EXTERNO">Taller externo</option>
                    <option value="SERVICE_OFICIAL">Service oficial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Marcas que atiende</label>
                  <input value={form.marcas} onChange={(e) => setForm({ ...form, marcas: e.target.value })} placeholder="Scania, Volvo, …" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Servicios / especialidades</label>
                <input value={form.especialidades} onChange={(e) => setForm({ ...form, especialidades: e.target.value })} placeholder="Frenos, embrague, electrónica…" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Dirección</label>
                  <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Localidad</label>
                  <input value={form.localidad} onChange={(e) => setForm({ ...form, localidad: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Contacto</label>
                  <input value={form.contactoNombre} onChange={(e) => setForm({ ...form, contactoNombre: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Teléfono</label>
                  <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Observaciones</label>
                <textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} rows={2} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={() => setShowForm(false)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700">Cancelar</button>
              <button onClick={guardar} disabled={busy} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {busy ? 'Guardando…' : confirmarNombre ? 'Guardar igual (nombre repetido)' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ficha del taller ── */}
      {fichaId && <FichaTaller tallerId={fichaId} onClose={() => setFichaId(null)} onChanged={load} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FICHA DEL TALLER — datos, métricas, OTs, facturas y bitácora
// ═══════════════════════════════════════════════════════════════
function FichaTaller({ tallerId, onClose, onChanged }: { tallerId: string; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<{ taller: Taller; ots: OtFicha[]; facturas: FacturaFicha[]; eventos: EventoTaller[]; metricas: Metricas } | null>(null);
  const [tab, setTab] = useState<'OTS' | 'FACTURAS' | 'BITACORA'>('OTS');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const qs = filtroEstado ? `?estado=${filtroEstado}` : '';
      const res = await apiFetch<any>(`/flota/talleres/${tallerId}${qs}`);
      setData(res);
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar la ficha');
    }
  };
  useEffect(() => { load(); }, [tallerId, filtroEstado]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = data?.taller;
  const m = data?.metricas;

  const derivarAOt = (ot: OtFicha) => window.open(`/flota-360/ordenes?ver=${ot.id}`, '_self');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true">
      <section className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-lg bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-3 sticky top-0 bg-white z-10">
          <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600" />
            {t ? t.nombre : 'Taller'}
            {t && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${t.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                {t.isActive ? 'Activo' : 'Inactivo'}
              </span>
            )}
            {t && <span className="rounded-full px-2 py-0.5 text-[11px] font-medium bg-indigo-50 text-indigo-700">{TIPO_LABEL[t.tipo]}</span>}
          </h2>
          <button onClick={onClose}><X className="h-5 w-5 text-neutral-400" /></button>
        </header>

        {!data && <p className="p-8 text-center text-sm text-neutral-400">Cargando ficha…</p>}
        {error && <p className="m-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</p>}

        {data && t && m && (
          <div className="p-5 space-y-4">
            {/* Datos */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><p className="text-[11px] text-slate-500 uppercase">Identificación fiscal</p><p className="font-medium flex items-center gap-1"><Landmark className="h-3 w-3 text-neutral-400" />{t.identificacionFiscal || '—'}</p></div>
              <div><p className="text-[11px] text-slate-500 uppercase">Contacto</p><p className="font-medium">{t.contactoNombre || '—'}{t.telefono ? ` · ${t.telefono}` : ''}</p></div>
              <div><p className="text-[11px] text-slate-500 uppercase">Ubicación</p><p className="font-medium flex items-center gap-1"><MapPin className="h-3 w-3 text-neutral-400" />{[t.direccion, t.localidad].filter(Boolean).join(', ') || '—'}</p></div>
              <div><p className="text-[11px] text-slate-500 uppercase">Marcas</p><p className="font-medium">{fromList(t.marcas) || '—'}</p></div>
            </div>
            {t.observaciones && <p className="text-xs text-neutral-500 rounded-md bg-neutral-50 px-3 py-2">{t.observaciones}</p>}

            {/* Métricas — ceros reales vs falta de datos */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-2.5 text-center">
                <p className="text-lg font-bold text-blue-700">{m.otsAbiertas}</p>
                <p className="text-[10px] text-blue-600 uppercase font-medium">OTs abiertas</p>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-2.5 text-center">
                <p className="text-lg font-bold text-emerald-700">{m.otsTerminadas}</p>
                <p className="text-[10px] text-emerald-600 uppercase font-medium">Terminadas</p>
              </div>
              <div className="rounded-lg border border-neutral-200 p-2.5 text-center">
                <p className="text-lg font-bold text-neutral-800">${m.costoPeriodo.toLocaleString('es-AR')}</p>
                <p className="text-[10px] text-neutral-500 uppercase font-medium flex items-center justify-center gap-0.5"><DollarSign className="h-2.5 w-2.5" />{m.periodoDias}d</p>
              </div>
              <div className="rounded-lg border border-neutral-200 p-2.5 text-center">
                <p className="text-lg font-bold text-neutral-800">{m.permanenciaPromedioDias !== null ? `${m.permanenciaPromedioDias}d` : '—'}</p>
                <p className="text-[10px] text-neutral-500 uppercase font-medium flex items-center justify-center gap-0.5"><Clock className="h-2.5 w-2.5" />Permanencia</p>
              </div>
              <div className="rounded-lg border border-neutral-200 p-2.5 text-center">
                <p className={`text-lg font-bold ${m.fueraDeFecha > 0 ? 'text-red-600' : 'text-neutral-800'}`}>{m.fueraDeFecha}</p>
                <p className="text-[10px] text-neutral-500 uppercase font-medium flex items-center justify-center gap-0.5"><AlertTriangle className="h-2.5 w-2.5" />Fuera de fecha</p>
              </div>
              <div className="rounded-lg border border-neutral-200 p-2.5 text-center">
                <p className={`text-lg font-bold ${m.reclamos > 0 ? 'text-amber-600' : 'text-neutral-800'}`}>{m.reclamos}</p>
                <p className="text-[10px] text-neutral-500 uppercase font-medium flex items-center justify-center gap-0.5"><Wrench className="h-2.5 w-2.5" />Reclamos</p>
              </div>
            </div>
            {m.hayFacturasOtraMoneda && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5">
                Hay facturas en moneda distinta a ARS: no se suman a los indicadores (sin tipo de cambio definido).
              </p>
            )}

            {/* Tabs */}
            <div className="flex gap-1 border-b border-neutral-200">
              {([['OTS', `Órdenes de trabajo · ${m.otsTotal}`], ['FACTURAS', `Facturas · ${data.facturas.length}`], ['BITACORA', `Bitácora · ${data.eventos.length}`]] as const).map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)} className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px ${tab === k ? 'border-blue-600 text-blue-700' : 'border-transparent text-neutral-500'}`}>{label}</button>
              ))}
            </div>

            {tab === 'OTS' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-neutral-500">Estado:</span>
                  <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="rounded-md border border-neutral-300 px-2 py-1 text-xs">
                    <option value="">Todos</option>
                    <option value="PENDING">Pendiente</option>
                    <option value="IN_PROGRESS">En proceso</option>
                    <option value="ON_HOLD">En espera</option>
                    <option value="COMPLETED">Completada</option>
                    <option value="CANCELLED">Cancelada</option>
                  </select>
                </div>
                {data.ots.length === 0 && <p className="py-6 text-center text-xs text-neutral-400">Sin órdenes para este taller</p>}
                <div className="rounded-lg border border-neutral-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-neutral-50 text-neutral-500 uppercase">
                      <tr>
                        <th className="text-left font-medium px-2.5 py-1.5">OT</th>
                        <th className="text-left font-medium px-2.5 py-1.5">Unidad</th>
                        <th className="text-left font-medium px-2.5 py-1.5">Ingreso</th>
                        <th className="text-left font-medium px-2.5 py-1.5">Entrega est.</th>
                        <th className="text-left font-medium px-2.5 py-1.5">Devolución</th>
                        <th className="text-left font-medium px-2.5 py-1.5">Estado</th>
                        <th className="text-left font-medium px-2.5 py-1.5">Recepción</th>
                        <th className="text-right font-medium px-2.5 py-1.5">Costo externo</th>
                        <th className="px-2.5 py-1.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {data.ots.map((o) => {
                        const atrasada = o.fechaEntregaEstimada && !o.fechaDevolucion && new Date(o.fechaEntregaEstimada) < new Date();
                        return (
                          <tr key={o.id} className="hover:bg-neutral-50">
                            <td className="px-2.5 py-1.5">
                              <span className="font-medium text-neutral-800">{o.code}</span>
                              {o.reclamoDeOtId && <span className="ml-1 rounded bg-amber-50 px-1 text-[10px] text-amber-700">reclamo</span>}
                              {o.sinCargo && <span className="ml-1 rounded bg-emerald-50 px-1 text-[10px] text-emerald-700">sin cargo</span>}
                              <span className="block text-neutral-500 max-w-[180px] truncate">{o.title}</span>
                            </td>
                            <td className="px-2.5 py-1.5 font-medium text-neutral-700">{o.vehiculo?.dominio || '—'}</td>
                            <td className="px-2.5 py-1.5 text-neutral-600">{fmtFecha(o.fechaIngresoTaller)}</td>
                            <td className={`px-2.5 py-1.5 ${atrasada ? 'text-red-600 font-semibold' : 'text-neutral-600'}`}>{fmtFecha(o.fechaEntregaEstimada)}</td>
                            <td className="px-2.5 py-1.5 text-neutral-600">{fmtFecha(o.fechaDevolucion)}</td>
                            <td className="px-2.5 py-1.5 text-neutral-600">{ESTADO_OT[o.status] || o.status}</td>
                            <td className="px-2.5 py-1.5">
                              {o.recepcionResultado
                                ? <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${RECEPCION_LABEL[o.recepcionResultado]?.cls || 'bg-neutral-100'}`}>{RECEPCION_LABEL[o.recepcionResultado]?.label || o.recepcionResultado}</span>
                                : '—'}
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-medium text-neutral-800">${(o.costoExterno || 0).toLocaleString('es-AR')}</td>
                            <td className="px-2.5 py-1.5">
                              <button onClick={() => derivarAOt(o)} className="text-blue-600 hover:underline flex items-center gap-0.5">Ver OT <ArrowRight className="h-3 w-3" /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'FACTURAS' && (
              <div className="rounded-lg border border-neutral-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-neutral-50 text-neutral-500 uppercase">
                    <tr>
                      <th className="text-left font-medium px-2.5 py-1.5">Fecha</th>
                      <th className="text-left font-medium px-2.5 py-1.5">Comprobante</th>
                      <th className="text-left font-medium px-2.5 py-1.5">Concepto</th>
                      <th className="text-left font-medium px-2.5 py-1.5">OT</th>
                      <th className="text-right font-medium px-2.5 py-1.5">Total</th>
                      <th className="px-2.5 py-1.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {data.facturas.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-neutral-400">Sin facturas del taller</td></tr>}
                    {data.facturas.map((f) => (
                      <tr key={f.id} className="hover:bg-neutral-50">
                        <td className="px-2.5 py-1.5 text-neutral-600">{fmtFecha(f.fecha)}</td>
                        <td className="px-2.5 py-1.5">
                          <span className={`font-medium ${f.tipoComprobante === 'NOTA_CREDITO' ? 'text-red-600' : f.tipoComprobante === 'PRESUPUESTO' ? 'text-neutral-500' : 'text-neutral-800'}`}>
                            {f.tipoComprobante} {f.puntoVenta ? `${f.puntoVenta}-` : ''}{f.numero || ''}
                          </span>
                          {f.tipoComprobante === 'PRESUPUESTO' && <span className="ml-1 text-[10px] text-neutral-400">(no suma)</span>}
                        </td>
                        <td className="px-2.5 py-1.5 text-neutral-600 max-w-[200px] truncate">{f.concepto || '—'}</td>
                        <td className="px-2.5 py-1.5 text-neutral-600">{f.workOrderId ? <span className="text-blue-600">Vinculada a OT</span> : 'Sueltas'}</td>
                        <td className="px-2.5 py-1.5 text-right font-medium">
                          {f.tipoComprobante === 'NOTA_CREDITO' ? '-' : ''}${f.total.toLocaleString('es-AR')} {f.moneda !== 'ARS' && <span className="text-[10px] text-neutral-400">{f.moneda}</span>}
                          {f.montoRepuestosPropios > 0 && <span className="block text-[10px] text-neutral-400">−${f.montoRepuestosPropios.toLocaleString('es-AR')} rep. propios</span>}
                        </td>
                        <td className="px-2.5 py-1.5 text-right">
                          {f.fileUrl && <a href={f.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-0.5 justify-end"><FileText className="h-3 w-3" />PDF</a>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'BITACORA' && (
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {data.eventos.length === 0 && <p className="py-6 text-center text-xs text-neutral-400">Sin eventos registrados</p>}
                {data.eventos.map((e) => (
                  <div key={e.id} className="flex items-start gap-2 rounded-md border border-neutral-100 bg-neutral-50/50 px-3 py-2">
                    <History className="h-3.5 w-3.5 text-neutral-400 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-neutral-700"><span className="font-semibold">{e.tipo}</span> — {e.detalle}</p>
                      <p className="text-[10px] text-neutral-400">{fmtFecha(e.createdAt)} {e.usuarioNombre ? `· ${e.usuarioNombre}` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end border-t border-neutral-200 pt-3">
              <button onClick={onClose} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700">Cerrar</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
