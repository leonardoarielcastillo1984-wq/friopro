'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { CreditCard, AlertTriangle, CheckCircle, Clock, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function BillingPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/billing/status').then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Cargando...</div>;
  if (!data) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-red-400">Error al cargar</div>;

  const t = data.tenant;
  const plans = data.plans;
  const end = t.licenseEndAt ? new Date(t.licenseEndAt) : null;
  const days = end ? Math.ceil((end.getTime() - Date.now()) / 86400000) : null;

  const sc: Record<string, { c: string; l: string }> = {
    ACTIVE: { c: 'text-green-400', l: 'Activa' },
    EXPIRING: { c: 'text-yellow-400', l: 'Por vencer' },
    GRACE: { c: 'text-orange-400', l: 'En gracia' },
    EXPIRED: { c: 'text-red-400', l: 'Vencida' },
  };
  const st = sc[t.licenseStatus] || sc.ACTIVE;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-white mb-6"><ArrowLeft className="w-4 h-4" /> Volver</Link>
        <h1 className="text-3xl font-bold mb-8">Gestión de Licencia</h1>

        <div className="bg-slate-800 rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-2">{t.name}</h2>
          <p className="text-slate-300 mb-4">Plan: {t.licensePlan || 'Básico'}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-700 rounded-xl p-4">
              <p className="text-sm text-slate-400">Estado</p>
              <p className={`font-semibold ${st.c}`}>{st.l}</p>
            </div>
            <div className="bg-slate-700 rounded-xl p-4">
              <p className="text-sm text-slate-400">Vencimiento</p>
              <p className="font-semibold">{end ? end.toLocaleDateString('es-AR') : 'N/A'}</p>
            </div>
            <div className="bg-slate-700 rounded-xl p-4">
              <p className="text-sm text-slate-400">Días restantes</p>
              <p className={`font-semibold ${days !== null && days <= 3 ? 'text-red-400' : days !== null && days <= 7 ? 'text-yellow-400' : 'text-green-400'}`}>{days !== null ? days : '∞'}</p>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-6">Renovar licencia</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {Object.entries(plans).map(([tier, p]: [string, any]) => (
            <div key={tier} className="bg-slate-800 rounded-2xl p-6 border border-slate-700 hover:border-orange-500 transition-colors">
              <h3 className="text-xl font-semibold mb-2">{p.name}</h3>
              <p className="text-3xl font-bold text-orange-400 mb-1">${p.monthly}<span className="text-base text-slate-400">/mes</span></p>
              <p className="text-sm text-slate-400 mb-4">${p.annual}/año (ahorrás 2 meses)</p>
              <button
                onClick={() => window.location.href = `/license?plan=${tier}&period=monthly`}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" /> Pagar con MercadoPago
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
