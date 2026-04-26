'use client';
import { Siren } from 'lucide-react';
import GenericCrudPage from '@/components/GenericCrudPage';

const typeLabels: Record<string, string> = {
  ACCIDENT: 'Accidente', INCIDENT: 'Incidente', NEAR_MISS: 'Casi-accidente', DANGEROUS_SITUATION: 'Situación peligrosa',
};
const severityLabels: Record<string, string> = {
  NONE: 'Sin consecuencias', FIRST_AID: 'Primeros auxilios', MEDICAL_TREATMENT: 'Tratamiento médico',
  LOST_TIME: 'Tiempo perdido', FATALITY: 'Fatalidad', PROPERTY_DAMAGE: 'Daño material', ENVIRONMENTAL: 'Ambiental',
};
const investigationLabels: Record<string, string> = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En curso', COMPLETED: 'Completada',
};

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
        { key: 'type', label: 'Tipo', render: (i) => typeLabels[i.type] || i.type || '—' },
        { key: 'severity', label: 'Severidad', render: (i) => severityLabels[i.severity] || i.severity || '—' },
        { key: 'date', label: 'Fecha', render: (i) => i.date ? new Date(i.date).toLocaleDateString() : '—' },
        { key: 'location', label: 'Lugar' },
        { key: 'investigationStatus', label: 'Investigación', render: (i) => investigationLabels[i.investigationStatus] || i.investigationStatus || '—' },
      ]}
      aiFields={[
        {
          targetKey: 'rootCause',
          buttonLabel: 'Sugerir causa raíz',
          buildPrompt: (f) => `Eres un experto en seguridad y salud ocupacional ISO 45001. Dado este incidente/accidente:\nTipo: ${typeLabels[f.type] || f.type || '—'}\nSeveridad: ${severityLabels[f.severity] || f.severity || '—'}\nLugar: ${f.location || '—'}\nDescripción: ${f.description || '—'}\nAcciones inmediatas: ${f.immediateActions || '—'}\n\nIdentificá la causa raíz más probable usando el método de los 5 Porqués. Sé conciso y directo.`,
        },
        {
          targetKey: 'rootCauseAnalysis',
          buttonLabel: 'Análisis 5 Porqués',
          buildPrompt: (f) => `Eres un experto en seguridad industrial. Dado este incidente:\nDescripción: ${f.description || '—'}\nCausa raíz identificada: ${f.rootCause || '(pendiente)'}\n\nDesarrollá un análisis completo de 5 Porqués paso a paso y sugerí medidas correctivas y preventivas concretas para evitar recurrencia.`,
        },
        {
          targetKey: 'immediateActions',
          buttonLabel: 'Acciones inmediatas IA',
          buildPrompt: (f) => `Eres un experto en seguridad ISO 45001. Para este incidente:\nTipo: ${typeLabels[f.type] || f.type || '—'}, Severidad: ${severityLabels[f.severity] || f.severity || '—'}, Lugar: ${f.location || '—'}\nDescripción: ${f.description || '—'}\n\nSugerí 3 acciones inmediatas concretas que se deben tomar ahora para contener el incidente y proteger a las personas.`,
        },
      ]}
    />
  );
}
