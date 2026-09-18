'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Users, Plus, X, Pencil, Trash2, Paperclip, Loader2 } from 'lucide-react';

type Conductor = {
  id: string; nombre: string; dni: string | null; categoria: string | null;
  licenciaVto: string | null; psicofisicoVto: string | null; status: string;
  licenciaFileUrl?: string | null; psicofisicoFileUrl?: string | null;
  telefono?: string | null; email?: string | null;
};

function diasRestantes(fecha: string | null) {
  if (!fecha) return null;
  return Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000);
}

function toDateInput(fecha: string | null) {
  return fecha ? new Date(fecha).toISOString().slice(0, 10) : '';
}

const FORM_VACIO = { nombre: '', dni: '', categoria: '', licenciaVto: '', psicofisicoVto: '', licenciaFileUrl: '', psicofisicoFileUrl: '', telefono: '', email: '', status: 'ACTIVO' };

export default function ConductoresPage() {
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<Conductor | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>(FORM_VACIO);
  const [subiendo, setSubiendo] = useState<'lic' | 'psi' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileTarget = useRef<'lic' | 'psi'>('lic');

  const subirDoc = async (f: File) => {
    setSubiendo(fileTarget.current);
    try {
      const fd = new FormData(); fd.append('file', f);
      const d = await apiFetch<{ url: string }>('/driver-hub/documentos/upload', { method: 'POST', body: fd } as any);
      if (d.url) setForm((p: any) => ({ ...p, [fileTarget.current === 'lic' ? 'licenciaFileUrl' : 'psicofisicoFileUrl']: d.url }));
    } catch { /* silencioso */ }
    setSubiendo(null);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ conductores: Conductor[] }>('/flota/conductores');
      setConductores(res.conductores || []);
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

  const abrirEdicion = (c: Conductor) => {
    setEditando(c);
    setForm({
      nombre: c.nombre, dni: c.dni || '', categoria: c.categoria || '',
      licenciaVto: toDateInput(c.licenciaVto), psicofisicoVto: toDateInput(c.psicofisicoVto),
      licenciaFileUrl: c.licenciaFileUrl || '', psicofisicoFileUrl: c.psicofisicoFileUrl || '',
      telefono: c.telefono || '', email: c.email || '', status: c.status,
    });
    setError(null);
    setShowForm(true);
  };

  const guardar = async () => {
    if (!form.nombre) { setError('El nombre es obligatorio'); return; }
    setBusy(true);
    setError(null);
    try {
      const payload: any = {
        nombre: form.nombre,
        dni: form.dni || undefined,
        categoria: form.categoria || undefined,
        licenciaVto: form.licenciaVto ? new Date(`${form.licenciaVto}T12:00:00`).toISOString() : undefined,
        psicofisicoVto: form.psicofisicoVto ? new Date(`${form.psicofisicoVto}T12:00:00`).toISOString() : undefined,
        licenciaFileUrl: form.licenciaFileUrl || undefined,
        psicofisicoFileUrl: form.psicofisicoFileUrl || undefined,
        telefono: form.telefono || undefined,
        email: form.email || undefined,
        status: form.status,
      };
      if (editando) {
        await apiFetch(`/flota/conductores/${editando.id}`, { method: 'PATCH', json: payload });
      } else {
        await apiFetch('/flota/conductores', { method: 'POST', json: payload });
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
      await apiFetch(`/flota/conductores/${id}`, { method: 'DELETE' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Conductores</h1>
          <p className="text-sm text-neutral-500">Licencias y psicofísico — mismos datos que Infraestructura</p>
        </div>
        <button onClick={abrirNuevo} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Nuevo conductor
        </button>
      </div>

      {error && !showForm && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</p>}

      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-3 py-2">Nombre</th>
              <th className="text-left font-medium px-3 py-2">DNI</th>
              <th className="text-left font-medium px-3 py-2">Categoría</th>
              <th className="text-left font-medium px-3 py-2">Vto. Licencia</th>
              <th className="text-left font-medium px-3 py-2">Vto. Psicofísico</th>
              <th className="text-left font-medium px-3 py-2">Estado</th>
              <th className="text-left font-medium px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && <tr><td colSpan={7} className="px-3 py-6 text-center text-neutral-400">Cargando…</td></tr>}
            {!loading && conductores.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-neutral-400">Sin conductores registrados</td></tr>}
            {conductores.map((c) => {
              const dLic = diasRestantes(c.licenciaVto);
              const dPsico = diasRestantes(c.psicofisicoVto);
              return (
                <tr key={c.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 font-medium text-neutral-800"><span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-neutral-400" />{c.nombre}</span></td>
                  <td className="px-3 py-2 text-neutral-600">{c.dni || '—'}</td>
                  <td className="px-3 py-2 text-neutral-600">{c.categoria || '—'}</td>
                  <td className={`px-3 py-2 ${dLic != null && dLic <= 30 ? 'text-amber-600 font-medium' : 'text-neutral-600'}`}>
                    {c.licenciaVto ? new Date(c.licenciaVto).toLocaleDateString('es-AR') : '—'}
                    {c.licenciaFileUrl && <a href={c.licenciaFileUrl} target="_blank" rel="noopener noreferrer" className="ml-1.5 text-blue-500 hover:text-blue-700" title="Ver licencia"><Paperclip className="h-3 w-3 inline" /></a>}
                  </td>
                  <td className={`px-3 py-2 ${dPsico != null && dPsico <= 30 ? 'text-amber-600 font-medium' : 'text-neutral-600'}`}>
                    {c.psicofisicoVto ? new Date(c.psicofisicoVto).toLocaleDateString('es-AR') : '—'}
                    {c.psicofisicoFileUrl && <a href={c.psicofisicoFileUrl} target="_blank" rel="noopener noreferrer" className="ml-1.5 text-blue-500 hover:text-blue-700" title="Ver psicofísico"><Paperclip className="h-3 w-3 inline" /></a>}
                  </td>
                  <td className="px-3 py-2 text-neutral-600">{c.status}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button disabled={busy} onClick={() => abrirEdicion(c)} className="text-blue-600 hover:text-blue-800 disabled:opacity-50" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                      <button disabled={busy} onClick={() => eliminar(c.id)} className="text-red-400 hover:text-red-600 disabled:opacity-50" title="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">{editando ? 'Editar conductor' : 'Nuevo conductor'}</h2>
              <button onClick={() => setShowForm(false)}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              {error && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</p>}
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Nombre *</label>
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">DNI</label>
                  <input value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Categoría licencia</label>
                  <input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="C, D1, E…" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Vto. licencia</label>
                  <input type="date" value={form.licenciaVto} onChange={(e) => setForm({ ...form, licenciaVto: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                  <button type="button" onClick={() => { fileTarget.current = 'lic'; fileRef.current?.click(); }} disabled={subiendo != null} className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 disabled:opacity-50">
                    {subiendo === 'lic' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
                    {form.licenciaFileUrl ? 'Archivo adjunto — cambiar' : 'Adjuntar licencia'}
                  </button>
                  {form.licenciaFileUrl && <a href={form.licenciaFileUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-[11px] text-neutral-500 hover:underline">ver</a>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Vto. psicofísico</label>
                  <input type="date" value={form.psicofisicoVto} onChange={(e) => setForm({ ...form, psicofisicoVto: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                  <button type="button" onClick={() => { fileTarget.current = 'psi'; fileRef.current?.click(); }} disabled={subiendo != null} className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 disabled:opacity-50">
                    {subiendo === 'psi' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
                    {form.psicofisicoFileUrl ? 'Archivo adjunto — cambiar' : 'Adjuntar psicofísico'}
                  </button>
                  {form.psicofisicoFileUrl && <a href={form.psicofisicoFileUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-[11px] text-neutral-500 hover:underline">ver</a>}
                </div>
              </div>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirDoc(f); e.target.value = ''; }} />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Teléfono</label>
                  <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Estado</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="ACTIVO">Activo</option>
                    <option value="INACTIVO">Inactivo</option>
                    <option value="SUSPENDIDO">Suspendido</option>
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
    </div>
  );
}
