'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { FileText, Plus, X, Trash2, Upload, AlertTriangle, NotebookPen, MapPin, HeartPulse, CheckCircle2, XCircle, Download, Settings2, ShieldCheck, KeyRound, RefreshCw } from 'lucide-react';

const CAT_L: Record<string, string> = { SEGURIDAD_HIGIENE: 'Seguridad e higiene', COMUNICADO: 'Comunicado', DOCUMENTO_UNIDAD: 'Doc. de unidad', GENERAL: 'General' };
const CAT_COLOR: Record<string, string> = { SEGURIDAD_HIGIENE: 'bg-red-50 text-red-700', COMUNICADO: 'bg-blue-50 text-blue-700', DOCUMENTO_UNIDAD: 'bg-cyan-50 text-cyan-700', GENERAL: 'bg-neutral-100 text-neutral-600' };
const TIPO_INC_L: Record<string, string> = { ACCIDENTE_TRANSITO: 'Accidente de tránsito', LESION_PERSONAL: 'Lesión personal', ROBO_HURTO: 'Robo / hurto', PROBLEMA_CARGA: 'Problema con la carga', CONTROL_TRANSITO: 'Control / multa', DEMORA: 'Demora', OTRO: 'Otro' };
const GRAV_COLOR: Record<string, string> = { BAJA: 'bg-green-50 text-green-700', MEDIA: 'bg-amber-50 text-amber-700', ALTA: 'bg-orange-50 text-orange-700', CRITICA: 'bg-red-50 text-red-700' };
const ESTADO_INC: Record<string, string> = { ABIERTO: 'bg-red-50 text-red-700', EN_SEGUIMIENTO: 'bg-amber-50 text-amber-700', CERRADO: 'bg-green-50 text-green-700' };
const TIPO_SERV_L: Record<string, { label: string; color: string }> = {
  INICIO_SERVICIO: { label: 'Inicio servicio', color: 'bg-green-50 text-green-700' },
  FIN_SERVICIO: { label: 'Fin servicio', color: 'bg-red-50 text-red-700' },
  CAMBIO_UNIDAD: { label: 'Cambio de unidad', color: 'bg-blue-50 text-blue-700' },
  INICIO_RECHAZADO: { label: 'Inicio rechazado', color: 'bg-red-100 text-red-800' },
  BITACORA: { label: 'Bitácora', color: 'bg-purple-50 text-purple-700' },
};
const EVAL_DESC_L: Record<string, { label: string; color: string }> = {
  CUMPLE: { label: 'Descanso suficiente', color: 'bg-green-50 text-green-700' },
  INSUFICIENTE: { label: 'Descanso insuficiente', color: 'bg-red-100 text-red-700' },
  SIN_HISTORIAL: { label: 'Sin historial', color: 'bg-amber-50 text-amber-700' },
  CIERRE_NO_CONFIABLE: { label: 'Cierre no confiable', color: 'bg-amber-100 text-amber-800' },
};

// ── Documentos para el chofer ────────────────────────────────────────────────
export function DocsChoferPanel({ vehiculos }: { vehiculos: any[] }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNuevo, setShowNuevo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ titulo: '', categoria: 'GENERAL', vehiculoId: '' });
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const d = await apiFetch<{ documentos: any[] }>('/driver-hub/documentos');
      setDocs(d.documentos || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const crear = async () => {
    if (!form.titulo.trim()) { setError('El título es obligatorio'); return; }
    if (!file) { setError('Seleccioná un archivo PDF o imagen'); return; }
    setBusy(true); setError(null);
    try {
      // 1. Subir archivo
      const fd = new FormData(); fd.append('file', file);
      const up = await apiFetch<{ url: string; name: string; mimeType: string }>('/driver-hub/documentos/upload', { method: 'POST', body: fd } as any);
      // 2. Crear registro
      await apiFetch('/driver-hub/documentos', {
        method: 'POST',
        json: { titulo: form.titulo.trim(), categoria: form.categoria, vehiculoId: form.vehiculoId || null, fileUrl: up.url, fileName: up.name, mimeType: up.mimeType },
      });
      setShowNuevo(false); setForm({ titulo: '', categoria: 'GENERAL', vehiculoId: '' }); setFile(null);
      await load();
    } catch (e: any) { setError(e?.message || 'No se pudo subir'); }
    finally { setBusy(false); }
  };

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar este documento?')) return;
    await apiFetch(`/driver-hub/documentos/${id}`, { method: 'DELETE' });
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">PDFs e imágenes que los choferes consultan desde el QR de la unidad</p>
        <button onClick={() => setShowNuevo(true)} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Subir documento
        </button>
      </div>
      {error && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</p>}

      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-3 py-2">Documento</th>
              <th className="text-left font-medium px-3 py-2">Categoría</th>
              <th className="text-left font-medium px-3 py-2">Alcance</th>
              <th className="text-left font-medium px-3 py-2">Fecha</th>
              <th className="text-left font-medium px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && <tr><td colSpan={5} className="px-3 py-6 text-center text-neutral-400">Cargando…</td></tr>}
            {!loading && docs.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-neutral-400">Sin documentos para choferes</td></tr>}
            {docs.map(d => (
              <tr key={d.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2">
                  <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-medium text-neutral-800 hover:text-blue-700">
                    <FileText className="h-3.5 w-3.5 text-neutral-400" />{d.titulo}
                  </a>
                </td>
                <td className="px-3 py-2"><span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${CAT_COLOR[d.categoria] || CAT_COLOR.GENERAL}`}>{CAT_L[d.categoria] || d.categoria}</span></td>
                <td className="px-3 py-2 text-neutral-600">{d.vehiculo ? d.vehiculo.dominio : 'Toda la flota'}</td>
                <td className="px-3 py-2 text-neutral-600">{new Date(d.createdAt).toLocaleDateString('es-AR')}</td>
                <td className="px-3 py-2"><button onClick={() => eliminar(d.id)} className="text-red-400 hover:text-red-600" title="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNuevo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">Documento para choferes</h2>
              <button onClick={() => setShowNuevo(false)}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Título *</label>
                <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ej: Manual de seguridad vial" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Categoría</label>
                  <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="GENERAL">General</option>
                    <option value="SEGURIDAD_HIGIENE">Seguridad e higiene</option>
                    <option value="COMUNICADO">Comunicado</option>
                    <option value="DOCUMENTO_UNIDAD">Doc. de unidad</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Unidad (vacío = todas)</label>
                  <select value={form.vehiculoId} onChange={e => setForm({ ...form, vehiculoId: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="">Toda la flota</option>
                    {vehiculos.map(v => <option key={v.id} value={v.id}>{v.dominio}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Archivo (PDF o imagen) *</label>
                <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                <button onClick={() => fileRef.current?.click()} className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-dashed border-neutral-300 px-3 py-3 text-sm text-neutral-600 hover:border-blue-400 hover:text-blue-600">
                  <Upload className="h-4 w-4" /> {file ? file.name : 'Seleccionar archivo'}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={() => setShowNuevo(false)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700">Cancelar</button>
              <button onClick={crear} disabled={busy} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{busy ? 'Subiendo…' : 'Subir'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Incidentes reportados por choferes ───────────────────────────────────────
export function IncidentesPanel() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const d = await apiFetch<{ incidentes: any[] }>(`/driver-hub/incidentes${filtro ? `?estado=${filtro}` : ''}`);
      setItems(d.incidentes || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [filtro]);

  const cambiarEstado = async (id: string, estado: string) => {
    await apiFetch(`/driver-hub/incidentes/${id}`, { method: 'PATCH', json: { estado } });
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">Eventos reportados por choferes desde el QR de la unidad</p>
        <select value={filtro} onChange={e => setFiltro(e.target.value)} className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
          <option value="">Todos</option><option value="ABIERTO">Abiertos</option><option value="EN_SEGUIMIENTO">En seguimiento</option><option value="CERRADO">Cerrados</option>
        </select>
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-3 py-2">Fecha</th>
              <th className="text-left font-medium px-3 py-2">Unidad</th>
              <th className="text-left font-medium px-3 py-2">Tipo</th>
              <th className="text-left font-medium px-3 py-2">Gravedad</th>
              <th className="text-left font-medium px-3 py-2">Reportado por</th>
              <th className="text-left font-medium px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && <tr><td colSpan={6} className="px-3 py-6 text-center text-neutral-400">Cargando…</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-neutral-400">Sin incidentes reportados</td></tr>}
            {items.map(i => (
              <tr key={i.id} className="hover:bg-neutral-50 align-top">
                <td className="px-3 py-2 text-neutral-600 whitespace-nowrap">{new Date(i.createdAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                <td className="px-3 py-2 font-medium text-neutral-800">{i.vehiculo?.dominio || '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5 text-neutral-800"><AlertTriangle className="h-3.5 w-3.5 text-red-500" />{TIPO_INC_L[i.tipo] || i.tipo}</div>
                  {i.descripcion && <p className="text-xs text-neutral-500 mt-0.5 max-w-xs">{i.descripcion}</p>}
                  {i.hayLesionados && <span className="inline-block mt-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">LESIONADOS</span>}
                  {(i.lat && i.lng) && <a href={`https://maps.google.com/?q=${i.lat},${i.lng}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1 text-[11px] text-blue-600 hover:underline"><MapPin className="h-3 w-3" />Ubicación</a>}
                </td>
                <td className="px-3 py-2"><span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${GRAV_COLOR[i.gravedad] || ''}`}>{i.gravedad}</span></td>
                <td className="px-3 py-2 text-neutral-600">{i.reportadoPorNombre}{i.reportadoPorTelefono ? <div className="text-xs text-neutral-400">{i.reportadoPorTelefono}</div> : null}</td>
                <td className="px-3 py-2">
                  <select value={i.estado} onChange={e => cambiarEstado(i.id, e.target.value)} className={`rounded px-1.5 py-0.5 text-xs font-medium border-0 cursor-pointer ${ESTADO_INC[i.estado] || ''}`}>
                    <option value="ABIERTO">Abierto</option><option value="EN_SEGUIMIENTO">En seguimiento</option><option value="CERRADO">Cerrado</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Bitácora / registros de servicio ─────────────────────────────────────────
export function BitacoraPanel({ vehiculos }: { vehiculos: any[] }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [vehiculoId, setVehiculoId] = useState('');
  const [enServicio, setEnServicio] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const d = await apiFetch<{ registros: any[] }>(`/driver-hub/servicios${vehiculoId ? `?vehiculoId=${vehiculoId}` : ''}`);
      setItems(d.registros || []);
    } finally { setLoading(false); }
  };
  const loadEnServicio = async () => {
    try {
      const d = await apiFetch<{ enServicio: any[] }>('/driver-hub/en-servicio');
      setEnServicio(d.enServicio || []);
    } catch { /* silencioso */ }
  };
  useEffect(() => { load(); }, [vehiculoId]);
  useEffect(() => { loadEnServicio(); const t = setInterval(loadEnServicio, 60000); return () => clearInterval(t); }, []);

  return (
    <div className="space-y-4">
      {enServicio.length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-2">En servicio ahora ({enServicio.length})</p>
          <div className="flex flex-wrap gap-2">
            {enServicio.map(s => (
              <div key={s.id} className="rounded-md bg-white border border-emerald-200 px-3 py-2 text-xs">
                <span className="font-semibold text-neutral-800">{s.chofer}</span>
                <span className="text-neutral-500"> · {s.vehiculo?.dominio} · </span>
                <span className={s.horasEnServicio > 12 ? 'text-red-600 font-bold' : 'text-emerald-700 font-medium'}>{s.horasEnServicio}h</span>
                {s.destino && <span className="text-neutral-400"> → {s.destino}</span>}
                {s.descansoInsuficiente && <span className="ml-1 rounded bg-red-100 px-1 py-0.5 text-[10px] font-bold text-red-700">&lt;12h descanso</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">Inicios/fines de servicio y notas de bitácora de los choferes</p>
        <select value={vehiculoId} onChange={e => setVehiculoId(e.target.value)} className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
          <option value="">Todas las unidades</option>
          {vehiculos.map(v => <option key={v.id} value={v.id}>{v.dominio}</option>)}
        </select>
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-3 py-2">Fecha</th>
              <th className="text-left font-medium px-3 py-2">Unidad</th>
              <th className="text-left font-medium px-3 py-2">Tipo</th>
              <th className="text-left font-medium px-3 py-2">Odómetro</th>
              <th className="text-left font-medium px-3 py-2">Chofer</th>
              <th className="text-left font-medium px-3 py-2">Viaje</th>
              <th className="text-left font-medium px-3 py-2">Jornada / descanso</th>
              <th className="text-left font-medium px-3 py-2">Notas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && <tr><td colSpan={8} className="px-3 py-6 text-center text-neutral-400">Cargando…</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-neutral-400">Sin registros</td></tr>}
            {items.map(r => {
              const t = TIPO_SERV_L[r.tipo] || { label: r.tipo, color: 'bg-neutral-100 text-neutral-600' };
              return (
                <tr key={r.id} className="hover:bg-neutral-50 align-top">
                  <td className="px-3 py-2 text-neutral-600 whitespace-nowrap">{new Date(r.createdAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-3 py-2 font-medium text-neutral-800">{r.vehiculo?.dominio || '—'}</td>
                  <td className="px-3 py-2"><span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${t.color}`}><NotebookPen className="h-3 w-3" />{t.label}</span></td>
                  <td className="px-3 py-2 text-neutral-600">{r.odometro != null ? `${Math.round(r.odometro).toLocaleString('es-AR')} km` : '—'}</td>
                  <td className="px-3 py-2 text-neutral-600">{r.reportadoPorNombre}</td>
                  <td className="px-3 py-2 text-xs text-neutral-600">
                    {(r.origen || r.destino) && <div>{r.origen || '—'} → {r.destino || '—'}</div>}
                    {r.carga && <div className="text-neutral-400">{r.carga}</div>}
                    {!r.origen && !r.destino && !r.carga && <span className="text-neutral-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.tipo === 'FIN_SERVICIO' && r.horasTrabajadas != null && (
                      <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium ${r.jornadaExcesiva ? 'bg-red-100 text-red-700 font-bold' : 'bg-blue-50 text-blue-700'}`}>
                        {r.horasTrabajadas}h trabajadas{r.jornadaExcesiva ? ' · >12h' : ''}
                      </span>
                    )}
                    {r.tipo === 'INICIO_SERVICIO' && r.horasDescanso != null && (
                      <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium ${r.descansoInsuficiente ? 'bg-red-100 text-red-700 font-bold' : 'bg-green-50 text-green-700'}`}>
                        {r.horasDescanso}h descanso{r.descansoInsuficiente ? ' · <12h' : ''}
                      </span>
                    )}
                    {r.tipo === 'INICIO_SERVICIO' && r.horasDescanso == null && <span className="text-neutral-300">—</span>}
                    {r.tipo === 'FIN_SERVICIO' && r.horasTrabajadas == null && <span className="text-neutral-300">—</span>}
                    {r.tipo === 'BITACORA' && <span className="text-neutral-300">—</span>}
                    {r.odometroSospechoso && <div className="mt-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 inline-block">Odómetro salto &gt;2000km</div>}
                  </td>
                  <td className="px-3 py-2 text-neutral-600 max-w-xs">
                    {r.notas || '—'}
                    {(r.lat && r.lng) && <a href={`https://maps.google.com/?q=${r.lat},${r.lng}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 ml-2 text-[11px] text-blue-600 hover:underline"><MapPin className="h-3 w-3" />GPS</a>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Controles de aptitud pre-servicio ────────────────────────────────────────
export function ControlesPanel({ vehiculos }: { vehiculos: any[] }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [vehiculoId, setVehiculoId] = useState('');
  const [filtroApto, setFiltroApto] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (vehiculoId) params.set('vehiculoId', vehiculoId);
      if (filtroApto) params.set('apto', filtroApto);
      const d = await apiFetch<{ controles: any[] }>(`/driver-hub/controles?${params.toString()}`);
      setItems(d.controles || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [vehiculoId, filtroApto]);

  const noAptos = items.filter(c => !c.apto).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-neutral-500">Controles de aptitud registrados por los choferes al tomar servicio</p>
        <div className="flex gap-2">
          <select value={vehiculoId} onChange={e => setVehiculoId(e.target.value)} className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
            <option value="">Todas las unidades</option>
            {vehiculos.map(v => <option key={v.id} value={v.id}>{v.dominio}</option>)}
          </select>
          <select value={filtroApto} onChange={e => setFiltroApto(e.target.value)} className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
            <option value="">Todos</option><option value="true">Aptos</option><option value="false">No aptos</option>
          </select>
        </div>
      </div>

      {noAptos > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <XCircle className="h-3.5 w-3.5" />
          <span className="font-semibold">{noAptos} control{noAptos !== 1 ? 'es' : ''} con resultado NO APTO en el período</span>
        </div>
      )}

      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-3 py-2">Fecha</th>
              <th className="text-left font-medium px-3 py-2">Chofer</th>
              <th className="text-left font-medium px-3 py-2">Unidad</th>
              <th className="text-left font-medium px-3 py-2">Mediciones</th>
              <th className="text-left font-medium px-3 py-2">Resultado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && <tr><td colSpan={5} className="px-3 py-6 text-center text-neutral-400">Cargando…</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-neutral-400">Sin controles registrados</td></tr>}
            {items.map(c => (
              <tr key={c.id} className="hover:bg-neutral-50 align-top">
                <td className="px-3 py-2 text-neutral-600 whitespace-nowrap">{new Date(c.createdAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                <td className="px-3 py-2 font-medium text-neutral-800">{c.reportadoPorNombre}</td>
                <td className="px-3 py-2 text-neutral-600">{c.vehiculo?.dominio || '—'}</td>
                <td className="px-3 py-2 text-neutral-600 text-xs">
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {c.presionSistolica != null && <span>PA {c.presionSistolica}/{c.presionDiastolica}</span>}
                    {c.alcoholemia != null && <span className={c.alcoholemia > 0 ? 'text-red-600 font-semibold' : ''}>Alc {c.alcoholemia} g/L</span>}
                    {c.temperatura != null && <span className={c.temperatura >= 37.5 ? 'text-red-600 font-semibold' : ''}>{c.temperatura}°C</span>}
                    {c.horasDescanso != null && <span className={c.horasDescanso < 6 ? 'text-amber-600 font-semibold' : ''}>{c.horasDescanso}h descanso</span>}
                    {c.nivelFatiga != null && <span className={c.nivelFatiga >= 7 ? 'text-red-600 font-semibold' : ''}>Fatiga {c.nivelFatiga}/9</span>}
                    {c.tomaMedicamentos && <span className="text-amber-600 font-semibold">Medicamentos</span>}
                  </div>
                  {c.observaciones && <p className="text-[11px] text-neutral-400 mt-0.5">{c.observaciones}</p>}
                </td>
                <td className="px-3 py-2">
                  {c.apto ? (
                    <span className="inline-flex items-center gap-1 rounded bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700"><CheckCircle2 className="h-3 w-3" /> Apto</span>
                  ) : (
                    <div>
                      <span className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-700"><XCircle className="h-3 w-3" /> NO APTO</span>
                      {c.motivos && <p className="text-[11px] text-red-600 mt-1 max-w-xs">{c.motivos}</p>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Jornadas agregadas por chofer ────────────────────────────────────────────
export function JornadasPanel() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dias, setDias] = useState(30);

  useEffect(() => {
    setLoading(true);
    apiFetch<{ jornadas: any[] }>(`/driver-hub/jornadas?dias=${dias}`)
      .then(d => setItems(d.jornadas || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [dias]);

  const alertas = items.filter(j => j.jornadasExcesivas > 0 || j.descansosInsuficientes > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-neutral-500">Horas trabajadas por chofer según registros de inicio/fin de servicio</p>
        <select value={dias} onChange={e => setDias(Number(e.target.value))} className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
          <option value={7}>Últimos 7 días</option>
          <option value={15}>Últimos 15 días</option>
          <option value={30}>Últimos 30 días</option>
          <option value={60}>Últimos 60 días</option>
        </select>
      </div>

      {alertas > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="font-semibold">{alertas} chofer{alertas !== 1 ? 'es' : ''} con jornadas excesivas o descansos insuficientes en el período</span>
        </div>
      )}

      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-3 py-2">Chofer</th>
              <th className="text-left font-medium px-3 py-2">Servicios</th>
              <th className="text-left font-medium px-3 py-2">Horas totales</th>
              <th className="text-left font-medium px-3 py-2">Promedio/jornada</th>
              <th className="text-left font-medium px-3 py-2">Jornadas &gt;12h</th>
              <th className="text-left font-medium px-3 py-2">Descansos &lt;12h</th>
              <th className="text-left font-medium px-3 py-2">Último registro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && <tr><td colSpan={7} className="px-3 py-6 text-center text-neutral-400">Cargando…</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-neutral-400">Sin registros en el período</td></tr>}
            {items.map(j => (
              <tr key={j.conductorId || j.chofer} className="hover:bg-neutral-50">
                <td className="px-3 py-2 font-medium text-neutral-800">{j.chofer}</td>
                <td className="px-3 py-2 text-neutral-600">{j.servicios}</td>
                <td className="px-3 py-2 font-semibold text-neutral-800">{j.horasTotales}h</td>
                <td className="px-3 py-2 text-neutral-600">{j.promedioJornada != null ? `${j.promedioJornada}h` : '—'}</td>
                <td className="px-3 py-2">{j.jornadasExcesivas > 0 ? <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-700">{j.jornadasExcesivas}</span> : <span className="text-neutral-300">0</span>}</td>
                <td className="px-3 py-2">{j.descansosInsuficientes > 0 ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-700">{j.descansosInsuficientes}</span> : <span className="text-neutral-300">0</span>}</td>
                <td className="px-3 py-2 text-neutral-500 text-xs">{new Date(j.ultimoRegistro).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Libro de jornada digital (export CNRT) ────────────────────────────────────
export function LibroJornadaPanel() {
  const [filas, setFilas] = useState<any[]>([]);
  const [conductores, setConductores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [conductorId, setConductorId] = useState('');
  const [desde, setDesde] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
  });
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    apiFetch<{ conductores: any[] }>('/flota/conductores')
      .then(d => setConductores(d.conductores || []))
      .catch(() => setConductores([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams();
    if (conductorId) q.set('conductorId', conductorId);
    if (desde) q.set('desde', desde);
    if (hasta) q.set('hasta', hasta);
    apiFetch<{ filas: any[] }>(`/fleet-ops/libro-jornada?${q}`)
      .then(d => setFilas(d.filas || []))
      .catch(() => setFilas([]))
      .finally(() => setLoading(false));
  }, [conductorId, desde, hasta]);

  async function exportCsv() {
    try {
      setDownloading(true);
      const token = localStorage.getItem('accessToken');
      const tenantId = localStorage.getItem('tenantId');
      const q = new URLSearchParams({ formato: 'csv' });
      if (conductorId) q.set('conductorId', conductorId);
      if (desde) q.set('desde', desde);
      if (hasta) q.set('hasta', hasta);
      const res = await fetch(`/api/fleet-ops/libro-jornada?${q}`, {
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
        },
        credentials: 'include',
      });
      if (!res.ok) { alert('No se pudo exportar el libro de jornada'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `libro-jornada-${desde}_${hasta}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  const fmtHora = (d: string | null) => d ? new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'EN CURSO';

  const evalBadge = (f: any) => f.evaluacionDescanso && f.evaluacionDescanso !== 'CUMPLE'
    ? <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${EVAL_DESC_L[f.evaluacionDescanso]?.color || 'bg-neutral-100 text-neutral-600'}`}>{EVAL_DESC_L[f.evaluacionDescanso]?.label || f.evaluacionDescanso}</span>
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <p className="text-sm text-neutral-500">Registro formal de jornada por chofer — exportable para inspección CNRT</p>
        <button onClick={exportCsv} disabled={downloading || filas.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
          <Download className="h-4 w-4" /> {downloading ? 'Exportando…' : 'Exportar CSV'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Chofer</label>
          <select value={conductorId} onChange={e => setConductorId(e.target.value)} className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
            <option value="">Todos</option>
            {conductores.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-3 py-2">Fecha</th>
              <th className="text-left font-medium px-3 py-2">Chofer</th>
              <th className="text-left font-medium px-3 py-2">Vehículo</th>
              <th className="text-left font-medium px-3 py-2">Inicio</th>
              <th className="text-left font-medium px-3 py-2">Fin</th>
              <th className="text-left font-medium px-3 py-2">Horas</th>
              <th className="text-left font-medium px-3 py-2">Descanso previo</th>
              <th className="text-left font-medium px-3 py-2">Recorrido</th>
              <th className="text-left font-medium px-3 py-2">Alertas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && <tr><td colSpan={9} className="px-3 py-6 text-center text-neutral-400">Cargando…</td></tr>}
            {!loading && filas.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-neutral-400">Sin jornadas en el período</td></tr>}
            {filas.map((f, i) => (
              <tr key={i} className="hover:bg-neutral-50">
                <td className="px-3 py-2 text-neutral-600">{new Date(f.fecha).toLocaleDateString('es-AR')}</td>
                <td className="px-3 py-2 font-medium text-neutral-800">{f.chofer}</td>
                <td className="px-3 py-2 text-neutral-600">{f.vehiculo}</td>
                <td className="px-3 py-2 text-neutral-600 text-xs">{fmtHora(f.inicio)}</td>
                <td className="px-3 py-2 text-neutral-600 text-xs">{f.fin ? fmtHora(f.fin) : <span className="text-emerald-600 font-medium">EN CURSO</span>}</td>
                <td className="px-3 py-2 font-semibold text-neutral-800">{f.horasJornada != null ? `${f.horasJornada}h` : '—'}</td>
                <td className="px-3 py-2 text-neutral-600">{f.descansoPrevio != null ? `${f.descansoPrevio}h` : '—'}</td>
                <td className="px-3 py-2 text-neutral-500 text-xs">{f.origen || f.destino ? `${f.origen || '—'} → ${f.destino || '—'}` : '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    {f.descansoInsuficiente && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">DESC INSUF.</span>}
                    {f.jornadaExcesiva && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">JORN. EXCESIVA</span>}
                    {f.cierreTipo === 'REGULARIZADO' && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">REGULARIZADA</span>}
                    {f.corregida && <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">CORREGIDA</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Jornadas detalladas: lista con corrección y regularización (admin) ──────
export function JornadasListaPanel({ vehiculos }: { vehiculos: any[] }) {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [conductores, setConductores] = useState<any[]>([]);
  const [conductorId, setConductorId] = useState('');
  const [estado, setEstado] = useState('');
  const [desde, setDesde] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); });
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10));
  const [detalle, setDetalle] = useState<any>(null);
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [regularizando, setRegularizando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [nuevoInicio, setNuevoInicio] = useState('');
  const [nuevoFin, setNuevoFin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const pageSize = 50;

  useEffect(() => {
    apiFetch<{ conductores: any[] }>('/flota/conductores').then(d => setConductores(d.conductores || [])).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (conductorId) q.set('conductorId', conductorId);
    if (estado) q.set('estado', estado);
    if (desde) q.set('desde', desde);
    if (hasta) q.set('hasta', hasta);
    try {
      const d = await apiFetch<{ items: any[]; total: number }>(`/driver-hub/jornadas-lista?${q}`);
      setItems(d.items || []); setTotal(d.total || 0);
    } catch { setItems([]); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [page, conductorId, estado, desde, hasta]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrirDetalle = async (id: string) => {
    setError(null);
    try {
      const d = await apiFetch<{ jornada: any }>(`/driver-hub/jornadas-lista/${id}`);
      setDetalle(d.jornada);
      setNuevoInicio(d.jornada.inicioAt ? new Date(d.jornada.inicioAt).toISOString().slice(0, 16) : '');
      setNuevoFin(d.jornada.finAt ? new Date(d.jornada.finAt).toISOString().slice(0, 16) : '');
      setMotivo('');
    } catch { setError('No se pudo cargar el detalle'); }
  };

  const corregir = async () => {
    if (!motivo || motivo.trim().length < 5) { setError('El motivo es obligatorio (mín. 5 caracteres)'); return; }
    setBusy(true); setError(null);
    try {
      await apiFetch(`/driver-hub/jornadas-lista/${detalle.id}/corregir`, {
        method: 'POST',
        json: {
          motivo: motivo.trim(),
          inicioAt: nuevoInicio ? new Date(nuevoInicio).toISOString() : undefined,
          finAt: detalle.estado === 'ABIERTA' ? (nuevoFin ? new Date(nuevoFin).toISOString() : null) : (nuevoFin ? new Date(nuevoFin).toISOString() : undefined),
        },
      });
      setCorrigiendo(false); setMsg('Corrección aplicada y registrada.'); await load(); setDetalle(null);
    } catch (e: any) { setError(e?.message || 'No se pudo corregir'); }
    setBusy(false);
  };

  const regularizar = async () => {
    if (!motivo || motivo.trim().length < 5) { setError('El motivo es obligatorio (mín. 5 caracteres)'); return; }
    setBusy(true); setError(null);
    try {
      await apiFetch(`/driver-hub/jornadas-lista/${detalle.id}/regularizar`, { method: 'POST', json: { motivo: motivo.trim() } });
      setRegularizando(false); setMsg('Jornada regularizada (cerrada sin fin confiable).'); await load(); setDetalle(null);
    } catch (e: any) { setError(e?.message || 'No se pudo regularizar'); }
    setBusy(false);
  };

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      {msg && <p className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">{msg}</p>}
      {error && !detalle && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Chofer</label>
          <select value={conductorId} onChange={e => { setConductorId(e.target.value); setPage(1); }} className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
            <option value="">Todos</option>
            {conductores.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Estado</label>
          <select value={estado} onChange={e => { setEstado(e.target.value); setPage(1); }} className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
            <option value="">Todas</option><option value="ABIERTA">Abiertas</option><option value="CERRADA">Cerradas</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Desde</label>
          <input type="date" value={desde} onChange={e => { setDesde(e.target.value); setPage(1); }} className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Hasta</label>
          <input type="date" value={hasta} onChange={e => { setHasta(e.target.value); setPage(1); }} className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
        </div>
        <p className="text-xs text-neutral-400 ml-auto">{total} jornadas · pág. {page}/{pages}</p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-3 py-2">Inicio</th>
              <th className="text-left font-medium px-3 py-2">Fin</th>
              <th className="text-left font-medium px-3 py-2">Chofer</th>
              <th className="text-left font-medium px-3 py-2">Horas</th>
              <th className="text-left font-medium px-3 py-2">Descanso previo</th>
              <th className="text-left font-medium px-3 py-2">Estado</th>
              <th className="text-left font-medium px-3 py-2">Flags</th>
              <th className="text-left font-medium px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && <tr><td colSpan={8} className="px-3 py-6 text-center text-neutral-400">Cargando…</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-neutral-400">Sin jornadas en el período</td></tr>}
            {items.map((j: any) => (
              <tr key={j.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2 text-neutral-600 text-xs">{new Date(j.inicioAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                <td className="px-3 py-2 text-neutral-600 text-xs">{j.finAt ? new Date(j.finAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : (j.estado === 'ABIERTA' ? 'EN CURSO' : '—')}</td>
                <td className="px-3 py-2 font-medium text-neutral-800">{j.conductor?.nombre || '—'}</td>
                <td className="px-3 py-2 font-semibold text-neutral-800">{j.horasTrabajadas != null ? `${j.horasTrabajadas}h` : '—'}</td>
                <td className="px-3 py-2 text-xs">
                  {j.descansoPrevioHoras != null ? `${j.descansoPrevioHoras}h` : '—'}
                  {j.evaluacionDescanso && j.evaluacionDescanso !== 'CUMPLE' && <div><span className={`rounded px-1 py-0.5 text-[10px] font-bold ${EVAL_DESC_L[j.evaluacionDescanso]?.color || ''}`}>{EVAL_DESC_L[j.evaluacionDescanso]?.label || j.evaluacionDescanso}</span></div>}
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${j.estado === 'ABIERTA' ? 'bg-emerald-50 text-emerald-700' : j.cierreTipo === 'REGULARIZADO' ? 'bg-amber-50 text-amber-700' : 'bg-neutral-100 text-neutral-600'}`}>
                    {j.estado === 'ABIERTA' ? 'Abierta' : j.cierreTipo === 'REGULARIZADO' ? 'Regularizada' : 'Cerrada'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {j.jornadaExcesiva && <span className="rounded bg-red-100 px-1 py-0.5 text-[10px] font-bold text-red-700">&gt;12h</span>}
                    {j._count?.correcciones > 0 && <span className="rounded bg-violet-100 px-1 py-0.5 text-[10px] font-bold text-violet-700">{j._count.correcciones} corr.</span>}
                    {j.discrepanciaDeclaradoCalc && <span className="rounded bg-amber-100 px-1 py-0.5 text-[10px] font-bold text-amber-700" title="El descanso declarado en el control no coincide con el calculado">Discrep.</span>}
                  </div>
                </td>
                <td className="px-3 py-2"><button onClick={() => abrirDetalle(j.id)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Detalle</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-md border border-neutral-300 px-3 py-1 text-sm disabled:opacity-40">← Anterior</button>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages} className="rounded-md border border-neutral-300 px-3 py-1 text-sm disabled:opacity-40">Siguiente →</button>
        </div>
      )}

      {/* Detalle + corrección/regularización */}
      {detalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">Jornada de {detalle.conductor?.nombre}</h2>
              <button onClick={() => setDetalle(null)}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-neutral-500">Inicio:</span> <strong>{new Date(detalle.inicioAt).toLocaleString('es-AR')}</strong></div>
                <div><span className="text-neutral-500">Fin:</span> <strong>{detalle.finAt ? new Date(detalle.finAt).toLocaleString('es-AR') : detalle.estado === 'ABIERTA' ? 'En curso' : 'Sin fin confiable'}</strong></div>
                <div><span className="text-neutral-500">Horas:</span> <strong>{detalle.horasTrabajadas ?? '—'}h</strong></div>
                <div><span className="text-neutral-500">Descanso previo:</span> <strong>{detalle.descansoPrevioHoras ?? '—'}h</strong></div>
                <div><span className="text-neutral-500">Evaluación:</span> <strong>{EVAL_DESC_L[detalle.evaluacionDescanso]?.label || detalle.evaluacionDescanso || '—'}</strong></div>
                <div><span className="text-neutral-500">Estado:</span> <strong>{detalle.estado}{detalle.cierreTipo === 'REGULARIZADO' ? ' (regularizada)' : ''}</strong></div>
                {(detalle.origen || detalle.destino) && <div className="col-span-2"><span className="text-neutral-500">Recorrido:</span> {detalle.origen || '—'} → {detalle.destino || '—'}{detalle.carga ? ` · ${detalle.carga}` : ''}</div>}
                <div className="col-span-2"><span className="text-neutral-500">Unidades:</span> {(detalle.unidades || []).map((u: any) => u.dominio).join(' → ') || '—'}</div>
                {detalle.evaluacionDescansoOriginal && detalle.evaluacionDescanso !== detalle.evaluacionDescansoOriginal && (
                  <div className="col-span-2 text-violet-700 bg-violet-50 rounded px-2 py-1">Valor original preservado: {EVAL_DESC_L[detalle.evaluacionDescansoOriginal]?.label || detalle.evaluacionDescansoOriginal} ({detalle.descansoPrevioHorasOriginal}h)</div>
                )}
              </div>
              {detalle.registros?.length > 0 && (
                <div className="border-t pt-2">
                  <p className="text-xs font-semibold text-neutral-600 mb-1">Eventos vinculados</p>
                  {detalle.registros.map((r: any) => (
                    <div key={r.id} className="text-xs text-neutral-500 py-0.5">{new Date(r.eventoAt).toLocaleString('es-AR')} — {TIPO_SERV_L[r.tipo]?.label || r.tipo}{r.notas ? ` · ${r.notas}` : ''}</div>
                  ))}
                </div>
              )}
              {detalle.correcciones?.length > 0 && (
                <div className="border-t pt-2">
                  <p className="text-xs font-semibold text-neutral-600 mb-1">Correcciones ({detalle.correcciones.length})</p>
                  {detalle.correcciones.map((c: any) => (
                    <div key={c.id} className="text-xs text-neutral-500 py-1 border-b last:border-0">
                      <span className="font-medium text-violet-700">{c.campo}</span>: {c.valorAnterior} → {c.valorNuevo}
                      <div className="text-neutral-400">{c.motivo} · {new Date(c.corregidoEn).toLocaleString('es-AR')}</div>
                    </div>
                  ))}
                </div>
              )}
              {detalle.avisos?.length > 0 && (
                <div className="border-t pt-2">
                  <p className="text-xs font-semibold text-neutral-600 mb-1">Avisos enviados</p>
                  {detalle.avisos.map((a: any) => <div key={a.id} className="text-xs text-neutral-500">{a.tipo} · {a.estadoEntrega}{a.enviadoAt ? ` · ${new Date(a.enviadoAt).toLocaleString('es-AR')}` : ''}</div>)}
                </div>
              )}
              {error && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</p>}

              {!corrigiendo && !regularizando && (
                <div className="flex gap-2 border-t pt-3">
                  <button onClick={() => setCorrigiendo(true)} className="flex-1 rounded-md border border-violet-300 text-violet-700 px-3 py-1.5 text-sm font-medium hover:bg-violet-50">Corregir horarios</button>
                  {detalle.estado === 'ABIERTA' && <button onClick={() => setRegularizando(true)} className="flex-1 rounded-md border border-amber-300 text-amber-700 px-3 py-1.5 text-sm font-medium hover:bg-amber-50">Regularizar (sin fin)</button>}
                </div>
              )}

              {corrigiendo && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-semibold text-violet-700">Corrección de horarios — queda trazada con tu usuario</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="block text-xs font-medium text-neutral-600 mb-1">Inicio corregido</label><input type="datetime-local" value={nuevoInicio} onChange={e => setNuevoInicio(e.target.value)} className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm" /></div>
                    <div><label className="block text-xs font-medium text-neutral-600 mb-1">Fin corregido{detalle.estado === 'ABIERTA' ? ' (vacío = sigue abierta)' : ''}</label><input type="datetime-local" value={nuevoFin} onChange={e => setNuevoFin(e.target.value)} className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm" /></div>
                  </div>
                  <div><label className="block text-xs font-medium text-neutral-600 mb-1">Motivo *</label><input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej: el chofer cerró 2h tarde por falta de señal" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" /></div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setCorrigiendo(false)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm">Cancelar</button>
                    <button onClick={corregir} disabled={busy} className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">{busy ? 'Aplicando…' : 'Aplicar corrección'}</button>
                  </div>
                </div>
              )}
              {regularizando && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-semibold text-amber-700">Regularización — la jornada queda cerrada SIN fin confiable. El próximo inicio de este chofer se evaluará como CIERRE_NO_CONFIABLE.</p>
                  <div><label className="block text-xs font-medium text-neutral-600 mb-1">Motivo *</label><input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej: el chofer no registró el fin — confirmado por teléfono" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" /></div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setRegularizando(false)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm">Cancelar</button>
                    <button onClick={regularizar} disabled={busy} className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">{busy ? 'Aplicando…' : 'Regularizar'}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Política de jornada + habilitaciones + conciliación ─────────────────────
export function PoliticaJornadaPanel() {
  const [politica, setPolitica] = useState<any>(null);
  const [historial, setHistorial] = useState<any[]>([]);
  const [conductores, setConductores] = useState<any[]>([]);
  const [habilitaciones, setHabilitaciones] = useState<any[]>([]);
  const [conciliacion, setConciliacion] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ descansoMinHoras: 12, modoAplicacion: 'ADVERTENCIA', jornadaAlertaHoras: 12, avisoAnticipacionHoras: 1 });
  const [confirmBloqueo, setConfirmBloqueo] = useState(false);
  const [habForm, setHabForm] = useState({ conductorId: '', descansoDeclaradoHoras: '', fundamento: '' });
  const [showHab, setShowHab] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [p, h, c] = await Promise.all([
        apiFetch<{ politica: any; historial: any[] }>('/driver-hub/jornada-politica'),
        apiFetch<{ habilitaciones: any[] }>('/driver-hub/habilitaciones-descanso'),
        apiFetch<any>('/driver-hub/jornadas-conciliacion'),
      ]);
      setPolitica(p.politica); setHistorial(p.historial || []);
      setHabilitaciones(h.habilitaciones || []); setConciliacion(c);
      setForm({
        descansoMinHoras: p.politica.descansoMinHoras ?? 12,
        modoAplicacion: p.politica.modoAplicacion || 'ADVERTENCIA',
        jornadaAlertaHoras: p.politica.jornadaAlertaHoras ?? 12,
        avisoAnticipacionHoras: p.politica.avisoAnticipacionHoras ?? 1,
      });
    } catch (e: any) { setError(e?.message || 'Error al cargar'); }
    apiFetch<{ conductores: any[] }>('/flota/conductores').then(d => setConductores(d.conductores || [])).catch(() => {});
    setLoading(false);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = async () => {
    setBusy(true); setError(null); setMsg(null);
    try {
      const payload: any = {
        descansoMinHoras: Number(form.descansoMinHoras),
        jornadaAlertaHoras: Number(form.jornadaAlertaHoras),
        avisoAnticipacionHoras: Number(form.avisoAnticipacionHoras),
        modoAplicacion: form.modoAplicacion,
      };
      if (form.modoAplicacion === 'BLOQUEO') payload.politicaRevisada = true;
      await apiFetch('/driver-hub/jornada-politica', { method: 'PATCH', json: payload });
      setMsg('Política actualizada.'); setConfirmBloqueo(false); await load();
    } catch (e: any) { setError(e?.message || 'No se pudo guardar'); }
    setBusy(false);
  };

  const crearHab = async () => {
    if (!habForm.conductorId || !habForm.fundamento || habForm.fundamento.trim().length < 5) { setError('Conductor y fundamento son obligatorios'); return; }
    setBusy(true); setError(null);
    try {
      await apiFetch('/driver-hub/habilitaciones-descanso', {
        method: 'POST',
        json: {
          conductorId: habForm.conductorId,
          descansoDeclaradoHoras: habForm.descansoDeclaradoHoras !== '' ? Number(habForm.descansoDeclaradoHoras) : undefined,
          fundamento: habForm.fundamento.trim(),
        },
      });
      setShowHab(false); setHabForm({ conductorId: '', descansoDeclaradoHoras: '', fundamento: '' });
      setMsg('Habilitación creada.'); await load();
    } catch (e: any) { setError(e?.message || 'No se pudo crear'); }
    setBusy(false);
  };

  if (loading) return <p className="text-sm text-neutral-400 py-8 text-center">Cargando política…</p>;

  return (
    <div className="space-y-6">
      {msg && <p className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">{msg}</p>}
      {error && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</p>}

      {/* Política */}
      <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3">
        <div className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-blue-600" /><h3 className="text-sm font-semibold text-neutral-900">Política de descanso y jornada</h3><span className="text-xs text-neutral-400 ml-auto">v{politica?.version || 1}</span></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Descanso mínimo (h)</label>
            <input type="number" min="4" max="24" step="0.5" value={form.descansoMinHoras} onChange={e => setForm({ ...form, descansoMinHoras: Number(e.target.value) })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Alerta de jornada (h)</label>
            <input type="number" min="4" max="24" step="0.5" value={form.jornadaAlertaHoras} onChange={e => setForm({ ...form, jornadaAlertaHoras: Number(e.target.value) })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Aviso anticipado (h)</label>
            <input type="number" min="0.5" max="8" step="0.5" value={form.avisoAnticipacionHoras} onChange={e => setForm({ ...form, avisoAnticipacionHoras: Number(e.target.value) })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Modo de aplicación</label>
            <select value={form.modoAplicacion} onChange={e => { setForm({ ...form, modoAplicacion: e.target.value }); setConfirmBloqueo(false); }} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
              <option value="ADVERTENCIA">Advertencia (registra y avisa)</option>
              <option value="BLOQUEO">Bloqueo (impide el inicio)</option>
            </select>
          </div>
        </div>
        {form.modoAplicacion === 'BLOQUEO' && (
          <label className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            <input type="checkbox" checked={confirmBloqueo} onChange={e => setConfirmBloqueo(e.target.checked)} className="mt-0.5" />
            <span>Confirmo que revisé la política: en modo <strong>BLOQUEO</strong> el chofer NO podrá iniciar servicio sin el descanso mínimo salvo habilitación expresa. El intento queda registrado como rechazo.</span>
          </label>
        )}
        <div className="flex justify-end">
          <button onClick={guardar} disabled={busy || (form.modoAplicacion === 'BLOQUEO' && !confirmBloqueo && politica?.modoAplicacion !== 'BLOQUEO')}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {busy ? 'Guardando…' : 'Guardar política'}
          </button>
        </div>
        {historial.length > 0 && (
          <details className="text-xs text-neutral-500">
            <summary className="cursor-pointer font-medium">Historial de cambios ({historial.length})</summary>
            {historial.map(h => <div key={h.id} className="py-1 border-t border-neutral-100">v{h.version} · {new Date(h.changedAt).toLocaleString('es-AR')} · modo {h.valores?.modoAplicacion}, descanso {h.valores?.descansoMinHoras}h</div>)}
          </details>
        )}
      </div>

      {/* Conciliación */}
      {conciliacion?.hayInconsistencias && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
          <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /><h3 className="text-sm font-semibold text-amber-800">Conciliación de datos</h3></div>
          <ul className="text-xs text-amber-800 space-y-1">
            {conciliacion.sinFin > 0 && <li>· {conciliacion.sinFin} registros INICIO sin jornada vinculada (legacy o ambiguos en la migración — revisar manualmente)</li>}
            {conciliacion.sinInicio > 0 && <li>· {conciliacion.sinInicio} registros FIN huérfanos sin inicio vinculado</li>}
            {conciliacion.jornadasAbiertasViejas?.length > 0 && <li>· {conciliacion.jornadasAbiertasViejas.length} jornada(s) ABIERTA hace más de 36h: {conciliacion.jornadasAbiertasViejas.map((j: any) => j.conductor?.nombre).join(', ')} — revisar y regularizar en la pestaña Jornadas</li>}
          </ul>
          {conciliacion.intentosRechazados?.length > 0 && <p className="text-xs text-amber-700">{conciliacion.intentosRechazados.length} intento(s) de inicio rechazados recientemente (visibles en Bitácora como "Inicio rechazado").</p>}
        </div>
      )}

      {/* Habilitaciones */}
      <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /><h3 className="text-sm font-semibold text-neutral-900">Habilitaciones de inicio</h3></div>
          <button onClick={() => setShowHab(true)} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"><Plus className="h-3.5 w-3.5" /> Nueva habilitación</button>
        </div>
        <p className="text-xs text-neutral-500">Circuito autorizado para el primer inicio de un chofer (sin historial) o tras un cierre no confiable — de un solo uso.</p>
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide"><tr>
            <th className="text-left font-medium px-3 py-2">Chofer</th><th className="text-left font-medium px-3 py-2">Tipo</th>
            <th className="text-left font-medium px-3 py-2">Descanso declarado</th><th className="text-left font-medium px-3 py-2">Fundamento</th>
            <th className="text-left font-medium px-3 py-2">Estado</th></tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {habilitaciones.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-neutral-400 text-xs">Sin habilitaciones</td></tr>}
            {habilitaciones.map((h: any) => (
              <tr key={h.id}>
                <td className="px-3 py-2 font-medium">{h.conductor?.nombre || '—'}</td>
                <td className="px-3 py-2 text-xs">{h.tipo === 'SIN_HISTORIAL' ? 'Sin historial' : 'Cierre no confiable'}</td>
                <td className="px-3 py-2">{h.descansoDeclaradoHoras != null ? `${h.descansoDeclaradoHoras}h` : '—'}</td>
                <td className="px-3 py-2 text-xs text-neutral-500 max-w-[220px]">{h.fundamento}</td>
                <td className="px-3 py-2 text-xs">{h.usadaEnJornadaId ? <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-500">Usada</span> : <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 font-medium">Vigente</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showHab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">Habilitar inicio de jornada</h2>
              <button onClick={() => setShowHab(false)}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Chofer *</label>
                <select value={habForm.conductorId} onChange={e => setHabForm({ ...habForm, conductorId: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                  <option value="">Seleccionar…</option>
                  {conductores.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Descanso declarado (h — opcional)</label>
                <input type="number" min="0" max="96" step="0.5" value={habForm.descansoDeclaradoHoras} onChange={e => setHabForm({ ...habForm, descansoDeclaradoHoras: e.target.value })} placeholder="Ej: 12" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Fundamento *</label>
                <textarea value={habForm.fundamento} onChange={e => setHabForm({ ...habForm, fundamento: e.target.value })} placeholder="Ej: alta nueva — primer servicio en la empresa" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm min-h-[60px]" />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={() => setShowHab(false)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm">Cancelar</button>
              <button onClick={crearHab} disabled={busy} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{busy ? 'Creando…' : 'Crear habilitación'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
