import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100/50">
      <div className="text-center">
        <h1 className="text-7xl font-bold text-neutral-200">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-neutral-900">Página no encontrada</h2>
        <p className="mt-2 text-sm text-neutral-500">
          La página que buscás no existe o fue movida.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
