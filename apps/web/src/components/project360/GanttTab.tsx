'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Calendar, Clock, AlertTriangle, CheckCircle, ArrowRight,
  Users, Zap, Target, GitBranch, Save, RefreshCw, Plus,
  Trash2, ChevronDown, ChevronRight, Settings, GripVertical,
  LayoutGrid, BarChart3
} from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  completedAt: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  parentId: string | null;
  dependencies: string[];
  baselineStart: string | null;
  baselineEnd: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  progress: number;
  isCriticalPath: boolean;
  slackDays: number;
  resourceIds: string[];
  subtasks?: Task[];
}

interface Props {
  projectId: string;
}

export default function GanttTab({ projectId }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'quarter'>('month');
  const [showCriticalPath, setShowCriticalPath] = useState(true);
  const [showBaseline, setShowBaseline] = useState(true);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [portfolioView, setPortfolioView] = useState(false);
  const [portfolioProjects, setPortfolioProjects] = useState<any[]>([]);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/project360-v1/projects/${projectId}/tasks?includeAll=true`) as any;
      const taskMap = new Map<string, Task>();
      const rootTasks: Task[] = [];
      (res.tasks || []).forEach((t: Task) => { taskMap.set(t.id, { ...t, subtasks: [] }); });
      (res.tasks || []).forEach((t: Task) => {
        const task = taskMap.get(t.id)!;
        if (t.parentId && taskMap.has(t.parentId)) {
          const parent = taskMap.get(t.parentId)!;
          parent.subtasks!.push(task);
        } else { rootTasks.push(task); }
      });
      setTasks(rootTasks);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [projectId]);

  const loadPortfolio = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/project360-v1/projects?limit=50') as any;
      const projects = res.projects || [];
      const enriched = await Promise.all(projects.map(async (p: any) => {
        try {
          const tRes = await apiFetch(`/project360-v1/projects/${p.id}/tasks?includeAll=true`) as any;
          return { ...p, tasks: tRes.tasks || [] };
        } catch { return { ...p, tasks: [] }; }
      }));
      setPortfolioProjects(enriched);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (portfolioView) loadPortfolio();
    else load();
  }, [portfolioView]);

  const calculateCriticalPath = useCallback(async () => {
    setCalculating(true);
    try {
      await apiFetch(`/project360-v1/projects/${projectId}/calculate-critical-path`, { method: 'POST' });
      load();
    } catch (e: any) { alert(e.message); }
    setCalculating(false);
  }, [projectId, load]);

  const allTasks = useMemo(() => {
    const flatten = (tasks: Task[]): Task[] => {
      return tasks.flatMap(t => [t, ...(t.subtasks ? flatten(t.subtasks) : [])]);
    };
    return flatten(tasks);
  }, [tasks]);

  const stats = useMemo(() => {
    const total = allTasks.length;
    const completed = allTasks.filter(t => t.status === 'COMPLETED').length;
    const inProgress = allTasks.filter(t => t.status === 'IN_PROGRESS').length;
    const criticalPath = allTasks.filter(t => t.isCriticalPath).length;
    const delayed = allTasks.filter(t => {
      if (!t.dueDate || t.status === 'COMPLETED') return false;
      return new Date(t.dueDate) < new Date();
    }).length;
    return { total, completed, inProgress, criticalPath, delayed, progress: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [allTasks]);

  const toggleExpand = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const formatDate = (date: string | null) => date ? new Date(date).toLocaleDateString('es-AR') : '-';

  const getBarStyle = (task: Task) => {
    const start = new Date(task.plannedStart || task.dueDate || Date.now());
    const end = new Date(task.plannedEnd || task.dueDate || Date.now());
    const now = new Date();
    const totalDays = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const daysFromStart = Math.max(0, (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const progressWidth = Math.min(100, Math.max(0, (daysFromStart / totalDays) * 100));

    let bgColor = 'bg-blue-400';
    if (task.isCriticalPath) bgColor = 'bg-red-400';
    else if (task.status === 'COMPLETED') bgColor = 'bg-emerald-400';
    else if (new Date(task.dueDate || Date.now()) < new Date() && task.status !== 'COMPLETED') bgColor = 'bg-amber-400';

    return { bgColor, progressWidth };
  };

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggingTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, taskId: string) => {
    e.preventDefault();
    if (draggingTaskId && draggingTaskId !== taskId) {
      setDragOverTaskId(taskId);
    }
  };

  const handleDragLeave = () => {
    setDragOverTaskId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault();
    if (!draggingTaskId || draggingTaskId === targetTaskId) { setDraggingTaskId(null); setDragOverTaskId(null); return; }
    try {
      await apiFetch(`/project360-v1/tasks/${draggingTaskId}/reorder`, {
        method: 'PUT',
        json: { targetTaskId }
      });
      load();
    } catch (err: any) { alert(err.message); }
    setDraggingTaskId(null);
    setDragOverTaskId(null);
  };

  // Portfolio color map
  const projectColorMap = useMemo(() => {
    const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500', 'bg-amber-500', 'bg-indigo-500'];
    const map: Record<string, string> = {};
    portfolioProjects.forEach((p, i) => { map[p.id] = colors[i % colors.length]; });
    return map;
  }, [portfolioProjects]);

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando Gantt...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Gantt Enterprise</h2>
          <p className="text-sm text-gray-500">{portfolioView ? 'Vista portfolio de múltiples proyectos' : 'Cronograma con dependencias, ruta crítica y baseline'}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={calculateCriticalPath}
            disabled={calculating}
            className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <Zap className={`w-4 h-4 ${calculating ? 'animate-spin' : ''}`} />
            {calculating ? 'Calculando...' : 'Calcular Ruta Crítica'}
          </button>
          <button
            onClick={() => setPortfolioView(!portfolioView)}
            className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${portfolioView ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <LayoutGrid className="w-4 h-4" /> {portfolioView ? 'Proyecto' : 'Portfolio'}
          </button>
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['week', 'month', 'quarter'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  viewMode === mode ? 'bg-white text-gray-900 shadow' : 'text-gray-600'
                }`}
              >
                {mode === 'week' ? 'Semana' : mode === 'month' ? 'Mes' : 'Trimestre'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-xs text-gray-500">Total Tareas</div>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
          <div className="text-2xl font-bold text-emerald-600">{stats.completed}</div>
          <div className="text-xs text-emerald-600">Completadas</div>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
          <div className="text-xs text-blue-600">En Progreso</div>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <div className="text-2xl font-bold text-red-600">{stats.criticalPath}</div>
          <div className="text-xs text-red-600">Ruta Crítica</div>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <div className="text-2xl font-bold text-amber-600">{stats.delayed}</div>
          <div className="text-xs text-amber-600">Retrasadas</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 bg-white rounded-xl border p-3">
        <label className="flex items-center gap-2 text-sm">
          <input 
            type="checkbox" 
            checked={showCriticalPath} 
            onChange={e => setShowCriticalPath(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-400 rounded" /> Mostrar Ruta Crítica
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input 
            type="checkbox" 
            checked={showBaseline} 
            onChange={e => setShowBaseline(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 border-2 border-gray-400 border-dashed rounded" /> Mostrar Baseline
          </span>
        </label>
      </div>

      {/* Gantt Chart */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[300px_1fr] border-b bg-gray-50">
          <div className="px-4 py-3 font-medium text-gray-700 text-sm">
            {portfolioView ? 'Proyecto / Tarea' : 'Tarea'}
          </div>
          <div className="grid grid-cols-12 gap-1 px-2 py-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="text-center text-xs text-gray-500 border-l">
                {viewMode === 'month' ? ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][i] : `S${i + 1}`}
              </div>
            ))}
          </div>
        </div>

        {/* Portfolio View */}
        {portfolioView ? (
          <div className="divide-y">
            {portfolioProjects.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">Sin proyectos para mostrar</div>
            ) : portfolioProjects.map((proj: any) => (
              <div key={proj.id}>
                {/* Project Header Row */}
                <div className="grid grid-cols-[300px_1fr] bg-gray-100 border-b">
                  <div className="px-4 py-2 font-semibold text-sm text-gray-800 flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${projectColorMap[proj.id] || 'bg-gray-400'}`} />
                    {proj.name}
                    <span className="text-xs text-gray-500 font-normal">({(proj.tasks || []).length} tareas)</span>
                  </div>
                  <div className="relative h-8">
                    <div
                      className={`absolute h-4 rounded top-2 ${projectColorMap[proj.id] || 'bg-gray-400'} opacity-60`}
                      style={{
                        left: `${(new Date(proj.createdAt || Date.now()).getMonth() / 12) * 100}%`,
                        width: `${Math.max(5, 15)}%`
                      }}
                    />
                  </div>
                </div>
                {/* Project Tasks */}
                {(proj.tasks || []).map((task: any) => {
                  const start = new Date(task.plannedStart || task.dueDate || Date.now());
                  const end = new Date(task.plannedEnd || task.dueDate || Date.now());
                  const leftPct = (start.getMonth() / 12) * 100;
                  const widthPct = Math.max(5, ((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)) * 8);
                  return (
                    <div key={task.id} className="grid grid-cols-[300px_1fr]">
                      <div className="px-8 py-1.5 border-r text-xs text-gray-600 truncate">{task.title}</div>
                      <div className="relative h-7 bg-gray-50/30 grid grid-cols-12 gap-1 px-2">
                        <div
                          className={`absolute h-4 rounded top-1.5 ${projectColorMap[proj.id] || 'bg-gray-400'} opacity-80`}
                          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
        /* Single Project Tasks */
        <div className="divide-y">
          {allTasks.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">No hay tareas para mostrar</div>
          ) : allTasks.map((task) => {
            const hasSubtasks = task.subtasks && task.subtasks.length > 0;
            const isExpanded = expandedTasks.has(task.id);
            const isVisible = !task.parentId || expandedTasks.has(task.parentId || '');
            const { bgColor, progressWidth } = getBarStyle(task);
            const isDragging = draggingTaskId === task.id;
            const isDragOver = dragOverTaskId === task.id;

            if (!isVisible) return null;

            return (
              <div
                key={task.id}
                draggable
                onDragStart={e => handleDragStart(e, task.id)}
                onDragOver={e => handleDragOver(e, task.id)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, task.id)}
                className={`grid grid-cols-[300px_1fr] ${task.isCriticalPath && showCriticalPath ? 'bg-red-50/30' : ''} ${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'bg-blue-50 border-blue-300 border-2' : ''} transition-colors cursor-move`}
              >
                {/* Task Info */}
                <div className="px-4 py-2 border-r flex items-center gap-2">
                  <GripVertical className="w-3 h-3 text-gray-300" />
                  {hasSubtasks && (
                    <button onClick={() => toggleExpand(task.id)} className="text-gray-400 hover:text-gray-600">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  )}
                  <div className={`w-2 h-2 rounded-full ${
                    task.status === 'COMPLETED' ? 'bg-emerald-400' :
                    task.status === 'IN_PROGRESS' ? 'bg-blue-400' : 'bg-gray-300'
                  }`} />
                  <span className={`text-sm truncate ${task.isCriticalPath ? 'font-semibold text-red-900' : 'text-gray-700'}`}>
                    {task.title}
                  </span>
                  {task.dependencies?.length > 0 && (
                    <span title={`Depende de: ${task.dependencies.join(', ')}`}>
                      <GitBranch className="w-3 h-3 text-purple-500" />
                    </span>
                  )}
                </div>

                {/* Timeline Bar */}
                <div className="relative h-10 bg-gray-50/50 grid grid-cols-12 gap-1 px-2">
                  {/* Baseline (dashed) */}
                  {showBaseline && task.baselineStart && task.baselineEnd && (
                    <div
                      className="absolute h-2 border-2 border-gray-400 border-dashed rounded top-1"
                      style={{
                        left: `${(new Date(task.baselineStart).getMonth() / 12) * 100}%`,
                        width: `${Math.max(5, ((new Date(task.baselineEnd).getTime() - new Date(task.baselineStart).getTime()) / (1000 * 60 * 60 * 24 * 365)) * 100)}%`
                      }}
                    />
                  )}

                  {/* Actual bar */}
                  <div
                    className={`absolute h-6 rounded top-2 ${bgColor} cursor-pointer hover:opacity-80 transition-opacity`}
                    style={{
                      left: `${(new Date(task.plannedStart || task.dueDate || Date.now()).getMonth() / 12) * 100}%`,
                      width: `${Math.max(8, 10)}%`
                    }}
                    onClick={() => setSelectedTask(task)}
                  >
                    <div
                      className="h-full bg-white/30 rounded"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>

                  {/* Critical path indicator */}
                  {task.isCriticalPath && showCriticalPath && (
                    <div className="absolute -top-0.5 right-0 px-1 bg-red-500 text-white text-[8px] rounded">
                      CRÍTICA
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-400 rounded" /> Planificado</span>
        <span className="flex items-center gap-1"><div className="w-3 h-3 bg-red-400 rounded" /> Ruta Crítica</span>
        <span className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-400 rounded" /> Completado</span>
        <span className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-400 rounded" /> Retrasado</span>
        <span className="flex items-center gap-1"><div className="w-3 h-3 border-2 border-gray-400 border-dashed rounded" /> Baseline</span>
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{selectedTask.title}</h3>
              <button onClick={() => setSelectedTask(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Inicio Planificado</label>
                  <div className="text-sm">{formatDate(selectedTask.plannedStart)}</div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fin Planificado</label>
                  <div className="text-sm">{formatDate(selectedTask.plannedEnd)}</div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Baseline Inicio</label>
                  <div className="text-sm">{formatDate(selectedTask.baselineStart)}</div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Baseline Fin</label>
                  <div className="text-sm">{formatDate(selectedTask.baselineEnd)}</div>
                </div>
              </div>
              
              {selectedTask.isCriticalPath && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-red-800 font-medium text-sm">
                    <AlertTriangle className="w-4 h-4" /> Tarea en Ruta Crítica
                  </div>
                  <p className="text-xs text-red-600 mt-1">
                    Cualquier retraso en esta tarea afectará directamente la fecha de entrega del proyecto.
                  </p>
                </div>
              )}
              
              {selectedTask.slackDays > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-blue-800 text-sm">
                    <Clock className="w-4 h-4" /> Holgura: {selectedTask.slackDays} días
                  </div>
                </div>
              )}
              
              {selectedTask.dependencies?.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Dependencias</label>
                  <div className="flex flex-wrap gap-1">
                    {selectedTask.dependencies.map(dep => (
                      <span key={dep} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                        {dep.slice(0, 8)}...
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
