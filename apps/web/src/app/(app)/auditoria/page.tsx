'use client';
import { Suspense } from 'react';
import { BrainCircuit, ClipboardCheck } from 'lucide-react';
import PageTabs from '@/components/PageTabs';
import AuditIaContent from './_tabs/AuditIaContent';
import AuditIsoContent from './_tabs/AuditIsoContent';

const TABS = [
  { key: 'ia', label: 'Auditoría IA', icon: BrainCircuit },
  { key: 'iso', label: 'Auditorías ISO', icon: ClipboardCheck },
];

export default function AuditoriaPage() {
  return (
    <Suspense>
      <div className="space-y-2">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Auditorías</h1>
          <p className="mt-1 text-sm text-neutral-500">Análisis de cumplimiento con IA y auditorías internas ISO</p>
        </div>
        <PageTabs tabs={TABS}>
          {(active) => (
            <>
              {active === 'ia' && <AuditIaContent />}
              {active === 'iso' && <AuditIsoContent />}
            </>
          )}
        </PageTabs>
      </div>
    </Suspense>
  );
}
