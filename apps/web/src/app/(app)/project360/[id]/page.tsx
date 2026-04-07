'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import {
  ArrowLeft, Target, Calendar, User, CheckCircle, Clock,
  AlertTriangle, Flag, FileText, Plus, Edit, Trash2, Check, Download, Users
} from 'lucide-react';

interface Project {
  id: string;
  code: string;
  name: string;
  description: string;
  status: string;
  priority: string;
  progress: number;
  targetDate: string;
  createdAt?: string;
  responsible: {
    id: string;
    name: string;
    email: string;
  };
  origin: string;
  tasks?: any[];
  _count?: {
    tasks: number;
  };
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Tasks state
  const [tasks, setTasks] = useState<any[]>([]);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [newTask, setNewTask] = useState({ title: '', responsible: '', dueDate: '', status: 'PENDING' });

  // Activity History state
  const [activityHistory, setActivityHistory] = useState<any[]>([]);

  // Attachments state
  const [attachments, setAttachments] = useState<any[]>([]);
  const [showAddAttachment, setShowAddAttachment] = useState(false);
  const [newAttachment, setNewAttachment] = useState({ name: '', url: '', type: '' });

  // Reminders state
  const [reminders, setReminders] = useState<any[]>([]);
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [newReminder, setNewReminder] = useState({ title: '', reminderDate: '', description: '' });

  // Edit Project state
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  useEffect(() => {
    loadProject();
    loadActivityHistory();
    loadAttachments();
    loadReminders();
  }, [params.id]);

  useEffect(() => {
    if (project?.tasks) {
      setTasks(project.tasks);
    }
  }, [project]);

  const loadProject = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(`/project360/projects/${params.id}`) as any;
      setProject(response.project || null);
    } catch (err: any) {
      setError(err.message || 'Error al cargar el proyecto');
    } finally {
      setLoading(false);
    }
  };

  const loadActivityHistory = async () => {
    try {
      const response = await apiFetch(`/project360/projects/${params.id}/history`) as any;
      setActivityHistory(response.history || []);
    } catch (err) {
      console.error('Error loading activity history:', err);
    }
  };

  const loadAttachments = async () => {
    try {
      const response = await apiFetch(`/project360/projects/${params.id}/attachments`) as any;
      setAttachments(response.attachments || []);
    } catch (err) {
      console.error('Error loading attachments:', err);
    }
  };

  const loadReminders = async () => {
    try {
      const response = await apiFetch(`/project360/projects/${params.id}/reminders`) as any;
      setReminders(response.reminders || []);
    } catch (err) {
      console.error('Error loading reminders:', err);
    }
  };

  const handleAddReminder = async () => {
    if (!newReminder.title || !newReminder.reminderDate) return;
    
    try {
      const response = await apiFetch(`/project360/projects/${params.id}/reminders`, {
        method: 'POST',
        json: newReminder
      }) as any;
      setReminders([...reminders, response.reminder].sort((a, b) => 
        new Date(a.reminderDate).getTime() - new Date(b.reminderDate).getTime()
      ));
      setNewReminder({ title: '', reminderDate: '', description: '' });
      setShowAddReminder(false);
    } catch (err) {
      console.error('Error adding reminder:', err);
    }
  };

  const handleCompleteReminder = async (reminderId: string) => {
    try {
      await apiFetch(`/project360/reminders/${reminderId}/complete`, {
        method: 'POST'
      });
      setReminders(reminders.map(r => 
        r.id === reminderId ? { ...r, isCompleted: true } : r
      ));
    } catch (err) {
      console.error('Error completing reminder:', err);
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    try {
      await apiFetch(`/project360/reminders/${reminderId}`, {
        method: 'DELETE'
      });
      setReminders(reminders.filter(r => r.id !== reminderId));
    } catch (err) {
      console.error('Error deleting reminder:', err);
    }
  };

  const handleEditProject = async () => {
    if (!editingProject) return;
    
    try {
      const response = await apiFetch(`/project360/projects/${params.id}`, {
        method: 'PUT',
        json: {
          name: editingProject.name,
          description: editingProject.description,
          status: editingProject.status,
          priority: editingProject.priority,
          targetDate: editingProject.targetDate,
          responsibleId: editingProject.responsible?.id
        }
      }) as any;
      
      setProject(response.project);
      setShowEditProjectModal(false);
      setEditingProject(null);
    } catch (err) {
      console.error('Error updating project:', err);
    }
  };

  const handleAddAttachment = async () => {
    if (!newAttachment.name || !newAttachment.url) return;
    
    try {
      const response = await apiFetch(`/project360/projects/${params.id}/attachments`, {
        method: 'POST',
        json: newAttachment
      }) as any;
      setAttachments([response.attachment, ...attachments]);
      setNewAttachment({ name: '', url: '', type: '' });
      setShowAddAttachment(false);
    } catch (err) {
      console.error('Error adding attachment:', err);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      await apiFetch(`/project360/attachments/${attachmentId}`, {
        method: 'DELETE'
      });
      setAttachments(attachments.filter(a => a.id !== attachmentId));
    } catch (err) {
      console.error('Error deleting attachment:', err);
    }
  };

  // Task management functions
  const toggleTaskStatus = (taskId: string) => {
    const updatedTasks = tasks.map(t => 
      t.id === taskId 
        ? { ...t, status: t.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED' }
        : t
    );
    setTasks(updatedTasks);
    updateProjectProgress(updatedTasks);
  };

  const handleAddTask = () => {
    if (!newTask.title.trim()) return;
    const task = {
      id: Date.now().toString(),
      ...newTask
    };
    const updatedTasks = [...tasks, task];
    setTasks(updatedTasks);
    updateProjectProgress(updatedTasks);
    setNewTask({ title: '', responsible: '', dueDate: '', status: 'PENDING' });
    setShowAddTaskModal(false);
  };

  const handleEditTask = () => {
    if (!editingTask?.title.trim()) return;
    const updatedTasks = tasks.map(t => 
      t.id === editingTask.id ? editingTask : t
    );
    setTasks(updatedTasks);
    updateProjectProgress(updatedTasks);
    setEditingTask(null);
    setShowEditTaskModal(false);
  };

  const updateProjectProgress = async (taskList: any[]) => {
    if (taskList.length === 0) return;
    const completed = taskList.filter(t => t.status === 'COMPLETED').length;
    const progress = Math.round((completed / taskList.length) * 100);
    
    const updatedProject = { ...project, progress, tasks: taskList, _count: { tasks: taskList.length } };
    setProject(prev => prev ? updatedProject : null);
    
    // Persist to backend
    try {
      await apiFetch(`/project360/projects/${params.id}`, {
        method: 'PUT',
        json: { tasks: taskList, progress, _count: { tasks: taskList.length } }
      });
    } catch (err) {
      console.error('Error saving tasks:', err);
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'PENDING': 'Pendiente',
      'IN_PROGRESS': 'En Progreso',
      'COMPLETED': 'Completado',
      'CANCELLED': 'Cancelado',
      'ON_HOLD': 'En Pausa'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'IN_PROGRESS': 'bg-blue-100 text-blue-800',
      'COMPLETED': 'bg-green-100 text-green-800',
      'CANCELLED': 'bg-gray-100 text-gray-800',
      'ON_HOLD': 'bg-purple-100 text-purple-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      'LOW': 'Baja',
      'MEDIUM': 'Media',
      'HIGH': 'Alta',
      'CRITICAL': 'Crítica'
    };
    return labels[priority] || priority;
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'LOW': 'bg-blue-100 text-blue-800',
      'MEDIUM': 'bg-yellow-100 text-yellow-800',
      'HIGH': 'bg-orange-100 text-orange-800',
      'CRITICAL': 'bg-red-100 text-red-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-gray-600 mb-4">{error || 'Proyecto no encontrado'}</p>
        <Link href="/project360" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Volver a Proyectos
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link 
          href="/project360" 
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <p className="text-gray-500">{project.code}</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => { setEditingProject(project); setShowEditProjectModal(true); }}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <Edit className="w-5 h-5" />
          </button>
          <button className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Target className="w-4 h-4" />
            <span className="text-sm">Estado</span>
          </div>
          <span className={`inline-flex px-2 py-1 rounded-full text-sm font-medium ${getStatusColor(project.status)}`}>
            {getStatusLabel(project.status)}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Flag className="w-4 h-4" />
            <span className="text-sm">Prioridad</span>
          </div>
          <span className={`inline-flex px-2 py-1 rounded-full text-sm font-medium ${getPriorityColor(project.priority)}`}>
            {getPriorityLabel(project.priority)}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">Fecha de Inicio</span>
          </div>
          <p className="text-gray-900 font-medium">
            {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'No definida'}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">Fecha Objetivo</span>
          </div>
          <p className="text-gray-900 font-medium">
            {project.targetDate ? new Date(project.targetDate).toLocaleDateString() : 'No definida'}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Users className="w-4 h-4" />
            <span className="text-sm">Líder de Proyecto</span>
          </div>
          <p className="text-gray-900 font-medium">
            {project.responsible?.name || project.responsible?.email || 'Sin asignar'}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Progreso</h3>
          <span className="text-lg font-bold text-blue-600">{project.progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className="bg-blue-600 h-3 rounded-full transition-all" 
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>

      {/* Description */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-3">Descripción</h3>
        <p className="text-gray-600">{project.description || 'Sin descripción'}</p>
      </div>

      {/* Tasks */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Tareas</h3>
          <button 
            onClick={() => setShowAddTaskModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Agregar Tarea
          </button>
        </div>
        
        {tasks.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No hay tareas asignadas</p>
          </div>
        ) : (
          <div className="space-y-2">
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
                <span className="text-xs text-gray-500">
                  {task.dueDate}
                </span>
                <button
                  onClick={() => { setEditingTask(task); setShowEditTaskModal(true); }}
                  className="p-1 text-gray-400 hover:text-blue-600"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attachments */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Archivos Adjuntos</h3>
          <button
            onClick={() => setShowAddAttachment(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Agregar
          </button>
        </div>
        
        {attachments.length === 0 ? (
          <p className="text-gray-500 text-center py-4">Sin archivos adjuntos</p>
        ) : (
          <div className="space-y-2">
            {attachments.map(attachment => (
              <div key={attachment.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <FileText className="w-8 h-8 text-blue-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{attachment.name}</p>
                  <p className="text-xs text-gray-500">
                    {attachment.uploadedByName} • {new Date(attachment.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                    title="Descargar"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => handleDeleteAttachment(attachment.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showAddAttachment && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Agregar Archivo</h4>
            <div className="space-y-3">
              <input
                type="text"
                value={newAttachment.name}
                onChange={(e) => setNewAttachment({ ...newAttachment, name: e.target.value })}
                placeholder="Nombre del archivo"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <input
                type="text"
                value={newAttachment.url}
                onChange={(e) => setNewAttachment({ ...newAttachment, url: e.target.value })}
                placeholder="URL del archivo"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddAttachment}
                  disabled={!newAttachment.name || !newAttachment.url}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  Agregar
                </button>
                <button
                  onClick={() => setShowAddAttachment(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reminders */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Recordatorios</h3>
          <button
            onClick={() => setShowAddReminder(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Agregar
          </button>
        </div>
        
        {reminders.length === 0 ? (
          <p className="text-gray-500 text-center py-4">Sin recordatorios</p>
        ) : (
          <div className="space-y-2">
            {reminders.map(reminder => (
              <div key={reminder.id} className={`flex items-center gap-3 p-3 rounded-lg ${
                reminder.isCompleted ? 'bg-gray-50' : 'bg-yellow-50'
              }`}>
                <button
                  onClick={() => !reminder.isCompleted && handleCompleteReminder(reminder.id)}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    reminder.isCompleted 
                      ? 'bg-green-500 border-green-500' 
                      : 'border-yellow-400 hover:border-yellow-500'
                  }`}
                >
                  {reminder.isCompleted && <Check className="w-3 h-3 text-white" />}
                </button>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${reminder.isCompleted ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                    {reminder.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(reminder.reminderDate).toLocaleDateString()}
                    {reminder.description && ` - ${reminder.description}`}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteReminder(reminder.id)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {showAddReminder && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Nuevo Recordatorio</h4>
            <div className="space-y-3">
              <input
                type="text"
                value={newReminder.title}
                onChange={(e) => setNewReminder({ ...newReminder, title: e.target.value })}
                placeholder="Título"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <input
                type="date"
                value={newReminder.reminderDate}
                onChange={(e) => setNewReminder({ ...newReminder, reminderDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <input
                type="text"
                value={newReminder.description}
                onChange={(e) => setNewReminder({ ...newReminder, description: e.target.value })}
                placeholder="Descripción (opcional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddReminder}
                  disabled={!newReminder.title || !newReminder.reminderDate}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  Guardar
                </button>
                <button
                  onClick={() => setShowAddReminder(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Activity History */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-4">Historial de Cambios</h3>
        {activityHistory.length === 0 ? (
          <p className="text-gray-500 text-center py-4">Sin registros de actividad</p>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {activityHistory.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  entry.action === 'CREATE' ? 'bg-green-500' :
                  entry.action === 'UPDATE' ? 'bg-blue-500' :
                  entry.action === 'DELETE' ? 'bg-red-500' :
                  entry.action === 'STATUS_CHANGE' ? 'bg-yellow-500' :
                  'bg-gray-500'
                }`} />
                <div className="flex-1">
                  <p className="text-sm text-gray-800">{entry.details}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {entry.userName} • {new Date(entry.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Task Modal */}
      {showAddTaskModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Agregar Tarea</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nombre de la tarea"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
                  <input
                    type="text"
                    value={newTask.responsible}
                    onChange={(e) => setNewTask({ ...newTask, responsible: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha límite</label>
                  <input
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select
                  value={newTask.status}
                  onChange={(e) => setNewTask({ ...newTask, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="PENDING">Pendiente</option>
                  <option value="IN_PROGRESS">En Progreso</option>
                  <option value="COMPLETED">Completado</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowAddTaskModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddTask}
                disabled={!newTask.title}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {showEditTaskModal && editingTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Editar Tarea</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <input
                  type="text"
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
                  <input
                    type="text"
                    value={editingTask.responsible}
                    onChange={(e) => setEditingTask({ ...editingTask, responsible: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha límite</label>
                  <input
                    type="date"
                    value={editingTask.dueDate}
                    onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select
                  value={editingTask.status}
                  onChange={(e) => setEditingTask({ ...editingTask, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="PENDING">Pendiente</option>
                  <option value="IN_PROGRESS">En Progreso</option>
                  <option value="COMPLETED">Completado</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowEditTaskModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditTask}
                disabled={!editingTask.title}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Project Modal */}
      {showEditProjectModal && editingProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Editar Proyecto</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={editingProject.name}
                  onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={editingProject.description || ''}
                  onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select
                    value={editingProject.status}
                    onChange={(e) => setEditingProject({ ...editingProject, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PENDING">Pendiente</option>
                    <option value="IN_PROGRESS">En Progreso</option>
                    <option value="AT_RISK">En Riesgo</option>
                    <option value="OVERDUE">Vencido</option>
                    <option value="COMPLETED">Completado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                  <select
                    value={editingProject.priority}
                    onChange={(e) => setEditingProject({ ...editingProject, priority: e.target.value })}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha objetivo</label>
                <input
                  type="date"
                  value={editingProject.targetDate?.split('T')[0] || ''}
                  onChange={(e) => setEditingProject({ ...editingProject, targetDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowEditProjectModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditProject}
                disabled={!editingProject.name}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
