'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  Shield, AlertTriangle, Users, Calendar, Clock, CheckCircle, XCircle,
  ArrowLeft, Edit, Trash2, FileText, Download, Play, Pause, Settings,
  MapPin, Phone, Radio, Megaphone, Target, Activity, TrendingUp,
  TrendingDown, BarChart3, Plus, Save, X, ChevronDown
} from 'lucide-react';

interface DrillScenario {
  id: string;
  name: string;
  description: string;
  type: 'FIRE' | 'EARTHQUAKE' | 'FLOOD' | 'CHEMICAL_SPILL' | 'MEDICAL_EMERGENCY' | 'SECURITY_BREACH' | 'EVACUATION' | 'OTHER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: 'NATURAL_DISASTER' | 'INDUSTRIAL_ACCIDENT' | 'MEDICAL' | 'SECURITY' | 'ENVIRONMENTAL';
  objectives: string[];
  scope: {
    areas: string[];
    departments: string[];
    participants: number;
    external_agencies: string[];
  };
  schedule: {
    plannedDate: string;
    duration: number;
    start_time: string;
    end_time: string;
  };
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'POSTPONED';
  coordinator: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  evaluators: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  resources: {
    equipment: Array<{
      name: string;
      quantity: number;
      status: 'AVAILABLE' | 'ASSIGNED' | 'USED';
    }>;
    personnel: Array<{
      role: string;
      required: number;
      assigned: number;
    }>;
    facilities: Array<{
      name: string;
      location: string;
      capacity: number;
    }>;
  };
  procedures: Array<{
    id: string;
    step: number;
    action: string;
    responsible: string;
    estimated_time: number;
    dependencies: string[];
  }>;
  evaluation_criteria: Array<{
    criteria: string;
    weight: number;
    measurement_method: string;
    target_value: number;
  }>;
  results?: {
    completion_rate: number;
    participant_satisfaction: number;
    objectives_achieved: number;
    issues_identified: number;
    lessons_learned: string[];
    recommendations: string[];
    improvement_actions: Array<{
      action: string;
      responsible: string;
      due_date: string;
      status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
    }>;
  };
  created_at: string;
  updated_at: string;
  created_by: string;
}

export default function DrillDetailPage() {
  const params = useParams();
  const router = useRouter();
  const drillId = params.id as string;

  const [drill, setDrill] = useState<DrillScenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<DrillScenario | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'info' | 'results' | 'actions' | 'participants' | 'ai' | 'alerts'>('info');
  const [results, setResults] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [sectionLoading, setSectionLoading] = useState(false);

  useEffect(() => {
    if (drillId) {
      loadDrillDetails();
    }
  }, [drillId]);

  const loadDrillDetails = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(`/emergency/drills/${drillId}`);
      setDrill(response as DrillScenario);
      setEditForm(response as DrillScenario);
    } catch (error) {
      console.error('Error loading drill details:', error);
      setError('No se pudo cargar los detalles del simulacro');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditForm({ ...drill! });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditForm({ ...drill! });
  };

  const handleSave = async () => {
    if (!editForm) return;
    
    try {
      setSaving(true);
      const response = await apiFetch(`/emergency/drills/${drillId}`, {
        method: 'PUT',
        json: editForm
      });
      
      setDrill(response as DrillScenario);
      setIsEditing(false);
      alert('Simulacro actualizado exitosamente');
    } catch (error) {
      console.error('Error saving drill:', error);
      alert('Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  const handleStartDrill = async () => {
    if (!drill) return;
    
    if (!confirm('¿Está seguro de que desea iniciar el simulacro?')) {
      return;
    }
    
    try {
      setLoading(true);
      const response = await apiFetch(`/emergency/drills/${drillId}/start`, {
        method: 'POST',
        json: drill
      }) as { success: boolean; drill: DrillScenario };
      
      if (response.success) {
        setDrill(response.drill);
        alert('Simulacro iniciado correctamente');
      }
    } catch (error) {
      console.error('Error starting drill:', error);
      alert('Error al iniciar el simulacro');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteDrill = async () => {
    if (!drill) return;
    
    const completedDate = new Date().toLocaleDateString('es-AR');
    
    try {
      setLoading(true);
      const response = await apiFetch(`/emergency/drills/${drillId}/complete`, {
        method: 'POST',
        json: drill
      }) as { success: boolean; drill: DrillScenario };
      
      if (response.success) {
        setDrill(response.drill);
        alert(`Simulacro completado exitosamente el ${completedDate}`);
      }
    } catch (error) {
      console.error('Error completing drill:', error);
      alert('Error al completar el simulacro');
    } finally {
      setLoading(false);
    }
  };

  const loadResults = async () => {
    if (!drillId) return;
    setSectionLoading(true);
    try {
      const data = await apiFetch(`/emergency/drills/${drillId}/results`) as any;
      setResults(data.items || []);
    } catch (e) { setResults([]); }
    setSectionLoading(false);
  };

  const loadActions = async () => {
    if (!drillId) return;
    setSectionLoading(true);
    try {
      const data = await apiFetch(`/emergency/drills/${drillId}/actions`) as any;
      setActions(data.items || []);
    } catch (e) { setActions([]); }
    setSectionLoading(false);
  };

  const loadParticipants = async () => {
    if (!drillId) return;
    setSectionLoading(true);
    try {
      const data = await apiFetch(`/emergency/drills/${drillId}/participants`) as any;
      setParticipants(data.items || []);
    } catch (e) { setParticipants([]); }
    setSectionLoading(false);
  };

  const loadAiAnalysis = async () => {
    if (!drillId) return;
    setSectionLoading(true);
    try {
      const data = await apiFetch(`/emergency/drills/${drillId}/ai-analyze`, { method: 'POST' }) as any;
      setAiAnalysis(data.analysis || '');
    } catch (e) { setAiAnalysis('Error al obtener análisis'); }
    setSectionLoading(false);
  };

  const loadAlerts = async () => {
    if (!drillId) return;
    setSectionLoading(true);
    try {
      const data = await apiFetch(`/emergency/drills/alerts/summary`) as any;
      const mine = (data.alerts || []).filter((a: any) => a.drillId === drillId);
      setAlerts(mine);
    } catch (e) { setAlerts([]); }
    setSectionLoading(false);
  };

  useEffect(() => {
    if (!drillId) return;
    if (activeSection === 'results') loadResults();
    if (activeSection === 'actions') loadActions();
    if (activeSection === 'participants') loadParticipants();
    if (activeSection === 'ai') loadAiAnalysis();
    if (activeSection === 'alerts') loadAlerts();
  }, [activeSection, drillId]);

  const updateEditForm = (field: string, value: any) => {
    if (!editForm) return;
    
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      const parentObj = editForm[parent as keyof DrillScenario];
      if (typeof parentObj === 'object' && parentObj !== null) {
        setEditForm({
          ...editForm,
          [parent]: {
            ...parentObj,
            [child]: value
          }
        });
      }
    } else {
      setEditForm({
        ...editForm,
        [field]: value
      });
    }
  };

  const addObjective = () => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      objectives: [...editForm.objectives, '']
    });
  };

  const updateObjective = (index: number, value: string) => {
    if (!editForm) return;
    const newObjectives = [...editForm.objectives];
    newObjectives[index] = value;
    setEditForm({
      ...editForm,
      objectives: newObjectives
    });
  };

  const removeObjective = (index: number) => {
    if (!editForm) return;
    const newObjectives = editForm.objectives.filter((_, i) => i !== index);
    setEditForm({
      ...editForm,
      objectives: newObjectives
    });
  };

  const addProcedure = () => {
    if (!editForm) return;
    const newProcedure = {
      id: 'proc-' + Date.now(),
      step: editForm.procedures.length + 1,
      action: '',
      responsible: '',
      estimated_time: 5,
      dependencies: []
    };
    setEditForm({
      ...editForm,
      procedures: [...editForm.procedures, newProcedure]
    });
  };

  const updateProcedure = (index: number, field: string, value: any) => {
    if (!editForm) return;
    const newProcedures = [...editForm.procedures];
    newProcedures[index] = { ...newProcedures[index], [field]: value };
    setEditForm({
      ...editForm,
      procedures: newProcedures
    });
  };

  const removeProcedure = (index: number) => {
    if (!editForm) return;
    const newProcedures = editForm.procedures.filter((_, i) => i !== index);
    // Reorder steps
    newProcedures.forEach((proc, i) => {
      proc.step = i + 1;
    });
    setEditForm({
      ...editForm,
      procedures: newProcedures
    });
  };

  // Scope editing helpers
  const addArea = () => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      scope: { ...editForm.scope, areas: [...editForm.scope.areas, ''] }
    });
  };

  const updateArea = (index: number, value: string) => {
    if (!editForm) return;
    const newAreas = [...editForm.scope.areas];
    newAreas[index] = value;
    setEditForm({
      ...editForm,
      scope: { ...editForm.scope, areas: newAreas }
    });
  };

  const removeArea = (index: number) => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      scope: { ...editForm.scope, areas: editForm.scope.areas.filter((_, i) => i !== index) }
    });
  };

  const addDepartment = () => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      scope: { ...editForm.scope, departments: [...editForm.scope.departments, ''] }
    });
  };

  const updateDepartment = (index: number, value: string) => {
    if (!editForm) return;
    const newDepts = [...editForm.scope.departments];
    newDepts[index] = value;
    setEditForm({
      ...editForm,
      scope: { ...editForm.scope, departments: newDepts }
    });
  };

  const removeDepartment = (index: number) => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      scope: { ...editForm.scope, departments: editForm.scope.departments.filter((_, i) => i !== index) }
    });
  };

  // Resources editing helpers
  const addEquipment = () => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      resources: {
        ...editForm.resources,
        equipment: [...editForm.resources.equipment, { name: '', quantity: 1, status: 'AVAILABLE' }]
      }
    });
  };

  const updateEquipment = (index: number, field: string, value: any) => {
    if (!editForm) return;
    const newEquip = [...editForm.resources.equipment];
    newEquip[index] = { ...newEquip[index], [field]: value };
    setEditForm({
      ...editForm,
      resources: { ...editForm.resources, equipment: newEquip }
    });
  };

  const removeEquipment = (index: number) => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      resources: {
        ...editForm.resources,
        equipment: editForm.resources.equipment.filter((_, i) => i !== index)
      }
    });
  };

  const addPersonnel = () => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      resources: {
        ...editForm.resources,
        personnel: [...editForm.resources.personnel, { role: '', required: 1, assigned: 0 }]
      }
    });
  };

  const updatePersonnel = (index: number, field: string, value: any) => {
    if (!editForm) return;
    const newPersonnel = [...editForm.resources.personnel];
    newPersonnel[index] = { ...newPersonnel[index], [field]: value };
    setEditForm({
      ...editForm,
      resources: { ...editForm.resources, personnel: newPersonnel }
    });
  };

  const removePersonnel = (index: number) => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      resources: {
        ...editForm.resources,
        personnel: editForm.resources.personnel.filter((_, i) => i !== index)
      }
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'FIRE': return 'text-red-600 bg-red-50';
      case 'EARTHQUAKE': return 'text-orange-600 bg-orange-50';
      case 'FLOOD': return 'text-blue-600 bg-blue-50';
      case 'CHEMICAL_SPILL': return 'text-purple-600 bg-purple-50';
      case 'MEDICAL_EMERGENCY': return 'text-green-600 bg-green-50';
      case 'SECURITY_BREACH': return 'text-gray-600 bg-gray-50';
      case 'EVACUATION': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'FIRE': return 'Incendio';
      case 'EARTHQUAKE': return 'Sismo';
      case 'FLOOD': return 'Inundación';
      case 'CHEMICAL_SPILL': return 'Derrame Químico';
      case 'MEDICAL_EMERGENCY': return 'Emergencia Médica';
      case 'SECURITY_BREACH': return 'Brecha de Seguridad';
      case 'EVACUATION': return 'Evacuación';
      default: return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLANNED': return 'text-blue-600 bg-blue-50';
      case 'IN_PROGRESS': return 'text-yellow-600 bg-yellow-50';
      case 'COMPLETED': return 'text-green-600 bg-green-50';
      case 'CANCELLED': return 'text-red-600 bg-red-50';
      case 'POSTPONED': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PLANNED': return 'Planificado';
      case 'IN_PROGRESS': return 'En Progreso';
      case 'COMPLETED': return 'Completado';
      case 'CANCELLED': return 'Cancelado';
      case 'POSTPONED': return 'Postergado';
      default: return status;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'text-red-600 bg-red-50';
      case 'HIGH': return 'text-orange-600 bg-orange-50';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50';
      case 'LOW': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'Crítica';
      case 'HIGH': return 'Alta';
      case 'MEDIUM': return 'Media';
      case 'LOW': return 'Baja';
      default: return severity;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !drill) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/simulacros"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Simulacros
          </Link>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">Error</h3>
          <p className="text-red-600">{error || 'Simulacro no encontrado'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/simulacros"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Simulacros
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{drill.name}</h1>
            <p className="text-gray-600">Detalles del simulacro</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" />
            Exportar
          </button>
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          ) : (
            <button
              onClick={handleEdit}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Edit className="w-4 h-4" />
              Editar
            </button>
          )}
          {drill.status === 'PLANNED' && (
            <button 
              onClick={handleCompleteDrill}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4" />
              Completar Simulacro - {new Date().toLocaleDateString('es-AR')}
            </button>
          )}
          {drill.status === 'IN_PROGRESS' && (
            <button className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700">
              <Pause className="w-4 h-4" />
              Pausar
            </button>
          )}
          <Link
            href={`/simulacros/${drill.id}/gestionar`}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Activity className="w-4 h-4" />
            Gestionar
          </Link>
        </div>
      </div>

      {/* Status and Type Badges */}
      <div className="flex items-center gap-3 mb-6">
        <span className={`px-3 py-1 rounded text-sm font-medium ${getTypeColor(drill.type)}`}>
          {getTypeLabel(drill.type)}
        </span>
        <span className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(drill.status)}`}>
          {getStatusLabel(drill.status)}
        </span>
        <span className={`px-3 py-1 rounded text-sm font-medium ${getSeverityColor(drill.severity)}`}>
          {getSeverityLabel(drill.severity)}
        </span>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Descripción</h2>
            {isEditing ? (
              <textarea
                value={editForm?.description || ''}
                onChange={(e) => updateEditForm('description', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Describe el simulacro..."
              />
            ) : (
              <p className="text-gray-700">{drill.description}</p>
            )}
          </div>

          {/* Objectives */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Objetivos</h2>
              {isEditing && (
                <button
                  onClick={addObjective}
                  className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Agregar
                </button>
              )}
            </div>
            {isEditing ? (
              <div className="space-y-2">
                {editForm?.objectives.map((objective, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={objective}
                      onChange={(e) => updateObjective(index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Objetivo..."
                    />
                    <button
                      onClick={() => removeObjective(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : drill.objectives.length > 0 ? (
              <ul className="space-y-2">
                {drill.objectives.map((objective, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span className="text-gray-700">{objective}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No hay objetivos definidos</p>
            )}
          </div>

          {/* Procedures */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Procedimientos</h2>
              {isEditing && (
                <button
                  onClick={addProcedure}
                  className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Agregar
                </button>
              )}
            </div>
            {isEditing ? (
              <div className="space-y-3">
                {editForm?.procedures.map((procedure, index) => (
                  <div key={procedure.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                        {procedure.step}
                      </div>
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={procedure.action}
                          onChange={(e) => updateProcedure(index, 'action', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Acción..."
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={procedure.responsible}
                            onChange={(e) => updateProcedure(index, 'responsible', e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Responsable..."
                          />
                          <input
                            type="number"
                            value={procedure.estimated_time}
                            onChange={(e) => updateProcedure(index, 'estimated_time', parseInt(e.target.value))}
                            className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Minutos"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => removeProcedure(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : drill.procedures.length > 0 ? (
              <div className="space-y-3">
                {drill.procedures.map((procedure) => (
                  <div key={procedure.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                        {procedure.step}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{procedure.action}</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          Responsable: {procedure.responsible} • Tiempo estimado: {procedure.estimated_time} min
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No hay procedimientos definidos</p>
            )}
          </div>

          {/* Results (if completed) */}
          {drill.status === 'COMPLETED' && drill.results && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Resultados</h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{drill.results.completion_rate.toFixed(1)}%</div>
                  <div className="text-sm text-gray-600">Tasa Completación</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{drill.results.participant_satisfaction.toFixed(1)}/5</div>
                  <div className="text-sm text-gray-600">Satisfacción</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{drill.results.objectives_achieved}/{drill.objectives.length}</div>
                  <div className="text-sm text-gray-600">Objetivos Logrados</div>
                </div>
              </div>
              
              {drill.results.lessons_learned.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-gray-900 mb-2">Lecciones Aprendidas</h4>
                  <ul className="space-y-1">
                    {drill.results.lessons_learned.map((lesson, index) => (
                      <li key={index} className="text-sm text-gray-700">• {lesson}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Details */}
        <div className="space-y-6">
          {/* Schedule */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Programación</h2>
            {isEditing && editForm ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Fecha:</label>
                  <input
                    type="date"
                    value={new Date(editForm.schedule.plannedDate).toISOString().split('T')[0]}
                    onChange={(e) => updateEditForm('schedule.plannedDate', new Date(e.target.value).toISOString())}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Duración (horas):</label>
                    <input
                      type="number"
                      value={editForm.schedule.duration}
                      onChange={(e) => updateEditForm('schedule.duration', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Participantes:</label>
                    <input
                      type="number"
                      value={editForm.scope.participants}
                      onChange={(e) => updateEditForm('scope.participants', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Inicio:</label>
                    <input
                      type="time"
                      value={editForm.schedule.start_time}
                      onChange={(e) => updateEditForm('schedule.start_time', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Fin:</label>
                    <input
                      type="time"
                      value={editForm.schedule.end_time}
                      onChange={(e) => updateEditForm('schedule.end_time', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Fecha:</span>
                  <span className="text-sm font-medium">{new Date(drill.schedule.plannedDate).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Duración:</span>
                  <span className="text-sm font-medium">{drill.schedule.duration} horas</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Inicio:</span>
                  <span className="text-sm font-medium">{drill.schedule.start_time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Fin:</span>
                  <span className="text-sm font-medium">{drill.schedule.end_time}</span>
                </div>
              </div>
            )}
          </div>

          {/* Scope */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Alcance</h2>
            {isEditing && editForm ? (
              <div className="space-y-4">
                {/* Areas */}
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Áreas:</label>
                  {editForm.scope.areas.map((area, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={area}
                        onChange={(e) => updateArea(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Nombre del área"
                      />
                      <button
                        onClick={() => removeArea(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addArea}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar área
                  </button>
                </div>
                {/* Departments */}
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Departamentos:</label>
                  {editForm.scope.departments.map((dept, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={dept}
                        onChange={(e) => updateDepartment(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Nombre del departamento"
                      />
                      <button
                        onClick={() => removeDepartment(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addDepartment}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar departamento
                  </button>
                </div>
                {/* Participants */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Participantes:</label>
                  <input
                    type="number"
                    value={editForm.scope.participants}
                    onChange={(e) => updateEditForm('scope.participants', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Número de participantes"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-600">Áreas:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {drill.scope.areas.map((area, index) => (
                      <span key={index} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Departamentos:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {drill.scope.departments.map((dept, index) => (
                      <span key={index} className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded">
                        {dept}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Participantes:</span>
                  <span className="text-sm font-medium">{drill.scope.participants}</span>
                </div>
              </div>
            )}
          </div>

          {/* Coordinator */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Coordinador</h2>
            {isEditing && editForm ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editForm.coordinator.name}
                  onChange={(e) => updateEditForm('coordinator.name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nombre del coordinador"
                />
                <input
                  type="email"
                  value={editForm.coordinator.email}
                  onChange={(e) => updateEditForm('coordinator.email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Email"
                />
                <input
                  type="tel"
                  value={editForm.coordinator.phone}
                  onChange={(e) => updateEditForm('coordinator.phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Teléfono"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="font-medium">{drill.coordinator.name}</div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4" />
                  {drill.coordinator.phone}
                </div>
                <div className="text-sm text-gray-600">{drill.coordinator.email}</div>
              </div>
            )}
          </div>

          {/* Resources */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recursos</h2>
            {isEditing && editForm ? (
              <div className="space-y-4">
                {/* Equipment */}
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Equipos:</label>
                  {editForm.resources.equipment.map((item, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateEquipment(index, 'name', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Nombre del equipo"
                      />
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateEquipment(index, 'quantity', parseInt(e.target.value))}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Cant."
                      />
                      <button
                        onClick={() => removeEquipment(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addEquipment}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar equipo
                  </button>
                </div>
                {/* Personnel */}
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Personal:</label>
                  {editForm.resources.personnel.map((item, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={item.role}
                        onChange={(e) => updatePersonnel(index, 'role', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Rol"
                      />
                      <input
                        type="number"
                        value={item.required}
                        onChange={(e) => updatePersonnel(index, 'required', parseInt(e.target.value))}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Req."
                      />
                      <input
                        type="number"
                        value={item.assigned}
                        onChange={(e) => updatePersonnel(index, 'assigned', parseInt(e.target.value))}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Asig."
                      />
                      <button
                        onClick={() => removePersonnel(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addPersonnel}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar personal
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {drill.resources.equipment.length > 0 && (
                  <div>
                    <span className="text-sm text-gray-600">Equipos:</span>
                    <ul className="mt-1 space-y-1">
                      {drill.resources.equipment.map((item, index) => (
                        <li key={index} className="text-sm flex items-center justify-between">
                          <span>{item.name}</span>
                          <span className="text-gray-500">x{item.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {drill.resources.personnel.length > 0 && (
                  <div>
                    <span className="text-sm text-gray-600">Personal:</span>
                    <ul className="mt-1 space-y-1">
                      {drill.resources.personnel.map((item, index) => (
                        <li key={index} className="text-sm flex items-center justify-between">
                          <span>{item.role}</span>
                          <span className="text-gray-500">{item.assigned}/{item.required}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
