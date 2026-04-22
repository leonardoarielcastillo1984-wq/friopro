'use client';
import { Suspense } from 'react';
import { Shield, HardHat, Leaf, ClipboardCheck } from 'lucide-react';
import PageTabs from '@/components/PageTabs';

const TABS = [
  { key: 'riesgos', label: 'Riesgos', icon: Shield },
  { key: 'iperc', label: 'IPERC — Peligros SST', icon: HardHat },
  { key: 'ambientales', label: 'Aspectos Ambientales', icon: Leaf },
  { key: 'simulacros', label: 'Simulacros', icon: ClipboardCheck },
];

import RiesgosContent from './_tabs/RiesgosContent';
import IpercContent from './_tabs/IpercContent';
import AmbientalesContent from './_tabs/AmbientalesContent';
import SimulacrosContent from './_tabs/SimulacrosContent';

export default function SeguridadPage() {
  return (
    <Suspense>
      <div className="space-y-2">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Seguridad &amp; Ambiente</h1>
          <p className="mt-1 text-sm text-neutral-500">Riesgos, peligros SST, aspectos ambientales y simulacros — ISO 14001 / 45001</p>
        </div>
        <PageTabs tabs={TABS}>
          {(active) => (
            <>
              {active === 'riesgos' && <RiesgosContent />}
              {active === 'iperc' && <IpercContent />}
              {active === 'ambientales' && <AmbientalesContent />}
              {active === 'simulacros' && <SimulacrosContent />}
            </>
          )}
        </PageTabs>
      </div>
    </Suspense>
  );
}
