'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { Plus, Calendar, ChevronLeft, Edit2, Trash2, CheckCircle, AlertTriangle, Grid3X3 } from 'lucide-react';

type AuditProgram = {
  id: string;
  year: number;
  name: string;
  description: string | null;
  priorityBasis: string | null;
  status: 'ACTIVE' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
};

type CoverageRow = {
  processId: string;
  processName: string;
  processCode?: string;
  auditsCount: number;
  completedCount: number;
  plannedCount: number;
  audited: boolean;
  typesCovered: string[];
  shiftsCovered: string[];
  missingShifts: string[];
  lastAuditDate: string | null;
};

type CoverageData = {
  program: { id: string; year: number; name: string; priorityBasis: string | null } | null;
  matrix: CoverageRow[];
  summary: {
    totalProcesses: number;
    auditedProcesses: number;
    coveragePercent: number;
    mfgAuditedProcesses: number;
    mfgAllShiftsCovered: number;
  };
  unlinkedAudits: { id: string; code: string; title: string; process: string | null }[];
};

const SHIFT_LABELS: Record<string, string> = {
  MORNING: 'Mañana',
  AFTERNOON: 'Tarde',
  NIGHT: 'Noche',
};

const TYPE_LABELS: Record<string, string> = {
  INTERNAL: 'Interna', EXTERNAL: 'Externa', SUPPLIER: 'Proveedor', CUSTOMER: 'Cliente',
  CERTIFICATION: 'Certificación', RECERTIFICATION: 'Recertificación', SURVEILLANCE: 'Vigilancia',
  SYSTEM: 'Sistema', MANUFACTURING_PROCESS: 'Manufactura', PRODUCT: 'Producto',
};

type Audit = {
  id: string;
  code: string;
  title: string;
  type: string;
  status: string;
  plannedStartDate: string | null;
  area: string;
  isoStandard: string[];
  programId: string;
};

export default function ProgramaAnualPage() {
  const [programs, setPrograms] = useState<AuditProgram[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<AuditProgram | null>(null);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProgram, setNewProgram] = useState({ year: new Date().getFullYear(), name: '', description: '', priorityBasis: '' });
  const [coverage, setCoverage] = useState<CoverageData | null>(null);
  const [showCoverage, setShowCoverage] = useState(false);

  useEffect(() => {
    loadPrograms();
  }, []);

  async function loadPrograms() {
    try {
      setLoading(true);
      const res = await apiFetch('/audit/programs') as { programs: AuditProgram[] };
      if (res.programs) {
        setPrograms(res.programs);
        if (res.programs.length > 0 && !selectedProgram) {
          setSelectedProgram(res.programs[0]);
          loadAuditsForProgram(res.programs[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading programs:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadAuditsForProgram(programId: string) {
    try {
      const res = await apiFetch('/audit/audits') as { audits: Audit[] };
      if (res.audits) {
        setAudits(res.audits.filter(a => a.programId === programId));
      }
    } catch (err) {
      console.error('Error loading audits:', err);
    }
  }

  async function createProgram(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await apiFetch('/audit/programs', {
        method: 'POST',
        json: newProgram,
      }) as { program: AuditProgram };
      
      if (res.program) {
        setPrograms([...programs, res.program]);
        setSelectedProgram(res.program);
        setShowCreateModal(false);
        setNewProgram({ year: new Date().getFullYear(), name: '', description: '', priorityBasis: '' });
      }
    } catch (err) {
      console.error('Error creating program:', err);
    }
  }

  async function loadCoverage(year: number) {
    try {
      const res = await apiFetch(`/audit/coverage?year=${year}`) as CoverageData;
      setCoverage(res);
    } catch { setCoverage(null); }
  }

  useEffect(() => {
    if (selectedProgram) loadCoverage(selectedProgram.year);
  }, [selectedProgram?.id]);

  function getStatusColor(status: string) {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      case 'COMPLETED': return 'bg-gray-100 text-gray-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function getStatusLabel(status: string) {
    const labels: Record<string, string> = {
      'ACTIVE': 'Activo',
      'IN_PROGRESS': 'En progreso',
      'COMPLETED': 'Completado',
      'CANCELLED': 'Cancelado',
    };
    return labels[status] || status;
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
        <div className="flex items-center gap-4">
          <Link
            href="/auditorias"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Programa Anual de Auditorías</h1>
            <p className="text-gray-500">Gestión de programas anuales y planificación</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Programa
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Programas */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Programas</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {programs.map((program) => (
              <button
                key={program.id}
                onClick={() => {
                  setSelectedProgram(program);
                  loadAuditsForProgram(program.id);
                }}
                className={`w-full px-6 py-4 text-left hover:bg-gray-50 transition-colors ${
                  selectedProgram?.id === program.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900">{program.year}</span>
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(program.status)}`}>
                    {getStatusLabel(program.status)}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{program.name}</p>
              </button>
            ))}
            
            {programs.length === 0 && (
              <div className="px-6 py-8 text-center text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No hay programas creados</p>
              </div>
            )}
          </div>
        </div>

        {/* Detalle del Programa Seleccionado */}
        <div className="lg:col-span-2 space-y-6">
          {selectedProgram ? (
            <>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{selectedProgram.name}</h2>
                    <p className="text-gray-500 mt-1">Año: {selectedProgram.year}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                      <Edit2 className="w-4 h-4 text-gray-600" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
                
                {selectedProgram.description && (
                  <p className="text-gray-600 mb-4">{selectedProgram.description}</p>
                )}

                {selectedProgram.priorityBasis && (
                  <div className="mb-4 text-sm bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <span className="font-medium text-amber-800">Base de priorización (IATF 9.2.2.1): </span>
                    <span className="text-amber-900">{selectedProgram.priorityBasis}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(selectedProgram.status)}`}>
                    {getStatusLabel(selectedProgram.status)}
                  </span>
                  <button
                    onClick={() => setShowCoverage(!showCoverage)}
                    className="inline-flex items-center gap-1 px-3 py-1 text-sm border border-gray-300 rounded-full hover:bg-gray-50"
                  >
                    <Grid3X3 className="w-3.5 h-3.5" />
                    Matriz de cobertura
                  </button>
                </div>
              </div>

              {/* Matriz de cobertura proceso × año (IATF 9.2.2.1/9.2.2.2) */}
              {showCoverage && coverage && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Cobertura de procesos {coverage.program?.year}</h3>
                    <div className="flex gap-4 text-sm">
                      <span className="text-gray-600">Procesos auditados: <b>{coverage.summary.auditedProcesses}/{coverage.summary.totalProcesses}</b> ({coverage.summary.coveragePercent}%)</span>
                      <span className="text-gray-600">Manufactura con todos los turnos: <b>{coverage.summary.mfgAllShiftsCovered}/{coverage.summary.mfgAuditedProcesses}</b></span>
                    </div>
                  </div>
                  {!coverage.program && (
                    <p className="px-6 py-4 text-sm text-amber-700 bg-amber-50">No hay programa creado para este año — la matriz muestra la cobertura esperada.</p>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-600">Proceso</th>
                          <th className="px-4 py-2 text-center font-medium text-gray-600">Estado</th>
                          <th className="px-4 py-2 text-center font-medium text-gray-600">Tipos</th>
                          <th className="px-4 py-2 text-center font-medium text-gray-600">Turnos</th>
                          <th className="px-4 py-2 text-center font-medium text-gray-600">Última auditoría</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {coverage.matrix.map((row) => (
                          <tr key={row.processId} className={row.audited ? '' : 'bg-red-50/40'}>
                            <td className="px-4 py-2.5">
                              <span className="font-medium text-gray-900">{row.processCode ? `[${row.processCode}] ` : ''}{row.processName}</span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {row.audited ? (
                                <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle className="w-3.5 h-3.5" /> Auditado</span>
                              ) : row.plannedCount > 0 ? (
                                <span className="text-blue-600">Planificado ({row.plannedCount})</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-red-600"><AlertTriangle className="w-3.5 h-3.5" /> Sin cubrir</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-center text-xs text-gray-600">
                              {row.typesCovered.length ? row.typesCovered.map((t) => TYPE_LABELS[t] || t).join(', ') : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {row.typesCovered.includes('MANUFACTURING_PROCESS') ? (
                                <span className="text-xs">
                                  {row.shiftsCovered.map((s) => SHIFT_LABELS[s] || s).join(', ') || '—'}
                                  {row.missingShifts.length > 0 && (
                                    <span className="text-red-600" title="IATF 9.2.2.2: todos los turnos deben auditarse en el ciclo">
                                      {' '}(falta: {row.missingShifts.map((s) => SHIFT_LABELS[s] || s).join(', ')})
                                    </span>
                                  )}
                                </span>
                              ) : <span className="text-xs text-gray-400">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-center text-xs text-gray-600">
                              {row.lastAuditDate ? new Date(row.lastAuditDate).toLocaleDateString() : '—'}
                            </td>
                          </tr>
                        ))}
                        {coverage.matrix.length === 0 && (
                          <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No hay procesos cargados en el Mapa de Procesos</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {coverage.unlinkedAudits.length > 0 && (
                    <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-600">
                      <span className="font-medium">Auditorías sin proceso vinculado al mapa:</span>{' '}
                      {coverage.unlinkedAudits.map((a) => a.code).join(', ')}
                    </div>
                  )}
                </div>
              )}

              {/* Auditorías del Programa */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Auditorías del Programa</h3>
                  <Link
                    href="/auditorias/nueva"
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    + Agregar auditoría
                  </Link>
                </div>
                <div className="divide-y divide-gray-200">
                  {audits.length > 0 ? (
                    audits.map((audit) => (
                      <Link
                        key={audit.id}
                        href={`/auditorias/${audit.id}`}
                        className="block px-6 py-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{audit.code} - {audit.title}</p>
                            <p className="text-sm text-gray-500">
                              {audit.area} • {audit.isoStandard?.join(', ')}
                            </p>
                          </div>
                          <ChevronLeft className="w-4 h-4 text-gray-400 rotate-180" />
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="px-6 py-8 text-center text-gray-500">
                      <p>No hay auditorías en este programa</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">Selecciona un programa para ver sus detalles</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Crear Programa */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Nuevo Programa Anual</h3>
            </div>
            <form onSubmit={createProgram} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
                <input
                  type="number"
                  value={newProgram.year}
                  onChange={(e) => setNewProgram({ ...newProgram, year: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={newProgram.name}
                  onChange={(e) => setNewProgram({ ...newProgram, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={newProgram.description}
                  onChange={(e) => setNewProgram({ ...newProgram, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Base de priorización <span className="text-xs text-gray-500">(IATF 9.2.2.1)</span>
                </label>
                <textarea
                  value={newProgram.priorityBasis}
                  onChange={(e) => setNewProgram({ ...newProgram, priorityBasis: e.target.value })}
                  placeholder="Ej: frecuencia según criticidad del proceso, resultados de auditorías previas, reclamos de clientes, scorecards y cambios significativos"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Crear Programa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
