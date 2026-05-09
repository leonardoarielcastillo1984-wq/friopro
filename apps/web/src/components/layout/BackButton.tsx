'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

// Rutas que ya tienen su propio botón de volver o son full-page sin necesidad del global
const SKIP_BACK_PATHS = [
  '/clima/',
  '/audit360',
  '/seguridad360',
  '/reportes/export',
  '/reportes/informe-direccion/',
];


export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();

  // Normalizar: quitar trailing slash
  const normalized = pathname.replace(/\/$/, '') || '/';

  // No mostrar en páginas que ya tienen su propio botón de volver
  if (SKIP_BACK_PATHS.some(p => normalized === p.replace(/\/$/, '') || normalized.startsWith(p))) return null;

  // Segmentos del path (ej: /rrhh/configuracion → ['rrhh', 'configuracion'])
  const segments = normalized.split('/').filter(Boolean);

  // No mostrar si es una ruta de 1 solo nivel
  if (segments.length <= 1) return null;

  // Calcular la ruta padre (subir un nivel)
  const parentPath = '/' + segments.slice(0, -1).join('/');

  return (
    <button
      onClick={() => router.back()}
      title={`Volver a ${parentPath}`}
      className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors mb-4 group"
    >
      <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
      <span>Volver</span>
    </button>
  );
}
