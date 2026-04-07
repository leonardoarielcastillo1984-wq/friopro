'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { Plus, Calendar, ChevronLeft, Edit2, Trash2, CheckCircle } from 'lucide-react';

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
  const [newProgram, setNewProgram] = useState({ year: new Date().getFullYear(), name: '', description: '' });

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
        setNewProgram({ year: new Date().getFullYear(), name: '', description: '' });
      }
    } catch (err) {
      console.error('Error creating program:', err);
    }
  }

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
                
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(selectedProgram.status)}`}>
                    {getStatusLabel(selectedProgram.status)}
                  </span>
                </div>
              </div>

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
