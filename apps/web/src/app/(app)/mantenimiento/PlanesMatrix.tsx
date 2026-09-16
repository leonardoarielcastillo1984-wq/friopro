'use client';
import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { Search, Filter, CheckCircle, Clock, AlertTriangle, Gauge } from 'lucide-react';

const MESES_ATRAS = 3;
const MESES_ADELANTE = 8;

const MES_LABEL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

type CellStatus = 'REALIZADO' | 'VENCIDO' | 'PLANIFICADO' | 'CANCELADO' | '';

interface Props {
  assets: any[];
  plans: any[];
  workOrders?: any[];
  selectedAssetId: string | null;
  onSelectAsset: (assetId: string | null) => void;
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

export default function PlanesMatrix({ assets, plans, workOrders = [], selectedAssetId, onSelectAsset }: Props) {
  const [intervenciones, setIntervenciones] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState('all');
  const [soloConPlan, setSoloConPlan] = useState(false);
  const [detalleModal, setDetalleModal] = useState<{ asset: any; mesLabel: string; detalle: string[] } | null>(null);

  useEffect(() => {
    apiFetch('/maintenance-interventions?limit=500')
      .then((d: any) => setIntervenciones(d.intervenciones || []))
      .catch(() => setIntervenciones([]))
      .finally(() => setLoaded(true));
  }, []);

  const meses = useMemo(() => {
    const hoy = new Date();
    const arr: Date[] = [];
    for (let i = -MESES_ATRAS; i <= MESES_ADELANTE; i++) {
      arr.push(new Date(hoy.getFullYear(), hoy.getMonth() + i, 1));
    }
    return arr;
  }, []);

  const mesActualKey = monthKey(new Date());

  const categorias = useMemo(() => {
    const set = new Set<string>();
    assets.forEach(a => { if (a.category) set.add(a.category); });
    return Array.from(set).sort();
  }, [assets]);

  const planesPorAsset = useMemo(() => {
    const map = new Map<string, any[]>();
    plans.forEach(p => {
      if (!p.assetId) return;
      if (!map.has(p.assetId)) map.set(p.assetId, []);
      map.get(p.assetId)!.push(p);
    });
    return map;
  }, [plans]);

  const intervencionesPorAsset = useMemo(() => {
    const map = new Map<string, any[]>();
    intervenciones.forEach(i => {
      if (!i.cumplioPreventivo) return;
      const id = i.maintenanceAssetId || i.maintenanceAsset?.id;
      if (!id) return;
      if (!map.has(id)) map.set(id, []);
      map.get(id)!.push(i);
    });
    return map;
  }, [intervenciones]);

  const assetsFiltrados = useMemo(() => {
    return assets.filter(a => {
      if (categoria !== 'all' && a.category !== categoria) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!a.name?.toLowerCase().includes(q) && !a.code?.toLowerCase().includes(q)) return false;
      }
      if (soloConPlan && !(planesPorAsset.get(a.id)?.length)) return false;
      return true;
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [assets, categoria, search, soloConPlan, planesPorAsset]);

  const otsPorAsset = useMemo(() => {
    const map = new Map<string, any[]>();
    (workOrders || []).forEach(o => {
      if (!o.planId || !o.assetId) return;
      if (!map.has(o.assetId)) map.set(o.assetId, []);
      map.get(o.assetId)!.push(o);
    });
    return map;
  }, [workOrders]);

  const calcularCelda = (assetId: string, mes: Date): { status: CellStatus; detalle: string[] } => {
    const key = monthKey(mes);
    const detalle: string[] = [];
    let status: CellStatus = '';

    const realizadas = (intervencionesPorAsset.get(assetId) || []).filter(i => monthKey(new Date(i.performedAt)) === key);
    if (realizadas.length > 0) {
      status = 'REALIZADO';
      realizadas.forEach(r => detalle.push(`Realizado: ${r.plan?.title || (r.tiposLabel || []).join(', ')}`));
    }

    (otsPorAsset.get(assetId) || []).forEach(o => {
      if (o.status === 'COMPLETED' && o.completedAt && monthKey(new Date(o.completedAt)) === key) {
        status = 'REALIZADO';
        detalle.push(`Realizado (OT ${o.code}): ${o.title}`);
      } else if (o.status === 'CANCELLED' && o.scheduledDate && monthKey(new Date(o.scheduledDate)) === key) {
        if (status !== 'REALIZADO') status = 'CANCELADO';
        detalle.push(`Cancelado (OT ${o.code}): ${o.title}`);
      } else if (o.scheduledDate && monthKey(new Date(o.scheduledDate)) === key && status !== 'REALIZADO' && status !== 'CANCELADO') {
        status = 'PLANIFICADO';
        detalle.push(`OT programada: ${o.title} (${o.code})`);
      }
    });

    const planesAsset = (planesPorAsset.get(assetId) || []).filter(p => p.status === 'ACTIVE' && p.frequencyUnit !== 'KM' && p.nextExecutionDate);
    planesAsset.forEach(p => {
      const pk = monthKey(new Date(p.nextExecutionDate));
      if (pk === key) {
        const esPasado = key < mesActualKey;
        if (status !== 'REALIZADO' && status !== 'CANCELADO') status = esPasado ? 'VENCIDO' : 'PLANIFICADO';
        detalle.push(`${esPasado ? 'Vencido' : 'Planificado'}: ${p.title}`);
      }
    });

    return { status, detalle };
  };

  const estadoKm = (plan: any, asset: any): { estado: 'VENCIDO' | 'PROXIMO' | 'AL_DIA'; detalle: string } => {
    const base = plan.lastOdometerExecution ?? 0;
    const trigger = plan.triggerKm || plan.frequencyValue;
    const actual = asset.currentOdometer ?? null;
    const restante = actual != null ? (base + trigger) - actual : null;
    let estado: 'VENCIDO' | 'PROXIMO' | 'AL_DIA' = 'AL_DIA';
    if (restante != null && restante <= 0) estado = 'VENCIDO';
    else if (restante != null && restante <= Math.max(500, trigger * 0.1)) estado = 'PROXIMO';
    const detalle = `${plan.title} · cada ${trigger.toLocaleString('es-AR')} km` + (restante != null ? ` · faltan ${Math.max(0, Math.round(restante)).toLocaleString('es-AR')} km` : '');
    return { estado, detalle };
  };

  const CELL_STYLE: Record<CellStatus, string> = {
    REALIZADO: 'bg-green-500',
    VENCIDO: 'bg-red-500',
    CANCELADO: 'bg-red-500',
    PLANIFICADO: 'bg-sky-400',
    '': 'bg-gray-100',
  };

  const KM_STYLE: Record<string, string> = {
    VENCIDO: 'bg-red-100 text-red-700 border-red-200',
    PROXIMO: 'bg-amber-100 text-amber-700 border-amber-200',
    AL_DIA: 'bg-gray-100 text-gray-500 border-gray-200',
  };

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar activo…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select value={categoria} onChange={e => setCategoria(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-2 text-sm">
            <option value="all">Todas las categorías</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={soloConPlan} onChange={e => setSoloConPlan(e.target.checked)} />
          Solo activos con plan asignado
        </label>
        {selectedAssetId && (
          <button onClick={() => onSelectAsset(null)} className="text-xs text-blue-600 hover:underline ml-auto">
            Quitar filtro de activo ×
          </button>
        )}
        <div className="flex items-center gap-3 text-xs text-gray-500 ml-auto">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" /> Realizado</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-sky-400 inline-block" /> Planificado</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> Vencido / Cancelado</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-gray-100 border border-gray-200 inline-block" /> Sin actividad</span>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
        <table className="text-sm border-collapse w-full">
          <thead>
            <tr>
              <th className="sticky left-0 bg-gray-50 text-left px-3 py-2.5 text-xs font-medium text-gray-500 uppercase z-10 min-w-[200px]">Activo</th>
              {meses.map(m => {
                const key = monthKey(m);
                const esHoy = key === mesActualKey;
                return (
                  <th key={key} className={`px-2 py-2.5 text-xs font-medium uppercase text-center min-w-[46px] ${esHoy ? 'text-blue-600 bg-blue-50' : 'text-gray-400'}`}>
                    {MES_LABEL[m.getMonth()]}<br />{String(m.getFullYear()).slice(2)}
                  </th>
                );
              })}
              <th className="px-3 py-2.5 text-xs font-medium text-gray-500 uppercase text-left min-w-[160px]">Por KM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {assetsFiltrados.map(asset => {
              const kmPlanes = (planesPorAsset.get(asset.id) || []).filter(p => p.status === 'ACTIVE' && p.frequencyUnit === 'KM');
              const seleccionado = selectedAssetId === asset.id;
              return (
                <tr key={asset.id} className={`hover:bg-gray-50 ${seleccionado ? 'bg-blue-50' : ''}`}>
                  <td className="sticky left-0 bg-inherit px-3 py-2 z-10">
                    <button onClick={() => onSelectAsset(seleccionado ? null : asset.id)} className="text-left">
                      <p className="font-medium text-gray-800 hover:text-blue-600">{asset.name}</p>
                      <p className="text-xs text-gray-400">{asset.code}</p>
                    </button>
                  </td>
                  {meses.map(m => {
                    const key = monthKey(m);
                    const { status, detalle } = calcularCelda(asset.id, m);
                    return (
                      <td key={key} className="px-2 py-2 text-center">
                        <div
                          title={detalle.join('\n') || undefined}
                          onClick={() => detalle.length && setDetalleModal({ asset, mesLabel: `${MES_LABEL[m.getMonth()]} ${m.getFullYear()}`, detalle })}
                          className={`w-6 h-6 mx-auto rounded ${CELL_STYLE[status]} ${detalle.length ? 'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-gray-400' : ''}`}
                        />
                      </td>
                    );
                  })}
                  <td className="px-3 py-2">
                    {kmPlanes.length === 0 ? (
                      <span className="text-xs text-gray-300">—</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {kmPlanes.map(p => {
                          const { estado, detalle } = estadoKm(p, asset);
                          return (
                            <span key={p.id} title={detalle} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border w-fit ${KM_STYLE[estado]}`}>
                              <Gauge className="w-3 h-3" />
                              {p.title}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {assetsFiltrados.length === 0 && (
              <tr><td colSpan={meses.length + 2} className="text-center py-8 text-gray-400 text-sm">No hay activos que coincidan con el filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {!loaded && <p className="text-xs text-gray-400 mt-2">Cargando historial de cumplimiento…</p>}

      {detalleModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDetalleModal(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
            <p className="font-semibold text-gray-900">{detalleModal.asset.name}</p>
            <p className="text-xs text-gray-400 mb-3">{detalleModal.mesLabel}</p>
            <ul className="space-y-1.5">
              {detalleModal.detalle.map((d, i) => (
                <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                  {d}
                </li>
              ))}
            </ul>
            <button onClick={() => setDetalleModal(null)} className="mt-4 w-full px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
