'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import {
  ArrowLeft, Target, Calendar, User, CheckCircle, Clock,
  AlertTriangle, Flag, FileText, Plus, Edit, Trash2, Check, Download, Users, Upload,
  TrendingUp, TrendingDown, Zap, RefreshCw, X, Shield, Send, ArrowRight,
  BarChart3, Cpu, Briefcase, Wallet, FileSpreadsheet, Lightbulb, MessageSquare
} from 'lucide-react';

import BusinessCaseTab from '@/components/project360/BusinessCaseTab';
import SimulationTab from '@/components/project360/SimulationTab';
import OperationalSizingTab from '@/components/project360/OperationalSizingTab';
import ProjectCopilot from '@/components/project360/ProjectCopilot';

interface Project {
  id: string;
  code: string;
  name: string;
  description: string;
  status: string;
  priority: string;
  progress: number;
  etapaAprobacion?: string;
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
  // Pro fields
  budget?: number;
  budgetCurrency?: string;
  actualCost?: number;
  licitationMode?: string;
  budgetItems?: any[];
  milestones?: any[];
  aiAnalyses?: any[];
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reminders state
  const [reminders, setReminders] = useState<any[]>([]);
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [newReminder, setNewReminder] = useState({ title: '', reminderDate: '', description: '' });

  // Edit Project state
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Pro states
  const [milestones, setMilestones] = useState<any[]>([]);
  const [budgetItems, setBudgetItems] = useState<any[]>([]);
  const [aiAnalyses, setAiAnalyses] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'business-case' | 'simulation' | 'sizing' | 'budget' | 'milestones' | 'analysis' | 'history' | 'aprobaciones' | 'copilot'>('overview');
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [newMilestone, setNewMilestone] = useState({ name: '', description: '', targetDate: '' });
  const [showAddBudgetItem, setShowAddBudgetItem] = useState(false);
  const [newBudgetItem, setNewBudgetItem] = useState({ 
    nombre: '', 
    categoria: 'MATERIAL', 
    cantidad: '', 
    unidadMedida: 'unidades',
    costoUnitario: '',
    costoTotalEstimado: '',
    moneda: 'ARS',
    descripcion: '',
    proveedorNombre: ''
  });
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareWithId, setCompareWithId] = useState('');
  const [comparisonResult, setComparisonResult] = useState<any>(null);

  // Aprobaciones workflow
  const [aprobaciones, setAprobaciones] = useState<any[]>([]);
  const [showSolicitarAprobacion, setShowSolicitarAprobacion] = useState(false);
  const [nuevaAprobacion, setNuevaAprobacion] = useState({ etapa: '', aprobadorId: '', comentarios: '' });
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [showAvanzarEtapa, setShowAvanzarEtapa] = useState(false);
  const [etapaDestino, setEtapaDestino] = useState('');

  // Precio de venta y margen
  const [precioVenta, setPrecioVenta] = useState<number | null>(null);
  const [showPrecioVenta, setShowPrecioVenta] = useState(false);

  useEffect(() => {
    loadProject();
    loadActivityHistory();
    loadAttachments();
    loadReminders();
    loadMilestones();
    loadBudgetItems();
    loadAiAnalyses();
    loadAprobaciones();
    loadEmpleados();
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
      if (!response?.project) {
        setError('No se pudo cargar el proyecto. Verificá tu sesión o volvé al listado.');
      } else {
        setProject(response.project);
      }
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

  const loadMilestones = async () => {
    try {
      const response = await apiFetch(`/project360/projects/${params.id}/milestones`) as any;
      setMilestones(response.milestones || []);
    } catch (err) {
      console.error('Error loading milestones:', err);
    }
  };

  const loadBudgetItems = async () => {
    try {
      const response = await apiFetch(`/project360/projects/${params.id}/budget-items`) as any;
      setBudgetItems(response.budgetItems || []);
    } catch (err) {
      console.error('Error loading budget items:', err);
    }
  };

  const loadAiAnalyses = async () => {
    try {
      const response = await apiFetch(`/project360/projects/${params.id}/ai-analyses`) as any;
      setAiAnalyses(response.aiAnalyses || []);
    } catch (err) {
      console.error('Error loading AI analyses:', err);
    }
  };

  const loadAprobaciones = async () => {
    try {
      const response = await apiFetch(`/project360/projects/${params.id}/aprobaciones`) as any;
      setAprobaciones(response.aprobaciones || []);
    } catch (err) {
      console.error('Error loading aprobaciones:', err);
    }
  };

  const loadEmpleados = async () => {
    try {
      const response = await apiFetch('/project360/members') as any;
      setEmpleados(response.users || []);
    } catch (err) {
      console.error('Error loading members:', err);
    }
  };

  const handleSolicitarAprobacion = async () => {
    if (!nuevaAprobacion.etapa || !nuevaAprobacion.aprobadorId) {
      alert('Seleccioná etapa y aprobador');
      return;
    }
    try {
      const response = await apiFetch(`/project360/projects/${params.id}/aprobaciones`, {
        method: 'POST',
        json: nuevaAprobacion
      }) as any;
      alert(response.mensaje || 'Solicitud enviada');
      setShowSolicitarAprobacion(false);
      setNuevaAprobacion({ etapa: '', aprobadorId: '', comentarios: '' });
      loadAprobaciones();
    } catch (err: any) {
      alert('Error: ' + (err.message || 'No se pudo enviar'));
    }
  };

  const handleAprobarEtapa = async (aprobacionId: string) => {
    try {
      const response = await apiFetch(`/project360/aprobaciones/${aprobacionId}/aprobar`, {
        method: 'POST',
        json: {}
      }) as any;
      alert(response.mensaje || 'Etapa aprobada');
      loadAprobaciones();
    } catch (err: any) {
      alert('Error: ' + (err.message || 'No se pudo aprobar'));
    }
  };

  const handleRechazarEtapa = async (aprobacionId: string) => {
    const comentarios = prompt('Motivo del rechazo:');
    if (!comentarios) return;
    try {
      const response = await apiFetch(`/project360/aprobaciones/${aprobacionId}/rechazar`, {
        method: 'POST',
        json: { comentarios }
      }) as any;
      alert(response.mensaje || 'Etapa rechazada');
      loadAprobaciones();
    } catch (err: any) {
      alert('Error: ' + (err.message || 'No se pudo rechazar'));
    }
  };

  const handleAvanzarEtapa = async () => {
    if (!etapaDestino) {
      alert('Seleccioná la etapa destino');
      return;
    }
    try {
      const response = await apiFetch(`/project360/projects/${params.id}/avanzar-etapa`, {
        method: 'POST',
        json: { etapaDestino }
      }) as any;
      alert(response.mensaje || 'Etapa avanzada');
      setShowAvanzarEtapa(false);
      setEtapaDestino('');
      loadProject();
      loadAprobaciones();
    } catch (err: any) {
      alert('Error: ' + (err.message || err.error || 'No se pudo avanzar'));
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  const handleAddAttachment = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      // Subir archivo al storage
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', selectedFile.name);
      
      const uploadRes = await apiFetch<{ url: string; size: number; type: string }>('/storage/upload', {
        method: 'POST',
        body: formData
      });
      
      // Crear attachment con la URL del archivo subido
      const response = await apiFetch(`/project360/projects/${params.id}/attachments`, {
        method: 'POST',
        json: {
          name: selectedFile.name,
          url: uploadRes.url,
          size: uploadRes.size,
          type: uploadRes.type || selectedFile.type
        }
      }) as any;
      
      setAttachments([response.attachment, ...attachments]);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setShowAddAttachment(false);
    } catch (err) {
      console.error('Error adding attachment:', err);
      alert('Error al subir archivo');
    } finally {
      setUploading(false);
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

  const handleAddMilestone = async () => {
    if (!newMilestone.name || !newMilestone.targetDate) return;
    try {
      const res = await apiFetch(`/project360/projects/${params.id}/milestones`, { method: 'POST', json: newMilestone }) as any;
      setMilestones([...milestones, res.milestone].sort((a: any, b: any) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()));
      setNewMilestone({ name: '', description: '', targetDate: '' });
      setShowAddMilestone(false);
    } catch (err) { console.error(err); }
  };

  const handleAddBudgetItem = async () => {
    if (!newBudgetItem.nombre || !newBudgetItem.costoTotalEstimado) return;
    try {
      const cantidad = parseFloat(newBudgetItem.cantidad || '1');
      const costoUnitario = parseFloat(newBudgetItem.costoUnitario || '0');
      const costoTotalEstimado = parseFloat(newBudgetItem.costoTotalEstimado || '0');
      
      const res = await apiFetch(`/project360/projects/${params.id}/budget-items`, {
        method: 'POST',
        json: {
          nombre: newBudgetItem.nombre,
          categoria: newBudgetItem.categoria,
          cantidad,
          unidadMedida: newBudgetItem.unidadMedida,
          costoUnitario,
          costoTotalEstimado,
          moneda: newBudgetItem.moneda,
          descripcion: newBudgetItem.descripcion,
          proveedorNombre: newBudgetItem.proveedorNombre,
          estado: 'PRESUPUESTADO'
        }
      }) as any;
      setBudgetItems([...budgetItems, res.budgetItem]);
      setNewBudgetItem({ 
        nombre: '', 
        categoria: 'MATERIAL', 
        cantidad: '', 
        unidadMedida: 'unidades',
        costoUnitario: '',
        costoTotalEstimado: '',
        moneda: 'ARS',
        descripcion: '',
        proveedorNombre: ''
      });
      setShowAddBudgetItem(false);
    } catch (err) { console.error(err); }
  };

  const handleDeleteBudgetItem = async (id: string) => {
    if (!confirm('Eliminar ítem?')) return;
    await apiFetch(`/project360/budget-items/${id}`, { method: 'DELETE' });
    setBudgetItems(budgetItems.filter(b => b.id !== id));
  };

  const handleDeleteMilestone = async (id: string) => {
    if (!confirm('Eliminar hito?')) return;
    await apiFetch(`/project360/milestones/${id}`, { method: 'DELETE' });
    setMilestones(milestones.filter(m => m.id !== id));
  };

  const handleCompareAnalysis = async () => {
    if (!compareWithId || !aiAnalyses[0]) return;
    try {
      const res = await apiFetch(`/project360/ai-analyses/${aiAnalyses[0].id}/compare`, { method: 'POST', json: { compareWithId } }) as any;
      setComparisonResult(res);
    } catch (err) { console.error(err); }
  };

  const handleCreateTaskFromRequirement = async (req: any) => {
    try {
      const res = await apiFetch(`/project360/projects/${params.id}/tasks`, {
        method: 'POST',
        json: {
          title: req.title,
          description: req.description || '',
          priority: req.priority === 'ALTA' ? 'HIGH' : req.priority === 'MEDIA' ? 'MEDIUM' : 'LOW',
          status: 'PENDING',
        }
      }) as any;
      setTasks(prev => [...prev, res.task]);
      alert(`Tarea "${req.title}" creada exitosamente`);
    } catch (err: any) {
      alert('Error creando tarea: ' + err.message);
    }
  };

  const handleImportAllRequirements = async (requirements: any[]) => {
    if (!confirm(`¿Crear ${requirements.length} tareas desde los requerimientos del análisis?`)) return;
    let created = 0;
    for (const req of requirements) {
      try {
        const res = await apiFetch(`/project360/projects/${params.id}/tasks`, {
          method: 'POST',
          json: {
            title: req.title,
            description: req.description || '',
            priority: req.priority === 'ALTA' ? 'HIGH' : req.priority === 'MEDIA' ? 'MEDIUM' : 'LOW',
            status: 'PENDING',
          }
        }) as any;
        setTasks(prev => [...prev, res.task]);
        created++;
      } catch { /* skip */ }
    }
    alert(`${created} tareas creadas correctamente`);
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

  const getEtapaLabel = (etapa: string) => {
    const labels: Record<string, string> = {
      'LICITACION_BORRADOR': 'Licitación - Borrador',
      'DIMENSIONADO': 'Dimensionado',
      'COTIZADO': 'Cotizado',
      'APROBADO_PARA_PRESENTAR': 'Aprobado para Presentar',
      'ADJUDICADO': 'Adjudicado',
      'EN_EJECUCION': 'En Ejecución',
      'CERRADO': 'Cerrado'
    };
    return labels[etapa] || etapa;
  };

  const getEtapaColor = (etapa: string) => {
    const colors: Record<string, string> = {
      'LICITACION_BORRADOR': 'bg-gray-100 text-gray-800',
      'DIMENSIONADO': 'bg-blue-100 text-blue-800',
      'COTIZADO': 'bg-purple-100 text-purple-800',
      'APROBADO_PARA_PRESENTAR': 'bg-indigo-100 text-indigo-800',
      'ADJUDICADO': 'bg-green-100 text-green-800',
      'EN_EJECUCION': 'bg-orange-100 text-orange-800',
      'CERRADO': 'bg-gray-200 text-gray-900'
    };
    return colors[etapa] || 'bg-gray-100 text-gray-800';
  };

  const getEstadoAprobacionLabel = (estado: string) => {
    const labels: Record<string, string> = {
      'PENDIENTE': 'Pendiente',
      'APROBADO': 'Aprobado',
      'RECHAZADO': 'Rechazado'
    };
    return labels[estado] || estado;
  };

  const getEstadoAprobacionColor = (estado: string) => {
    const colors: Record<string, string> = {
      'PENDIENTE': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'APROBADO': 'bg-green-100 text-green-800 border-green-200',
      'RECHAZADO': 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[estado] || 'bg-gray-100 text-gray-800';
  };

  const ETAPAS_ORDEN = [
    'LICITACION_BORRADOR',
    'DIMENSIONADO',
    'COTIZADO',
    'APROBADO_PARA_PRESENTAR',
    'ADJUDICADO',
    'EN_EJECUCION',
    'CERRADO'
  ];

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

      {/* ── ENTERPRISE TABS ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex overflow-x-auto border-b">
          {[
            { key: 'overview', label: 'General', icon: Target },
            { key: 'business-case', label: 'Business Case', icon: BarChart3 },
            { key: 'simulation', label: 'Simulación', icon: TrendingUp },
            { key: 'sizing', label: 'Dimensionamiento', icon: Cpu },
            { key: 'budget', label: 'Presupuesto', icon: Wallet },
            { key: 'milestones', label: 'Hitos', icon: Calendar },
            { key: 'analysis', label: 'Análisis IA', icon: Zap },
            { key: 'aprobaciones', label: 'Aprobaciones', icon: Shield },
            { key: 'history', label: 'Historial', icon: Clock },
            { key: 'copilot', label: 'Copilot IA', icon: MessageSquare },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === t.key
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
      <>

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
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="w-full text-sm"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.zip,.rar"
              />
              {selectedFile && (
                <p className="text-xs text-gray-600">
                  Archivo: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleAddAttachment}
                  disabled={!selectedFile || uploading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      Subiendo...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Subir
                    </>
                  )}
                </button>
                <button
                  onClick={() => { setShowAddAttachment(false); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  disabled={uploading}
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

      {/* ══ WORKFLOW DE APROBACIONES (ETAPAS DEL NEGOCIO) ══ */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-600" /> Workflow de Aprobaciones
          </h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowSolicitarAprobacion(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700"
            >
              <Send className="w-4 h-4" /> Solicitar Aprobación
            </button>
            <button 
              onClick={() => setShowAvanzarEtapa(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
            >
              <ArrowRight className="w-4 h-4" /> Avanzar Etapa
            </button>
          </div>
        </div>

        {/* Etapa Actual */}
        <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Etapa Actual del Proyecto</p>
              <p className={`text-2xl font-bold ${getEtapaColor(project.etapaAprobacion || 'LICITACION_BORRADOR')}`}>
                {getEtapaLabel(project.etapaAprobacion || 'LICITACION_BORRADOR')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 mb-1">Progreso en Workflow</p>
              <p className="text-xl font-bold text-gray-800">
                {ETAPAS_ORDEN.indexOf(project.etapaAprobacion || 'LICITACION_BORRADOR') + 1} / {ETAPAS_ORDEN.length}
              </p>
            </div>
          </div>
          {/* Barra de progreso del workflow */}
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-amber-500 h-2 rounded-full transition-all" 
                style={{ width: `${((ETAPAS_ORDEN.indexOf(project.etapaAprobacion || 'LICITACION_BORRADOR') + 1) / ETAPAS_ORDEN.length) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Licitación</span>
              <span>Cerrado</span>
            </div>
          </div>
        </div>

        {/* Lista de Aprobaciones */}
        <h4 className="font-medium text-gray-900 mb-3">Historial de Aprobaciones</h4>
        {aprobaciones.length === 0 ? (
          <p className="text-gray-500 text-center py-4">Sin solicitudes de aprobación registradas</p>
        ) : (
          <div className="space-y-3">
            {aprobaciones.map((aprob: any) => (
              <div key={aprob.id} className={`p-4 rounded-xl border ${getEstadoAprobacionColor(aprob.estado)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{getEtapaLabel(aprob.etapa)}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/50">
                        {getEstadoAprobacionLabel(aprob.estado)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Solicitado por: {aprob.solicitadoPor?.firstName || 'Usuario'} → Aprobador: {aprob.aprobador?.firstName || 'Sin asignar'} {aprob.aprobador?.lastName || ''}
                    </p>
                    {aprob.comentarios && (
                      <p className="text-sm text-gray-700 mt-2 italic">"{aprob.comentarios}"</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(aprob.solicitadoEn).toLocaleDateString('es-AR')}
                      {aprob.aprobadoEn && ` → ${new Date(aprob.aprobadoEn).toLocaleDateString('es-AR')}`}
                    </p>
                  </div>
                  {aprob.estado === 'PENDIENTE' && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleAprobarEtapa(aprob.id)}
                        className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                      >
                        Aprobar
                      </button>
                      <button 
                        onClick={() => handleRechazarEtapa(aprob.id)}
                        className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ PRESUPUESTO / RECURSOS DIMENSIONADOS ══ */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-indigo-600" /> Recursos Dimensionados</h3>
          <button onClick={() => setShowAddBudgetItem(true)} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"><Plus className="w-4 h-4" /> Agregar Recurso</button>
        </div>
        {project?.budget && (
          <div className="mb-4 bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between text-sm mb-2">
              <span>Total: <strong>{project.budget?.toLocaleString('es-AR', { style: 'currency', currency: project.budgetCurrency || 'ARS' })}</strong></span>
              <span>Gasto: <strong>{(project.actualCost || 0).toLocaleString('es-AR', { style: 'currency', currency: project.budgetCurrency || 'ARS' })}</strong></span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3"><div className="bg-indigo-600 h-3 rounded-full" style={{ width: `${Math.min(100, ((project.actualCost || 0) / (project.budget || 1)) * 100)}%` }} /></div>
            <p className="text-xs text-gray-500 mt-1">{Math.round(((project.actualCost || 0) / (project.budget || 1)) * 100)}% consumido</p>
          </div>
        )}
        {budgetItems.length === 0 ? <p className="text-gray-500 text-center py-4">Sin ítems</p> : (
          <div className="space-y-2">
            {budgetItems.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.name} <span className="text-xs text-gray-500">({item.category})</span></p>
                  <div className="flex gap-3 text-xs text-gray-600 mt-1">
                    <span>Est: {item.estimated?.toLocaleString('es-AR', { style: 'currency', currency: item.currency || 'ARS' })}</span>
                    <span>Act: {item.actual?.toLocaleString('es-AR', { style: 'currency', currency: item.currency || 'ARS' })}</span>
                    {item.isExpense && <span className="text-red-600 font-medium">GASTO</span>}
                  </div>
                </div>
                <button onClick={() => handleDeleteBudgetItem(item.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
        {showAddBudgetItem && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
            <h4 className="text-sm font-medium">Nuevo Recurso</h4>
            <input type="text" value={newBudgetItem.nombre} onChange={e => setNewBudgetItem({ ...newBudgetItem, nombre: e.target.value })} placeholder="Nombre del recurso" className="w-full px-3 py-2 border rounded-lg text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <select value={newBudgetItem.categoria} onChange={e => setNewBudgetItem({ ...newBudgetItem, categoria: e.target.value })} className="px-3 py-2 border rounded-lg text-sm">
                <option value="MATERIAL">Material</option><option value="MANO_OBRA">Mano de obra</option><option value="SERVICIO">Servicio</option><option value="EQUIPO">Equipo</option><option value="SUBCONTRATO">Subcontrato</option><option value="TECNOLOGIA">Tecnología</option><option value="OTRO">Otro</option>
              </select>
              <select value={newBudgetItem.unidadMedida} onChange={e => setNewBudgetItem({ ...newBudgetItem, unidadMedida: e.target.value })} className="px-3 py-2 border rounded-lg text-sm">
                <option value="unidades">Unidades</option><option value="horas">Horas</option><option value="dias">Días</option><option value="meses">Meses</option><option value="m2">m²</option><option value="kg">kg</option><option value="litros">Litros</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input type="number" value={newBudgetItem.cantidad} onChange={e => setNewBudgetItem({ ...newBudgetItem, cantidad: e.target.value })} placeholder="Cantidad" className="px-3 py-2 border rounded-lg text-sm" />
              <input type="number" value={newBudgetItem.costoUnitario} onChange={e => setNewBudgetItem({ ...newBudgetItem, costoUnitario: e.target.value })} placeholder="Costo unitario" className="px-3 py-2 border rounded-lg text-sm" />
              <input type="number" value={newBudgetItem.costoTotalEstimado} onChange={e => setNewBudgetItem({ ...newBudgetItem, costoTotalEstimado: e.target.value })} placeholder="Costo total" className="px-3 py-2 border rounded-lg text-sm" />
            </div>
            <input type="text" value={newBudgetItem.proveedorNombre} onChange={e => setNewBudgetItem({ ...newBudgetItem, proveedorNombre: e.target.value })} placeholder="Proveedor / Responsable" className="w-full px-3 py-2 border rounded-lg text-sm" />
            <input type="text" value={newBudgetItem.descripcion} onChange={e => setNewBudgetItem({ ...newBudgetItem, descripcion: e.target.value })} placeholder="Descripción (opcional)" className="w-full px-3 py-2 border rounded-lg text-sm" />
            <div className="flex gap-3">
              <button onClick={handleAddBudgetItem} disabled={!newBudgetItem.nombre || !newBudgetItem.costoTotalEstimado} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50">Agregar</button>
              <button onClick={() => setShowAddBudgetItem(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm">Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {/* ══ HITOS / TIMELINE ══ */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Clock className="w-5 h-5 text-blue-600" /> Hitos / Timeline</h3>
          <button onClick={() => setShowAddMilestone(true)} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"><Plus className="w-4 h-4" /> Agregar</button>
        </div>
        {milestones.length === 0 ? <p className="text-gray-500 text-center py-4">Sin hitos definidos</p> : (
          <div className="relative border-l-2 border-blue-200 ml-3 space-y-6">
            {milestones.sort((a: any, b: any) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()).map((m: any, i: number) => (
              <div key={m.id} className="ml-6 relative">
                <div className={`absolute -left-[31px] w-4 h-4 rounded-full border-2 ${m.status === 'COMPLETED' ? 'bg-green-500 border-green-500' : 'bg-white border-blue-400'}`} />
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{m.name}</p>
                    <button onClick={() => handleDeleteMilestone(m.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3" /></button>
                  </div>
                  {m.description && <p className="text-xs text-gray-500 mt-1">{m.description}</p>}
                  <p className="text-xs text-gray-500 mt-1">{new Date(m.targetDate).toLocaleDateString()} • {m.status === 'COMPLETED' ? '✓ Completado' : 'Pendiente'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {showAddMilestone && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
            <h4 className="text-sm font-medium">Nuevo Hito</h4>
            <input type="text" value={newMilestone.name} onChange={e => setNewMilestone({ ...newMilestone, name: e.target.value })} placeholder="Nombre del hito" className="w-full px-3 py-2 border rounded-lg text-sm" />
            <input type="text" value={newMilestone.description} onChange={e => setNewMilestone({ ...newMilestone, description: e.target.value })} placeholder="Descripción" className="w-full px-3 py-2 border rounded-lg text-sm" />
            <input type="date" value={newMilestone.targetDate} onChange={e => setNewMilestone({ ...newMilestone, targetDate: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
            <div className="flex gap-3">
              <button onClick={handleAddMilestone} disabled={!newMilestone.name || !newMilestone.targetDate} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">Agregar</button>
              <button onClick={() => setShowAddMilestone(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm">Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {/* ══ ANÁLISIS IA ══ */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Zap className="w-5 h-5 text-purple-600" /> Análisis IA del Documento</h3>
          {aiAnalyses.length > 0 && (
            <div className="flex items-center gap-2">
              <select value={compareWithId} onChange={e => setCompareWithId(e.target.value)} className="px-2 py-1 border rounded-lg text-sm">
                <option value="">Comparar con...</option>
                {aiAnalyses.slice(1).map(a => <option key={a.id} value={a.id}>{a.documentName}</option>)}
              </select>
              <button onClick={handleCompareAnalysis} disabled={!compareWithId} className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50">Comparar</button>
            </div>
          )}
        </div>
        {aiAnalyses.length === 0 ? <p className="text-gray-500 text-center py-4">Sin análisis IA. Creá el proyecto desde "Crear desde licitación" para generar uno.</p> : (
          <div className="space-y-4">
            {aiAnalyses.map((a: any) => {
              const requirements: any[] = Array.isArray(a.requirements) ? a.requirements : [];
              const risks: any[] = Array.isArray(a.risks) ? a.risks : [];
              const timeline: any[] = Array.isArray(a.timeline) ? a.timeline : [];
              const costs: any = a.costs && typeof a.costs === 'object' ? a.costs : {};
              const scores: any = a.scores && typeof a.scores === 'object' ? a.scores : {};
              const avgScore = Object.values(scores).length > 0
                ? (Object.values(scores) as number[]).reduce((s, v) => s + v, 0) / Object.values(scores).length
                : null;
              return (
                <div key={a.id} className="border border-purple-200 rounded-xl p-5 bg-white">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-semibold text-purple-900">{a.documentName}</p>
                      <p className="text-xs text-gray-500">{a.analysisType} · {new Date(a.createdAt).toLocaleDateString('es-AR')}</p>
                    </div>
                    {avgScore !== null && (
                      <div className="flex flex-col items-center bg-purple-50 rounded-lg px-3 py-2">
                        <span className="text-2xl font-bold text-purple-700">{avgScore.toFixed(1)}</span>
                        <span className="text-xs text-purple-500">puntaje IA</span>
                      </div>
                    )}
                  </div>

                  {/* Resumen */}
                  {a.summary && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-xs font-semibold text-blue-700 uppercase mb-1">Resumen ejecutivo</p>
                      <p className="text-sm text-gray-800">{a.summary}</p>
                    </div>
                  )}

                  {/* Scores */}
                  {Object.keys(scores).length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Puntajes</p>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(scores).map(([k, v]: [string, any]) => (
                          <div key={k} className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 w-24 capitalize">{k}</span>
                            <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                              <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${Math.min((v / 10) * 100, 100)}%` }} />
                            </div>
                            <span className="text-xs font-bold text-purple-700 w-6">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Requerimientos */}
                  {requirements.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-600 uppercase">Requerimientos ({requirements.length})</p>
                        <button
                          onClick={() => handleImportAllRequirements(requirements)}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          <Plus className="w-3 h-3" /> Importar todos como tareas
                        </button>
                      </div>
                      <div className="space-y-2">
                        {requirements.map((r: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg group">
                            <span className={`mt-0.5 px-1.5 py-0.5 text-xs rounded font-medium shrink-0 ${
                              r.priority === 'ALTA' ? 'bg-red-100 text-red-700' :
                              r.priority === 'MEDIA' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                            }`}>{r.priority || 'N/A'}</span>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{r.title}</p>
                              {r.description && <p className="text-xs text-gray-600">{r.description}</p>}
                              {r.estimatedCost > 0 && <p className="text-xs text-blue-600">Costo est.: ${r.estimatedCost.toLocaleString('es-AR')}</p>}
                            </div>
                            <button
                              onClick={() => handleCreateTaskFromRequirement(r)}
                              title="Crear tarea"
                              className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Tarea
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Riesgos */}
                  {risks.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Riesgos ({risks.length})</p>
                      <div className="space-y-2">
                        {risks.map((r: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 p-2 bg-red-50 rounded-lg">
                            <span className={`mt-0.5 px-1.5 py-0.5 text-xs rounded font-medium ${
                              r.severity === 'ALTO' ? 'bg-red-200 text-red-800' :
                              r.severity === 'MEDIO' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>{r.severity || 'N/A'}</span>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{r.title}</p>
                              {r.description && <p className="text-xs text-gray-600">{r.description}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timeline */}
                  {timeline.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Cronograma</p>
                      <div className="flex gap-2 flex-wrap">
                        {timeline.map((t: any, i: number) => (
                          <div key={i} className="p-2 bg-blue-50 rounded-lg border border-blue-100 text-xs">
                            <p className="font-medium text-blue-900">{t.phase}</p>
                            <p className="text-blue-600">{t.days} días</p>
                            {t.description && <p className="text-gray-600">{t.description}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Costos */}
                  {costs.totalEstimated > 0 && (
                    <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                      <p className="text-xs font-semibold text-green-700 uppercase mb-1">Costos estimados</p>
                      <p className="text-lg font-bold text-green-800">
                        {costs.totalEstimated.toLocaleString('es-AR', { style: 'currency', currency: costs.currency || 'ARS', maximumFractionDigits: 0 })}
                      </p>
                      {costs.breakdown && costs.breakdown.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {costs.breakdown.map((b: any, i: number) => (
                            <div key={i} className="flex justify-between text-xs text-gray-600">
                              <span>{b.category}</span>
                              <span>${b.amount.toLocaleString('es-AR')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {comparisonResult && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900">Comparación</h4>
              <button onClick={() => setComparisonResult(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap">{JSON.stringify(comparisonResult.comparison, null, 2)}</pre>
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

      {/* Modal: Solicitar Aprobación */}
      {showSolicitarAprobacion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Solicitar Aprobación</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Etapa a Aprobar</label>
                <select
                  value={nuevaAprobacion.etapa}
                  onChange={(e) => setNuevaAprobacion({ ...nuevaAprobacion, etapa: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar etapa...</option>
                  {ETAPAS_ORDEN.filter(e => e !== 'LICITACION_BORRADOR').map(etapa => (
                    <option key={etapa} value={etapa}>{getEtapaLabel(etapa)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aprobador</label>
                <select
                  value={nuevaAprobacion.aprobadorId}
                  onChange={(e) => setNuevaAprobacion({ ...nuevaAprobacion, aprobadorId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar aprobador...</option>
                  {empleados.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.email})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Comentarios</label>
                <textarea
                  value={nuevaAprobacion.comentarios}
                  onChange={(e) => setNuevaAprobacion({ ...nuevaAprobacion, comentarios: e.target.value })}
                  placeholder="Motivo de la solicitud..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowSolicitarAprobacion(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSolicitarAprobacion}
                disabled={!nuevaAprobacion.etapa || !nuevaAprobacion.aprobadorId}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                Enviar Solicitud
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Avanzar Etapa */}
      {showAvanzarEtapa && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Avanzar Etapa del Proyecto</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Etapa actual: <strong>{getEtapaLabel(project.etapaAprobacion || 'LICITACION_BORRADOR')}</strong>
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Etapa Destino</label>
                <select
                  value={etapaDestino}
                  onChange={(e) => setEtapaDestino(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar etapa...</option>
                  {ETAPAS_ORDEN.map((etapa, index) => {
                    const currentIndex = ETAPAS_ORDEN.indexOf(project.etapaAprobacion || 'LICITACION_BORRADOR');
                    if (index > currentIndex) {
                      return <option key={etapa} value={etapa}>{getEtapaLabel(etapa)}</option>;
                    }
                    return null;
                  })}
                </select>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg text-sm text-yellow-800">
                <strong>Nota:</strong> Solo podrás avanzar si todas las etapas intermedias han sido aprobadas.
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowAvanzarEtapa(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAvanzarEtapa}
                disabled={!etapaDestino}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Avanzar
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}

      {/* ── BUSINESS CASE ── */}
      {activeTab === 'business-case' && (
        <BusinessCaseTab projectId={params.id as string} />
      )}

      {/* ── SIMULACIÓN ── */}
      {activeTab === 'simulation' && (
        <SimulationTab projectId={params.id as string} />
      )}

      {/* ── DIMENSIONAMIENTO OPERATIVO ── */}
      {activeTab === 'sizing' && (
        <OperationalSizingTab projectId={params.id as string} />
      )}

      {/* ── COPILOT IA ── */}
      {activeTab === 'copilot' && project && (
        <ProjectCopilot projectId={params.id as string} projectName={project.name} />
      )}

    </div>
  );
}
