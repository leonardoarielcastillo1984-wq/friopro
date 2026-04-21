'use client';
import { Siren } from 'lucide-react';
import GenericCrudPage from '@/components/GenericCrudPage';

export default function IncidentesPage() {
  return (
    <GenericCrudPage
      title="Incidentes / Accidentes"
      subtitle="Registro e investigación de incidentes y accidentes (ISO 45001)"
      endpoint="/incidents"
      icon={Siren}
      defaultValues={{ type: 'INCIDENT', severity: 'NONE', investigationStatus: 'PENDING' }}
      fields={[
        { key: 'type', label: 'Tipo', type: 'select', required: true, options: [
          { value: 'ACCIDENT', label: 'Accidente' },
          { value: 'INCIDENT', label: 'Incidente' },
          { value: 'NEAR_MISS', label: 'Casi-accidente' },
          { value: 'DANGEROUS_SITUATION', label: 'Situación peligrosa' },
        ]},
        { key: 'severity', label: 'Severidad', type: 'select', required: true, options: [
          { value: 'NONE', label: 'Sin consecuencias' },
          { value: 'FIRST_AID', label: 'Primeros auxilios' },
          { value: 'MEDICAL_TREATMENT', label: 'Tratamiento médico' },
          { value: 'LOST_TIME', label: 'Tiempo perdido' },
          { value: 'FATALITY', label: 'Fatalidad' },
          { value: 'PROPERTY_DAMAGE', label: 'Daño material' },
          { value: 'ENVIRONMENTAL', label: 'Ambiental' },
        ]},
        { key: 'date', label: 'Fecha', type: 'date', required: true },
        { key: 'time', label: 'Hora', type: 'text', placeholder: 'HH:MM' },
        { key: 'location', label: 'Lugar', type: 'text', required: true },
        { key: 'description', label: 'Descripción', type: 'textarea', required: true },
        { key: 'immediateActions', label: 'Acciones inmediatas', type: 'textarea' },
        { key: 'affectedPerson', label: 'Persona afectada', type: 'text' },
        { key: 'position', label: 'Puesto', type: 'text' },
        { key: 'daysLost', label: 'Días perdidos', type: 'number' },
        { key: 'investigationStatus', label: 'Estado investigación', type: 'select', options: [
          { value: 'PENDING', label: 'Pendiente' },
          { value: 'IN_PROGRESS', label: 'En curso' },
          { value: 'COMPLETED', label: 'Completada' },
        ]},
        { key: 'rootCause', label: 'Causa raíz', type: 'textarea' },
        { key: 'rootCauseAnalysis', label: 'Análisis (5 porqués / Ishikawa)', type: 'textarea' },
        { key: 'witnesses', label: 'Testigos', type: 'textarea' },
      ]}
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'type', label: 'Tipo' },
        { key: 'severity', label: 'Severidad' },
        { key: 'date', label: 'Fecha', render: (i) => i.date ? new Date(i.date).toLocaleDateString() : '—' },
        { key: 'location', label: 'Lugar' },
        { key: 'investigationStatus', label: 'Investigación' },
      ]}
    />
  );
}
