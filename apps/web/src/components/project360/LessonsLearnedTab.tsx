'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Lightbulb, Plus, BookOpen, Tag, Calendar, User, AlertTriangle,
  CheckCircle, TrendingUp, Trash2, Edit, Eye, FileText, Search,
  Brain, Sparkles
} from 'lucide-react';

interface LessonLearned {
  id: string;
  title: string;
  category: string;
  description: string;
  impact: string;
  rootCause: string | null;
  correctiveAction: string | null;
  preventiveAction: string | null;
  tags: string[];
  relatedProjectIds: string[];
  relatedTaskIds: string[];
  aiSummary: string | null;
  aiRecommendations: string[];
  aiSimilarCases: any[];
  createdById: string;
  createdAt: string;
}

interface Props {
  projectId: string;
}

const CATEGORIES = [
  { key: 'OPERACIONAL', label: 'Operacional', color: 'bg-blue-100 text-blue-700' },
  { key: 'FINANCIERO', label: 'Financiero', color: 'bg-emerald-100 text-emerald-700' },
  { key: 'COMERCIAL', label: 'Comercial', color: 'bg-purple-100 text-purple-700' },
  { key: 'TECNICO', label: 'Técnico', color: 'bg-amber-100 text-amber-700' },
  { key: 'RRHH', label: 'RRHH/Equipo', color: 'bg-pink-100 text-pink-700' },
  { key: 'CLIENTE', label: 'Relación Cliente', color: 'bg-indigo-100 text-indigo-700' },
  { key: 'PROVEEDOR', label: 'Proveedores', color: 'bg-orange-100 text-orange-700' },
  { key: 'LEGAL', label: 'Legal/Contractual', color: 'bg-red-100 text-red-700' },
];

const IMPACTS = [
  { key: 'ALTO_POSITIVO', label: 'Alto Positivo', icon: TrendingUp, color: 'text-emerald-600' },
  { key: 'MEDIO_POSITIVO', label: 'Medio Positivo', icon: CheckCircle, color: 'text-blue-600' },
  { key: 'BAJO_IMPACTO', label: 'Bajo Impacto', icon: FileText, color: 'text-gray-600' },
  { key: 'MEDIO_NEGATIVO', label: 'Medio Negativo', icon: AlertTriangle, color: 'text-amber-600' },
  { key: 'ALTO_NEGATIVO', label: 'Alto Negativo', icon: AlertTriangle, color: 'text-red-600' },
];

export default function LessonsLearnedTab({ projectId }: Props) {
  const [lessons, setLessons] = useState<LessonLearned[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<LessonLearned | null>(null);
  const [searchTag, setSearchTag] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [newLesson, setNewLesson] = useState({
    title: '', category: 'OPERACIONAL', description: '', impact: 'MEDIO_POSITIVO',
    rootCause: '', correctiveAction: '', preventiveAction: '', tags: ''
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/project360-v1/projects/${projectId}/lessons-learned`) as any;
      setLessons(res.lessons || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    try {
      await apiFetch(`/project360-v1/projects/${projectId}/lessons-learned`, {
        method: 'POST',
        json: {
          ...newLesson,
          tags: newLesson.tags.split(',').map(t => t.trim()).filter(Boolean),
        }
      });
      setShowAddModal(false);
      setNewLesson({ title: '', category: 'OPERACIONAL', description: '', impact: 'MEDIO_POSITIVO', rootCause: '', correctiveAction: '', preventiveAction: '', tags: '' });
      load();
    } catch (e: any) { alert(e.message); }
  };

  const handleAnalyzeIA = async (lessonId: string) => {
    setAnalyzing(true);
    try {
      await apiFetch(`/project360-v1/lessons-learned/${lessonId}/analyze`, { method: 'POST' });
      load();
      alert('Análisis IA completado.');
    } catch (e: any) { alert(e.message); }
    setAnalyzing(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta lección aprendida?')) return;
    try {
      await apiFetch(`/project360-v1/lessons-learned/${id}`, { method: 'DELETE' });
      load();
    } catch (e: any) { alert(e.message); }
  };

  const filteredLessons = lessons.filter(l => 
    searchTag === '' || l.tags.some(t => t.toLowerCase().includes(searchTag.toLowerCase()))
  );

  const allTags = Array.from(new Set(lessons.flatMap(l => l.tags)));

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando lessons learned...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Lecciones Aprendidas / Knowledge Base</h2>
          <p className="text-sm text-gray-500">Conocimiento corporativo generado por proyectos</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Agregar Lección
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="text-2xl font-bold text-gray-900">{lessons.length}</div>
          <div className="text-xs text-gray-500">Total Lecciones</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-2xl font-bold text-emerald-600">{lessons.filter(l => l.impact.includes('POSITIVO')).length}</div>
          <div className="text-xs text-gray-500">Positivas</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-2xl font-bold text-red-600">{lessons.filter(l => l.impact.includes('NEGATIVO')).length}</div>
          <div className="text-xs text-gray-500">Negativas</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-2xl font-bold text-blue-600">{allTags.length}</div>
          <div className="text-xs text-gray-500">Tags Únicos</div>
        </div>
      </div>

      {/* Search by Tag */}
      <div className="flex items-center gap-2">
        <Search className="w-5 h-5 text-gray-400" />
        <input 
          type="text"
          placeholder="Buscar por tag..."
          value={searchTag}
          onChange={e => setSearchTag(e.target.value)}
          className="flex-1 px-3 py-2 border rounded-lg text-sm"
        />
        {searchTag && (
          <button onClick={() => setSearchTag('')} className="text-sm text-gray-500 hover:text-gray-700">
            Limpiar
          </button>
        )}
      </div>

      {/* Cloud Tags */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allTags.map(tag => (
            <button 
              key={tag}
              onClick={() => setSearchTag(tag)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                searchTag === tag ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Tag className="w-3 h-3 inline mr-1" /> {tag}
            </button>
          ))}
        </div>
      )}

      {/* Lista */}
      {filteredLessons.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Sin lecciones aprendidas</h3>
          <p className="text-gray-500">Registrá aprendizajes de este proyecto para futuras referencias</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredLessons.map(lesson => {
            const category = CATEGORIES.find(c => c.key === lesson.category);
            const impact = IMPACTS.find(i => i.key === lesson.impact);
            
            return (
              <div key={lesson.id} className="bg-white rounded-xl border p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${category?.color || 'bg-gray-100'}`}>
                      {category?.label || lesson.category}
                    </span>
                    {impact && <impact.icon className={`w-4 h-4 ${impact.color}`} />}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setSelectedLesson(lesson)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(lesson.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold text-gray-900 mb-2">{lesson.title}</h3>
                <p className="text-sm text-gray-600 mb-3 line-clamp-3">{lesson.description}</p>

                {lesson.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {lesson.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {lesson.aiSummary && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-3">
                    <div className="flex items-center gap-1 text-xs text-blue-700 mb-1">
                      <Brain className="w-3 h-3" /> Resumen IA
                    </div>
                    <p className="text-xs text-blue-800 line-clamp-2">{lesson.aiSummary}</p>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{new Date(lesson.createdAt).toLocaleDateString()}</span>
                  {lesson.aiRecommendations && lesson.aiRecommendations.length > 0 && (
                    <span className="text-blue-600">{lesson.aiRecommendations.length} recomendaciones IA</span>
                  )}
                </div>

                <button 
                  onClick={() => handleAnalyzeIA(lesson.id)}
                  disabled={analyzing}
                  className="mt-3 w-full px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3" /> Analizar con IA
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Agregar */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Nueva Lección Aprendida</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Título</label>
                <input 
                  value={newLesson.title} 
                  onChange={e => setNewLesson({...newLesson, title: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="Ej: Optimización de rutas redujo 15% de combustible"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
                  <select 
                    value={newLesson.category} 
                    onChange={e => setNewLesson({...newLesson, category: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Impacto</label>
                  <select 
                    value={newLesson.impact} 
                    onChange={e => setNewLesson({...newLesson, impact: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    {IMPACTS.map(i => <option key={i.key} value={i.key}>{i.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                <textarea 
                  value={newLesson.description} 
                  onChange={e => setNewLesson({...newLesson, description: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  rows={3}
                  placeholder="Describí la situación, el contexto y el resultado..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Causa Raíz (opcional)</label>
                <input 
                  value={newLesson.rootCause} 
                  onChange={e => setNewLesson({...newLesson, rootCause: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="¿Por qué ocurrió?"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Acción Correctiva</label>
                  <input 
                    value={newLesson.correctiveAction} 
                    onChange={e => setNewLesson({...newLesson, correctiveAction: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="¿Qué se hizo?"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Acción Preventiva</label>
                  <input 
                    value={newLesson.preventiveAction} 
                    onChange={e => setNewLesson({...newLesson, preventiveAction: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="¿Cómo evitarlo?"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tags (separados por coma)</label>
                <input 
                  value={newLesson.tags} 
                  onChange={e => setNewLesson({...newLesson, tags: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="Ej: combustible, rutas, optimización, ahorro"
                />
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={handleAdd} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                Guardar Lección
              </button>
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle */}
      {selectedLesson && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{selectedLesson.title}</h3>
              <button onClick={() => setSelectedLesson(null)} className="p-2 text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${CATEGORIES.find(c => c.key === selectedLesson.category)?.color}`}>
                  {CATEGORIES.find(c => c.key === selectedLesson.category)?.label}
                </span>
                <span className={`px-2 py-1 rounded text-xs font-medium bg-gray-100`}>
                  {IMPACTS.find(i => i.key === selectedLesson.impact)?.label}
                </span>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Descripción</h4>
                <p className="text-sm text-gray-700">{selectedLesson.description}</p>
              </div>

              {selectedLesson.rootCause && (
                <div className="bg-red-50 rounded-lg p-3">
                  <h4 className="font-medium text-red-900 mb-1">Causa Raíz</h4>
                  <p className="text-sm text-red-800">{selectedLesson.rootCause}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {selectedLesson.correctiveAction && (
                  <div className="bg-emerald-50 rounded-lg p-3">
                    <h4 className="font-medium text-emerald-900 mb-1">Acción Correctiva</h4>
                    <p className="text-sm text-emerald-800">{selectedLesson.correctiveAction}</p>
                  </div>
                )}
                {selectedLesson.preventiveAction && (
                  <div className="bg-blue-50 rounded-lg p-3">
                    <h4 className="font-medium text-blue-900 mb-1">Acción Preventiva</h4>
                    <p className="text-sm text-blue-800">{selectedLesson.preventiveAction}</p>
                  </div>
                )}
              </div>

              {selectedLesson.aiSummary && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-medium text-purple-900 mb-2 flex items-center gap-2">
                    <Brain className="w-4 h-4" /> Análisis IA
                  </h4>
                  <p className="text-sm text-purple-800">{selectedLesson.aiSummary}</p>
                </div>
              )}

              {selectedLesson.aiRecommendations && selectedLesson.aiRecommendations.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Recomendaciones IA</h4>
                  <ul className="space-y-1">
                    {selectedLesson.aiRecommendations.map((rec, i) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" /> {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedLesson.tags.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedLesson.tags.map(tag => (
                      <span key={tag} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                        {tag}
                      </span>
                    ))}
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
