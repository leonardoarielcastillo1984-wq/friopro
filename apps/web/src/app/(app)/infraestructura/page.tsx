'use client';
import { Suspense } from 'react';
import { Settings, Ruler, Package } from 'lucide-react';
import PageTabs from '@/components/PageTabs';
import MantenimientoContent from './_tabs/MantenimientoContent';
import CalibracionesContent from './_tabs/CalibracionesContent';
import ActivosContent from './_tabs/ActivosContent';

const TABS = [
  { key: 'mantenimiento', label: 'Mantenimiento', icon: Settings },
  { key: 'calibraciones', label: 'Calibraciones', icon: Ruler },
  { key: 'activos', label: 'Activos', icon: Package },
];

export default function InfraestructuraPage() {
  return (
    <Suspense>
      <div className="space-y-2">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Infraestructura</h1>
          <p className="mt-1 text-sm text-neutral-500">Mantenimiento de equipos, calibraciones y gestión de activos — ISO §7.1</p>
        </div>
        <PageTabs tabs={TABS}>
          {(active) => (
            <>
              {active === 'mantenimiento' && <MantenimientoContent />}
              {active === 'calibraciones' && <CalibracionesContent />}
              {active === 'activos' && <ActivosContent />}
            </>
          )}
        </PageTabs>
      </div>
    </Suspense>
  );
}
