'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { 
  ArrowLeft, Briefcase, Plus, Search, Edit2, Trash2, Users, X, Check, 
  Star, Target, GraduationCap, AlertCircle, UserCheck
} from 'lucide-react';
import Link from 'next/link';

interface Position {
  id: string;
  name: string;
  code?: string;
  category?: string;
  level?: string;
  objective?: string;
  responsibilities?: string[];
  requirements?: string[];
  _count?: { employees: number };
}

interface Competency {
  id: string;
  name: string;
  category: string;
  description?: string;
  levels?: string[];
}

interface PositionCompetency {
  id: string;
  positionId: string;
  competencyId: string;
  requiredLevel: number;
  competency: Competency;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  positionId?: string;
}

interface EmployeeCompetency {
  id: string;
  employeeId: string;
  competencyId: string;
  currentLevel: number;
  competency: Competency;
}

const LEVEL_COLORS = [
  'bg-red-100 text-red-700',      // Level 1
  'bg-orange-100 text-orange-700', // Level 2
  'bg-yellow-100 text-yellow-700',   // Level 3
  'bg-blue-100 text-blue-700',       // Level 4
  'bg-green-100 text-green-700'      // Level 5
];

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCompetenciesModal, setShowCompetenciesModal] = useState(false);
  const [showGapModal, setShowGapModal] = useState(false);
  const [showCreateTrainingModal, setShowCreateTrainingModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedGap, setSelectedGap] = useState<{competency: Competency, requiredLevel: number, currentLevel: number} | null>(null);
  const [positionCompetencies, setPositionCompetencies] = useState<PositionCompetency[]>([]);
  const [employeeCompetencies, setEmployeeCompetencies] = useState<EmployeeCompetency[]>([]);
  const [saving, setSaving] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: '',
    level: '',
    objective: '',
    responsibilities: [] as string[],
    requirements: [] as string[]
  });

  const [competencyForm, setCompetencyForm] = useState({
    competencyId: '',
    requiredLevel: 3
  });

  const [trainingForm, setTrainingForm] = useState({
    title: '',
    description: '',
    type: 'INTERNAL' as const,
    duration: '',
    cost: ''
  });

  useEffect(() => {
    loadPositions();
    loadCompetencies();
    loadEmployees();
  }, []);

  const loadPositions = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<{ positions: Position[] }>('/hr/positions');
      setPositions(res.positions || []);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar puestos');
    } finally {
      setLoading(false);
    }
  };

  const loadCompetencies = async () => {
    try {
      const res = await apiFetch<{ competencies: Competency[] }>('/hr/competencies');
      setCompetencies(res.competencies || []);
    } catch (err) {
      console.error('Error loading competencies:', err);
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

  const loadPositionCompetencies = async (positionId: string) => {
    try {
      const res = await apiFetch<{ positionCompetencies: PositionCompetency[] }>(`/hr/positions/${positionId}/competencies`);
      setPositionCompetencies(res.positionCompetencies || []);
    } catch (err) {
      console.error('Error loading position competencies:', err);
    }
  };

  const loadEmployeeCompetencies = async (employeeId: string) => {
    try {
      const res = await apiFetch<{ competencies: EmployeeCompetency[] }>(`/hr/employees/${employeeId}/competencies`);
      setEmployeeCompetencies(res.competencies || []);
    } catch (err) {
      console.error('Error loading employee competencies:', err);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) return;
    
    setSaving(true);
    try {
      await apiFetch('/positions', {
        method: 'POST',
        json: formData
      });
      setShowCreateModal(false);
      resetForm();
      await loadPositions();
    } catch (err: any) {
      setError(err?.message || 'Error al crear puesto');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingPosition || !formData.name.trim()) return;
    
    setSaving(true);
    try {
      await apiFetch(`/hr/positions/${editingPosition.id}`, {
        method: 'PUT',
        json: formData
      });
      setEditingPosition(null);
      resetForm();
      await loadPositions();
    } catch (err: any) {
      setError(err?.message || 'Error al actualizar puesto');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este puesto?')) return;
    
    try {
      await apiFetch(`/hr/positions/${id}`, { method: 'DELETE' });
      await loadPositions();
    } catch (err: any) {
      setError(err?.message || 'Error al eliminar puesto');
    }
  };

  const handleAddCompetency = async () => {
    if (!selectedPosition || !competencyForm.competencyId) return;
    
    setSaving(true);
    try {
      await apiFetch(`/hr/positions/${selectedPosition.id}/competencies`, {
        method: 'POST',
        json: competencyForm
      });
      setCompetencyForm({ competencyId: '', requiredLevel: 3 });
      await loadPositionCompetencies(selectedPosition.id);
    } catch (err: any) {
      setError(err?.message || 'Error al agregar competencia');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveCompetency = async (id: string) => {
    if (!confirm('¿Eliminar esta competencia del puesto?')) return;
    
    try {
      await apiFetch(`/hr/positions/competencies/${id}`, { method: 'DELETE' });
      if (selectedPosition) {
        await loadPositionCompetencies(selectedPosition.id);
      }
    } catch (err: any) {
      setError(err?.message || 'Error al eliminar competencia');
    }
  };

  const openCompetenciesModal = (position: Position) => {
    setSelectedPosition(position);
    loadPositionCompetencies(position.id);
    setShowCompetenciesModal(true);
  };

  const openGapModal = (position: Position, employee: Employee) => {
    setSelectedPosition(position);
    setSelectedEmployee(employee);
    loadPositionCompetencies(position.id);
    loadEmployeeCompetencies(employee.id);
    setShowGapModal(true);
  };

  const openCreateTrainingFromGap = (competency: Competency, requiredLevel: number, currentLevel: number) => {
    setSelectedGap({ competency, requiredLevel, currentLevel });
    setTrainingForm({
      title: `Capacitación: ${competency.name}`,
      description: `Formación para alcanzar el nivel ${requiredLevel} en ${competency.name}. Nivel actual: ${currentLevel}.`,
      type: 'INTERNAL',
      duration: '',
      cost: ''
    });
    setShowCreateTrainingModal(true);
  };

  const handleCreateTraining = async () => {
    if (!trainingForm.title.trim()) return;
    
    setSaving(true);
    try {
      await apiFetch('/trainings', {
        method: 'POST',
        json: {
          ...trainingForm,
          duration: trainingForm.duration ? parseInt(trainingForm.duration) : undefined,
          cost: trainingForm.cost ? parseFloat(trainingForm.cost) : undefined,
          competencyIds: selectedGap ? [selectedGap.competency.id] : undefined
        }
      });
      setShowCreateTrainingModal(false);
      setTrainingForm({ title: '', description: '', type: 'INTERNAL', duration: '', cost: '' });
      setSelectedGap(null);
      alert('Capacitación creada exitosamente');
    } catch (err: any) {
      setError(err?.message || 'Error al crear capacitación');
    } finally {
      setSaving(false);
    }
  };

  // Calculate gap between required and actual
  const calculateGap = () => {
    const gaps: Array<{
      positionCompetency: PositionCompetency;
      employeeCompetency?: EmployeeCompetency;
      gap: number;
      status: 'gap' | 'meets' | 'exceeds';
    }> = [];

    positionCompetencies.forEach(pc => {
      const ec = employeeCompetencies.find(e => e.competencyId === pc.competencyId);
      const actualLevel = ec?.currentLevel || 0;
      const gap = pc.requiredLevel - actualLevel;
      
      gaps.push({
        positionCompetency: pc,
        employeeCompetency: ec,
        gap,
        status: gap > 0 ? 'gap' : gap < 0 ? 'exceeds' : 'meets'
      });
    });

    return gaps;
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      category: '',
      level: '',
      objective: '',
      responsibilities: [],
      requirements: []
    });
  };

  const addArrayItem = (field: 'responsibilities' | 'requirements', value: string) => {
    if (value.trim()) {
      setFormData(prev => ({ ...prev, [field]: [...prev[field], value.trim()] }));
    }
  };

  const removeArrayItem = (field: 'responsibilities' | 'requirements', index: number) => {
    setFormData(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));
  };

  const filteredPositions = positions.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const positionEmployees = (positionId: string) => employees.filter(e => e.positionId === positionId);

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
            <Briefcase className="h-6 w-6" />
            Perfiles de Puesto
          </h1>
          <p className="text-gray-500 mt-1">Definición y gestión de perfiles laborales</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingPosition(null);
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nuevo Puesto
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
          placeholder="Buscar puestos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Positions Grid */}
      {filteredPositions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Briefcase className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay puestos definidos</h3>
          <p className="text-gray-500 mb-4">Crea el primer perfil de puesto para comenzar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPositions.map(position => (
            <div key={position.id} className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{position.name}</h3>
                  {position.code && (
                    <p className="text-sm text-gray-500">{position.code}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => {
                      setEditingPosition(position);
                      setFormData({
                        name: position.name,
                        code: position.code || '',
                        category: position.category || '',
                        level: position.level || '',
                        objective: position.objective || '',
                        responsibilities: position.responsibilities || [],
                        requirements: position.requirements || []
                      });
                      setShowCreateModal(true);
                    }}
                    className="p-1 text-gray-400 hover:text-blue-600"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(position.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                {position.category && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                    {position.category}
                  </span>
                )}
                {position.level && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                    {position.level}
                  </span>
                )}
              </div>

              {position.objective && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{position.objective}</p>
              )}

              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Users className="h-4 w-4" />
                <span>{position._count?.employees || 0} empleados</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingPosition ? 'Editar Puesto' : 'Nuevo Puesto'}
                </h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Gerente de Ventas"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Ej: GER-001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Ej: Gerencia"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nivel</label>
                  <input
                    type="text"
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Senior"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Objetivo</label>
                  <textarea
                    value={formData.objective}
                    onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Descripción del objetivo del puesto..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Responsabilidades</label>
                  <div className="space-y-2">
                    {formData.responsibilities.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2 rounded">
                        <Check className="h-4 w-4 text-green-500" />
                        <span className="flex-1 text-sm">{item}</span>
                        <button
                          onClick={() => removeArrayItem('responsibilities', idx)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <input
                      type="text"
                      placeholder="Agregar responsabilidad..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          addArrayItem('responsibilities', e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Requisitos</label>
                  <div className="space-y-2">
                    {formData.requirements.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2 rounded">
                        <Check className="h-4 w-4 text-blue-500" />
                        <span className="flex-1 text-sm">{item}</span>
                        <button
                          onClick={() => removeArrayItem('requirements', idx)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <input
                      type="text"
                      placeholder="Agregar requisito..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          addArrayItem('requirements', e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
                  onClick={editingPosition ? handleUpdate : handleCreate}
                  disabled={saving || !formData.name.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : (editingPosition ? 'Actualizar' : 'Crear')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
