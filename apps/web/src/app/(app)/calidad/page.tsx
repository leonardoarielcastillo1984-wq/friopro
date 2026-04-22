'use client';
import { Suspense } from 'react';
import { AlertTriangle, Siren, CheckSquare, RefreshCw } from 'lucide-react';
import PageTabs from '@/components/PageTabs';
import NcContent from './_tabs/NcContent';
import IncidentesContent from './_tabs/IncidentesContent';
import AccionesContent from './_tabs/AccionesContent';
import CambiosContent from './_tabs/CambiosContent';

const TABS = [
  { key: 'nc', label: 'No Conformidades', icon: AlertTriangle },
  { key: 'incidentes', label: 'Incidentes / Accidentes', icon: Siren },
  { key: 'acciones', label: 'Acciones CAPA', icon: CheckSquare },
  { key: 'cambios', label: 'Gestión de Cambios', icon: RefreshCw },
];

export default function CalidadPage() {
  return (
    <Suspense>
      <div className="space-y-2">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Calidad / Mejora Continua</h1>
          <p className="mt-1 text-sm text-neutral-500">No conformidades, incidentes, acciones CAPA y gestión de cambios — ISO §8, §10</p>
        </div>
        <PageTabs tabs={TABS}>
          {(active) => (
            <>
              {active === 'nc' && <NcContent />}
              {active === 'incidentes' && <IncidentesContent />}
              {active === 'acciones' && <AccionesContent />}
              {active === 'cambios' && <CambiosContent />}
            </>
          )}
        </PageTabs>
      </div>
    </Suspense>
  );
}
