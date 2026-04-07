'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  Crown, Check, AlertCircle, Loader2, CreditCard, Lock,
} from 'lucide-react';

type Plan = {
  id: string;
  tier: string;
  name: string;
  price: number;
  features: Record<string, boolean>;
  limits: Record<string, number>;
};

type PaymentResult = {
  preferenceUrl?: string;
  preferenceId?: string;
  error?: string;
};

const PLAN_COLORS: Record<string, string> = {
  BASIC: 'bg-slate-50 border-slate-200',
  PROFESSIONAL: 'bg-blue-50 border-blue-200',
  PREMIUM: 'bg-amber-50 border-amber-200',
};

const PLAN_ICONS: Record<string, string> = {
  BASIC: '📊',
  PROFESSIONAL: '⚡',
  PREMIUM: '👑',
};

const FEATURE_LABELS: Record<string, string> = {
  project360: 'PROJECT360',
  mantenimiento: 'Mantenimiento',
  simulacros: 'Simulacros',
  documentos: 'Documentos',
  normativos: 'Normativos',
  ia_auditora: 'Auditoría IA',
  auditorias: 'Auditorías ISO',
  auditorias_iso: 'Auditorías ISO',
  no_conformidades: 'No Conformidades',
  riesgos: 'Riesgos',
  indicadores: 'Indicadores',
  capacitaciones: 'Capacitaciones',
  rrhh: 'RRHH',
  clientes: 'Clientes',
  reportes: 'Reportes',
  sistemas: 'Sistemas',
  ia_asistente: 'IA Asistente',
  emergency: 'Emergencias',
  encuestas: 'Encuestas',
  mantenimiento_industrial: 'Mantenimiento Industrial',
  dashboard: 'Dashboard',
  bi: 'Business Intelligence',
  hse360: 'HSE360',
  audit360: 'AUDIT360',
  seguridad360: 'Seguridad 360',
  license: 'Gestión de Licencias',
};

export default function PlanSelectionPage() {
  const router = useRouter();
  const { user, loading: authLoading, tenant } = useAuth();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [mpConfig, setMpConfig] = useState<any>(null);

  useEffect(() => {
    if (!authLoading && user?.globalRole !== 'TENANT') {
      router.push('/dashboard');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user?.globalRole === 'TENANT') {
      loadPlans();
      loadMercadoPagoConfig();
    }
  }, [user]);

  async function loadPlans() {
    setLoading(true);
    try {
      const data = await apiFetch<{ plans: Plan[] }>('/license/plans');
      setPlans(data?.plans ?? []);
    } catch (err: any) {
      setError(err.message || 'Error al cargar planes');
    } finally {
      setLoading(false);
    }
  }

  async function loadMercadoPagoConfig() {
    try {
      const config = await apiFetch('/mercadopago-config/public');
      setMpConfig(config);
    } catch (err) {
      console.error('Error loading MP config:', err);
    }
  }

  async function handleSelectPlan(planTier: string) {
    if (!mpConfig?.configured) {
      setError('MercadoPago no está configurado. Contacta al administrador.');
      return;
    }

    setSelectedPlan(planTier);
    setProcessing(true);
    setError('');

    try {
      const plan = plans.find(p => p.tier === planTier);
      if (!plan) {
        throw new Error('Plan no encontrado');
      }

      // Crear preferencia de pago en MercadoPago
      const paymentResponse = await apiFetch<PaymentResult>('/license/create-payment', {
        method: 'POST',
        json: {
          planTier: planTier,
          planId: plan.id,
          amount: plan.price,
        },
      });

      if (paymentResponse.preferenceUrl) {
        // Redirigir a MercadoPago
        window.location.href = paymentResponse.preferenceUrl;
      } else if (paymentResponse.error) {
        throw new Error(paymentResponse.error);
      } else {
        throw new Error('Error creando preferencia de pago');
      }
    } catch (err: any) {
      setError(err.message || 'Error procesando pago');
      setSelectedPlan(null);
    } finally {
      setProcessing(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-brand-100/20 border border-brand-500/30">
            <Crown className="h-6 w-6 text-brand-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            Selecciona tu Plan
          </h1>
          <p className="text-neutral-400 text-lg">
            Elige el plan perfecto para tu empresa y accede a todos los módulos
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="rounded-xl bg-red-50/10 border border-red-500/30 p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.tier;
            const planColor = PLAN_COLORS[plan.tier] || PLAN_COLORS.BASIC;

            return (
              <div
                key={plan.id}
                className={`rounded-2xl border-2 transition-all ${
                  isSelected
                    ? 'border-brand-500 bg-neutral-800/50 shadow-2xl shadow-brand-500/20'
                    : `border-neutral-700 ${planColor}`
                } p-6 space-y-6 relative overflow-hidden`}
              >
                {/* Badge */}
                {plan.tier === 'PREMIUM' && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-1 text-xs font-bold rounded-bl-lg">
                    MÁS POPULAR
                  </div>
                )}

                {/* Header */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
                    <span className="text-3xl">{PLAN_ICONS[plan.tier] || '📦'}</span>
                  </div>
                  <p className="text-neutral-400 text-sm">{plan.tier}</p>
                </div>

                {/* Price */}
                <div className="space-y-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">
                      ${plan.price || '0'}
                    </span>
                    <span className="text-neutral-400">/mes</span>
                  </div>
                  <p className="text-xs text-neutral-500">
                    Facturación anual: ${(plan.price || 0) * 12}
                  </p>
                </div>

                {/* Features */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-neutral-200">Módulos Incluidos:</p>
                  <div className="space-y-2">
                    {Object.entries(plan.features as Record<string, boolean>)
                      .filter(([, enabled]) => enabled)
                      .slice(0, 8)
                      .map(([key]) => (
                        <div key={key} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                          <span className="text-neutral-300">
                            {FEATURE_LABELS[key] || key.replace(/_/g, ' ')}
                          </span>
                        </div>
                      ))}
                  </div>
                  {Object.values(plan.features).filter(v => v).length > 8 && (
                    <p className="text-xs text-brand-400">
                      +{Object.values(plan.features).filter(v => v).length - 8} módulos más
                    </p>
                  )}
                </div>

                {/* Limits */}
                {plan.limits && Object.keys(plan.limits).length > 0 && (
                  <div className="space-y-2 pt-4 border-t border-neutral-700">
                    <p className="text-xs font-semibold text-neutral-200">Límites:</p>
                    {Object.entries(plan.limits as Record<string, number>)
                      .slice(0, 3)
                      .map(([key, value]) => (
                        <div key={key} className="flex justify-between text-xs text-neutral-400">
                          <span>{key.replace('max_', '').replace(/_/g, ' ')}</span>
                          <span className="font-semibold">{value.toLocaleString()}</span>
                        </div>
                      ))}
                  </div>
                )}

                {/* CTA Button */}
                <button
                  onClick={() => handleSelectPlan(plan.tier)}
                  disabled={processing || !mpConfig?.configured}
                  className={`w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                    isSelected
                      ? 'bg-brand-600 text-white hover:bg-brand-700'
                      : 'bg-neutral-700 text-neutral-200 hover:bg-neutral-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {processing && isSelected && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {mpConfig?.configured ? (
                    <>
                      <CreditCard className="h-4 w-4" />
                      {isSelected ? 'Procesando pago...' : 'Seleccionar y Pagar'}
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      No disponible
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Info Footer */}
        <div className="text-center text-sm text-neutral-500 pt-4">
          <p>💳 Pagos seguros con MercadoPago | 🔒 Tus datos están protegidos</p>
        </div>
      </div>
    </div>
  );
}
