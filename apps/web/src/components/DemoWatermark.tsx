'use client';

import type { DemoStatus } from '@/hooks/useDemoMode';

export function DemoWatermark({ status }: { status: DemoStatus }) {
  if (!status.isDemo) return null;
  return (
    <div
      style={{
        position: 'fixed', bottom: 12, left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999, pointerEvents: 'none',
        background: 'rgba(0,0,0,0.08)', borderRadius: 6,
        padding: '3px 12px', fontSize: 10, fontWeight: 700,
        letterSpacing: '0.12em', color: 'rgba(0,0,0,0.28)',
        textTransform: 'uppercase', whiteSpace: 'nowrap',
      }}
    >
      SGI360 DEMO – Período de prueba
    </div>
  );
}
