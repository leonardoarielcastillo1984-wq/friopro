'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function AccionDetailRedirect() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  useEffect(() => { router.replace(`/plan-accion/${id}`); }, [id]);
  return (
    <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
      Redirigiendo a Plan de Acción...
    </div>
  );
}
