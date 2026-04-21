'use client';
import { HardHat } from 'lucide-react';
import GenericCrudPage from '@/components/GenericCrudPage';

const CATEGORY_LABEL: Record<string, string> = {
  TOLERABLE: 'Tolerable', MODERATE: 'Moderado', SUBSTANTIAL: 'Sustancial', INTOLERABLE: 'Intolerable',
};

export default function IPERCPage() {
  return (
    <GenericCrudPage
      title="IPERC — Peligros SST"
      subtitle="Identificación de Peligros, Evaluación de Riesgos y Controles (ISO 45001)"
      endpoint="/hazards"
      icon={HardHat}
      defaultValues={{ probability: 3, severity: 3, exposure: 1, riskLevel: 9, riskCategory: 'MODERATE' }}
      fields={[
        { key: 'area', label: 'Área / Puesto', type: 'text', required: true },
        { key: 'activity', label: 'Actividad / Tarea', type: 'text', required: true },
        { key: 'hazard', label: 'Peligro identificado', type: 'textarea', required: true },
        { key: 'risk', label: 'Riesgo asociado', type: 'textarea', required: true },
        { key: 'probability', label: 'Probabilidad (1-5)', type: 'number', required: true },
        { key: 'severity', label: 'Severidad (1-5)', type: 'number', required: true },
        { key: 'exposure', label: 'Exposición (1-5)', type: 'number' },
        { key: 'riskLevel', label: 'Nivel de riesgo', type: 'number', required: true },
        { key: 'riskCategory', label: 'Categoría', type: 'select', required: true, options: [
          { value: 'TOLERABLE', label: 'Tolerable' },
          { value: 'MODERATE', label: 'Moderado' },
          { value: 'SUBSTANTIAL', label: 'Sustancial' },
          { value: 'INTOLERABLE', label: 'Intolerable' },
        ]},
        { key: 'elimination', label: 'Control: Eliminación', type: 'textarea' },
        { key: 'substitution', label: 'Control: Sustitución', type: 'textarea' },
        { key: 'engineering', label: 'Control: Ingeniería', type: 'textarea' },
        { key: 'administrative', label: 'Control: Administrativo', type: 'textarea' },
        { key: 'ppe', label: 'Control: EPP', type: 'textarea' },
        { key: 'residualRiskLevel', label: 'Riesgo residual (nivel)', type: 'number' },
        { key: 'residualRiskCategory', label: 'Riesgo residual', type: 'select', options: [
          { value: 'TOLERABLE', label: 'Tolerable' },
          { value: 'MODERATE', label: 'Moderado' },
          { value: 'SUBSTANTIAL', label: 'Sustancial' },
          { value: 'INTOLERABLE', label: 'Intolerable' },
        ]},
        { key: 'reviewDate', label: 'Próxima revisión', type: 'date' },
      ]}
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'area', label: 'Área' },
        { key: 'activity', label: 'Actividad' },
        { key: 'hazard', label: 'Peligro' },
        { key: 'riskCategory', label: 'Categoría', render: (i) => CATEGORY_LABEL[i.riskCategory] || i.riskCategory },
        { key: 'riskLevel', label: 'Nivel' },
      ]}
    />
  );
}
