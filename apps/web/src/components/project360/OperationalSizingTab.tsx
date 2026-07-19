'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Truck, Users, Fuel, AlertTriangle, Calculator, Save, RotateCcw,
  MapPin, Clock, Package, ArrowRight
} from 'lucide-react';

interface OperationalSizing {
  id: string;
  km: number | null;
  trips: number | null;
  pallets: number | null;
  tons: number | null;
  frequency: string | null;
  slaHours: number | null;
  shifts: number | null;
  operatingHours: string | null;
  units: string | null;
  operationType: string | null;
  minStaff: number | null;
  geographicCoverage: string | null;
  driversNeeded: number | null;
  trucksNeeded: number | null;
  supervisorsNeeded: number | null;
  administrativeNeeded: number | null;
  fuelNeeded: number | null;
  manHoursNeeded: number | null;
  utilizationRate: number | null;
  availabilityRequired: number | null;
  operationalCapacity: number | null;
  fleetAlert: string | null;
  createdAt: string;
}

interface Props {
  projectId: string;
}

export default function OperationalSizingTab({ projectId }: Props) {
  const [sizing, setSizing] = useState<OperationalSizing | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/project360-v1/projects/${projectId}/operational-sizing`) as any;
      setSizing(res.operationalSizing);
      if (res.operationalSizing) setForm(res.operationalSizing);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch(`/project360-v1/projects/${projectId}/operational-sizing`, {
        method: 'POST',
        json: form,
      }) as any;
      setSizing(res.operationalSizing);
      setEditing(false);
    } catch (e: any) { alert(e.message); }
    setSaving(false);
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando dimensionamiento...</div>;

  const results = sizing ? [
    { label: 'Choferes Necesarios', value: sizing.driversNeeded, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Camiones Necesarios', value: sizing.trucksNeeded, icon: Truck, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Supervisores', value: sizing.supervisorsNeeded, icon: Users, color: 'bg-amber-50 text-amber-600' },
    { label: 'Administrativos', value: sizing.administrativeNeeded, icon: Users, color: 'bg-purple-50 text-purple-600' },
    { label: 'Combustible (L)', value: sizing.fuelNeeded ? Math.round(sizing.fuelNeeded) : null, icon: Fuel, color: 'bg-orange-50 text-orange-600' },
    { label: 'Horas Hombre', value: sizing.manHoursNeeded ? Math.round(sizing.manHoursNeeded) : null, icon: Clock, color: 'bg-indigo-50 text-indigo-600' },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Dimensionamiento Operativo</h2>
          <p className="text-sm text-gray-500">Cálculo automático de recursos operativos</p>
        </div>
        <button
          onClick={() => setEditing(!editing)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          {editing ? 'Cancelar' : sizing ? 'Recalcular' : 'Nuevo Cálculo'}
        </button>
      </div>

      {sizing?.fleetAlert && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <span className="text-sm text-amber-800 font-medium">{sizing.fleetAlert}</span>
        </div>
      )}

      {/* Inputs */}
      {editing && (
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-600" /> Parámetros de Operación
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">KM Totales</label>
              <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm" value={form.km || ''} onChange={e => setForm({ ...form, km: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Viajes</label>
              <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm" value={form.trips || ''} onChange={e => setForm({ ...form, trips: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pallets</label>
              <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm" value={form.pallets || ''} onChange={e => setForm({ ...form, pallets: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Toneladas</label>
              <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm" value={form.tons || ''} onChange={e => setForm({ ...form, tons: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Frecuencia</label>
              <select className="w-full px-3 py-2 border rounded-lg text-sm" value={form.frequency || ''} onChange={e => setForm({ ...form, frequency: e.target.value })}>
                <option value="">Seleccionar...</option>
                <option value="DIARIA">Diaria</option>
                <option value="SEMANAL">Semanal</option>
                <option value="QUINCENAL">Quincenal</option>
                <option value="MENSUAL">Mensual</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Horas SLA</label>
              <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm" value={form.slaHours || ''} onChange={e => setForm({ ...form, slaHours: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Turnos</label>
              <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm" value={form.shifts || ''} onChange={e => setForm({ ...form, shifts: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Dotación Mínima</label>
              <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm" value={form.minStaff || ''} onChange={e => setForm({ ...form, minStaff: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Horario Operación</label>
              <input type="text" className="w-full px-3 py-2 border rounded-lg text-sm" value={form.operatingHours || ''} onChange={e => setForm({ ...form, operatingHours: e.target.value })} placeholder="08:00-17:00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo Operación</label>
              <select className="w-full px-3 py-2 border rounded-lg text-sm" value={form.operationType || ''} onChange={e => setForm({ ...form, operationType: e.target.value })}>
                <option value="">Seleccionar...</option>
                <option value="TRANSPORTE">Transporte</option>
                <option value="DISTRIBUCION">Distribución</option>
                <option value="ALMACENAMIENTO">Almacenamiento</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Cobertura Geográfica</label>
              <input type="text" className="w-full px-3 py-2 border rounded-lg text-sm" value={form.geographicCoverage || ''} onChange={e => setForm({ ...form, geographicCoverage: e.target.value })} placeholder="Ej: Buenos Aires, Córdoba, Rosario" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2">
              <Calculator className="w-4 h-4" /> {saving ? 'Calculando...' : 'Calcular'}
            </button>
            <button onClick={() => setEditing(false)} className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">Cancelar</button>
          </div>
        </div>
      )}

      {/* Resultados */}
      {sizing && !editing && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {results.map(r => (
              <div key={r.label} className="bg-white rounded-xl border p-4">
                <div className={`w-10 h-10 rounded-lg ${r.color} flex items-center justify-center mb-3`}>
                  <r.icon className="w-5 h-5" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{r.value ?? '-'}</div>
                <div className="text-xs text-gray-500 mt-1">{r.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border p-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Utilización</h4>
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20">
                  <svg viewBox="0 0 36 36" className="w-full h-full">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#3b82f6" strokeWidth="3" strokeDasharray={`${sizing.utilizationRate || 0}, 100`} />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-900">{Math.round(sizing.utilizationRate || 0)}%</span>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Tasa de utilización</div>
                  <div className="text-lg font-bold text-gray-900">{sizing.utilizationRate?.toFixed(1)}%</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border p-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Disponibilidad Requerida</h4>
              <div className="text-3xl font-bold text-gray-900">{sizing.availabilityRequired}%</div>
              <div className="text-sm text-gray-500 mt-1">Meta operativa</div>
            </div>
            <div className="bg-white rounded-xl border p-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Capacidad Operativa</h4>
              <div className="text-3xl font-bold text-gray-900">{sizing.operationalCapacity ? Math.round(sizing.operationalCapacity).toLocaleString('es-AR') : '-'}</div>
              <div className="text-sm text-gray-500 mt-1">ton-km/viaje</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
