'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  FileText, Plus, Users, BarChart3, Clock, CheckCircle, AlertCircle,
  Filter, Search, MoreVertical, Eye, Edit, Trash2, Send, Archive,
  TrendingUp, TrendingDown, Star, MessageSquare, Calendar, Target,
  Settings, Download, Copy, Share2, Play, Pause, X
} from 'lucide-react';

interface Survey {
  id: string;
  title: string;
  description: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
  type: 'SATISFACTION' | 'FEEDBACK' | 'ASSESSMENT' | 'POLL' | 'RESEARCH';
  targetAudience: string[];
  questions: Array<{
    id: string;
    type: 'TEXT' | 'MULTIPLE_CHOICE' | 'RATING' | 'YES_NO' | 'SCALE';
    question: string;
    required: boolean;
    options?: string[];
  }>;
  responses: {
    total: number;
    completed: number;
    partial: number;
    completionRate: number;
  };
  analytics: {
    averageRating?: number;
    satisfactionScore?: number;
    npsScore?: number;
    topIssues?: Array<{
      issue: string;
      count: number;
      percentage: number;
    }>;
  };
  settings: {
    anonymous: boolean;
    allowMultipleResponses: boolean;
    showResults: boolean;
    requireAuthentication: boolean;
    deadline?: string;
  };
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  completedAt?: string;
  tags: string[];
}

interface SurveyStats {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  totalResponses: number;
  avgCompletionRate: number;
  avgSatisfactionScore: number;
  activeSurveys: number;
  completedSurveys: number;
}

export default function SurveysPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [stats, setStats] = useState<SurveyStats>({
    total: 0,
    byStatus: {},
    byType: {},
    totalResponses: 0,
    avgCompletionRate: 0,
    avgSatisfactionScore: 0,
    activeSurveys: 0,
    completedSurveys: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadSurveys();
  }, []);

  const loadSurveys = async () => {
    try {
      setLoading(true);
      const [surveysData, statsData] = await Promise.all([
        apiFetch('/surveys'),
        apiFetch('/surveys/stats')
      ]) as any;
      
      setSurveys(surveysData.surveys || []);
      setStats(statsData.stats || stats);
    } catch (error) {
      console.error('Error loading surveys:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'text-gray-600 bg-gray-50';
      case 'ACTIVE': return 'text-green-600 bg-green-50';
      case 'PAUSED': return 'text-yellow-600 bg-yellow-50';
      case 'COMPLETED': return 'text-blue-600 bg-blue-50';
      case 'ARCHIVED': return 'text-purple-600 bg-purple-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'Borrador';
      case 'ACTIVE': return 'Activa';
      case 'PAUSED': return 'Pausada';
      case 'COMPLETED': return 'Completada';
      case 'ARCHIVED': return 'Archivada';
      default: return status;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'SATISFACTION': return 'text-blue-600 bg-blue-50';
      case 'FEEDBACK': return 'text-green-600 bg-green-50';
      case 'ASSESSMENT': return 'text-purple-600 bg-purple-50';
      case 'POLL': return 'text-orange-600 bg-orange-50';
      case 'RESEARCH': return 'text-pink-600 bg-pink-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'SATISFACTION': return 'Satisfacción';
      case 'FEEDBACK': return 'Feedback';
      case 'ASSESSMENT': return 'Evaluación';
      case 'POLL': return 'Encuesta';
      case 'RESEARCH': return 'Investigación';
      default: return type;
    }
  };

  const getCompletionColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'text-green-600';
    if (rating >= 3.5) return 'text-yellow-600';
    if (rating >= 2.5) return 'text-orange-600';
    return 'text-red-600';
  };

  const filteredSurveys = surveys.filter(survey => {
    if (searchQuery && !survey.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !survey.description.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterStatus !== 'all' && survey.status !== filterStatus) return false;
    if (filterType !== 'all' && survey.type !== filterType) return false;
    return true;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'title':
        return a.title.localeCompare(b.title);
      case 'status':
        return a.status.localeCompare(b.status);
      case 'responses':
        return b.responses.total - a.responses.total;
      case 'completionRate':
        return b.responses.completionRate - a.responses.completionRate;
      case 'createdAt':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      default:
        return 0;
    }
  });

  const handlePublish = async (surveyId: string) => {
    try {
      await apiFetch(`/surveys/${surveyId}/publish`, { method: 'POST' });
      loadSurveys();
    } catch (error) {
      console.error('Error publishing survey:', error);
    }
  };

  const handlePause = async (surveyId: string) => {
    try {
      await apiFetch(`/surveys/${surveyId}/pause`, { method: 'POST' });
      loadSurveys();
    } catch (error) {
      console.error('Error pausing survey:', error);
    }
  };

  const handleArchive = async (surveyId: string) => {
    try {
      await apiFetch(`/surveys/${surveyId}/archive`, { method: 'POST' });
      loadSurveys();
    } catch (error) {
      console.error('Error archiving survey:', error);
    }
  };

  const handleDelete = async (surveyId: string) => {
    if (confirm('¿Está seguro de eliminar esta encuesta? Esta acción no se puede deshacer.')) {
      try {
        await apiFetch(`/surveys/${surveyId}`, { method: 'DELETE' });
        loadSurveys();
      } catch (error) {
        console.error('Error deleting survey:', error);
      }
    }
  };

  const handleDuplicate = async (surveyId: string) => {
    try {
      await apiFetch(`/surveys/${surveyId}/duplicate`, { method: 'POST' });
      loadSurveys();
    } catch (error) {
      console.error('Error duplicating survey:', error);
    }
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Encuestas</h1>
          <p className="text-gray-600">Gestión de encuestas y análisis de satisfacción</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Nueva Encuesta
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Encuestas</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Respuestas Totales</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalResponses}</p>
            </div>
            <Users className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tasa Completación</p>
              <p className="text-2xl font-bold text-gray-900">{stats.avgCompletionRate.toFixed(0)}%</p>
            </div>
            <Target className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Satisfacción Promedio</p>
              <p className="text-2xl font-bold text-gray-900">{stats.avgSatisfactionScore.toFixed(1)}</p>
            </div>
            <Star className="w-8 h-8 text-yellow-600" />
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
              placeholder="Buscar encuestas..."
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
            <option value="DRAFT">Borrador</option>
            <option value="ACTIVE">Activa</option>
            <option value="PAUSED">Pausada</option>
            <option value="COMPLETED">Completada</option>
            <option value="ARCHIVED">Archivada</option>
          </select>
          
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Todos los tipos</option>
            <option value="SATISFACTION">Satisfacción</option>
            <option value="FEEDBACK">Feedback</option>
            <option value="ASSESSMENT">Evaluación</option>
            <option value="POLL">Encuesta</option>
            <option value="RESEARCH">Investigación</option>
          </select>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="createdAt">Fecha Creación</option>
            <option value="title">Título</option>
            <option value="status">Estado</option>
            <option value="responses">Respuestas</option>
            <option value="completionRate">Tasa Completación</option>
          </select>
        </div>
      </div>

      {/* Surveys List */}
      <div className="space-y-4">
        {filteredSurveys.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay encuestas</h3>
            <p className="text-gray-600 mb-4">
              {searchQuery || filterStatus !== 'all' || filterType !== 'all'
                ? 'No se encontraron encuestas con los filtros seleccionados'
                : 'Comienza creando tu primera encuesta'}
            </p>
            {!searchQuery && filterStatus === 'all' && filterType === 'all' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Crear Encuesta
              </button>
            )}
          </div>
        ) : (
          filteredSurveys.map(survey => (
            <div key={survey.id} className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{survey.title}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(survey.status)}`}>
                        {getStatusLabel(survey.status)}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(survey.type)}`}>
                        {getTypeLabel(survey.type)}
                      </span>
                      {survey.settings.deadline && new Date(survey.settings.deadline) < new Date() && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                          Vencida
                        </span>
                      )}
                    </div>
                    
                    <p className="text-gray-600 mb-3">{survey.description}</p>
                    
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <MessageSquare className="w-4 h-4" />
                        <span>{survey.questions.length} preguntas</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{survey.targetAudience.join(', ')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(survey.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>Creado por {survey.createdBy.name}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/encuestas/${survey.id}`}
                      className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                      title="Ver detalles"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                    <button className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-lg">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDuplicate(survey.id)}
                      className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-lg"
                      title="Duplicar"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-lg">
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Response Stats */}
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="font-medium text-gray-900">{survey.responses.total}</div>
                    <div className="text-gray-600">Respuestas Totales</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-gray-900">{survey.responses.completed}</div>
                    <div className="text-gray-600">Completadas</div>
                  </div>
                  <div className="text-center">
                    <div className={`font-medium ${getCompletionColor(survey.responses.completionRate)}`}>
                      {survey.responses.completionRate.toFixed(0)}%
                    </div>
                    <div className="text-gray-600">Tasa Completación</div>
                  </div>
                  <div className="text-center">
                    {survey.analytics.averageRating ? (
                      <>
                        <div className={`font-medium ${getRatingColor(survey.analytics.averageRating)}`}>
                          {survey.analytics.averageRating.toFixed(1)}
                        </div>
                        <div className="text-gray-600">Rating Promedio</div>
                      </>
                    ) : (
                      <>
                        <div className="font-medium text-gray-400">-</div>
                        <div className="text-gray-600">Sin Rating</div>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Progress Bar */}
                {survey.responses.total > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">Progreso de Respuestas</span>
                      <span className="text-sm text-gray-600">{survey.responses.completionRate.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${getCompletionColor(survey.responses.completionRate) === 'text-green-600' ? 'bg-green-500' : getCompletionColor(survey.responses.completionRate) === 'text-yellow-600' ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${survey.responses.completionRate}%` }}
                      />
                    </div>
                  </div>
                )}
                
                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2">
                    {survey.status === 'DRAFT' && (
                      <button
                        onClick={() => handlePublish(survey.id)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                      >
                        <Send className="w-4 h-4" />
                        Publicar
                      </button>
                    )}
                    {survey.status === 'ACTIVE' && (
                      <button
                        onClick={() => handlePause(survey.id)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm"
                      >
                        <Pause className="w-4 h-4" />
                        Pausar
                      </button>
                    )}
                    {survey.status === 'PAUSED' && (
                      <button
                        onClick={() => handlePublish(survey.id)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                      >
                        <Play className="w-4 h-4" />
                        Reanudar
                      </button>
                    )}
                    {survey.status === 'COMPLETED' && (
                      <button
                        onClick={() => handleArchive(survey.id)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                      >
                        <Archive className="w-4 h-4" />
                        Archivar
                      </button>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {survey.responses.total > 0 && (
                      <Link
                        href={`/encuestas/${survey.id}/analytics`}
                        className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                      >
                        <BarChart3 className="w-4 h-4" />
                        Ver Análisis
                      </Link>
                    )}
                  </div>
                </div>
                
                {/* Tags */}
                {(survey.tags?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {(survey.tags || []).map(tag => (
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

      {/* Create Survey Modal (placeholder) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Nueva Encuesta</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Formulario de creación de encuestas</p>
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
