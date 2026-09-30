'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { History, ChevronDown, ChevronRight, User, Cpu, ChevronLeft } from 'lucide-react';

type Cambio = {
  campo: string;
  etiqueta: string;
  antes: unknown;
  despues: unknown;
  antesTxt: string;
  despuesTxt: string;
};

type Evento = {
  id: string;
  fuente: 'MAESTRO' | 'ESTADIO';
  fecha: string;
  accion: string;
  accionLabel: string;
  origen: string;
  origenLabel: string;
  usuarioId: string | null;
  usuarioNombre: string | null;
  dominio: string;
  tipoActivo: string;
  motivo: string | null;
  cambios: Cambio[];
  workOrderId?: string | null;
};

type Respuesta = {
  vehiculo?: { id: string; dominio: string; tipo: string };
  eventos?: Evento[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  timezone?: string;
  trazabilidadDesde?: string;
};

const ACCION_CLS: Record<string, string> = {
  ALTA: 'bg-green-100 text-green-700',
  EDICION: 'bg-blue-100 text-blue-700',
  CAMBIO_ESTADO: 'bg-amber-100 text-amber-700',
  CAMBIO_ESTADIO: 'bg-indigo-100 text-indigo-700',
  BAJA: 'bg-red-100 text-red-700',
  REACTIVACION: 'bg-emerald-100 text-emerald-700',
  ELIMINADO_PERMANENTE: 'bg-red-200 text-red-800',
};

const PAGE_SIZE = 10;

export default function HistorialCambiosPanel({ vehiculoId, refreshKey = 0 }: { vehiculoId: string; refreshKey?: number }) {
  const [data, setData] = useState<Respuesta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const cargar = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<Respuesta>(`/flota/vehiculos/${vehiculoId}/historial-cambios?page=${p}&pageSize=${PAGE_SIZE}`);
      if (res && Array.isArray(res.eventos)) {
        setData(res);
      } else {
        setData({ eventos: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 });
      }
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar el historial');
    } finally {
      setLoading(false);
    }
  }, [vehiculoId]);

  useEffect(() => { cargar(page); }, [cargar, page, refreshKey]);

  const tz = data?.timezone || 'America/Argentina/Buenos_Aires';
  const fmtFechaHora = (iso: string) =>
    new Date(iso).toLocaleString('es-AR', {
      timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  const fmtSoloFecha = (iso: string) =>
    new Date(iso).toLocaleDateString('es-AR', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric' });

  const eventos = data?.eventos ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const resumen = (e: Evento): string => {
    if (e.accion === 'ALTA') return `Se dio de alta la unidad (${e.cambios.length} datos iniciales)`;
    if (e.accion === 'ELIMINADO_PERMANENTE') return 'Se eliminó físicamente el registro de la unidad';
    if (e.accion === 'CAMBIO_ESTADIO') {
      const c = e.cambios[0];
      return `Estadío operativo → ${c?.despuesTxt ?? '—'}`;
    }
    if (e.cambios.length === 1) {
      const c = e.cambios[0];
      return `${c.etiqueta}: ${c.antesTxt} → ${c.despuesTxt}`;
    }
    if (e.cambios.length > 1) return `${e.cambios.length} campos modificados`;
    return e.accionLabel;
  };

  const esAutomatico = (e: Evento) => e.origen.startsWith('AUTOMATICO') || (!e.usuarioId && e.fuente === 'MAESTRO' && e.origen !== 'SEED_DEMO');

  return (
    <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
      <div className="px-3 py-2 border-b border-neutral-200 text-xs font-semibold text-neutral-800 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <History className="h-3.5 w-3.5 text-blue-600" /> Historial de cambios
          <span className="font-normal text-neutral-400">· registro maestro</span>
        </span>
        {total > 0 && <span className="font-normal text-neutral-400">{total} evento{total === 1 ? '' : 's'}</span>}
      </div>

      {loading && <p className="px-3 py-4 text-xs text-neutral-400">Cargando historial…</p>}
      {error && <p className="px-3 py-4 text-xs text-red-600">{error}</p>}

      {!loading && !error && eventos.length === 0 && (
        <p className="px-3 py-4 text-xs text-neutral-400">
          Sin eventos registrados.
          {data?.trazabilidadDesde && <> Trazabilidad disponible desde {fmtSoloFecha(data.trazabilidadDesde)}.</>}
        </p>
      )}

      {!loading && !error && eventos.length > 0 && (
        <>
          <div className="divide-y divide-neutral-100">
            {eventos.map((e) => {
              const abierto = !!expanded[e.id];
              return (
                <div key={e.id}>
                  <button
                    onClick={() => setExpanded((p) => ({ ...p, [e.id]: !p[e.id] }))}
                    className="w-full px-3 py-2 flex items-center gap-3 text-left hover:bg-neutral-50"
                  >
                    <span className="shrink-0 text-neutral-400">
                      {abierto ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </span>
                    <span className="w-[118px] shrink-0 text-[11px] text-neutral-500">{fmtFechaHora(e.fecha)}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${ACCION_CLS[e.accion] ?? 'bg-neutral-100 text-neutral-600'}`}>
                      {e.accionLabel}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-neutral-700">{resumen(e)}</span>
                    <span className="shrink-0 flex items-center gap-1 text-[11px] text-neutral-500">
                      {esAutomatico(e)
                        ? <><Cpu className="h-3 w-3 text-neutral-400" /> {e.origenLabel}</>
                        : <><User className="h-3 w-3 text-neutral-400" /> {e.usuarioNombre || 'Usuario no identificado'}</>}
                    </span>
                  </button>
                  {abierto && (
                    <div className="px-3 pb-3 pt-1 ml-8 mr-3 mb-1 rounded-md bg-neutral-50 border border-neutral-100">
                      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-[11px] mb-2">
                        <div><dt className="text-neutral-400">Dominio al momento</dt><dd className="font-medium text-neutral-700">{e.dominio}</dd></div>
                        <div><dt className="text-neutral-400">Tipo de activo</dt><dd className="font-medium text-neutral-700">{e.tipoActivo === 'SEMI' ? 'Semirremolque' : 'Vehículo'}</dd></div>
                        <div><dt className="text-neutral-400">Origen</dt><dd className="font-medium text-neutral-700">{e.origenLabel}</dd></div>
                        <div>
                          <dt className="text-neutral-400">Responsable</dt>
                          <dd className="font-medium text-neutral-700">
                            {esAutomatico(e) ? 'Proceso automático' : (e.usuarioNombre || 'No identificado')}
                          </dd>
                        </div>
                      </dl>
                      {e.cambios.length > 0 && (
                        <table className="w-full text-[11px] border-t border-neutral-200">
                          <thead>
                            <tr className="text-neutral-400 uppercase">
                              <th className="text-left font-medium py-1">Campo</th>
                              <th className="text-left font-medium py-1">Valor anterior</th>
                              <th className="text-left font-medium py-1">Valor nuevo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {e.cambios.map((c, i) => (
                              <tr key={`${c.campo}-${i}`} className="border-t border-neutral-100">
                                <td className="py-1 pr-2 font-medium text-neutral-700">{c.etiqueta}</td>
                                <td className="py-1 pr-2 text-neutral-500">{c.antesTxt}</td>
                                <td className="py-1 text-neutral-800">{c.despuesTxt}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      {e.motivo && (
                        <p className="mt-2 text-[11px] text-neutral-600">
                          <span className="font-medium text-neutral-700">Motivo: </span>{e.motivo}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="px-3 py-2 border-t border-neutral-200 flex items-center justify-between text-[11px] text-neutral-500">
              <span>Página {page} de {totalPages}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3 w-3" /> Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-50 disabled:opacity-40"
                >
                  Siguiente <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
