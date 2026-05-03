'use client';

import { Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { DemoStatus } from '@/hooks/useDemoMode';

export function DemoExpiredModal({ status }: { status: DemoStatus }) {
  const router = useRouter();
  if (!status.isDemo || !status.isExpired) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: 'white', borderRadius: 16, padding: 40,
          maxWidth: 420, width: '100%', textAlign: 'center',
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ width: 56, height: 56, background: '#fef2f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Lock size={24} color="#dc2626" />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 10 }}>
          Tu período de prueba ha finalizado
        </h2>
        <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, marginBottom: 28 }}>
          Tu acceso demo de 3 días expiró. Podés ver la información existente, pero para crear,
          editar o eliminar registros necesitás activar un plan.
        </p>
        <button
          onClick={() => router.push('/licencia')}
          style={{
            width: '100%', background: '#dc2626', color: 'white',
            border: 'none', borderRadius: 8, padding: '12px 0',
            fontSize: 15, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Activar plan →
        </button>
        <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 16 }}>
          Todos los datos creados durante la demo se conservan.
        </p>
      </div>
    </div>
  );
}
