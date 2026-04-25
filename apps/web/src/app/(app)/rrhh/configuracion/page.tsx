'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Settings, Building, Briefcase, FileText, GraduationCap, Brain,
  Plus, Edit2, Trash2, X, Save, ChevronDown, ChevronRight,
  Users, Clock, Award, Target
} from 'lucide-react';

interface Department {
  id: string;
  name: string;
  description?: string;
  color: string;
  _count?: { employees: number };
}

interface PositionCategory {
  id: string;
  name: string;
  description?: string;
  level: string;
}

interface ContractType {
  id: string;
  name: string;
  description?: string;
  duration?: string;
}

interface CompetencyLevel {
  level: number;
  name: string;
  description: string;
}

interface TrainingCategory {
  id: string;
  name: string;
  description?: string;
  standard?: string;
}

const DEFAULT_COMPETENCY_LEVELS: CompetencyLevel[] = [
  { level: 1, name: 'Básico', description: 'Conocimiento fundamental, requiere supervisión constante' },
  { level: 2, name: 'Intermedio', description: 'Puede trabajar con supervisión ocasional' },
  { level: 3, name: 'Avanzado', description: 'Trabaja independientemente, resuelve problemas complejos' },
  { level: 4, name: 'Experto', description: 'Referente técnico, guía a otros' },
];

const DEFAULT_CONTRACT_TYPES: ContractType[] = [
  { id: '1', name: 'Permanente', description: 'Relación laboral indefinida', duration: 'Indefinido' },
  { id: '2', name: 'Temporal', description: 'Por temporada o proyecto', duration: '6-12 meses' },
  { id: '3', name: 'Contrato', description: 'Por obra o servicio específico', duration: 'Proyecto' },
  { id: '4', name: 'Prácticas', description: 'Pasantías o prácticas profesionales', duration: '3-6 meses' },
  { id: '5', name: 'Freelance', description: 'Trabajo independiente', duration: 'Por proyecto' },
];

const DEFAULT_TRAINING_CATEGORIES: TrainingCategory[] = [
  { id: '1', name: 'Seguridad', description: 'Seguridad industrial y prevención de riesgos', standard: 'ISO 45001' },
  { id: '2', name: 'Calidad', description: 'Sistemas de gestión de calidad', standard: 'ISO 9001' },
  { id: '3', name: 'Ambiente', description: 'Gestión ambiental y sostenibilidad', standard: 'ISO 14001' },
  { id: '4', name: 'Seguridad Vial', description: 'Conducción segura y prevención', standard: 'ISO 39001' },
  { id: '5', name: 'Normativo', description: 'Cumplimiento normativo y legal', standard: 'Varios' },
  { id: '6', name: 'Técnico', description: 'Habilidades técnicas específicas', standard: 'N/A' },
  { id: '7', name: 'Liderazgo', description: 'Desarrollo de habilidades directivas', standard: 'N/A' },
  { id: '8', name: 'Primeros Auxilios', description: 'Respuesta a emergencias médicas', standard: 'ISO 45001' },
];

export default function ConfiguracionRRHHPage() {
  const [activeTab, setActiveTab] = useState<'departments' | 'positions' | 'contracts' | 'competencyLevels' | 'competencies' | 'training'>('departments');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positionCategories, setPositionCategories] = useState<PositionCategory[]>([]);
  const [contractTypes, setContractTypes] = useState<ContractType[]>(DEFAULT_CONTRACT_TYPES);
  const [competencyLevels, setCompetencyLevels] = useState<CompetencyLevel[]>(DEFAULT_COMPETENCY_LEVELS);
  const [trainingCategories, setTrainingCategories] = useState<TrainingCategory[]>(DEFAULT_TRAINING_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Forms
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [showPosCatForm, setShowPosCatForm] = useState(false);
  const [showContractForm, setShowContractForm] = useState(false);
  const [showTrainingCatForm, setShowTrainingCatForm] = useState(false);
  
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editingPosCat, setEditingPosCat] = useState<PositionCategory | null>(null);
  const [editingContract, setEditingContract] = useState<ContractType | null>(null);
  const [editingTrainingCat, setEditingTrainingCat] = useState<TrainingCategory | null>(null);

  // Form states
  const [deptForm, setDeptForm] = useState({ name: '', description: '', color: '#3B82F6' });
  const [posCatForm, setPosCatForm] = useState({ name: '', description: '', level: '' });
  const [contractForm, setContractForm] = useState({ name: '', description: '', duration: '' });
  const [trainingCatForm, setTrainingCatForm] = useState({ name: '', description: '', standard: '' });

  // Competencies
  const [competenciesList, setCompetenciesList] = useState<{id: string; name: string; category: string; description?: string}[]>([]);
  const [showCompetencyForm, setShowCompetencyForm] = useState(false);
  const [editingCompetency, setEditingCompetency] = useState<{id: string; name: string; category: string; description?: string} | null>(null);
  const [competencyForm, setCompetencyForm] = useState({ name: '', category: '', description: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load departments
      const deptRes = await apiFetch<{ departments: Department[] }>('/hr/departments');
      setDepartments(deptRes.departments || []);
      
      // Load position categories
      const posRes = await apiFetch<{ positions: any[] }>('/hr/positions');
      // Extract unique categories from positions
      const categories = [...new Set(posRes.positions?.map(p => p.category) || [])];
      setPositionCategories(categories.map((cat, idx) => ({
        id: String(idx),
        name: cat,
        description: '',
        level: ''
      })));

      // Load competencies
      try {
        const compRes = await apiFetch<{ competencies: any[] }>('/hr/competencies');
        setCompetenciesList(compRes.competencies || []);
      } catch (err) {
        setCompetenciesList([]);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Competency handlers
  const handleCreateCompetency = async () => {
    if (!competencyForm.name) return;
    try {
      await apiFetch('/hr/competencies', {
        method: 'POST',
        json: competencyForm,
      });
      setCompetencyForm({ name: '', category: '', description: '' });
      setShowCompetencyForm(false);
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleUpdateCompetency = async () => {
    if (!editingCompetency || !competencyForm.name) return;
    try {
      await apiFetch(`/hr/competencies/${editingCompetency.id}`, {
        method: 'PUT',
        json: competencyForm,
      });
      setEditingCompetency(null);
      setCompetencyForm({ name: '', category: '', description: '' });
      setShowCompetencyForm(false);
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteCompetency = async (id: string) => {
    if (!confirm('¿Eliminar esta competencia?')) return;
    try {
      await apiFetch(`/hr/competencies/${id}`, { method: 'DELETE' });
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Department handlers
  const handleCreateDept = async () => {
    if (!deptForm.name) return;
    try {
      await apiFetch('/hr/departments', {
        method: 'POST',
        json: deptForm,
      });
      setDeptForm({ name: '', description: '', color: '#3B82F6' });
      setShowDeptForm(false);
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleUpdateDept = async () => {
    if (!editingDept || !deptForm.name) return;
    try {
      await apiFetch(`/hr/departments/${editingDept.id}`, {
        method: 'PUT',
        json: deptForm,
      });
      setEditingDept(null);
      setDeptForm({ name: '', description: '', color: '#3B82F6' });
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteDept = async (id: string) => {
    if (!confirm('¿Eliminar este departamento?')) return;
    try {
      await apiFetch(`/hr/departments/${id}`, { method: 'DELETE' });
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Position category handlers (local state only - no API)
  const handleCreatePosCat = () => {
    if (!posCatForm.name) return;
    const newCat: PositionCategory = {
      id: Date.now().toString(),
      ...posCatForm,
    };
    setPositionCategories([...positionCategories, newCat]);
    setPosCatForm({ name: '', description: '', level: '' });
    setShowPosCatForm(false);
  };

  const handleUpdatePosCat = () => {
    if (!editingPosCat || !posCatForm.name) return;
    setPositionCategories(positionCategories.map(c => 
      c.id === editingPosCat.id ? { ...c, ...posCatForm } : c
    ));
    setEditingPosCat(null);
    setPosCatForm({ name: '', description: '', level: '' });
  };

  const handleDeletePosCat = (id: string) => {
    if (!confirm('¿Eliminar esta categoría?')) return;
    setPositionCategories(positionCategories.filter(c => c.id !== id));
  };

  // Contract type handlers
  const handleCreateContract = () => {
    if (!contractForm.name) return;
    const newContract: ContractType = {
      id: Date.now().toString(),
      ...contractForm,
    };
    setContractTypes([...contractTypes, newContract]);
    setContractForm({ name: '', description: '', duration: '' });
    setShowContractForm(false);
  };

  const handleUpdateContract = () => {
    if (!editingContract || !contractForm.name) return;
    setContractTypes(contractTypes.map(c => 
      c.id === editingContract.id ? { ...c, ...contractForm } : c
    ));
    setEditingContract(null);
    setContractForm({ name: '', description: '', duration: '' });
  };

  const handleDeleteContract = (id: string) => {
    if (!confirm('¿Eliminar este tipo de contrato?')) return;
    setContractTypes(contractTypes.filter(c => c.id !== id));
  };

  // Training category handlers
  const handleCreateTrainingCat = () => {
    if (!trainingCatForm.name) return;
    const newCat: TrainingCategory = {
      id: Date.now().toString(),
      ...trainingCatForm,
    };
    setTrainingCategories([...trainingCategories, newCat]);
    setTrainingCatForm({ name: '', description: '', standard: '' });
    setShowTrainingCatForm(false);
  };

  const handleUpdateTrainingCat = () => {
    if (!editingTrainingCat || !trainingCatForm.name) return;
    setTrainingCategories(trainingCategories.map(c => 
      c.id === editingTrainingCat.id ? { ...c, ...trainingCatForm } : c
    ));
    setEditingTrainingCat(null);
    setTrainingCatForm({ name: '', description: '', standard: '' });
  };

  const handleDeleteTrainingCat = (id: string) => {
    if (!confirm('¿Eliminar esta categoría de capacitación?')) return;
    setTrainingCategories(trainingCategories.filter(c => c.id !== id));
  };

  // Competency level handlers
  const handleUpdateCompetencyLevel = (index: number, field: keyof CompetencyLevel, value: string) => {
    const updated = [...competencyLevels];
    updated[index] = { ...updated[index], [field]: value };
    setCompetencyLevels(updated);
  };

  const colorOptions = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6B7280'
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Settings className="h-6 w-6 text-slate-600" />
            Configuración RRHH
          </h1>
          <p className="text-slate-500 mt-1">Gestión de parámetros y catálogos del módulo de Recursos Humanos</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm flex items-center justify-between">
          {error} <button onClick={() => setError('')}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <TabButton active={activeTab === 'departments'} onClick={() => setActiveTab('departments')} icon={Building} label="Departamentos" />
        <TabButton active={activeTab === 'positions'} onClick={() => setActiveTab('positions')} icon={Briefcase} label="Categorías de Puestos" />
        <TabButton active={activeTab === 'contracts'} onClick={() => setActiveTab('contracts')} icon={FileText} label="Tipos de Contrato" />
        <TabButton active={activeTab === 'competencyLevels'} onClick={() => setActiveTab('competencyLevels')} icon={Brain} label="Niveles de Competencia" />
        <TabButton active={activeTab === 'competencies'} onClick={() => setActiveTab('competencies')} icon={Target} label="Competencias" />
        <TabButton active={activeTab === 'training'} onClick={() => setActiveTab('training')} icon={GraduationCap} label="Categorías de Capacitación" />
      </div>

      {/* Departments Tab */}
      {activeTab === 'departments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Departamentos</h2>
            <button onClick={() => setShowDeptForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              <Plus className="h-4 w-4" /> Nuevo Departamento
            </button>
          </div>

          {showDeptForm && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <h3 className="font-medium text-slate-900">{editingDept ? 'Editar' : 'Nuevo'} Departamento</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input 
                  placeholder="Nombre *" 
                  value={deptForm.name} 
                  onChange={e => setDeptForm({ ...deptForm, name: e.target.value })} 
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm" 
                />
                <input 
                  placeholder="Descripción" 
                  value={deptForm.description} 
                  onChange={e => setDeptForm({ ...deptForm, description: e.target.value })} 
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm" 
                />
                <div className="flex items-center gap-2">
                  {colorOptions.map(color => (
                    <button
                      key={color}
                      onClick={() => setDeptForm({ ...deptForm, color })}
                      className={`w-6 h-6 rounded-full ${deptForm.color === color ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={editingDept ? handleUpdateDept : handleCreateDept} 
                  disabled={!deptForm.name}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700"
                >
                  <Save className="h-4 w-4 inline mr-1" /> {editingDept ? 'Guardar' : 'Crear'}
                </button>
                <button 
                  onClick={() => {
                    setShowDeptForm(false);
                    setEditingDept(null);
                    setDeptForm({ name: '', description: '', color: '#3B82F6' });
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map(dept => (
              <div key={dept.id} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg" style={{ backgroundColor: dept.color }}>
                      <Building className="h-5 w-5 text-white m-2.5" />
                    </div>
                    <div>
                      <h3 className="font-medium text-slate-900">{dept.name}</h3>
                      <p className="text-xs text-slate-500">{dept._count?.employees || 0} empleados</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => {
                        setEditingDept(dept);
                        setDeptForm({ name: dept.name, description: dept.description || '', color: dept.color });
                        setShowDeptForm(true);
                      }}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteDept(dept.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {dept.description && <p className="text-sm text-slate-600 mt-2">{dept.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Position Categories Tab */}
      {activeTab === 'positions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Categorías de Puestos</h2>
            <button onClick={() => setShowPosCatForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              <Plus className="h-4 w-4" /> Nueva Categoría
            </button>
          </div>

          {showPosCatForm && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <h3 className="font-medium text-slate-900">{editingPosCat ? 'Editar' : 'Nueva'} Categoría</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input 
                  placeholder="Nombre *" 
                  value={posCatForm.name} 
                  onChange={e => setPosCatForm({ ...posCatForm, name: e.target.value })} 
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm" 
                />
                <input 
                  placeholder="Nivel (ej: Junior, Senior)" 
                  value={posCatForm.level} 
                  onChange={e => setPosCatForm({ ...posCatForm, level: e.target.value })} 
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm" 
                />
                <input 
                  placeholder="Descripción" 
                  value={posCatForm.description} 
                  onChange={e => setPosCatForm({ ...posCatForm, description: e.target.value })} 
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm" 
                />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={editingPosCat ? handleUpdatePosCat : handleCreatePosCat} 
                  disabled={!posCatForm.name}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700"
                >
                  <Save className="h-4 w-4 inline mr-1" /> {editingPosCat ? 'Guardar' : 'Crear'}
                </button>
                <button 
                  onClick={() => {
                    setShowPosCatForm(false);
                    setEditingPosCat(null);
                    setPosCatForm({ name: '', description: '', level: '' });
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-700">Nombre</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-700">Nivel</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-700">Descripción</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {positionCategories.map(cat => (
                  <tr key={cat.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{cat.name}</td>
                    <td className="px-4 py-3 text-slate-600">{cat.level}</td>
                    <td className="px-4 py-3 text-slate-600">{cat.description}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button 
                          onClick={() => {
                            setEditingPosCat(cat);
                            setPosCatForm({ name: cat.name, description: cat.description || '', level: cat.level });
                            setShowPosCatForm(true);
                          }}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleDeletePosCat(cat.id)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Contract Types Tab */}
      {activeTab === 'contracts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Tipos de Contrato</h2>
            <button onClick={() => setShowContractForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              <Plus className="h-4 w-4" /> Nuevo Tipo
            </button>
          </div>

          {showContractForm && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <h3 className="font-medium text-slate-900">{editingContract ? 'Editar' : 'Nuevo'} Tipo de Contrato</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input 
                  placeholder="Nombre *" 
                  value={contractForm.name} 
                  onChange={e => setContractForm({ ...contractForm, name: e.target.value })} 
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm" 
                />
                <input 
                  placeholder="Duración" 
                  value={contractForm.duration} 
                  onChange={e => setContractForm({ ...contractForm, duration: e.target.value })} 
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm" 
                />
                <input 
                  placeholder="Descripción" 
                  value={contractForm.description} 
                  onChange={e => setContractForm({ ...contractForm, description: e.target.value })} 
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm" 
                />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={editingContract ? handleUpdateContract : handleCreateContract} 
                  disabled={!contractForm.name}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700"
                >
                  <Save className="h-4 w-4 inline mr-1" /> {editingContract ? 'Guardar' : 'Crear'}
                </button>
                <button 
                  onClick={() => {
                    setShowContractForm(false);
                    setEditingContract(null);
                    setContractForm({ name: '', description: '', duration: '' });
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contractTypes.map(contract => (
              <div key={contract.id} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-slate-900">{contract.name}</h3>
                      {contract.duration && <p className="text-xs text-slate-500">{contract.duration}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => {
                        setEditingContract(contract);
                        setContractForm({ name: contract.name, description: contract.description || '', duration: contract.duration || '' });
                        setShowContractForm(true);
                      }}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteContract(contract.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {contract.description && <p className="text-sm text-slate-600 mt-2">{contract.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Competency Levels Tab */}
      {activeTab === 'competencyLevels' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Niveles de Competencia</h2>
            <p className="text-sm text-slate-500">Escala 1-5 para evaluación de competencias</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-700 w-20">Nivel</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-700">Nombre</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-700">Descripción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {competencyLevels.map((level, idx) => (
                  <tr key={level.level}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Award className="h-4 w-4 text-yellow-500" />
                        <span className="font-bold text-slate-900">{level.level}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input 
                        value={level.name} 
                        onChange={e => handleUpdateCompetencyLevel(idx, 'name', e.target.value)}
                        className="w-full border border-slate-200 rounded px-2 py-1 text-sm" 
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input 
                        value={level.description} 
                        onChange={e => handleUpdateCompetencyLevel(idx, 'description', e.target.value)}
                        className="w-full border border-slate-200 rounded px-2 py-1 text-sm" 
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h4 className="text-sm font-medium text-blue-900 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Uso en Evaluaciones
            </h4>
            <p className="text-sm text-blue-700 mt-1">
              Esta escala se utiliza para evaluar el nivel actual y requerido de competencias en empleados.
              La brecha entre niveles determina las necesidades de capacitación.
            </p>
          </div>
        </div>
      )}

      {/* Competencies Tab */}
      {activeTab === 'competencies' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Competencias</h2>
            <button onClick={() => setShowCompetencyForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              <Plus className="h-4 w-4" /> Nueva Competencia
            </button>
          </div>

          {showCompetencyForm && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <h3 className="font-medium text-slate-900">{editingCompetency ? 'Editar' : 'Nueva'} Competencia</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input 
                  placeholder="Nombre *" 
                  value={competencyForm.name} 
                  onChange={e => setCompetencyForm({ ...competencyForm, name: e.target.value })} 
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm" 
                />
                <input 
                  placeholder="Categoría (ej: Técnica, Comportamental, Liderazgo)" 
                  value={competencyForm.category} 
                  onChange={e => setCompetencyForm({ ...competencyForm, category: e.target.value })} 
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm" 
                />
                <input 
                  placeholder="Descripción" 
                  value={competencyForm.description} 
                  onChange={e => setCompetencyForm({ ...competencyForm, description: e.target.value })} 
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm" 
                />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={editingCompetency ? handleUpdateCompetency : handleCreateCompetency} 
                  disabled={!competencyForm.name}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700"
                >
                  <Save className="h-4 w-4 inline mr-1" /> {editingCompetency ? 'Guardar' : 'Crear'}
                </button>
                <button 
                  onClick={() => {
                    setShowCompetencyForm(false);
                    setEditingCompetency(null);
                    setCompetencyForm({ name: '', category: '', description: '' });
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-700">Nombre</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-700">Categoría</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-700">Descripción</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-700 w-24">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {competenciesList.map(comp => (
                  <tr key={comp.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{comp.name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">{comp.category}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{comp.description || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button 
                          onClick={() => {
                            setEditingCompetency(comp);
                            setCompetencyForm({ name: comp.name, category: comp.category, description: comp.description || '' });
                            setShowCompetencyForm(true);
                          }}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteCompetency(comp.id)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Training Categories Tab */}
      {activeTab === 'training' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Categorías de Capacitación</h2>
            <button onClick={() => setShowTrainingCatForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              <Plus className="h-4 w-4" /> Nueva Categoría
            </button>
          </div>

          {showTrainingCatForm && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <h3 className="font-medium text-slate-900">{editingTrainingCat ? 'Editar' : 'Nueva'} Categoría</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input 
                  placeholder="Nombre *" 
                  value={trainingCatForm.name} 
                  onChange={e => setTrainingCatForm({ ...trainingCatForm, name: e.target.value })} 
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm" 
                />
                <input 
                  placeholder="Norma ISO relacionada" 
                  value={trainingCatForm.standard} 
                  onChange={e => setTrainingCatForm({ ...trainingCatForm, standard: e.target.value })} 
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm" 
                />
                <input 
                  placeholder="Descripción" 
                  value={trainingCatForm.description} 
                  onChange={e => setTrainingCatForm({ ...trainingCatForm, description: e.target.value })} 
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm" 
                />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={editingTrainingCat ? handleUpdateTrainingCat : handleCreateTrainingCat} 
                  disabled={!trainingCatForm.name}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700"
                >
                  <Save className="h-4 w-4 inline mr-1" /> {editingTrainingCat ? 'Guardar' : 'Crear'}
                </button>
                <button 
                  onClick={() => {
                    setShowTrainingCatForm(false);
                    setEditingTrainingCat(null);
                    setTrainingCatForm({ name: '', description: '', standard: '' });
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {trainingCategories.map(cat => (
              <div key={cat.id} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <GraduationCap className="h-5 w-5 text-orange-600" />
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => {
                        setEditingTrainingCat(cat);
                        setTrainingCatForm({ name: cat.name, description: cat.description || '', standard: cat.standard || '' });
                        setShowTrainingCatForm(true);
                      }}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteTrainingCat(cat.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <h3 className="font-medium text-slate-900 mt-3">{cat.name}</h3>
                {cat.standard && (
                  <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {cat.standard}
                  </span>
                )}
                {cat.description && <p className="text-sm text-slate-600 mt-2">{cat.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active 
          ? 'bg-blue-600 text-white' 
          : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
