'use client';

import { useState } from 'react';
import { X, FileText, Plus, Check, MessageCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

// Edit Project Modal Component
export function EditProjectModal({ project, onClose, onSave }: { 
  project: any; 
  onClose: () => void; 
  onSave: (project: any) => void;
}) {
  const [formData, setFormData] = useState({
    name: project.name,
    description: project.description || '',
    status: project.status,
    priority: project.priority,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Editar Proyecto</h2>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="PENDING">Pendiente</option>
                <option value="IN_PROGRESS">En Progreso</option>
                <option value="COMPLETED">Completado</option>
                <option value="CANCELLED">Cancelado</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="LOW">Baja</option>
                <option value="MEDIUM">Media</option>
                <option value="HIGH">Alta</option>
                <option value="CRITICAL">Crítica</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          {saveError && <p className="text-xs text-red-600 text-center">{saveError}</p>}
          <button
            onClick={async () => {
              setSaving(true);
              setSaveError('');
              try {
                const res = await apiFetch(`/project360/projects/${project.id}`, {
                  method: 'PUT',
                  json: formData,
                }) as any;
                onSave(res?.project ?? { ...project, ...formData });
              } catch (err: any) {
                setSaveError(err.message || 'Error al guardar');
              } finally {
                setSaving(false);
              }
            }}
            disabled={!formData.name || saving}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Tasks Modal Component
export function TasksModal({ project, onClose, onUpdateProject }: { 
  project: any; 
  onClose: () => void;
  onUpdateProject: (project: any) => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskResponsible, setNewTaskResponsible] = useState('');
  const [tasks, setTasks] = useState<any[]>(project.tasks || [
    { id: '1', title: 'Revisar requerimientos', status: 'PENDING', responsible: 'Juan', dueDate: '15/04' },
    { id: '2', title: 'Planificar recursos', status: 'COMPLETED', responsible: 'María', dueDate: 'Completada' },
  ]);
  
  // Comments state
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);

  // Calculate progress based on completed tasks
  const calculateProgress = (taskList: any[]) => {
    if (taskList.length === 0) return 0;
    const completed = taskList.filter(t => t.status === 'COMPLETED').length;
    return Math.round((completed / taskList.length) * 100);
  };

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    const newTask = {
      id: Date.now().toString(),
      title: newTaskTitle,
      status: 'PENDING',
      responsible: newTaskResponsible || 'Sin asignar',
      dueDate: 'Sin fecha'
    };
    const updatedTasks = [...tasks, newTask];
    setTasks(updatedTasks);
    
    // Update project with new tasks and progress
    const progress = calculateProgress(updatedTasks);
    onUpdateProject({ 
      ...project, 
      tasks: updatedTasks,
      progress,
      _count: { tasks: updatedTasks.length }
    });
    
    setNewTaskTitle('');
    setNewTaskResponsible('');
    setShowAddForm(false);
  };

  const toggleTaskStatus = (taskId: string) => {
    const updatedTasks = tasks.map(t => 
      t.id === taskId 
        ? { ...t, status: t.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED' }
        : t
    );
    setTasks(updatedTasks);
    
    // Recalculate progress
    const progress = calculateProgress(updatedTasks);
    onUpdateProject({ 
      ...project, 
      tasks: updatedTasks,
      progress,
      _count: { tasks: updatedTasks.length }
    });
  };

  const openComments = async (task: any) => {
    setSelectedTask(task);
    setShowComments(true);
    // Load comments from API
    try {
      const response = await fetch(`/project360/tasks/${task.id}/comments`);
      const data = await response.json();
      setComments(data.comments || []);
    } catch (err) {
      console.error('Error loading comments:', err);
      setComments([]);
    }
  };

  const addComment = async () => {
    if (!newComment.trim() || !selectedTask) return;
    
    try {
      const response = await fetch(`/project360/tasks/${selectedTask.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newComment })
      });
      const data = await response.json();
      setComments([data.comment, ...comments]);
      setNewComment('');
    } catch (err) {
      console.error('Error adding comment:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Tareas del Proyecto</h2>
              <p className="text-sm text-gray-500">{project.name}</p>
              <p className="text-sm text-blue-600 mt-1">Progreso: {calculateProgress(tasks)}%</p>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-6">
          {tasks.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No hay tareas asignadas a este proyecto</p>
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              {tasks.map(task => (
                <div key={task.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <button
                    onClick={() => toggleTaskStatus(task.id)}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      task.status === 'COMPLETED' 
                        ? 'bg-green-500 border-green-500' 
                        : 'border-gray-300 hover:border-blue-500'
                    }`}
                  >
                    {task.status === 'COMPLETED' && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <span className={`flex-1 ${task.status === 'COMPLETED' ? 'line-through text-gray-400' : ''}`}>
                    {task.title}
                  </span>
                  <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                    {task.responsible}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    task.status === 'COMPLETED' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {task.status === 'COMPLETED' ? 'Completada' : 'Pendiente'}
                  </span>
                  <button
                    onClick={() => openComments(task)}
                    className="p-1 text-gray-400 hover:text-blue-600"
                    title="Ver comentarios"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Comments Section */}
          {showComments && selectedTask && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">Comentarios: {selectedTask.title}</h4>
                <button 
                  onClick={() => setShowComments(false)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Cerrar
                </button>
              </div>
              
              {/* Add Comment */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Agregar un comentario..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && addComment()}
                />
                <button
                  onClick={addComment}
                  disabled={!newComment.trim()}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  Comentar
                </button>
              </div>
              
              {/* Comments List */}
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {comments.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-2">Sin comentarios</p>
                ) : (
                  comments.map(comment => (
                    <div key={comment.id} className="bg-white p-2 rounded border border-gray-200">
                      <p className="text-sm text-gray-800">{comment.text}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {comment.authorName} • {new Date(comment.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {showAddForm ? (
            <div className="space-y-3 mb-4 p-4 bg-gray-50 rounded-lg">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Nombre de la tarea"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={newTaskResponsible}
                onChange={(e) => setNewTaskResponsible(e.target.value)}
                placeholder="Responsable"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddTask}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Agregar
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Agregar tarea
            </button>
          )}
        </div>
        
        <div className="p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
