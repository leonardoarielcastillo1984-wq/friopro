'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import {
  BarChart2, Filter, ChevronLeft, ChevronRight, AlertCircle, ChevronDown, ChevronUp,
  Calendar, Clock, CheckCircle, XCircle, RefreshCw, Info,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────
type AuditRow = {
  id: string;
  code: string;
  title: string;
  type: string;
  status: string;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  plannedStartTime: string | null;
  plannedEndTime: string | null;
  area: string;
  process: string | null;
  isoStandard: string[];
  modality: string | null;
  auditLocation: string | null;
  notificationStatus: string | null;
  programId: string;
  auditedProcessOwner: string | null;
};

type Summary = {
  total: number;
  byStatus: Record<string, number>;
  planned: number;
  inProgress: number;
  completed: number;
  cancelled: number;
};

type Program = { id: string; year: number; name: string };

// ─── Constantes ───────────────────────────────────────────────────────────
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const STATUS_COLOR: Record<string, string> = {
  DRAFT:            'bg-gray-300 text-gray-700',
  PLANNED:          'bg-blue-400 text-white',
  SCHEDULED:        'bg-indigo-400 text-white',
  IN_PROGRESS:      'bg-yellow-400 text-gray-900',
  PENDING_REPORT:   'bg-orange-400 text-white',
  COMPLETED:        'bg-green-500 text-white',
  CLOSED:           'bg-gray-500 text-white',
  CANCELLED:        'bg-red-300 text-red-900 line-through opacity-60',
  RESCHEDULED:      'bg-purple-400 text-white',
};

const STATUS_BAR: Record<string, string> = {
  DRAFT:            'bg-gray-200 border-gray-300',
  PLANNED:          'bg-blue-200 border-blue-400',
  SCHEDULED:        'bg-indigo-200 border-indigo-400',
  IN_PROGRESS:      'bg-yellow-200 border-yellow-400',
  PENDING_REPORT:   'bg-orange-200 border-orange-400',
  COMPLETED:        'bg-green-200 border-green-500',
  CLOSED:           'bg-gray-300 border-gray-400',
  CANCELLED:        'bg-red-100 border-red-300 opacity-50',
  RESCHEDULED:      'bg-purple-200 border-purple-400',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador', PLANNED: 'Planificada', SCHEDULED: 'Programada',
  IN_PROGRESS: 'En ejecución', PENDING_REPORT: 'Pendiente informe',
  COMPLETED: 'Finalizada', CLOSED: 'Cerrada', CANCELLED: 'Cancelada',
  RESCHEDULED: 'Reprogramada',
};

const MODALITY_LABELS: Record<string, string> = {
  PRESENCIAL: 'Presencial', REMOTA: 'Remota', HIBRIDA: 'Híbrida',
};

const TYPE_LABELS: Record<string, string> = {
  INTERNAL: 'Interna', EXTERNAL: 'Externa', SUPPLIER: 'Proveedor',
  CUSTOMER: 'Cliente', CERTIFICATION: 'Certificación',
  RECERTIFICATION: 'Recertificación', SURVEILLANCE: 'Vigilancia',
};

// ─── Helpers ──────────────────────────────────────────────────────────────
function getMonthRange(dateStr: string | null): { month: number; day: number } | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return { month: d.getMonth(), day: d.getDate() };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function formatDateShort(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

// ─── Componente: Barra Gantt por auditoría ────────────────────────────────
function GanttBar({ audit, year }: { audit: AuditRow; year: number }) {
  const start = getMonthRange(audit.plannedStartDate);
  const end   = getMonthRange(audit.plannedEndDate || audit.plannedStartDate);
  if (!start) return null;

  const endResolved = end || start;

  // Calcula left% y width% sobre 12 meses
  const totalDays = 365;
  const startDay = start.month * 30 + start.day; // approx
  const endDay   = endResolved.month * 30 + endResolved.day;
  const leftPct  = (startDay / totalDays) * 100;
  const widthPct = Math.max(((endDay - startDay + 1) / totalDays) * 100, 0.5);

  const barClass = STATUS_BAR[audit.status] || 'bg-blue-100 border-blue-300';

  return (
    <div
      className={`absolute top-1 bottom-1 rounded border ${barClass} flex items-center px-1.5 overflow-hidden text-xs font-medium whitespace-nowrap cursor-pointer transition-opacity hover:opacity-80`}
      style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: '2px' }}
      title={`${audit.code} — ${audit.title}\n${formatDateShort(audit.plannedStartDate)} ${audit.plannedEndDate && audit.plannedEndDate !== audit.plannedStartDate ? `→ ${formatDateShort(audit.plannedEndDate)}` : ''}`}
    >
      <Link href={`/auditorias/${audit.id}`} className="block truncate w-full">
        {widthPct > 3 ? audit.code : ''}
      </Link>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────
export default function CronogramaAuditorias() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ status: '', programId: '', type: '' });
  const [hoveredAudit, setHoveredAudit] = useState<AuditRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ year: String(year) });
      if (filters.programId) params.set('programId', filters.programId);
      if (filters.status)    params.set('status', filters.status);

      const [cronRes, programsRes] = await Promise.all([
        apiFetch(`/audit/cronograma?${params.toString()}`) as Promise<{ audits: AuditRow[]; summary: Summary; programs: Program[] }>,
        apiFetch('/audit/programs') as Promise<{ programs: Program[] }>,
      ]);

      let rows = Array.isArray(cronRes?.audits) ? cronRes.audits : [];
      if (filters.type) rows = rows.filter(a => a.type === filters.type);
      setAudits(rows);
      setSummary(cronRes?.summary || null);
      setPrograms(Array.isArray(programsRes?.programs) ? programsRes.programs : []);
    } catch (err) {
      setError('Error al cargar el cronograma');
    } finally {
      setLoading(false);
    }
  }, [year, filters]);

  useEffect(() => { load(); }, [load]);

  // ── Calcular celdas por mes para la tabla de detalle ──────────────────
  const monthColumns = MONTHS.map((name, idx) => {
    const auditsInMonth = audits.filter(a => {
      const s = getMonthRange(a.plannedStartDate);
      const e = getMonthRange(a.plannedEndDate || a.plannedStartDate);
      if (!s) return false;
      const startMonth = s.month;
      const endMonth   = e ? e.month : startMonth;
      return idx >= startMonth && idx <= endMonth;
    });
    return { name, idx, audits: auditsInMonth };
  });

  // ── Meses con auditorías ──────────────────────────────────────────────
  const activeMonths = monthColumns.filter(m => m.audits.length > 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Cronograma de Auditorías</h2>
          <p className="text-sm text-gray-500">Vista anual del programa de auditorías</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Navegación de año */}
          <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setYear(y => y - 1)} className="px-3 py-2 hover:bg-gray-50 text-gray-600 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-4 py-2 font-semibold text-gray-900 text-sm">{year}</span>
            <button onClick={() => setYear(y => y + 1)} className="px-3 py-2 hover:bg-gray-50 text-gray-600 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Filtros */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Programa</label>
              <select value={filters.programId} onChange={e => setFilters({ ...filters, programId: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm">
                <option value="">Todos</option>
                {programs.filter(p => p.year === year).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
              <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm">
                <option value="">Todos</option>
                {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
              <select value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm">
                <option value="">Todos</option>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <button onClick={() => setFilters({ status: '', programId: '', type: '' })}
            className="mt-2 text-xs text-gray-400 hover:text-gray-600">Limpiar filtros</button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4" />{error}
        </div>
      )}

      {/* KPIs */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: summary.total, icon: BarChart2, color: 'text-gray-700 bg-gray-50' },
            { label: 'Planificadas', value: summary.planned, icon: Calendar, color: 'text-blue-700 bg-blue-50' },
            { label: 'Completadas', value: summary.completed, icon: CheckCircle, color: 'text-green-700 bg-green-50' },
            { label: 'Canceladas', value: summary.cancelled, icon: XCircle, color: 'text-red-700 bg-red-50' },
          ].map(kpi => (
            <div key={kpi.label} className={`${kpi.color} rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3`}>
              <kpi.icon className="w-5 h-5 opacity-70" />
              <div>
                <p className="text-xl font-bold">{kpi.value}</p>
                <p className="text-xs opacity-70">{kpi.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
        </div>
      ) : audits.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay auditorías programadas para {year}.</p>
          <Link href="/auditorias/nueva" className="mt-3 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
            + Crear primera auditoría
          </Link>
        </div>
      ) : (
        <>
          {/* ── VISTA GANTT ─────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Vista Gantt — {year}</h3>
              <span className="text-xs text-gray-400">{audits.length} auditoría{audits.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="overflow-x-auto">
              <div style={{ minWidth: '900px' }}>
                {/* Cabecera meses */}
                <div className="flex border-b border-gray-100">
                  <div className="w-48 flex-shrink-0 px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-r border-gray-100">Auditoría</div>
                  <div className="flex-1 flex">
                    {MONTHS.map((m, idx) => (
                      <div key={idx} className="flex-1 text-center py-2 text-xs font-semibold text-gray-500 border-r border-gray-100 last:border-r-0 bg-gray-50">
                        {m}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Filas */}
                {audits.map(audit => (
                  <div
                    key={audit.id}
                    className="flex border-b border-gray-50 hover:bg-gray-50 transition-colors"
                    onMouseEnter={() => setHoveredAudit(audit)}
                    onMouseLeave={() => setHoveredAudit(null)}
                  >
                    {/* Info lateral */}
                    <div className="w-48 flex-shrink-0 px-3 py-2 border-r border-gray-100">
                      <Link href={`/auditorias/${audit.id}`} className="text-xs font-semibold text-blue-700 hover:underline block truncate">
                        {audit.code}
                      </Link>
                      <p className="text-xs text-gray-500 truncate leading-tight">{audit.area}</p>
                      <span className={`mt-0.5 inline-block px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[audit.status] || 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABELS[audit.status] || audit.status}
                      </span>
                    </div>

                    {/* Celda Gantt */}
                    <div className="flex-1 flex relative">
                      {/* Grid de meses */}
                      {MONTHS.map((_, idx) => (
                        <div key={idx} className="flex-1 border-r border-gray-50 last:border-r-0 min-h-[44px]" />
                      ))}
                      {/* Barra */}
                      <GanttBar audit={audit} year={year} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tooltip de auditoría seleccionada */}
          {hoveredAudit && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm animate-in fade-in duration-150">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-semibold text-blue-900">{hoveredAudit.code} — {hoveredAudit.title}</p>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-blue-700">
                    <span>📋 {hoveredAudit.area}{hoveredAudit.process ? ` / ${hoveredAudit.process}` : ''}</span>
                    {hoveredAudit.plannedStartDate && <span>📅 {formatDateShort(hoveredAudit.plannedStartDate)}{hoveredAudit.plannedEndDate && hoveredAudit.plannedEndDate !== hoveredAudit.plannedStartDate ? ` → ${formatDateShort(hoveredAudit.plannedEndDate)}` : ''}</span>}
                    {hoveredAudit.plannedStartTime && <span>🕐 {hoveredAudit.plannedStartTime}{hoveredAudit.plannedEndTime ? ` – ${hoveredAudit.plannedEndTime}` : ''}</span>}
                    {hoveredAudit.modality && <span>🏢 {MODALITY_LABELS[hoveredAudit.modality]}</span>}
                    {hoveredAudit.auditedProcessOwner && <span>👤 {hoveredAudit.auditedProcessOwner}</span>}
                    {hoveredAudit.isoStandard?.length > 0 && <span>📌 {hoveredAudit.isoStandard.join(', ')}</span>}
                  </div>
                </div>
                <Link href={`/auditorias/${hoveredAudit.id}`}
                  className="flex-shrink-0 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
                  Ver detalle
                </Link>
              </div>
            </div>
          )}

          {/* ── TABLA MENSUAL ────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Distribución mensual</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {MONTHS.map((m, idx) => (
                      <th key={idx} className={`px-2 py-2 text-center font-semibold text-gray-500 border-r border-gray-100 last:border-0 ${monthColumns[idx].audits.length > 0 ? 'bg-blue-50 text-blue-700' : ''}`}>
                        {m}
                        {monthColumns[idx].audits.length > 0 && (
                          <span className="block mt-0.5 text-blue-500">{monthColumns[idx].audits.length}</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {monthColumns.map(({ idx, audits: monthAudits }) => (
                      <td key={idx} className="px-1 py-1 align-top border-r border-gray-50 last:border-0 min-h-[40px]">
                        {monthAudits.map(a => (
                          <Link key={a.id} href={`/auditorias/${a.id}`}
                            className={`block mb-1 px-1.5 py-0.5 rounded text-xs font-medium truncate max-w-[80px] ${STATUS_COLOR[a.status] || 'bg-gray-100 text-gray-700'}`}
                            title={`${a.code} — ${a.title}`}>
                            {a.code}
                          </Link>
                        ))}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── LEYENDA ──────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-3 text-xs">
            {Object.entries(STATUS_LABELS).map(([status, label]) => (
              <div key={status} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded-sm ${STATUS_BAR[status]?.split(' ')[0] || 'bg-gray-200'}`} />
                <span className="text-gray-500">{label} ({summary?.byStatus?.[status] || 0})</span>
              </div>
            ))}
          </div>

          {/* ── LISTADO DETALLADO ─────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Listado completo — {year}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Código</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Auditoría</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Inicio</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Fin</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Horario</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Área</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Modalidad</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Estado</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Normas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {audits.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <Link href={`/auditorias/${a.id}`} className="font-mono text-xs font-semibold text-blue-700 hover:underline">{a.code}</Link>
                      </td>
                      <td className="px-4 py-2.5 max-w-[200px]">
                        <p className="text-xs font-medium text-gray-900 truncate">{a.title}</p>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-600">{TYPE_LABELS[a.type] || a.type}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-700 whitespace-nowrap">{formatDateShort(a.plannedStartDate)}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-700 whitespace-nowrap">{formatDateShort(a.plannedEndDate)}</td>
                      <td className="px-4 py-2.5 text-xs font-mono text-gray-600 whitespace-nowrap">
                        {a.plannedStartTime && a.plannedEndTime ? `${a.plannedStartTime}–${a.plannedEndTime}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-600">{a.area}</td>
                      <td className="px-4 py-2.5 text-xs">
                        {a.modality ? (
                          <span className={`px-1.5 py-0.5 rounded-full font-medium ${a.modality === 'PRESENCIAL' ? 'bg-green-100 text-green-700' : a.modality === 'REMOTA' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                            {MODALITY_LABELS[a.modality]}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[a.status] || 'bg-gray-100 text-gray-700'}`}>
                          {STATUS_LABELS[a.status] || a.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{a.isoStandard?.join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
