'use client';
import { Ruler } from 'lucide-react';
import GenericCrudPage from '@/components/GenericCrudPage';

export default function CalibracionesPage() {
  return (
    <GenericCrudPage
      title="Equipos de medición / Calibraciones"
      subtitle="Inventario y cronograma de calibraciones (ISO 9001 §7.1.5)"
      endpoint="/equipment"
      icon={Ruler}
      defaultValues={{ status: 'ACTIVE', calibrationFrequency: 'YEARLY' }}
      fields={[
        { key: 'name', label: 'Nombre', type: 'text', required: true },
        { key: 'type', label: 'Tipo', type: 'text', placeholder: 'Balanza, calibre, termómetro...' },
        { key: 'brand', label: 'Marca', type: 'text' },
        { key: 'model', label: 'Modelo', type: 'text' },
        { key: 'serialNumber', label: 'Nº de serie', type: 'text' },
        { key: 'location', label: 'Ubicación', type: 'text' },
        { key: 'status', label: 'Estado', type: 'select', options: [
          { value: 'ACTIVE', label: 'Activo' },
          { value: 'OUT_OF_SERVICE', label: 'Fuera de servicio' },
          { value: 'RETIRED', label: 'Dado de baja' },
        ]},
        { key: 'calibrationFrequency', label: 'Frecuencia calibración', type: 'select', options: [
          { value: 'MONTHLY', label: 'Mensual' },
          { value: 'QUARTERLY', label: 'Trimestral' },
          { value: 'BIANNUAL', label: 'Semestral' },
          { value: 'YEARLY', label: 'Anual' },
          { value: 'OTHER', label: 'Otra' },
        ]},
        { key: 'lastCalibrationDate', label: 'Última calibración', type: 'date' },
        { key: 'nextCalibrationDate', label: 'Próxima calibración', type: 'date' },
        { key: 'acquisitionDate', label: 'Fecha de adquisición', type: 'date' },
        { key: 'notes', label: 'Notas', type: 'textarea' },
      ]}
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Nombre' },
        { key: 'type', label: 'Tipo' },
        { key: 'serialNumber', label: 'Serie' },
        { key: 'status', label: 'Estado' },
        { key: 'nextCalibrationDate', label: 'Próx. calibración', render: (i) => i.nextCalibrationDate ? new Date(i.nextCalibrationDate).toLocaleDateString() : '—' },
      ]}
    />
  );
}
