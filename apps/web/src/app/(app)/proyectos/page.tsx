'use client';
import PageTitleHelp from '@/components/ui/PageTitleHelp';

import { useState, useEffect } from 'react';
import { EmployeeCombobox } from '@/components/ui/EmployeeCombobox';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { EditProjectModal, TasksModal } from './components';
import { exportProjectsToExcel } from '@/lib/project360-export';
import { BoardCard } from './board-card';
import {
  Target, AlertTriangle, CheckCircle, Clock, Users, Calendar,
  Filter, Search, Plus, Eye, Edit, Trash2, FileText, BarChart3,
  TrendingUp, TrendingDown, Activity, Zap, Shield, Settings,
  Download, Upload, RefreshCw, Play, Pause, X, Flag, LayoutTemplate, Copy, Save
} from 'lucide-react';

interface ActionProject {
  id: string;
  code: string;
  name: string;
  description: string;
  origin: 'AUDIT_FINDING' | 'NON_CONFORMITY' | 'INCIDENT' | 'DRILL_DEVIATION' | 'MAINTENANCE_ISSUE' | 'RISK_DETECTED' | 'MANAGEMENT_OBJECTIVE' | 'MANUAL';
  originModule: string;
  originEntityId?: string;
  originReference?: string;
  responsible: {
    id: string;
    name: string;
    email: string;
  };
  startDate: string;
  targetDate: string;
  completedAt?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'AT_RISK' | 'OVERDUE' | 'COMPLETED' | 'CANCELLED' | 'ON_HOLD';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  progress: number;
  indicator?: {
    id: string;
    name: string;
    unit: string;
  };
  targetValue?: number;
  currentValue?: number;
  impactLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  tags: string[];
  metadata?: any;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  tasks?: any[];
  // Pro fields
  budget?: number;
  budgetCurrency?: string;
  actualCost?: number;
  licitationMode?: string;
  templateId?: string;
  budgetItems?: any[];
  milestones?: any[];
  aiAnalyses?: any[];
}

interface ActionTask {
  id: string;
  title: string;
  description?: string;
  responsible: {
    id: string;
    name: string;
  };
  dueDate: string;
  completedAt?: string;
  estimatedHours?: number;
  actualHours?: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
  progress: number;
  evidenceRequired: boolean;
  dependencies: string[];
  tags: string[];
}

interface ProjectStats {
  totalProjects: number;
  activeProjects: number;
  overdueProjects: number;
  completedProjects: number;
  projectsByStatus: Record<string, number>;
  projectsByOrigin: Record<string, number>;
  avgProgress: number;
  criticalProjects: number;
  onTimeCompletionRate: number;
}

export default function Project360Page() {
  const [projects, setProjects] = useState<ActionProject[]>([]);
  const [stats, setStats] = useState<ProjectStats>({
    totalProjects: 0,
    activeProjects: 0,
    overdueProjects: 0,
    completedProjects: 0,
    projectsByStatus: {},
    projectsByOrigin: {},
    avgProgress: 0,
    criticalProjects: 0,
    onTimeCompletionRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterOrigin, setFilterOrigin] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterResponsible, setFilterResponsible] = useState<string>('all');
  const [activeView, setActiveView] = useState<'list' | 'board'>('list');
  const [members, setMembers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ActionProject | null>(null);

  // Pro states
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [showLicitacionModal, setShowLicitacionModal] = useState(false);
  const [licitacionForm, setLicitacionForm] = useState({ name: '', documentText: '', documentName: '', analysisType: 'LICITACION', responsibleId: '', targetDate: '' });
  const [licitacionFile, setLicitacionFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Form state for creating new project
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    origin: 'MANUAL' as ActionProject['origin'],
    originModule: 'PROJECT360',
    priority: 'MEDIUM' as ActionProject['priority'],
    targetDate: '',
    responsibleId: '',
    templateId: '',
    budget: '',
    budgetCurrency: 'ARS',
    licitationMode: '',
  });

  useEffect(() => {
    loadProjects();
    // Cargar empleados de RRHH como responsables
    apiFetch<{ employees: any[] }>('/hr/employees')
      .then(res => setMembers((res?.employees || []).map((e: any) => ({
        id: e.id,
        name: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email,
        email: e.email,
      })).sort((a: any, b: any) => a.name.localeCompare(b.name))))
      .catch(() => {});
    // Cargar templates
    apiFetch('/project360-v1/templates')
      .then((res: any) => setTemplates(res.templates || []))
      .catch(() => {});
  }, []);

  // Calculate stats from projects data
  useEffect(() => {
    const active = projects.filter(p => p.status === 'IN_PROGRESS').length;
    const overdue = projects.filter(p => p.status === 'OVERDUE').length;
    const critical = projects.filter(p => p.priority === 'CRITICAL').length;
    const completed = projects.filter(p => p.status === 'COMPLETED').length;
    const avgProgress = projects.length > 0 ? projects.reduce((acc, p) => acc + (p.progress || 0), 0) / projects.length : 0;
    
    setStats({
      totalProjects: projects.length,
      activeProjects: active,
      overdueProjects: overdue,
      completedProjects: completed,
      projectsByStatus: {},
      projectsByOrigin: {},
      avgProgress: avgProgress,
      criticalProjects: critical,
      onTimeCompletionRate: 0
    });
  }, [projects]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const [projectsData, statsData] = await Promise.all([
        apiFetch('/project360-v1/projects'),
        apiFetch('/project360-v1/stats')
      ]) as any;
      
      setProjects(projectsData.projects || []);
      // Stats are calculated from projects data in the useEffect above
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  // Template management functions
  const loadTemplates = async () => {
    try {
      const res = await apiFetch('/project360-v1/templates') as any;
      setTemplates(res.templates || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const handleSaveTemplate = async (templateData: any) => {
    try {
      if (editingTemplate?.id) {
        // Update existing
        await apiFetch(`/project360-v1/templates/${editingTemplate.id}`, {
          method: 'PUT',
          body: JSON.stringify(templateData)
        });
        alert('Plantilla actualizada correctamente');
      } else {
        // Create new
        await apiFetch('/project360-v1/templates', {
          method: 'POST',
          body: JSON.stringify(templateData)
        });
        alert('Plantilla creada correctamente');
      }
      setEditingTemplate(null);
      loadTemplates();
    } catch (error: any) {
      alert('Error: ' + (error.message || 'No se pudo guardar la plantilla'));
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta plantilla?')) return;
    try {
      await apiFetch(`/project360-v1/templates/${templateId}`, { method: 'DELETE' });
      alert('Plantilla eliminada');
      loadTemplates();
    } catch (error: any) {
      alert('Error: ' + (error.message || 'No se pudo eliminar'));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'text-yellow-600 bg-yellow-50';
      case 'IN_PROGRESS': return 'text-blue-600 bg-blue-50';
      case 'AT_RISK': return 'text-orange-600 bg-orange-50';
      case 'OVERDUE': return 'text-red-600 bg-red-50';
      case 'COMPLETED': return 'text-green-600 bg-green-50';
      case 'CANCELLED': return 'text-gray-600 bg-gray-50';
      case 'ON_HOLD': return 'text-purple-600 bg-purple-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING': return 'Pendiente';
      case 'IN_PROGRESS': return 'En Ejecución';
      case 'AT_RISK': return 'En Riesgo';
      case 'OVERDUE': return 'Vencido';
      case 'COMPLETED': return 'Completado';
      case 'CANCELLED': return 'Cancelado';
      case 'ON_HOLD': return 'En Pausa';
      default: return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'text-red-600 bg-red-50';
      case 'HIGH': return 'text-orange-600 bg-orange-50';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50';
      case 'LOW': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'Crítica';
      case 'HIGH': return 'Alta';
      case 'MEDIUM': return 'Media';
      case 'LOW': return 'Baja';
      default: return priority;
    }
  };

  const getOriginColor = (origin: string) => {
    switch (origin) {
      case 'AUDIT_FINDING': return 'text-purple-600 bg-purple-50';
      case 'NON_CONFORMITY': return 'text-red-600 bg-red-50';
      case 'INCIDENT': return 'text-orange-600 bg-orange-50';
      case 'DRILL_DEVIATION': return 'text-blue-600 bg-blue-50';
      case 'MAINTENANCE_ISSUE': return 'text-green-600 bg-green-50';
      case 'RISK_DETECTED': return 'text-pink-600 bg-pink-50';
      case 'MANAGEMENT_OBJECTIVE': return 'text-indigo-600 bg-indigo-50';
      case 'MANUAL': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getOriginLabel = (origin: string) => {
    switch (origin) {
      case 'AUDIT_FINDING': return 'Hallazgo Auditoría';
      case 'NON_CONFORMITY': return 'No Conformidad';
      case 'INCIDENT': return 'Incidente';
      case 'DRILL_DEVIATION': return 'Desvío Simulacro';
      case 'MAINTENANCE_ISSUE': return 'Problema Mantenimiento';
      case 'RISK_DETECTED': return 'Riesgo Detectado';
      case 'MANAGEMENT_OBJECTIVE': return 'Objetivo Dirección';
      case 'MANUAL': return 'Manual';
      default: return origin;
    }
  };

  const getProgressColor = (progress: number, targetDate: string) => {
    const isOverdue = new Date(targetDate) < new Date();
    if (isOverdue) return 'text-red-600';
    if (progress >= 80) return 'text-green-600';
    if (progress >= 50) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const isOverdue = (project: ActionProject) => {
    return new Date(project.targetDate) < new Date() && project.status !== 'COMPLETED';
  };

  const getTrafficLightStatus = (project: ActionProject) => {
    const daysUntilDue = Math.ceil((new Date(project.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    
    if (project.status === 'COMPLETED') return 'green';
    if (daysUntilDue < 0) return 'red';
    if (daysUntilDue <= 7) return 'yellow';
    return 'green';
  };

  const filteredProjects = projects.filter(project => {
    if (searchQuery && !project.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !project.description?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !project.code.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterStatus !== 'all' && project.status !== filterStatus) return false;
    if (filterOrigin !== 'all' && project.origin !== filterOrigin) return false;
    if (filterPriority !== 'all' && project.priority !== filterPriority) return false;
    if (filterResponsible !== 'all' && project.responsible.id !== filterResponsible) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proyectos <PageTitleHelp moduleHref="/proyectos" /></h1>
          <p className="text-gray-600">Gestión de Planes de Acción y Mejora Continua</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/proyectos/pmo"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
          >
            <BarChart3 className="w-4 h-4" />
            PMO Dashboard
          </Link>
          <button 
            onClick={() => exportProjectsToExcel(projects)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Exportar Excel
          </button>
          <button 
            onClick={() => setShowLicitacionModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Upload className="w-4 h-4" />
            Crear desde licitación
          </button>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Nuevo Proyecto
          </button>
          <button 
            onClick={() => setShowTemplatesModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 border border-gray-300"
            title="Gestionar plantillas de proyectos"
          >
            <LayoutTemplate className="w-4 h-4" />
            Plantillas
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Proyectos Activos</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeProjects}</p>
            </div>
            <Target className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Vencidos</p>
              <p className="text-2xl font-bold text-red-900">{stats.overdueProjects}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Críticos</p>
              <p className="text-2xl font-bold text-orange-900">{stats.criticalProjects}</p>
            </div>
            <Flag className="w-8 h-8 text-orange-600" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avance</p>
              <p className="text-2xl font-bold text-green-900">{stats.avgProgress.toFixed(1)}%</p>
            </div>
            <BarChart3 className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Presupuesto Total</p>
              <p className="text-2xl font-bold text-gray-900">
                {projects.reduce((s, p) => s + (p.budget || 0), 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-indigo-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Gasto Actual</p>
              <p className="text-2xl font-bold text-gray-900">
                {projects.reduce((s, p) => s + (p.actualCost || 0), 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}
              </p>
            </div>
            <TrendingDown className="w-8 h-8 text-pink-600" />
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveView('list')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
                activeView === 'list' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              Vista Lista
            </button>
            <button
              onClick={() => setActiveView('board')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
                activeView === 'board' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Vista Tablero
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Buscar proyectos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los estados</option>
              <option value="PENDING">Pendiente</option>
              <option value="IN_PROGRESS">En Ejecución</option>
              <option value="AT_RISK">En Riesgo</option>
              <option value="OVERDUE">Vencido</option>
              <option value="COMPLETED">Completado</option>
            </select>
            
            <select
              value={filterOrigin}
              onChange={(e) => setFilterOrigin(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los orígenes</option>
              <option value="AUDIT_FINDING">Hallazgo Auditoría</option>
              <option value="NON_CONFORMITY">No Conformidad</option>
              <option value="INCIDENT">Incidente</option>
              <option value="DRILL_DEVIATION">Desvío Simulacro</option>
              <option value="MAINTENANCE_ISSUE">Problema Mantenimiento</option>
              <option value="RISK_DETECTED">Riesgo Detectado</option>
              <option value="MANAGEMENT_OBJECTIVE">Objetivo Dirección</option>
              <option value="MANUAL">Manual</option>
            </select>
            
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todas las prioridades</option>
              <option value="CRITICAL">Crítica</option>
              <option value="HIGH">Alta</option>
              <option value="MEDIUM">Media</option>
              <option value="LOW">Baja</option>
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {activeView === 'list' && (
            <div className="space-y-4">
              {filteredProjects.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No hay proyectos</h3>
                  <p className="text-gray-600">
                    {searchQuery || filterStatus !== 'all' || filterOrigin !== 'all' || filterPriority !== 'all'
                      ? 'No se encontraron proyectos con los filtros seleccionados'
                      : 'Comienza creando tu primer proyecto de acción'}
                  </p>
                </div>
              ) : (
                filteredProjects.map(project => (
                  <div key={project.id} className="bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                          <span className="text-sm font-medium text-gray-500">{project.code}</span>
                          
                          {/* Traffic Light Status */}
                          <div className={`w-3 h-3 rounded-full ${
                            getTrafficLightStatus(project) === 'green' ? 'bg-green-500' :
                            getTrafficLightStatus(project) === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
                          }`} title={`Estado: ${getTrafficLightStatus(project) === 'green' ? 'En tiempo' : getTrafficLightStatus(project) === 'yellow' ? 'Próximo a vencer' : 'Vencido'}`} />
                          
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(project.status)}`}>
                            {getStatusLabel(project.status)}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(project.priority)}`}>
                            {getPriorityLabel(project.priority)}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getOriginColor(project.origin)}`}>
                            {getOriginLabel(project.origin)}
                          </span>
                          {isOverdue(project) && (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                              Vencido
                            </span>
                          )}
                        </div>
                        
                        <p className="text-gray-600 mb-3">{project.description}</p>
                        
                        <div className="flex items-center gap-6 text-sm text-gray-500 mb-3">
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>{project.responsible.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>Vence: {new Date(project.targetDate).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <FileText className="w-4 h-4" />
                            <span>{project.tasks?.length ?? 0} tareas</span>
                          </div>
                          {project.originReference && (
                            <div className="flex items-center gap-1">
                              <Link href="#" className="w-4 h-4" />
                              <span>{project.originReference}</span>
                            </div>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-700">Progreso</span>
                            <span className={`text-sm font-medium ${getProgressColor(project.progress, project.targetDate)}`}>
                              {project.progress.toFixed(1)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                getProgressColor(project.progress, project.targetDate) === 'text-green-600' ? 'bg-green-500' :
                                getProgressColor(project.progress, project.targetDate) === 'text-yellow-600' ? 'bg-yellow-500' :
                                getProgressColor(project.progress, project.targetDate) === 'text-orange-600' ? 'bg-orange-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${project.progress}%` }}
                            />
                          </div>
                        </div>

                        {/* KPI Indicator */}
                        {project.indicator && (
                          <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-center gap-2">
                              <BarChart3 className="w-4 h-4 text-blue-600" />
                              <span className="text-sm font-medium text-blue-800">KPI:</span>
                              <span className="text-sm text-blue-900">{project.indicator.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-blue-700">Actual:</span>
                              <span className="text-sm font-medium text-blue-900">{project.currentValue}</span>
                              <span className="text-sm text-blue-700">/</span>
                              <span className="text-sm font-medium text-blue-900">{project.targetValue}</span>
                              <span className="text-sm text-blue-700">{project.indicator.unit}</span>
                            </div>
                          </div>
                        )}

                        {/* Tags */}
                        {project.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {project.tags.map(tag => (
                              <span
                                key={tag}
                                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/proyectos/${project.id}`}
                          className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button 
                          onClick={() => { setSelectedProject(project); setShowEditModal(true); }}
                          className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-lg"
                          title="Editar proyecto"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => { setSelectedProject(project); setShowTasksModal(true); }}
                          className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-lg"
                          title="Ver tareas"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={async () => {
                            if (!confirm('¿Está seguro de que desea eliminar este proyecto? Esta acción no se puede deshacer.')) {
                              return;
                            }
                            try {
                              await apiFetch(`/project360-v1/projects/${project.id}`, {
                                method: 'DELETE'
                              });
                              alert('Proyecto eliminado correctamente');
                              loadProjects();
                            } catch (error) {
                              console.error('Error deleting project:', error);
                              alert('Error al eliminar el proyecto');
                            }
                          }}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
                          title="Eliminar proyecto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeView === 'board' && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 p-4">
              {/* Column: Pendiente */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-700">Pendiente</h4>
                  <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs">
                    {filteredProjects.filter(p => p.status === 'PENDING').length}
                  </span>
                </div>
                <div className="space-y-3">
                  {filteredProjects.filter(p => p.status === 'PENDING').map(project => (
                    <BoardCard key={project.id} project={project} />
                  ))}
                </div>
              </div>

              {/* Column: En Ejecución */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-700">En Ejecución</h4>
                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs">
                    {filteredProjects.filter(p => p.status === 'IN_PROGRESS').length}
                  </span>
                </div>
                <div className="space-y-3">
                  {filteredProjects.filter(p => p.status === 'IN_PROGRESS').map(project => (
                    <BoardCard key={project.id} project={project} />
                  ))}
                </div>
              </div>

              {/* Column: En Riesgo */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-700">En Riesgo</h4>
                  <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs">
                    {filteredProjects.filter(p => p.status === 'AT_RISK').length}
                  </span>
                </div>
                <div className="space-y-3">
                  {filteredProjects.filter(p => p.status === 'AT_RISK').map(project => (
                    <BoardCard key={project.id} project={project} />
                  ))}
                </div>
              </div>

              {/* Column: Vencido */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-700">Vencido</h4>
                  <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs">
                    {filteredProjects.filter(p => p.status === 'OVERDUE').length}
                  </span>
                </div>
                <div className="space-y-3">
                  {filteredProjects.filter(p => p.status === 'OVERDUE').map(project => (
                    <BoardCard key={project.id} project={project} />
                  ))}
                </div>
              </div>

              {/* Column: Completado */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-700">Completado</h4>
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs">
                    {filteredProjects.filter(p => p.status === 'COMPLETED').length}
                  </span>
                </div>
                <div className="space-y-3">
                  {filteredProjects.filter(p => p.status === 'COMPLETED').map(project => (
                    <BoardCard key={project.id} project={project} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Nuevo Proyecto</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Proyecto</label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Implementación ISO 9001"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
                  placeholder="Describe el objetivo del proyecto..."
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Origen</label>
                  <select
                    value={newProject.origin}
                    onChange={(e) => setNewProject({ ...newProject, origin: e.target.value as ActionProject['origin'] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="MANUAL">Manual</option>
                    <option value="AUDIT_FINDING">Hallazgo Auditoría</option>
                    <option value="NON_CONFORMITY">No Conformidad</option>
                    <option value="INCIDENT">Incidente</option>
                    <option value="RISK_DETECTED">Riesgo Detectado</option>
                    <option value="MANAGEMENT_OBJECTIVE">Objetivo de Gestión</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                  <select
                    value={newProject.priority}
                    onChange={(e) => setNewProject({ ...newProject, priority: e.target.value as ActionProject['priority'] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="LOW">Baja</option>
                    <option value="MEDIUM">Media</option>
                    <option value="HIGH">Alta</option>
                    <option value="CRITICAL">Crítica</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
                <EmployeeCombobox
                  value={newProject.responsibleId}
                  onChange={id => setNewProject({ ...newProject, responsibleId: id })}
                  placeholder="Buscar responsable..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Objetivo</label>
                <input
                  type="date"
                  value={newProject.targetDate}
                  onChange={(e) => setNewProject({ ...newProject, targetDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plantilla</label>
                  <select
                    value={newProject.templateId}
                    onChange={(e) => setNewProject({ ...newProject, templateId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sin plantilla</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Presupuesto</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={newProject.budget}
                      onChange={(e) => setNewProject({ ...newProject, budget: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                    />
                    <select
                      value={newProject.budgetCurrency}
                      onChange={(e) => setNewProject({ ...newProject, budgetCurrency: e.target.value })}
                      className="px-2 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="ARS">ARS</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  try {
                    const payload = {
                      ...newProject,
                      targetDate: newProject.targetDate ? `${newProject.targetDate}T00:00:00Z` : '',
                      budget: newProject.budget ? parseFloat(newProject.budget) : undefined,
                    };
                    await apiFetch('/project360-v1/projects', {
                      method: 'POST',
                      json: payload
                    });
                    setShowCreateModal(false);
                    setNewProject({
                      name: '',
                      description: '',
                      origin: 'MANUAL',
                      originModule: 'PROJECT360',
                      priority: 'MEDIUM',
                      targetDate: '',
                      responsibleId: '',
                      templateId: '',
                      budget: '',
                      budgetCurrency: 'ARS',
                      licitationMode: '',
                    });
                    loadProjects();
                  } catch (error: any) {
                    console.error('Error creating project:', error);
                    alert('Error al crear el proyecto: ' + (error.message || JSON.stringify(error)));
                  }
                }}
                disabled={!newProject.name || !newProject.targetDate || !newProject.responsibleId}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Crear Proyecto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {showEditModal && selectedProject && (
        <EditProjectModal
          project={selectedProject}
          onClose={() => setShowEditModal(false)}
          onSave={async (_updatedProject) => {
            await loadProjects();
            setShowEditModal(false);
          }}
        />
      )}

      {/* View Tasks Modal */}
      {showTasksModal && selectedProject && (
        <TasksModal 
          project={selectedProject}
          onClose={() => setShowTasksModal(false)}
          onUpdateProject={(updatedProject) => {
            setProjects(projects.map(p => p.id === updatedProject.id ? updatedProject : p));
          }}
        />
      )}

      {/* ══ MODAL LICITACIÓN / PLIEGO ══ */}
      {showLicitacionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Crear desde Licitación / Pliego</h2>
                <p className="text-sm text-gray-500">La IA analizará el documento y generará un brief de proyecto</p>
              </div>
              <button onClick={() => { setShowLicitacionModal(false); setAnalyzing(false); }} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del proyecto *</label>
                <input type="text" value={licitacionForm.name} onChange={e => setLicitacionForm({ ...licitacionForm, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Ej: Licitación Municipal 2024" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de documento</label>
                  <select value={licitacionForm.analysisType} onChange={e => setLicitacionForm({ ...licitacionForm, analysisType: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                    <option value="LICITACION">Licitación</option>
                    <option value="PLIEGO">Pliego</option>
                    <option value="OFERTA">Oferta / Propuesta</option>
                    <option value="CONTRATO">Contrato</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha objetivo *</label>
                  <input type="date" value={licitacionForm.targetDate} onChange={e => setLicitacionForm({ ...licitacionForm, targetDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Responsable *</label>
                <EmployeeCombobox value={licitacionForm.responsibleId} onChange={id => setLicitacionForm({ ...licitacionForm, responsibleId: id })} placeholder="Buscar responsable..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del documento</label>
                <input type="text" value={licitacionForm.documentName} onChange={e => setLicitacionForm({ ...licitacionForm, documentName: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Ej: Pliego_Obra_Publica_2024.pdf" />
              </div>

              {/* Document Input: File Upload or Paste Text */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Contenido del documento *</label>

                {/* File Upload Option */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-purple-400 transition-colors">
                  <div className="flex items-center justify-center gap-3">
                    <input
                      type="file"
                      id="licitacionFile"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setLicitacionFile(file);
                        setLicitacionForm(prev => ({ ...prev, documentName: file.name }));
                        setUploadingFile(true);
                        try {
                          const formData = new FormData();
                          formData.append('file', file);
                          const res = await fetch('/api/project360/extract-text', {
                            method: 'POST',
                            body: formData,
                            credentials: 'include'
                          });
                          if (!res.ok) throw new Error('Error extrayendo texto');
                          const data = await res.json();
                          setLicitacionForm(prev => ({ ...prev, documentText: data.text }));
                          alert(`Texto extraído de "${file.name}". Podés editarlo antes de analizar.`);
                        } catch (err: any) {
                          alert('Error al extraer texto del archivo: ' + err.message);
                        } finally {
                          setUploadingFile(false);
                        }
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="licitacionFile"
                      className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 cursor-pointer transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      {uploadingFile ? 'Extrayendo texto...' : 'Subir PDF/Word'}
                    </label>
                    {licitacionFile && (
                      <span className="text-sm text-gray-600 flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        {licitacionFile.name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    Formatos soportados: PDF, DOC, DOCX, TXT
                  </p>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-300" />
                  <span className="text-xs text-gray-500">O</span>
                  <div className="flex-1 h-px bg-gray-300" />
                </div>

                {/* Text Paste Option */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Pegá el texto directamente
                  </label>
                  <textarea
                    value={licitacionForm.documentText}
                    onChange={e => setLicitacionForm({ ...licitacionForm, documentText: e.target.value })}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none text-sm"
                    placeholder="Pegá aquí el texto completo del documento. La IA extraerá requerimientos, plazos, costos y riesgos..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {licitacionForm.documentText ? `${licitacionForm.documentText.length} caracteres` : 'Sin contenido'}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => { setShowLicitacionModal(false); setAnalyzing(false); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!licitacionForm.name || !licitacionForm.targetDate || !licitacionForm.responsibleId || !licitacionForm.documentText) {
                    alert('Completá todos los campos obligatorios');
                    return;
                  }
                  setAnalyzing(true);
                  try {
                    // 1. Crear proyecto base
                    const projectRes = await apiFetch('/project360-v1/projects', {
                      method: 'POST',
                      json: {
                        name: licitacionForm.name,
                        description: `Proyecto generado desde ${licitacionForm.analysisType}: ${licitacionForm.documentName}`,
                        origin: 'MANUAL',
                        originModule: 'PROJECT360',
                        responsibleId: licitacionForm.responsibleId,
                        targetDate: `${licitacionForm.targetDate}T00:00:00Z`,
                        priority: 'HIGH',
                        licitationMode: licitacionForm.analysisType,
                      }
                    }) as any;
                    const projectId = projectRes.project?.id;
                    if (!projectId) throw new Error('No se pudo crear el proyecto');

                    // 2. Analizar con IA
                    await apiFetch(`/project360-v1/projects/${projectId}/ai-analyses`, {
                      method: 'POST',
                      json: {
                        documentText: licitacionForm.documentText,
                        documentName: licitacionForm.documentName || 'Documento',
                        analysisType: licitacionForm.analysisType,
                      }
                    });

                    setShowLicitacionModal(false);
                    setLicitacionForm({ name: '', documentText: '', documentName: '', analysisType: 'LICITACION', responsibleId: '', targetDate: '' });
                    loadProjects();
                    alert('Proyecto creado y analizado con éxito. Revisá el detalle para ver el brief completo.');
                  } catch (err: any) {
                    alert('Error: ' + (err.message || 'No se pudo procesar'));
                  } finally {
                    setAnalyzing(false);
                  }
                }}
                disabled={analyzing}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {analyzing ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Analizando con IA...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Zap className="w-4 h-4" />
                    Analizar y Crear Proyecto
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Management Modal */}
      {showTemplatesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <LayoutTemplate className="w-5 h-5" />
                  Gestión de Plantillas
                </h2>
                <button
                  onClick={() => { setShowTemplatesModal(false); setEditingTemplate(null); }}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {editingTemplate ? (
                /* Edit/Create Template Form */
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                    <input
                      type="text"
                      value={editingTemplate.name || ''}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ej: Proyecto ISO 9001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                    <textarea
                      value={editingTemplate.description || ''}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="Descripción de la plantilla..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                    <select
                      value={editingTemplate.category || 'GENERAL'}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="GENERAL">General</option>
                      <option value="ISO">ISO</option>
                      <option value="LICITACION">Licitación</option>
                      <option value="MANTENIMIENTO">Mantenimiento</option>
                      <option value="AUDITORIA">Auditoría</option>
                    </select>
                  </div>

                  {/* Default Tasks */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tareas Predefinidas (JSON)</label>
                    <textarea
                      value={typeof editingTemplate.defaultTasks === 'string' ? editingTemplate.defaultTasks : JSON.stringify(editingTemplate.defaultTasks || [], null, 2)}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, defaultTasks: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      rows={6}
                      placeholder='[{ "title": "Tarea 1", "description": "...", "estimatedHours": 8 }]'
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Formato: array de objetos con title, description, estimatedHours
                    </p>
                  </div>

                  {/* Default Budget Items */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ítems de Presupuesto (JSON)</label>
                    <textarea
                      value={typeof editingTemplate.defaultBudgetItems === 'string' ? editingTemplate.defaultBudgetItems : JSON.stringify(editingTemplate.defaultBudgetItems || [], null, 2)}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, defaultBudgetItems: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      rows={4}
                      placeholder='[{ "name": "Material", "category": "MATERIAL", "estimated": 1000 }]'
                    />
                  </div>

                  {/* Default Milestones */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Hitos (JSON)</label>
                    <textarea
                      value={typeof editingTemplate.defaultMilestones === 'string' ? editingTemplate.defaultMilestones : JSON.stringify(editingTemplate.defaultMilestones || [], null, 2)}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, defaultMilestones: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      rows={4}
                      placeholder='[{ "name": "Hito 1", "daysFromStart": 7 }]'
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editingTemplate.isActive !== false}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, isActive: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <label className="text-sm text-gray-700">Plantilla activa</label>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setEditingTemplate(null)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleSaveTemplate({
                        name: editingTemplate.name,
                        description: editingTemplate.description,
                        category: editingTemplate.category || 'GENERAL',
                        defaultTasks: typeof editingTemplate.defaultTasks === 'string' ? JSON.parse(editingTemplate.defaultTasks || '[]') : (editingTemplate.defaultTasks || []),
                        defaultBudgetItems: typeof editingTemplate.defaultBudgetItems === 'string' ? JSON.parse(editingTemplate.defaultBudgetItems || '[]') : (editingTemplate.defaultBudgetItems || []),
                        defaultMilestones: typeof editingTemplate.defaultMilestones === 'string' ? JSON.parse(editingTemplate.defaultMilestones || '[]') : (editingTemplate.defaultMilestones || []),
                        isActive: editingTemplate.isActive !== false
                      })}
                      disabled={!editingTemplate.name}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {editingTemplate.id ? 'Guardar Cambios' : 'Crear Plantilla'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Template List */
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-gray-600">{templates.length} plantilla(s) disponible(s)</p>
                    <button
                      onClick={() => setEditingTemplate({
                        name: '',
                        description: '',
                        category: 'GENERAL',
                        defaultTasks: '[]',
                        defaultBudgetItems: '[]',
                        defaultMilestones: '[]',
                        isActive: true
                      })}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4" />
                      Nueva Plantilla
                    </button>
                  </div>

                  <div className="grid gap-3">
                    {templates.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <LayoutTemplate className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No hay plantillas creadas</p>
                        <p className="text-sm">Creá una para reutilizar en nuevos proyectos</p>
                      </div>
                    ) : (
                      templates.map((template) => (
                        <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-medium text-gray-900">{template.name}</h3>
                                <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                                  {template.category}
                                </span>
                                {template.isActive === false && (
                                  <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-600">
                                    Inactiva
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{template.description || 'Sin descripción'}</p>
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span>{(template.defaultTasks?.length || 0)} tareas</span>
                                <span>{(template.defaultBudgetItems?.length || 0)} ítems presupuesto</span>
                                <span>{(template.defaultMilestones?.length || 0)} hitos</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setEditingTemplate({
                                  ...template,
                                  defaultTasks: JSON.stringify(template.defaultTasks || [], null, 2),
                                  defaultBudgetItems: JSON.stringify(template.defaultBudgetItems || [], null, 2),
                                  defaultMilestones: JSON.stringify(template.defaultMilestones || [], null, 2)
                                })}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteTemplate(template.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
