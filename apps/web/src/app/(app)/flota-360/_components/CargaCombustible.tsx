'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { X, Fuel } from 'lucide-react';

type VehiculoOpt = { id: string; dominio: string; tipo: string; tipoCombustible?: string | null; currentOdometer?: number | null };
type ConductorOpt = { id: string; nombre: string };

/**
 * Modal de registro de carga de combustible.
 * Es la puerta de entrada principal del odómetro: al guardar, el backend
 * actualiza currentOdometer del vehículo y dispara la verificación de planes por KM.
 */
export default function CargaCombustible({ vehiculos, vehiculoId, onClose, onSaved }: {
  vehiculos: VehiculoOpt[];
  vehiculoId?: string; // si viene, el vehículo queda fijo (ficha de vehículo)
  onClose: () => void;
  onSaved: () => void;
}) {
  const [conductores, setConductores] = useState<ConductorOpt[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<any>({
    vehiculoId: vehiculoId || '',
    litros: '',
    precioPorLitro: '',
    odometro: '',
    estacion: '',
    tipoCombustible: 'DIESEL',
    litrosUrea: '',
    precioPorLitroUrea: '',
    conductorId: '',
    fecha: new Date().toISOString().slice(0, 10),
    notas: '',
  });

  const esGnc = form.tipoCombustible === 'GNC';
  const unidad = esGnc ? 'm³' : 'litros';
  const unidadCorta = esGnc ? 'm³' : 'L';

  // Si el vehículo viene fijo (ficha), pre-seleccionar su tipo de combustible declarado
  useEffect(() => {
    if (vehiculoId) {
      const v = vehiculos.find((x) => x.id === vehiculoId);
      if (v?.tipoCombustible && v.tipoCombustible !== form.tipoCombustible) {
        setForm((f: any) => ({ ...f, tipoCombustible: v.tipoCombustible }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehiculoId, vehiculos]);

  const vehSel = vehiculos.find((v) => v.id === form.vehiculoId);

  useEffect(() => {
    apiFetch<{ conductores: ConductorOpt[] }>('/flota/conductores')
      .then((r) => setConductores(r.conductores || []))
      .catch(() => {});
  }, []);

  const guardar = async () => {
    if (!form.vehiculoId) { setError('Elegí un vehículo'); return; }
    if (!form.litros || Number(form.litros) <= 0) { setError('Los litros son obligatorios'); return; }
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/flota/vehiculos/${form.vehiculoId}/combustible`, {
        method: 'POST',
        json: {
          litros: Number(form.litros),
          precioPorLitro: form.precioPorLitro ? Number(form.precioPorLitro) : undefined,
          odometro: form.odometro ? Number(form.odometro) : undefined,
          estacion: form.estacion || undefined,
          tipoCombustible: form.tipoCombustible,
          litrosUrea: form.litrosUrea ? Number(form.litrosUrea) : undefined,
          precioPorLitroUrea: form.precioPorLitroUrea ? Number(form.precioPorLitroUrea) : undefined,
          conductorId: form.conductorId || undefined,
          fecha: form.fecha ? new Date(`${form.fecha}T12:00:00`).toISOString() : undefined,
          notas: form.notas || undefined,
        },
      });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'No se pudo registrar la carga');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-label="Registrar carga de combustible">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-1.5"><Fuel className="h-4 w-4 text-blue-600" /> Registrar carga de combustible</h2>
          <button onClick={onClose} aria-label="Cerrar"><X className="h-4 w-4 text-neutral-400" /></button>
        </div>
        <div className="p-4 space-y-3">
          {error && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</p>}

          {!vehiculoId && (
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Vehículo *</label>
              <select value={form.vehiculoId} onChange={(e) => {
                const vid = e.target.value;
                const v = vehiculos.find((x) => x.id === vid);
                setForm({ ...form, vehiculoId: vid, tipoCombustible: v?.tipoCombustible || 'DIESEL' });
              }} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                <option value="">Seleccionar…</option>
                {vehiculos.map((v) => <option key={v.id} value={v.id}>{v.dominio} ({v.tipo})</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">{esGnc ? 'm³ *' : 'Litros *'}</label>
              <input type="number" min={0} step="0.01" value={form.litros} onChange={(e) => setForm({ ...form, litros: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Precio / {unidadCorta} ($)</label>
              <input type="number" min={0} step="0.01" value={form.precioPorLitro} onChange={(e) => setForm({ ...form, precioPorLitro: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Odómetro al cargar (km)</label>
            <input type="number" min={0} value={form.odometro} onChange={(e) => setForm({ ...form, odometro: e.target.value })} placeholder={vehSel?.currentOdometer != null ? `Actual: ${Math.round(vehSel.currentOdometer).toLocaleString('es-AR')}` : 'Sin lectura previa'} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
            <p className="text-[11px] text-neutral-400 mt-1">Actualiza el odómetro del vehículo y alimenta los planes por km y el rendimiento.</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Fecha</label>
              <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Estación / proveedor</label>
              <input value={form.estacion} onChange={(e) => setForm({ ...form, estacion: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Combustible</label>
              <select value={form.tipoCombustible} onChange={(e) => setForm({ ...form, tipoCombustible: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                <option value="DIESEL">Diésel</option>
                <option value="NAFTA">Nafta</option>
                <option value="GNC">GNC</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Conductor</label>
              <select value={form.conductorId} onChange={(e) => setForm({ ...form, conductorId: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                <option value="">Sin especificar</option>
                {conductores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Urea (litros)</label>
              <input type="number" min={0} step="0.01" value={form.litrosUrea} onChange={(e) => setForm({ ...form, litrosUrea: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Precio urea / litro ($)</label>
              <input type="number" min={0} step="0.01" value={form.precioPorLitroUrea} onChange={(e) => setForm({ ...form, precioPorLitroUrea: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Notas</label>
            <input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
          <button onClick={onClose} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Cancelar</button>
          <button onClick={guardar} disabled={saving} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Guardando…' : 'Registrar carga'}
          </button>
        </div>
      </div>
    </div>
  );
}
