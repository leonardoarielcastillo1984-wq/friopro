'use client';
import { Target } from 'lucide-react';
import GenericCrudPage from '@/components/GenericCrudPage';

export default function ObjetivosPage() {
  const currentYear = new Date().getFullYear();
  return (
    <GenericCrudPage
      title="Objetivos del SGI"
      subtitle="Objetivos estratégicos del Sistema de Gestión (ISO 9001/14001/45001 §6.2)"
      endpoint="/objectives"
      icon={Target}
      defaultValues={{ year: currentYear, status: 'PLANNED', progress: 0 }}
      fields={[
        { key: 'title', label: 'Título del objetivo', type: 'text', required: true, fullWidth: true },
        { key: 'description', label: 'Descripción', type: 'textarea' },
        { key: 'year', label: 'Año', type: 'number', required: true },
        { key: 'standard', label: 'Norma', type: 'select', options: [
          { value: 'ISO 9001', label: 'ISO 9001' },
          { value: 'ISO 14001', label: 'ISO 14001' },
          { value: 'ISO 45001', label: 'ISO 45001' },
          { value: 'MULTIPLE', label: 'Múltiples normas' },
        ]},
        { key: 'target', label: 'Meta', type: 'text', required: true, placeholder: 'Ej: Reducir NCs en 20%' },
        { key: 'targetValue', label: 'Valor meta', type: 'number' },
        { key: 'unit', label: 'Unidad', type: 'text', placeholder: '%, hrs, ...' },
        { key: 'startDate', label: 'Inicio', type: 'date' },
        { key: 'endDate', label: 'Fin', type: 'date' },
        { key: 'status', label: 'Estado', type: 'select', options: [
          { value: 'PLANNED', label: 'Planificado' },
          { value: 'IN_PROGRESS', label: 'En progreso' },
          { value: 'ACHIEVED', label: 'Logrado' },
          { value: 'NOT_ACHIEVED', label: 'No logrado' },
          { value: 'CANCELLED', label: 'Cancelado' },
        ]},
        { key: 'progress', label: 'Progreso (%)', type: 'number', placeholder: '0-100' },
        { key: 'notes', label: 'Notas', type: 'textarea' },
      ]}
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'title', label: 'Objetivo' },
        { key: 'year', label: 'Año' },
        { key: 'target', label: 'Meta' },
        { key: 'status', label: 'Estado' },
        { key: 'progress', label: 'Progreso', render: (i) => `${i.progress ?? 0}%` },
      ]}
    />
  );
}
