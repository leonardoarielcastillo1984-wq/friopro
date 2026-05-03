'use client';

import { AlertTriangle, Clock, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { DemoStatus } from '@/hooks/useDemoMode';

interface Props {
  status: DemoStatus;
}

export function DemoBanner({ status }: Props) {
  const router = useRouter();
  if (!status.isDemo) return null;

  if (status.isExpired) {
    return (
      <div className="w-full bg-red-600 text-white px-4 py-2 flex items-center justify-between gap-3 text-sm z-40">
        <div className="flex items-center gap-2">
          <AlertTriangle size={15} />
          <span className="font-semibold">Tu período de prueba ha finalizado.</span>
          <span className="opacity-90">Los datos se conservan. Activá un plan para continuar.</span>
        </div>
        <button
          onClick={() => router.push('/licencia/planes')}
          className="shrink-0 bg-white text-red-600 font-bold text-xs px-3 py-1 rounded hover:bg-red-50 transition-colors"
        >
          Activar plan →
        </button>
      </div>
    );
  }

  if (status.daysLeft <= 1) {
    return (
      <div className="w-full bg-amber-500 text-white px-4 py-2 flex items-center justify-between gap-3 text-sm z-40">
        <div className="flex items-center gap-2">
          <Clock size={15} />
          <span className="font-semibold">Tu demo vence pronto.</span>
          <span className="opacity-90">Menos de 24 horas restantes en modo demo.</span>
        </div>
        <button
          onClick={() => router.push('/licencia/planes')}
          className="shrink-0 bg-white text-amber-700 font-bold text-xs px-3 py-1 rounded hover:bg-amber-50 transition-colors"
        >
          Activar plan →
        </button>
      </div>
    );
  }

  return (
    <div className="w-full bg-blue-600 text-white px-4 py-2 flex items-center justify-between gap-3 text-sm z-40">
      <div className="flex items-center gap-2">
        <Zap size={15} />
        <span className="font-semibold">Período de prueba activo.</span>
        <span className="opacity-90">
          {status.daysLeft === 1
            ? 'Te queda 1 día de demo.'
            : `Te quedan ${status.daysLeft} días de demo.`}
        </span>
      </div>
      <button
        onClick={() => router.push('/licencia/planes')}
        className="shrink-0 bg-white text-blue-700 font-bold text-xs px-3 py-1 rounded hover:bg-blue-50 transition-colors"
      >
        Activar plan →
      </button>
    </div>
  );
}
