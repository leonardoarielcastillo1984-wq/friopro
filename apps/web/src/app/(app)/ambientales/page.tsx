'use client';

import { Leaf } from 'lucide-react';
import Link from 'next/link';
import GenericCrudPage from '@/components/GenericCrudPage';

export default function AspectosAmbientalesPage() {
  return (
    <GenericCrudPage
      title="Aspectos Ambientales"
      subtitle="Identificación y evaluación de aspectos e impactos ambientales (ISO 14001)"
      endpoint="/aspects"
      icon={Leaf}
      defaultValues={{ condition: 'NORMAL', naturalness: 'DIRECT', magnitude: 3, severity: 3, frequency: 3, legalCompliance: 3, significance: 27, status: 'OPEN' }}
      fields={[
        { key: 'process', label: 'Proceso / Actividad', type: 'text', required: true },
        { key: 'aspect', label: 'Aspecto ambiental', type: 'textarea', required: true },
        { key: 'impact', label: 'Impacto', type: 'textarea', required: true },
        { key: 'category', label: 'Categoría', type: 'select', required: true, options: [
          { value: 'EMISSIONS', label: 'Emisiones atmosféricas' },
          { value: 'WASTE', label: 'Residuos' },
          { value: 'ENERGY', label: 'Energía' },
          { value: 'WATER', label: 'Agua' },
          { value: 'SOIL', label: 'Suelo' },
          { value: 'BIODIVERSITY', label: 'Biodiversidad' },
          { value: 'NOISE', label: 'Ruido' },
          { value: 'OTHER', label: 'Otro' },
        ]},
        { key: 'condition', label: 'Condición', type: 'select', options: [
          { value: 'NORMAL', label: 'Normal' },
          { value: 'ABNORMAL', label: 'Anormal' },
          { value: 'EMERGENCY', label: 'Emergencia' },
        ]},
        { key: 'naturalness', label: 'Naturaleza', type: 'select', options: [
          { value: 'DIRECT', label: 'Directo' },
          { value: 'INDIRECT', label: 'Indirecto' },
        ]},
        { key: 'magnitude', label: 'Magnitud (1-5)', type: 'number', required: true },
        { key: 'severity', label: 'Severidad (1-5)', type: 'number', required: true },
        { key: 'frequency', label: 'Frecuencia (1-5)', type: 'number', required: true },
        { key: 'legalCompliance', label: 'Cumplimiento legal (1-5)', type: 'number' },
        { key: 'significance', label: 'Significancia', type: 'number', required: true },
        { key: 'isSignificant', label: 'Significativo', type: 'checkbox', placeholder: 'Marcar si es significativo' },
        { key: 'status', label: 'Estado', type: 'select', options: [
          { value: 'OPEN', label: 'Abierto' },
          { value: 'IN_TREATMENT', label: 'En tratamiento' },
          { value: 'CONTROLLED', label: 'Controlado' },
          { value: 'CLOSED', label: 'Cerrado' },
        ]},
        { key: 'reviewFrequency', label: 'Frecuencia de revisión', type: 'select', options: [
          { value: 'MONTHLY', label: 'Mensual' },
          { value: 'QUARTERLY', label: 'Trimestral' },
          { value: 'ANNUAL', label: 'Anual' },
        ]},
        { key: 'currentControls', label: 'Controles actuales', type: 'textarea' },
        { key: 'improvementActions', label: 'Acciones de mejora', type: 'textarea' },
        { key: 'reviewDate', label: 'Próxima revisión', type: 'date' },
      ]}
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'process', label: 'Proceso' },
        { key: 'aspect', label: 'Aspecto' },
        { key: 'category', label: 'Categoría' },
        { key: 'significance', label: 'Significancia' },
        { key: 'isSignificant', label: '¿Significativo?', render: (i) => i.isSignificant ? 'Sí' : 'No' },
        { key: 'status', label: 'Estado', render: (i) => {
          const map: Record<string, string> = { OPEN: 'Abierto', IN_TREATMENT: 'En tratamiento', CONTROLLED: 'Controlado', CLOSED: 'Cerrado' };
          return map[i.status] || i.status;
        }},
        { key: 'manage', label: 'Gestionar', render: (i) => (
          <Link href={`/ambientales/${i.id}`} className="text-blue-600 hover:underline text-sm font-medium">
            Ver
          </Link>
        )},
      ]}
    />
  );
}
