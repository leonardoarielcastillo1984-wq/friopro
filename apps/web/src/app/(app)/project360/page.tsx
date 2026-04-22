'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { EditProjectModal, TasksModal } from './components';
import { exportProjectsToExcel } from '@/lib/project360-export';
import { BoardCard } from './board-card';
import {
  Target, AlertTriangle, CheckCircle, Clock, Users, Calendar,
  Filter, Search, Plus, Eye, Edit, Trash2, FileText, BarChart3,
  TrendingUp, TrendingDown, Activity, Zap, Shield, Settings,
  Download, Upload, RefreshCw, Play, Pause, X, Flag
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

  // Form state for creating new project
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    origin: 'MANUAL' as ActionProject['origin'],
    originModule: 'PROJECT360',
    priority: 'MEDIUM' as ActionProject['priority'],
    targetDate: '',
    responsibleId: '',
  });

  useEffect(() => {
    loadProjects();
    apiFetch<{ members: any[] }>('/settings/members')
      .then(res => setMembers((res?.members || []).map((m: any) => ({ id: m.userId, name: m.name || m.email, email: m.email }))))
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
        apiFetch('/project360/projects'),
        apiFetch('/project360/stats')
      ]) as any;
      
      setProjects(projectsData.projects || []);
      // Stats are calculated from projects data in the useEffect above
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
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
          <h1 className="text-2xl font-bold text-gray-900">Proyectos</h1>
          <p className="text-gray-600">Gestión de Planes de Acción y Mejora Continua</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => exportProjectsToExcel(projects)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Exportar Excel
          </button>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Nuevo Proyecto
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
              <p className="text-sm text-gray-600">Proyectos Vencidos</p>
              <p className="text-2xl font-bold text-red-900">{stats.overdueProjects}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Proyectos Críticos</p>
              <p className="text-2xl font-bold text-orange-900">{stats.criticalProjects}</p>
            </div>
            <Flag className="w-8 h-8 text-orange-600" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avance Promedio</p>
              <p className="text-2xl font-bold text-green-900">{stats.avgProgress.toFixed(1)}%</p>
            </div>
            <BarChart3 className="w-8 h-8 text-green-600" />
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
                          href={`/project360/${project.id}`}
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
                              await apiFetch(`/project360/projects/${project.id}`, {
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
                <select
                  value={newProject.responsibleId}
                  onChange={(e) => setNewProject({ ...newProject, responsibleId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar responsable...</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
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
                    };
                    await apiFetch('/project360/projects', {
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
          onSave={async () => {
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
    </div>
  );
}
