'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { Plus, Calendar, FileText, AlertCircle, CheckCircle, Clock, Users, List, Trash2, BarChart2 } from 'lucide-react';
import ExportButton from '@/components/ExportButton';
import dynamic from 'next/dynamic';
const AgendaAuditorias   = dynamic(() => import('./_tabs/AgendaAuditorias'),   { ssr: false, loading: () => <div className="p-8 text-center text-gray-400 text-sm">Cargando agenda...</div> });
const CronogramaAuditorias = dynamic(() => import('./_tabs/CronogramaAuditorias'), { ssr: false, loading: () => <div className="p-8 text-center text-gray-400 text-sm">Cargando cronograma...</div> });

// Tipos
type AuditProgram = {
  id: string;
  year: number;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
};

type Audit = {
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
  objective: string | null;
};

type Stats = {
  totalPrograms: number;
  totalAudits: number;
  auditsByStatus: Record<string, number>;
  totalFindings: number;
  findingsBySeverity: Record<string, number>;
};

export default function AuditoriasPage() {
  const searchParams = useSearchParams();
  const [programs, setPrograms] = useState<AuditProgram[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialTab = (searchParams.get('tab') as 'lista' | 'agenda' | 'cronograma' | 'calendario') || 'lista';
  const [activeTab, setActiveTab] = useState<'lista' | 'agenda' | 'cronograma' | 'calendario'>(initialTab);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [programsRes, auditsRes, statsRes] = await Promise.all([
        apiFetch('/audit/programs') as Promise<{ programs: AuditProgram[] }>,
        apiFetch('/audit/audits') as Promise<{ audits: Audit[] }>,
        apiFetch('/audit/stats') as Promise<{ stats: Stats }>,
      ]);

      if (programsRes.programs) setPrograms(programsRes.programs);
      if (auditsRes.audits) setAudits(auditsRes.audits);
      if (statsRes.stats) setStats(statsRes.stats);
    } catch (err) {
      setError('Error al cargar datos de auditorías');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(auditId: string, auditCode: string) {
    if (!confirm(`¿Estás seguro de que quieres eliminar la auditoría ${auditCode}?\n\nEsta acción no se puede deshacer.`)) {
      return;
    }
    
    try {
      setError(null);
      await apiFetch(`/audit/audits/${auditId}`, { method: 'DELETE' });
      await loadData();
    } catch (err: any) {
      console.error('Error deleting audit:', err);
      setError(err?.error || 'Error al eliminar la auditoría');
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'PLANNED': return 'bg-blue-100 text-blue-800';
      case 'SCHEDULED': return 'bg-purple-100 text-purple-800';
      case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-800';
      case 'PENDING_REPORT': return 'bg-orange-100 text-orange-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'CLOSED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function getStatusLabel(status: string) {
    const labels: Record<string, string> = {
      'DRAFT': 'Borrador',
      'PLANNED': 'Planificada',
      'SCHEDULED': 'Programada',
      'IN_PROGRESS': 'En ejecución',
      'PENDING_REPORT': 'Pendiente informe',
      'COMPLETED': 'Finalizada',
      'CLOSED': 'Cerrada',
    };
    return labels[status] || status;
  }

  function getTypeLabel(type: string) {
    const labels: Record<string, string> = {
      'INTERNAL': 'Interna',
      'EXTERNAL': 'Externa',
      'SUPPLIER': 'Proveedor',
      'CUSTOMER': 'Cliente',
      'CERTIFICATION': 'Certificación',
      'RECERTIFICATION': 'Recertificación',
      'SURVEILLANCE': 'Vigilancia',
    };
    return labels[type] || type;
  }

  // Calendar helpers
  function getDaysInMonth(date: Date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    return { daysInMonth, startDayOfWeek };
  }

  function getAuditsForDate(date: Date) {
    return audits.filter(audit => {
      if (!audit.plannedStartDate) return false;
      const auditDate = new Date(audit.plannedStartDate);
      return auditDate.getUTCFullYear() === date.getFullYear() &&
             auditDate.getUTCMonth() === date.getMonth() &&
             auditDate.getUTCDate() === date.getDate();
    });
  }

  function previousMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  }

  function nextMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Módulo de Auditorías ISO</h1>
          <p className="text-gray-500">Gestión integral de programas y auditorías de calidad</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/auditorias/auditores"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
          >
            <Users className="w-4 h-4" />
            Auditores
          </Link>
          <Link
            href="/auditorias/programa"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Programa Anual
          </Link>
          <ExportButton
            outputKey="auditorias-listado"
            title="Listado de Auditorías ISO"
            moduleName="Auditorías"
            recordCount={audits.length}
            bodyHtml={`
              <table style="width:100%;border-collapse:collapse;font-size:11px;">
                <thead><tr style="background:#1e40af;color:#fff;">
                  <th style="padding:6px 8px;text-align:left;width:110px;">Código</th>
                  <th style="padding:6px 8px;text-align:left;">Proceso / Área — Referenciales</th>
                  <th style="padding:6px 8px;text-align:left;width:80px;">Tipo</th>
                  <th style="padding:6px 8px;text-align:left;width:90px;">Estado</th>
                  <th style="padding:6px 8px;text-align:left;width:150px;">Fecha y Horario</th>
                </tr></thead>
                <tbody>${audits.map((a,i)=>{
                  const normas = (a.isoStandard||[]).map(s=>s.replace(/_/g,' ')).join(', ');
                  const fechaStr = a.plannedStartDate ? new Date(a.plannedStartDate).toLocaleDateString('es-AR', { timeZone: 'UTC' }) : '—';
                  const horario = (a.plannedStartTime||a.plannedEndTime) ? `<br><span style="color:#555;font-size:10px;">${a.plannedStartTime||''}${a.plannedEndTime?' – '+a.plannedEndTime:''}</span>` : '';
                  const modalidad = a.modality ? `<span style="color:#555;font-size:10px;">${a.modality==='PRESENCIAL'?'Presencial':a.modality==='REMOTA'?'Remota':'Híbrida'}${a.auditLocation?' · '+a.auditLocation:''}</span>` : '';
                  return `<tr style="background:${i%2===0?'#fff':'#f9fafb'}">
                  <td style="padding:6px 8px;font-family:monospace;">${a.code||''}</td>
                  <td style="padding:6px 8px;">
                    <div style="font-weight:600;">${a.area||a.title||''}</div>
                    ${normas?`<div style="color:#1e40af;font-size:10px;margin-top:2px;">📋 ${normas}</div>`:''}
                    ${modalidad?`<div style="margin-top:2px;">${modalidad}</div>`:''}
                  </td>
                  <td style="padding:6px 8px;">${getTypeLabel(a.type)||''}</td>
                  <td style="padding:6px 8px;">${getStatusLabel(a.status)||''}</td>
                  <td style="padding:6px 8px;">${fechaStr}${horario}</td>
                </tr>`;}).join('')}</tbody>
              </table>
            `}
          />
          <Link
            href="/auditorias/nueva"
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva Auditoría
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto">
          {([
            { id: 'lista',      label: 'Lista de Auditorías',  Icon: List },
            { id: 'agenda',     label: 'Agenda',               Icon: FileText },
            { id: 'cronograma', label: 'Cronograma',           Icon: BarChart2 },
            { id: 'calendario', label: 'Calendario',           Icon: Calendar },
          ] as const).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`pb-4 px-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {label}
              </div>
            </button>
          ))}
        </nav>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {activeTab === 'lista' && (
        <>
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <Calendar className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Programas Activos</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalPrograms}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-yellow-50 rounded-lg">
                    <Clock className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Auditorías en Curso</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.auditsByStatus?.IN_PROGRESS || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Auditorías Completadas</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.auditsByStatus?.COMPLETED || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-red-50 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Hallazgos Críticos</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.findingsBySeverity?.CRITICAL || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Audit List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Auditorías Recientes</h2>
              <Link
                href="/auditorias/lista"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Ver todas →
              </Link>
            </div>

            <div className="divide-y divide-gray-200">
              {audits.slice(0, 5).map((audit) => (
                <div
                  key={audit.id}
                  className="flex items-center px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <Link
                    href={`/auditorias/${audit.id}`}
                    className="flex-1"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-sm font-medium text-gray-900">{audit.code}</span>
                          <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(audit.status)}`}>
                            {getStatusLabel(audit.status)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {getTypeLabel(audit.type)}
                          </span>
                        </div>
                        <h3 className="text-base font-medium text-gray-900">{audit.title}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          Área: {audit.area} • Normas: {audit.isoStandard?.join(', ') || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </Link>
                  <button
                    onClick={() => handleDelete(audit.id, audit.code)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors ml-4"
                    title="Eliminar auditoría"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}

              {audits.length === 0 && (
                <div className="px-6 py-8 text-center text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No hay auditorías registradas</p>
                  <Link
                    href="/auditorias/nueva"
                    className="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block"
                  >
                    Crear primera auditoría →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'agenda' && <AgendaAuditorias />}
      {activeTab === 'cronograma' && <CronogramaAuditorias />}

      {activeTab === 'calendario' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Calendario de Auditorías</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={previousMonth}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-medium text-gray-900 min-w-[150px] text-center">
                {currentMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={nextMonth}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {(() => {
              const { daysInMonth, startDayOfWeek } = getDaysInMonth(currentMonth);
              const days = [];

              // Empty cells for days before the first day of the month
              for (let i = 0; i < startDayOfWeek; i++) {
                days.push(<div key={`empty-${i}`} className="h-24 bg-gray-50 rounded-lg" />);
              }

              // Days of the month
              for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                const dayAudits = getAuditsForDate(date);
                const isToday = new Date().toDateString() === date.toDateString();

                days.push(
                  <div
                    key={day}
                    className={`h-24 border border-gray-100 rounded-lg p-2 overflow-hidden ${
                      isToday ? 'bg-blue-50 border-blue-200' : 'bg-white'
                    }`}
                  >
                    <div className={`text-xs font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                      {day}
                    </div>
                    <div className="space-y-1">
                      {dayAudits.slice(0, 2).map((audit) => (
                        <Link
                          key={audit.id}
                          href={`/auditorias/${audit.id}`}
                          className={`block text-xs px-1.5 py-0.5 rounded truncate ${
                            audit.status === 'PLANNED' ? 'bg-blue-100 text-blue-800' :
                            audit.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
                            audit.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}
                          title={`${audit.code} - ${audit.title}`}
                        >
                          {audit.code}
                        </Link>
                      ))}
                      {dayAudits.length > 2 && (
                        <div className="text-xs text-gray-500 px-1.5">
                          +{dayAudits.length - 2} más
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              return days;
            })()}
          </div>

          {/* Legend */}
          <div className="mt-6 flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-100 rounded" />
              <span className="text-gray-600">Planificada</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-100 rounded" />
              <span className="text-gray-600">En ejecución</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-100 rounded" />
              <span className="text-gray-600">Completada</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
