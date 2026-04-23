'use client';
import { Suspense } from 'react';
import { Compass, UsersRound, Layers } from 'lucide-react';
import PageTabs from '@/components/PageTabs';
import ContextoContent from './_tabs/ContextoContent';
import PartesContent from './_tabs/PartesContent';
import MapaProcesosContent from './_tabs/MapaProcesosContent';

const TABS = [
  { key: 'contexto', label: 'Contexto / FODA', icon: Compass },
  { key: 'partes', label: 'Partes Interesadas', icon: UsersRound },
  { key: 'mapa', label: 'Mapa de Procesos', icon: Layers },
];

export default function ContextoSgiPage() {
  return (
    <Suspense>
      <div className="space-y-2">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Contexto del SGI</h1>
          <p className="mt-1 text-sm text-neutral-500">Análisis estratégico, partes interesadas y objetivos — ISO §4.1, §4.2, §6.2</p>
        </div>
        <PageTabs tabs={TABS}>
          {(active) => (
            <>
              {active === 'contexto' && <ContextoContent />}
              {active === 'partes' && <PartesContent />}
              {active === 'mapa' && <MapaProcesosContent />}
            </>
          )}
        </PageTabs>
      </div>
    </Suspense>
  );
}
