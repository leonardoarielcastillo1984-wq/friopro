'use client';

import { apiFetch } from '@/lib/api';

interface Project {
  id: string;
  code: string;
  name: string;
  status: string;
  priority: string;
  progress: number;
  targetDate: string;
  responsible: { name: string };
  tasks?: any[];
}

export async function exportProjectsToExcel(projects: Project[]) {
  const XLSX = await import('xlsx');
  
  const data = projects.map(p => ({
    'Código': p.code,
    'Nombre': p.name,
    'Estado': getStatusLabel(p.status),
    'Prioridad': getPriorityLabel(p.priority),
    'Progreso (%)': p.progress,
    'Fecha Objetivo': new Date(p.targetDate).toLocaleDateString(),
    'Responsable': p.responsible?.name || '-',
    'Tareas Totales': p.tasks?.length || 0,
    'Tareas Completadas': p.tasks?.filter((t: any) => t.status === 'COMPLETED').length || 0
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Proyectos');
  
  // Auto-width columns
  const colWidths = [
    { wch: 12 },  // Código
    { wch: 40 },  // Nombre
    { wch: 15 },  // Estado
    { wch: 12 },  // Prioridad
    { wch: 12 },  // Progreso
    { wch: 15 },  // Fecha
    { wch: 25 },  // Responsable
    { wch: 15 },  // Tareas
    { wch: 20 },  // Completadas
  ];
  ws['!cols'] = colWidths;

  // Use write and create download
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Proyectos_${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportProjectDetailToExcel(project: Project) {
  const XLSX = await import('xlsx');
  
  const wb = XLSX.utils.book_new();
  
  // Project info sheet
  const projectData = [{
    'Código': project.code,
    'Nombre': project.name,
    'Estado': getStatusLabel(project.status),
    'Prioridad': getPriorityLabel(project.priority),
    'Progreso (%)': project.progress,
    'Fecha Objetivo': new Date(project.targetDate).toLocaleDateString(),
    'Responsable': project.responsible?.name || '-'
  }];
  const wsProject = XLSX.utils.json_to_sheet(projectData);
  XLSX.utils.book_append_sheet(wb, wsProject, 'Proyecto');
  
  // Tasks sheet
  if (project.tasks && project.tasks.length > 0) {
    const tasksData = project.tasks.map((t: any) => ({
      'Tarea': t.title,
      'Estado': t.status === 'COMPLETED' ? 'Completada' : 'Pendiente',
      'Responsable': t.responsible || '-',
      'Fecha': t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '-'
    }));
    const wsTasks = XLSX.utils.json_to_sheet(tasksData);
    XLSX.utils.book_append_sheet(wb, wsTasks, 'Tareas');
  }
  
  // Use write and create download
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.code}_Detalle_${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'PENDING': 'Pendiente',
    'IN_PROGRESS': 'En Progreso',
    'REVIEW': 'En Revisión',
    'COMPLETED': 'Completado',
    'CANCELLED': 'Cancelado'
  };
  return labels[status] || status;
}

function getPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    'LOW': 'Baja',
    'MEDIUM': 'Media',
    'HIGH': 'Alta',
    'CRITICAL': 'Crítica'
  };
  return labels[priority] || priority;
}
