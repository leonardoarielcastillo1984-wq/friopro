'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AccionesPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/plan-accion'); }, []);
  return (
    <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
      Redirigiendo a Plan de Acción...
    </div>
  );
}
