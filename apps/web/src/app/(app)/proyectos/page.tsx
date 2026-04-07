'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  FolderOpen, Plus, Calendar, Users, DollarSign, Target, Clock,
  CheckCircle, AlertTriangle, TrendingUp, TrendingDown,
  Filter, Search, MoreVertical, Eye, Edit, Trash2, BarChart3,
  User, Settings, Archive, Star, Flag, X
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  startDate: string;
  endDate: string;
  actualEndDate?: string;
  budget: number;
  actualCost?: number;
  manager: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  team: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
  }>;
  progress: number;
  milestones: Array<{
    id: string;
    name: string;
    dueDate: string;
    completed: boolean;
    completedAt?: string;
  }>;
  tasks: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
  };
  risks: Array<{
    id: string;
    title: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    status: 'OPEN' | 'MITIGATED' | 'CLOSED';
  }>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface ProjectStats {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  totalBudget: number;
  totalCost: number;
  avgProgress: number;
  onTime: number;
  delayed: number;
  overBudget: number;
  teamMembers: number;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<ProjectStats>({
    total: 0,
    byStatus: {},
    byPriority: {},
    totalBudget: 0,
    totalCost: 0,
    avgProgress: 0,
    onTime: 0,
    delayed: 0,
    overBudget: 0,
    teamMembers: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const [projectsData, statsData] = await Promise.all([
        apiFetch('/projects'),
        apiFetch('/projects/stats')
      ]) as any;
      
      setProjects(projectsData.projects || []);
      setStats(statsData.stats || stats);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLANNING': return 'text-blue-600 bg-blue-50';
      case 'ACTIVE': return 'text-green-600 bg-green-50';
      case 'ON_HOLD': return 'text-yellow-600 bg-yellow-50';
      case 'COMPLETED': return 'text-purple-600 bg-purple-50';
      case 'CANCELLED': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PLANNING': return 'Planificación';
      case 'ACTIVE': return 'Activo';
      case 'ON_HOLD': return 'En Pausa';
      case 'COMPLETED': return 'Completado';
      case 'CANCELLED': return 'Cancelado';
      default: return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'text-red-600 bg-red-50';
      case 'HIGH': return 'text-orange-600 bg-orange-50';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50';
      case 'LOW': return 'text-gray-600 bg-gray-50';
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

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 50) return 'bg-blue-500';
    if (progress >= 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const isOverdue = (project: Project) => {
    return new Date(project.endDate) < new Date() && project.status !== 'COMPLETED';
  };

  const isOverBudget = (project: Project) => {
    return project.actualCost && project.actualCost > project.budget;
  };

  const filteredProjects = projects.filter(project => {
    if (searchQuery && !project.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !project.description.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterStatus !== 'all' && project.status !== filterStatus) return false;
    if (filterPriority !== 'all' && project.priority !== filterPriority) return false;
    return true;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'status':
        return a.status.localeCompare(b.status);
      case 'priority':
        const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder];
      case 'progress':
        return b.progress - a.progress;
      case 'endDate':
        return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
      default:
        return 0;
    }
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
          <p className="text-gray-600">Gestión de proyectos y portafolio</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Nuevo Proyecto
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Proyectos</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <FolderOpen className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Presupuesto Total</p>
              <p className="text-2xl font-bold text-gray-900">${(stats.totalBudget / 1000000).toFixed(1)}M</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Progreso Promedio</p>
              <p className="text-2xl font-bold text-gray-900">{stats.avgProgress.toFixed(0)}%</p>
            </div>
            <BarChart3 className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Miembros del Equipo</p>
              <p className="text-2xl font-bold text-gray-900">{stats.teamMembers}</p>
            </div>
            <Users className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-[300px]">
            <Search className="w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar proyectos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Todos los estados</option>
            <option value="PLANNING">Planificación</option>
            <option value="ACTIVE">Activo</option>
            <option value="ON_HOLD">En Pausa</option>
            <option value="COMPLETED">Completado</option>
            <option value="CANCELLED">Cancelado</option>
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
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="name">Nombre</option>
            <option value="status">Estado</option>
            <option value="priority">Prioridad</option>
            <option value="progress">Progreso</option>
            <option value="endDate">Fecha Fin</option>
          </select>
        </div>
      </div>

      {/* Projects List */}
      <div className="space-y-4">
        {filteredProjects.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay proyectos</h3>
            <p className="text-gray-600 mb-4">
              {searchQuery || filterStatus !== 'all' || filterPriority !== 'all'
                ? 'No se encontraron proyectos con los filtros seleccionados'
                : 'Comienza creando tu primer proyecto'}
            </p>
            {!searchQuery && filterStatus === 'all' && filterPriority === 'all' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Crear Proyecto
              </button>
            )}
          </div>
        ) : (
          filteredProjects.map(project => (
            <div key={project.id} className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(project.status)}`}>
                        {getStatusLabel(project.status)}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(project.priority)}`}>
                        {getPriorityLabel(project.priority)}
                      </span>
                      {isOverdue(project) && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                          Vencido
                        </span>
                      )}
                      {isOverBudget(project) && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-700">
                          Sobre Presupuesto
                        </span>
                      )}
                    </div>
                    
                    <p className="text-gray-600 mb-3">{project.description}</p>
                    
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        <span>{project.manager.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{project.team.length} miembros</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(project.startDate).toLocaleDateString()} - {new Date(project.endDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        <span>${(project.budget / 1000).toFixed(0)}K</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/proyectos/${project.id}`}
                      className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                      title="Ver detalles"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                    <button className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-lg">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-lg">
                      <Archive className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">Progreso</span>
                    <span className="text-sm text-gray-600">{project.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${getProgressColor(project.progress)}`}
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>
                
                {/* Quick Stats */}
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-medium text-gray-900">{project.milestones.length}</div>
                    <div className="text-gray-600">Hitos</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-gray-900">{project.tasks.completed}</div>
                    <div className="text-gray-600">Tareas Completadas</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-gray-900">{project.risks.filter(r => r.status === 'OPEN').length}</div>
                    <div className="text-gray-600">Riesgos Activos</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-gray-900">{project.milestones.filter(m => m.completed).length}</div>
                    <div className="text-gray-600">Hitos Completados</div>
                  </div>
                </div>
                
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
            </div>
          ))
        )}
      </div>

      {/* Create Project Modal (placeholder) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Nuevo Proyecto</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="text-center py-8">
              <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Formulario de creación de proyectos</p>
              <p className="text-sm text-gray-500 mt-2">Esta funcionalidad estará disponible próximamente</p>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
