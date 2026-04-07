'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { 
  ArrowLeft, GraduationCap, Plus, Search, Edit2, Trash2, Users, X, 
  Clock, DollarSign, BookOpen, UserPlus, CheckCircle, Clock3, XCircle 
} from 'lucide-react';
import Link from 'next/link';

interface Training {
  id: string;
  title: string;
  description?: string;
  type: 'INTERNAL' | 'EXTERNAL' | 'ONLINE' | 'WORKSHOP' | 'CERTIFICATION';
  duration?: number;
  cost?: number;
  competencyIds?: string[];
  _count?: { assignments: number };
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface TrainingAssignment {
  id: string;
  trainingId: string;
  employeeId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  assignedAt: string;
  dueDate?: string;
  completedAt?: string;
  score?: number;
  employee?: Employee;
}

const TRAINING_TYPE_LABELS: Record<string, string> = {
  INTERNAL: 'Interna',
  EXTERNAL: 'Externa',
  ONLINE: 'Online',
  WORKSHOP: 'Taller',
  CERTIFICATION: 'Certificación'
};

const TRAINING_TYPE_COLORS: Record<string, string> = {
  INTERNAL: 'bg-blue-100 text-blue-700',
  EXTERNAL: 'bg-green-100 text-green-700',
  ONLINE: 'bg-purple-100 text-purple-700',
  WORKSHOP: 'bg-orange-100 text-orange-700',
  CERTIFICATION: 'bg-red-100 text-red-700'
};

const STATUS_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  PENDING: { label: 'Pendiente', icon: Clock3, color: 'text-yellow-600' },
  IN_PROGRESS: { label: 'En Progreso', icon: Clock, color: 'text-blue-600' },
  COMPLETED: { label: 'Completado', icon: CheckCircle, color: 'text-green-600' },
  CANCELLED: { label: 'Cancelado', icon: XCircle, color: 'text-gray-600' },
  EXPIRED: { label: 'Vencido', icon: XCircle, color: 'text-red-600' }
};

export default function CapacitacionesPage() {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'INTERNAL' as 'INTERNAL' | 'EXTERNAL' | 'ONLINE' | 'WORKSHOP' | 'CERTIFICATION',
    duration: '',
    cost: ''
  });

  useEffect(() => {
    loadTrainings();
    loadEmployees();
  }, []);

  const loadTrainings = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<{ trainings: Training[] }>('/hr/trainings');
      setTrainings(res.trainings || []);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar capacitaciones');
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const res = await apiFetch<{ employees: Employee[] }>('/hr/employees');
      setEmployees(res.employees || []);
    } catch (err) {
      console.error('Error loading employees:', err);
    }
  };

  const loadAssignments = async (trainingId: string) => {
    try {
      const res = await apiFetch<{ assignments: TrainingAssignment[] }>(`/hr/trainings/${trainingId}/assignments`);
      setAssignments(res.assignments || []);
    } catch (err) {
      console.error('Error loading assignments:', err);
    }
  };

  const handleCreate = async () => {
    if (!formData.title.trim()) return;
    
    setSaving(true);
    try {
      await apiFetch('/hr/trainings', {
        method: 'POST',
        json: {
          ...formData,
          duration: formData.duration ? parseInt(formData.duration) : undefined,
          cost: formData.cost ? parseFloat(formData.cost) : undefined
        }
      });
      setShowCreateModal(false);
      resetForm();
      await loadTrainings();
    } catch (err: any) {
      setError(err?.message || 'Error al crear capacitación');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingTraining || !formData.title.trim()) return;
    
    setSaving(true);
    try {
      await apiFetch(`/trainings/${editingTraining.id}`, {
        method: 'POST', // Using POST since PUT might not be implemented
        json: {
          ...formData,
          duration: formData.duration ? parseInt(formData.duration) : undefined,
          cost: formData.cost ? parseFloat(formData.cost) : undefined
        }
      });
      setEditingTraining(null);
      setShowCreateModal(false);
      resetForm();
      await loadTrainings();
    } catch (err: any) {
      setError(err?.message || 'Error al actualizar capacitación');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta capacitación?')) return;
    
    try {
      await apiFetch(`/hr/trainings/${id}`, { method: 'DELETE' });
      await loadTrainings();
    } catch (err: any) {
      setError(err?.message || 'Error al eliminar capacitación');
    }
  };

  const handleAssign = async (employeeId: string) => {
    if (!selectedTraining) return;
    
    try {
      await apiFetch(`/hr/trainings/${selectedTraining.id}/assignments`, {
        method: 'POST',
        json: { employeeId }
      });
      await loadAssignments(selectedTraining.id);
    } catch (err: any) {
      setError(err?.message || 'Error al asignar capacitación');
    }
  };

  const handleUpdateStatus = async (assignmentId: string, status: string) => {
    try {
      await apiFetch(`/hr/trainings/assignments/${assignmentId}`, {
        method: 'PATCH',
        json: { status }
      });
      if (selectedTraining) {
        await loadAssignments(selectedTraining.id);
      }
      await loadTrainings();
    } catch (err: any) {
      setError(err?.message || 'Error al actualizar estado');
    }
  };

  const openAssignModal = (training: Training) => {
    setSelectedTraining(training);
    loadAssignments(training.id);
    setShowAssignModal(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      type: 'INTERNAL',
      duration: '',
      cost: ''
    });
  };

  const filteredTrainings = trainings.filter(t =>
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    TRAINING_TYPE_LABELS[t.type]?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/rrhh" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">Volver a RRHH</span>
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap className="h-6 w-6" />
            Capacitaciones
          </h1>
          <p className="text-gray-500 mt-1">Plan de formación y entrenamiento</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingTraining(null);
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
        >
          <Plus className="h-4 w-4" />
          Nueva Capacitación
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar capacitaciones..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
      </div>

      {/* Trainings Grid */}
      {filteredTrainings.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <GraduationCap className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay capacitaciones</h3>
          <p className="text-gray-500 mb-4">Crea la primera capacitación para comenzar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTrainings.map(training => (
            <div key={training.id} className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <span className={`px-2 py-1 text-xs rounded ${TRAINING_TYPE_COLORS[training.type]}`}>
                  {TRAINING_TYPE_LABELS[training.type]}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openAssignModal(training)}
                    className="p-1 text-gray-400 hover:text-orange-600"
                    title="Asignar empleados"
                  >
                    <UserPlus className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingTraining(training);
                      setFormData({
                        title: training.title,
                        description: training.description || '',
                        type: training.type,
                        duration: training.duration?.toString() || '',
                        cost: training.cost?.toString() || ''
                      });
                      setShowCreateModal(true);
                    }}
                    className="p-1 text-gray-400 hover:text-blue-600"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(training.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <h3 className="font-semibold text-gray-900 mb-2">{training.title}</h3>
              
              {training.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{training.description}</p>
              )}

              <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                {training.duration && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{training.duration}h</span>
                  </div>
                )}
                {training.cost && (
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    <span>${training.cost}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Users className="h-4 w-4" />
                <span>{training._count?.assignments || 0} asignados</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingTraining ? 'Editar Capacitación' : 'Nueva Capacitación'}
                </h2>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="Ej: Curso de Liderazgo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    {Object.entries(TRAINING_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="Descripción del contenido..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duración (hs)</label>
                    <input
                      type="number"
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      placeholder="Ej: 8"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Costo ($)</label>
                    <input
                      type="number"
                      value={formData.cost}
                      onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      placeholder="Ej: 500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={editingTraining ? handleUpdate : handleCreate}
                  disabled={saving || !formData.title.trim()}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : (editingTraining ? 'Actualizar' : 'Crear')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && selectedTraining && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Asignar: {selectedTraining.title}
                </h2>
                <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Current Assignments */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Asignados ({assignments.length})</h3>
                {assignments.length === 0 ? (
                  <p className="text-sm text-gray-500">No hay empleados asignados</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {assignments.map(assignment => {
                      const status = STATUS_LABELS[assignment.status];
                      const StatusIcon = status.icon;
                      return (
                        <div key={assignment.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div>
                            <p className="font-medium text-sm">
                              {assignment.employee?.firstName} {assignment.employee?.lastName}
                            </p>
                            <p className="text-xs text-gray-500">{assignment.employee?.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              value={assignment.status}
                              onChange={(e) => handleUpdateStatus(assignment.id, e.target.value)}
                              className={`text-xs border rounded px-2 py-1 ${status.color}`}
                            >
                              {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
                                <option key={key} value={key}>{label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add Assignment */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Agregar Empleado</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {employees
                    .filter(emp => !assignments.some(a => a.employeeId === emp.id))
                    .map(employee => (
                      <div key={employee.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                        <div>
                          <p className="font-medium text-sm">{employee.firstName} {employee.lastName}</p>
                          <p className="text-xs text-gray-500">{employee.email}</p>
                        </div>
                        <button
                          onClick={() => handleAssign(employee.id)}
                          className="px-3 py-1 bg-orange-100 text-orange-700 text-sm rounded hover:bg-orange-200"
                        >
                          Asignar
                        </button>
                      </div>
                    ))}
                  {employees.filter(emp => !assignments.some(a => a.employeeId === emp.id)).length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Todos los empleados están asignados
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
