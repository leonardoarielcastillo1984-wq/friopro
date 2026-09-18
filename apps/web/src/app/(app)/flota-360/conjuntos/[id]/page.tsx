'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CoupledVisual } from '../../_components/FleetVisual';
import { apiFetch } from '@/lib/api';
import {
  ChevronLeft, Truck, Container, DollarSign, Wrench, ScanLine,
  CalendarClock, AlertTriangle, Disc, FileWarning, Link2, Unlink,
} from 'lucide-react';

const ESTADO_LABEL: Record<string, string> = {
  ACTIVO: 'Activo', EN_TALLER: 'En taller', INACTIVO: 'Inactivo', BAJA: 'Baja',
  ACOPLADO: 'Acoplado', DESACOPLADO: 'Desacoplado',
};
const ESTADO_COLOR: Record<string, string> = {
  ACTIVO: 'bg-green-50 text-green-700', EN_TALLER: 'bg-amber-50 text-amber-700',
  INACTIVO: 'bg-neutral-100 text-neutral-600', BAJA: 'bg-red-50 text-red-600',
  ACOPLADO: 'bg-blue-50 text-blue-700', DESACOPLADO: 'bg-neutral-100 text-neutral-600',
};
const ESTADO_OT_LABEL: Record<string, string> = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En proceso', COMPLETED: 'Completada', ON_HOLD: 'En espera', CANCELLED: 'Cancelada',
};

function fmtFecha(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtKm(n: number | null | undefined) {
  return n != null ? `${Math.round(n).toLocaleString('es-AR')} km` : '—';
}
function fmtMoney(n: number | null | undefined) {
  return n != null ? `$${Math.round(n).toLocaleString('es-AR')}` : '—';
}

function saludColor(s: number | null | undefined) {
  if (s == null) return 'text-neutral-400';
  if (s >= 80) return 'text-green-600';
  if (s >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function PanelVehiculo({ titulo, v, resumen, twin, icon: Icon }: any) {
  const salud = twin?.twin?.healthScore ?? null;
  const prox = resumen?.proximoServicio;
  const insp = resumen?.ultimaInspeccion;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-blue-600" />
          <Link href={`/flota-360/vehiculos/${v.id}`} className="font-semibold text-neutral-900 hover:text-blue-700">
            {titulo} · {v.dominio}
          </Link>
        </div>
        <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${ESTADO_COLOR[v.status] || 'bg-neutral-100 text-neutral-600'}`}>
          {ESTADO_LABEL[v.status] || v.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <p className="text-neutral-400">Salud</p>
          <p className={`text-base font-bold ${saludColor(salud)}`}>{salud != null ? `${Math.round(salud)}/100` : 'Sin datos'}</p>
        </div>
        <div>
          <p className="text-neutral-400">Odómetro</p>
          <p className="text-base font-semibold text-neutral-800">{fmtKm(v.currentOdometer)}</p>
        </div>
        <div>
          <p className="text-neutral-400">OTs abiertas</p>
          <p className="font-semibold text-neutral-800 flex items-center gap-1">
            <Wrench className="h-3 w-3 text-neutral-400" />{resumen?.otsAbiertas ?? 0}
          </p>
        </div>
        <div>
          <p className="text-neutral-400">Neumáticos</p>
          <p className="font-semibold text-neutral-800 flex items-center gap-1">
            <Disc className="h-3 w-3 text-neutral-400" />{resumen?.neumaticosMontados ?? 0} montados
          </p>
        </div>
      </div>

      <div className="border-t border-neutral-100 pt-2 space-y-1.5 text-xs">
        <div className="flex items-center gap-1.5">
          <CalendarClock className="h-3 w-3 text-blue-500 shrink-0" />
          {prox ? (
            <span className="text-neutral-700">
              {prox.plan}: {prox.tipo === 'KM' ? `en ${fmtKm(prox.kmRestantes)}` : `${fmtFecha(prox.fecha)} (${prox.diasRestantes}d)`}
            </span>
          ) : (
            <span className="text-neutral-400">Sin próximo servicio planificado</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <ScanLine className="h-3 w-3 text-purple-500 shrink-0" />
          {insp ? (
            <span className="text-neutral-700">
              Última inspección {fmtFecha(insp.createdAt)} · {insp.hallazgosCount > 0 ? `${insp.hallazgosCount} hallazgos` : 'sin hallazgos'}
            </span>
          ) : (
            <span className="text-neutral-400">Sin inspecciones QR registradas</span>
          )}
        </div>
        {(resumen?.docsPendientes > 0 || resumen?.docsPorVencer > 0) && (
          <div className="flex items-center gap-1.5 text-amber-700">
            <FileWarning className="h-3 w-3 shrink-0" />
            <span>
              {resumen.docsPendientes > 0 && `${resumen.docsPendientes} doc. vencida${resumen.docsPendientes > 1 ? 's' : ''}`}
              {resumen.docsPendientes > 0 && resumen.docsPorVencer > 0 && ' · '}
              {resumen.docsPorVencer > 0 && `${resumen.docsPorVencer} por vencer`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ConjuntoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [conjunto, setConjunto] = useState<any>(null);
  const [costos, setCostos] = useState<any>(null);
  const [twinT, setTwinT] = useState<any>(null);
  const [twinS, setTwinS] = useState<any>(null);
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [inspecciones, setInspecciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'mantenimiento' | 'neumaticos' | 'documentacion' | 'inspecciones' | 'historial'>('mantenimiento');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [c, k] = await Promise.all([
          apiFetch<any>(`/fleet-ops/conjuntos/${id}`),
          apiFetch<any>(`/fleet-ops/conjuntos/${id}/costos`).catch(() => null),
        ]);
        const conj = c.conjunto;
        setConjunto(conj);
        setCostos(k);

        const [tt, ts, ots, insps] = await Promise.all([
          apiFetch<any>(`/flota/vehiculos/${conj.tractor.id}/twin`).catch(() => null),
          apiFetch<any>(`/flota/vehiculos/${conj.semi.id}/twin`).catch(() => null),
          apiFetch<any>('/maintenance/work-orders?scope=fleet').catch(() => ({ workOrders: [] })),
          apiFetch<any>('/inspecciones?limit=50').catch(() => ({ inspecciones: [] })),
        ]);
        setTwinT(tt);
        setTwinS(ts);
        const assetIds = [conj.tractor.maintenanceAssetId, conj.semi.maintenanceAssetId].filter(Boolean);
        setOrdenes((ots.workOrders || []).filter((o: any) => assetIds.includes(o.assetId)));
        const dominios = [conj.tractor.dominio, conj.semi.dominio].map((d: string) => d.toUpperCase());
        setInspecciones((insps.inspecciones || []).filter((i: any) =>
          dominios.includes((i.dominioTractor || '').toUpperCase()) || dominios.includes((i.dominioSemi || '').toUpperCase())
        ));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const desacoplar = async () => {
    setSaving(true);
    try {
      await apiFetch(`/fleet-ops/conjuntos/${id}/desacoplar`, { method: 'POST', json: {} });
      router.push('/flota-360/conjuntos');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-sm text-neutral-500">Cargando conjunto…</div>;
  if (!conjunto) return <div className="p-8 text-sm text-neutral-500">Conjunto no encontrado</div>;

  const acoplado = conjunto.estado === 'ACOPLADO';

  return (
    <div className="space-y-4">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800">
        <ChevronLeft className="h-3.5 w-3.5" /> Volver a conjuntos
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#0d1b3d] flex items-center gap-2">
            {conjunto.tractor.dominio} + {conjunto.semi.dominio}
            <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${ESTADO_COLOR[conjunto.estado] || 'bg-neutral-100'}`}>
              {ESTADO_LABEL[conjunto.estado] || conjunto.estado}
            </span>
          </h1>
          <p className="text-xs text-neutral-500">
            Conjunto operativo · acoplado el {fmtFecha(conjunto.fechaAcople)}{conjunto.ubicacion ? ` · ${conjunto.ubicacion}` : ''}
          </p>
        </div>
        {acoplado && (
          <button onClick={desacoplar} disabled={saving} className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
            <Unlink className="h-3.5 w-3.5" /> {saving ? 'Desacoplando…' : 'Desacoplar'}
          </button>
        )}
      </div>

      {/* Representación visual del acople */}
      <CoupledVisual tractor={conjunto.tractor} semi={conjunto.semi} coupled={acoplado} />
      <div className="hidden" aria-hidden="true">
        <div className="flex items-center justify-center gap-0">
          <div className={`flex items-center gap-2 rounded-l-lg border-2 px-4 py-3 ${acoplado ? 'border-blue-500 bg-blue-50' : 'border-neutral-200 bg-neutral-50'}`}>
            <Truck className="h-6 w-6 text-blue-700" />
            <div>
              <p className="text-xs font-bold text-neutral-800">{conjunto.tractor.dominio}</p>
              <p className="text-[10px] text-neutral-500">Tractor</p>
            </div>
          </div>
          <div className={`flex items-center px-2 ${acoplado ? 'text-blue-600' : 'text-neutral-300'}`}>
            <div className={`h-0.5 w-8 ${acoplado ? 'bg-blue-500' : 'bg-neutral-200'}`} />
            <Link2 className="h-4 w-4" />
            <div className={`h-0.5 w-8 ${acoplado ? 'bg-blue-500' : 'bg-neutral-200'}`} />
          </div>
          <div className={`flex items-center gap-2 rounded-r-lg border-2 px-4 py-3 ${acoplado ? 'border-blue-500 bg-blue-50' : 'border-neutral-200 bg-neutral-50'}`}>
            <Container className="h-6 w-6 text-slate-600" />
            <div>
              <p className="text-xs font-bold text-neutral-800">{conjunto.semi.dominio}</p>
              <p className="text-[10px] text-neutral-500">Semi</p>
            </div>
          </div>
        </div>
      </div>

      {/* Paneles por vehículo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <PanelVehiculo titulo="Tractor" v={conjunto.tractor} resumen={conjunto.tractorResumen} twin={twinT} icon={Truck} />
        <PanelVehiculo titulo="Semi" v={conjunto.semi} resumen={conjunto.semiResumen} twin={twinS} icon={Container} />
      </div>

      {/* Costos del conjunto */}
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-neutral-800">Costos del conjunto ({costos?.periodo || 'últimos 6 meses'})</h3>
          </div>
          {costos?.variacionVsPeriodoAnterior != null && (
            <span className={`text-xs font-semibold ${costos.variacionVsPeriodoAnterior <= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {costos.variacionVsPeriodoAnterior > 0 ? '+' : ''}{costos.variacionVsPeriodoAnterior}% vs. período anterior
            </span>
          )}
        </div>
        {!costos?.hayDatos ? (
          <p className="text-sm text-neutral-400">Sin datos suficientes para este período</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div><p className="text-neutral-500 text-xs">Tractor (OT)</p><p className="font-semibold text-neutral-900">{fmtMoney(costos.costoTractor)}</p></div>
            <div><p className="text-neutral-500 text-xs">Semi (OT)</p><p className="font-semibold text-neutral-900">{fmtMoney(costos.costoSemi)}</p></div>
            <div><p className="text-neutral-500 text-xs">Combustible</p><p className="font-semibold text-neutral-900">{fmtMoney(costos.costoCombustible)}</p></div>
            <div><p className="text-neutral-500 text-xs">Neumáticos</p><p className="font-semibold text-neutral-900">{fmtMoney(costos.costoNeumaticos)}</p></div>
            <div><p className="text-neutral-500 text-xs">Total</p><p className="font-bold text-[#0d1b3d]">{fmtMoney(costos.costoTotal)}</p></div>
          </div>
        )}
      </div>

      {/* Tabs de detalle */}
      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <div className="flex items-center gap-0.5 border-b border-neutral-200 px-1">
          {[
            { key: 'mantenimiento', label: 'Mantenimiento', n: ordenes.length },
            { key: 'neumaticos', label: 'Neumáticos', n: (conjunto.tractorResumen?.neumaticosMontados ?? 0) + (conjunto.semiResumen?.neumaticosMontados ?? 0) },
            { key: 'documentacion', label: 'Documentación', n: (conjunto.tractor.vencimientos?.length ?? 0) + (conjunto.semi.vencimientos?.length ?? 0) },
            { key: 'inspecciones', label: 'Inspecciones QR', n: inspecciones.length },
            { key: 'historial', label: 'Historial de acople', n: (conjunto.eventos || []).length },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`px-2.5 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {t.label} <span className="text-neutral-400">· {t.n}</span>
            </button>
          ))}
        </div>

        <div className="p-3">
          {tab === 'mantenimiento' && (
            <table className="w-full text-xs">
              <thead className="text-neutral-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-2 py-1.5">OT</th>
                  <th className="text-left font-medium px-2 py-1.5">Título</th>
                  <th className="text-left font-medium px-2 py-1.5">Estado</th>
                  <th className="text-left font-medium px-2 py-1.5">Programada</th>
                  <th className="text-left font-medium px-2 py-1.5">Costo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {ordenes.length === 0 && <tr><td colSpan={5} className="px-2 py-4 text-center text-neutral-400">Sin órdenes de trabajo del conjunto</td></tr>}
                {ordenes.slice(0, 15).map((o: any) => (
                  <tr key={o.id} className="hover:bg-neutral-50">
                    <td className="px-2 py-1.5 font-medium text-neutral-800">{o.code}</td>
                    <td className="px-2 py-1.5 text-neutral-600">{o.title}</td>
                    <td className="px-2 py-1.5 text-neutral-600">{ESTADO_OT_LABEL[o.status] || o.status}</td>
                    <td className="px-2 py-1.5 text-neutral-600">{fmtFecha(o.scheduledDate)}</td>
                    <td className="px-2 py-1.5 text-neutral-600">{fmtMoney(o.totalCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'neumaticos' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[{ label: 'Tractor', v: conjunto.tractor }, { label: 'Semi', v: conjunto.semi }].map(({ label, v }) => (
                <div key={label}>
                  <p className="text-xs font-semibold text-neutral-700 mb-1.5">{label} · {v.dominio}</p>
                  {(v.posicionesNeumatico || []).length === 0 ? (
                    <p className="text-xs text-neutral-400">Sin neumáticos montados registrados</p>
                  ) : (
                    <ul className="space-y-1">
                      {v.posicionesNeumatico.map((p: any) => (
                        <li key={p.id} className="flex items-center gap-2 text-xs text-neutral-600">
                          <Disc className="h-3 w-3 text-neutral-400" />
                          <span className="font-medium">{p.neumatico?.codigo || '—'}</span>
                          <span>Eje {p.eje} · {p.lado}</span>
                          {p.neumatico?.profBanda != null && <span className="text-neutral-400">{p.neumatico.profBanda}mm</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'documentacion' && (
            <table className="w-full text-xs">
              <thead className="text-neutral-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-2 py-1.5">Unidad</th>
                  <th className="text-left font-medium px-2 py-1.5">Documento</th>
                  <th className="text-left font-medium px-2 py-1.5">Vencimiento</th>
                  <th className="text-left font-medium px-2 py-1.5">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {[...((conjunto.tractor.vencimientos || []).map((d: any) => ({ ...d, unidad: conjunto.tractor.dominio }))),
                  ...((conjunto.semi.vencimientos || []).map((d: any) => ({ ...d, unidad: conjunto.semi.dominio })))]
                  .sort((a, b) => new Date(a.fechaVto).getTime() - new Date(b.fechaVto).getTime())
                  .map((d: any) => {
                    const vencido = new Date(d.fechaVto) < new Date();
                    return (
                      <tr key={d.id}>
                        <td className="px-2 py-1.5 font-medium text-neutral-800">{d.unidad}</td>
                        <td className="px-2 py-1.5 text-neutral-600">{d.tipo}</td>
                        <td className="px-2 py-1.5 text-neutral-600">{fmtFecha(d.fechaVto)}</td>
                        <td className="px-2 py-1.5">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${vencido ? 'bg-red-100 text-red-700' : 'bg-green-50 text-green-700'}`}>
                            {vencido ? 'Vencido' : 'Vigente'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                {(conjunto.tractor.vencimientos || []).length + (conjunto.semi.vencimientos || []).length === 0 && (
                  <tr><td colSpan={4} className="px-2 py-4 text-center text-neutral-400">Sin documentación registrada</td></tr>
                )}
              </tbody>
            </table>
          )}

          {tab === 'inspecciones' && (
            <table className="w-full text-xs">
              <thead className="text-neutral-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-2 py-1.5">Fecha</th>
                  <th className="text-left font-medium px-2 py-1.5">Unidad</th>
                  <th className="text-left font-medium px-2 py-1.5">Estado</th>
                  <th className="text-left font-medium px-2 py-1.5">Hallazgos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {inspecciones.length === 0 && <tr><td colSpan={4} className="px-2 py-4 text-center text-neutral-400">Sin inspecciones QR del conjunto</td></tr>}
                {inspecciones.map((i: any) => (
                  <tr key={i.id}>
                    <td className="px-2 py-1.5 text-neutral-600">{fmtFecha(i.createdAt)}</td>
                    <td className="px-2 py-1.5 font-medium text-neutral-800">{i.dominioTractor || i.dominioSemi || i.activoNombre}</td>
                    <td className="px-2 py-1.5 text-neutral-600">{i.estado}</td>
                    <td className="px-2 py-1.5">
                      {i.hallazgosCount > 0
                        ? <span className="flex items-center gap-1 text-amber-700"><AlertTriangle className="h-3 w-3" />{i.hallazgosCount}</span>
                        : <span className="text-neutral-400">0</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'historial' && (
            <table className="w-full text-xs">
              <tbody className="divide-y divide-neutral-100">
                {(conjunto.eventos || []).map((e: any) => (
                  <tr key={e.id}>
                    <td className="px-2 py-1.5 text-neutral-600">{new Date(e.fecha).toLocaleString('es-AR')}</td>
                    <td className="px-2 py-1.5">
                      <span className={`font-medium ${e.tipo === 'ACOPLE' ? 'text-green-700' : 'text-red-600'}`}>
                        {e.tipo === 'ACOPLE' ? 'Acoplado' : 'Desacoplado'}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-neutral-500">{e.ubicacion || '—'}</td>
                    <td className="px-2 py-1.5 text-neutral-500">{e.notas || ''}</td>
                  </tr>
                ))}
                {(conjunto.eventos || []).length === 0 && (
                  <tr><td className="px-2 py-4 text-center text-neutral-400">Sin eventos registrados</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
