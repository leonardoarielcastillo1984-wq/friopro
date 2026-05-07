'use client';
import { Suspense } from 'react';
import { BookOpen, Scale } from 'lucide-react';
import PageTabs from '@/components/PageTabs';
import NormativosContent from './_tabs/NormativosContent';
import LegalesContent from './_tabs/LegalesContent';

const TABS = [
  { key: 'normativos', label: 'Normativos', icon: BookOpen },
  { key: 'legales', label: 'Legales', icon: Scale },
];

export default function CumplimientoPage() {
  return (
    <Suspense>
      <div className="space-y-2">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Normativos</h1>
          <p className="mt-1 text-sm text-neutral-500">Normativos y requisitos legales del SGI</p>
        </div>
        <PageTabs tabs={TABS}>
          {(active) => (
            <>
              {active === 'normativos' && <NormativosContent />}
              {active === 'legales' && <LegalesContent />}
            </>
          )}
        </PageTabs>
      </div>
    </Suspense>
  );
}
