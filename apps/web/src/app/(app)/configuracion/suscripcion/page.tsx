'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Zap, Crown, Check, X, CreditCard,
  ArrowRight, Sparkles, Shield, Clock, Users,
  ChevronDown, ChevronUp, Loader2, AlertCircle
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

// ============================================================
// TIPOS
// ============================================================

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly';
  features: string[];
  limits: { premiumQueries: number; storage: number; users: number };
}

interface Subscription {
  plan: string | null;
  status: string;
  premiumQueriesLimit: number;
  premiumQueriesUsed: number;
  premiumQueriesRemaining: number;
  groqEnabled: boolean;
  openaiEnabled: boolean;
}

// ============================================================
// HELPERS
// ============================================================

const PLAN_COLORS: Record<string, { badge: string; border: string; btn: string; icon: string }> = {
  starter_ai_monthly: {
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    border: 'border-blue-500/30 hover:border-blue-400/60',
    btn: 'bg-blue-600 hover:bg-blue-500',
    icon: 'text-blue-400',
  },
  business_ai_monthly: {
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    border: 'border-purple-500/40 hover:border-purple-400/70 ring-1 ring-purple-500/20',
    btn: 'bg-purple-600 hover:bg-purple-500',
    icon: 'text-purple-400',
  },
  enterprise_ai_monthly: {
    badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    border: 'border-yellow-500/30 hover:border-yellow-400/60',
    btn: 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black',
    icon: 'text-yellow-400',
  },
};

const PLAN_ICONS: Record<string, React.ElementType> = {
  starter_ai_monthly: Brain,
  business_ai_monthly: Zap,
  enterprise_ai_monthly: Crown,
};

const queries = (n: number) => n === -1 ? 'Ilimitadas' : `${n}/mes`;

export default function SuscripcionPage() {
  const { user } = useAuth() as any;
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFaq, setShowFaq] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [plansRes, subRes] = await Promise.all([
          apiFetch('/command-center/mercadopago/plans') as any,
          apiFetch('/command-center/health') as any,
        ]);
        setPlans(plansRes?.data || []);
        setSubscription(subRes?.subscription || null);
      } catch {
        setError('No se pudieron cargar los planes. Intentá de nuevo.');
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSubscribe = async (planId: string) => {
    setPurchasing(planId);
    setError(null);
    try {
      const res = await apiFetch('/command-center/mercadopago/create-preference', {
        method: 'POST',
        body: JSON.stringify({ planId, billingCycle: billing }),
      }) as any;
      if (res?.data?.initPoint) {
        window.location.href = res.data.initPoint;
      } else {
        setError('No se pudo iniciar el pago. Intentá de nuevo.');
      }
    } catch {
      setError('Error al procesar el pago. Intentá de nuevo.');
    }
    setPurchasing(null);
  };

  const monthlyPlans = plans.filter(p => p.billingCycle === 'monthly' && !p.id.includes('pack'));
  const yearlyPlans  = plans.filter(p => p.billingCycle === 'yearly');
  const packPlan     = plans.find(p => p.id === 'pack_20_queries');
  const displayPlans = billing === 'monthly' ? monthlyPlans : yearlyPlans;

  const currentPlanId = subscription?.plan
    ? `${subscription.plan.toLowerCase()}_monthly`
    : null;

  const faqs = [
    { q: '¿Qué es una consulta premium?', a: 'Es una consulta procesada por GPT-4.1 (OpenAI), que ofrece análisis más profundos y razonamiento avanzado. Las consultas con Groq (LLaMA) son siempre ilimitadas y gratuitas.' },
    { q: '¿Qué pasa si me quedo sin consultas?', a: 'El sistema automáticamente usa Groq para responder. Podés comprar un pack adicional de 20 consultas por USD 10 en cualquier momento.' },
    { q: '¿Puedo cambiar de plan?', a: 'Sí, podés hacer upgrade o downgrade en cualquier momento. Los cambios aplican al siguiente ciclo de facturación.' },
    { q: '¿Las consultas no usadas se acumulan?', a: 'No se acumulan mes a mes, se resetean el primer día de cada mes.' },
    { q: '¿Cómo proceso el pago?', a: 'Usamos MercadoPago — podés pagar con tarjeta de crédito, débito o transferencia bancaria.' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950/10 to-gray-950 px-4 py-10">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full mb-4">
            <Brain className="w-4 h-4 text-purple-400" />
            <span className="text-purple-300 text-sm font-medium">Enterprise AI — Command Center</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Potenciá tu SGI360 con IA</h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Análisis ejecutivo, hallazgos automáticos, alertas proactivas y acción directa sobre tus módulos.
            Groq siempre gratuito — OpenAI GPT-4.1 en planes premium.
          </p>
        </div>

        {/* Estado actual */}
        {subscription && (
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 mb-8 flex flex-wrap items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-gray-300 text-sm">
                Plan actual: <span className="text-white font-semibold">{subscription.plan || 'Sin plan premium'}</span>
              </span>
            </div>
            {subscription.openaiEnabled && (
              <div className="flex items-center gap-6 text-sm text-gray-400">
                <span>Consultas OpenAI usadas: <strong className="text-white">{subscription.premiumQueriesUsed}</strong></span>
                <span>Restantes: <strong className={subscription.premiumQueriesRemaining <= 5 ? 'text-orange-400' : 'text-green-400'}>{subscription.premiumQueriesRemaining === -1 ? '∞' : subscription.premiumQueriesRemaining}</strong></span>
              </div>
            )}
          </div>
        )}

        {/* Toggle mensual/anual */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <span className={`text-sm ${billing === 'monthly' ? 'text-white' : 'text-gray-500'}`}>Mensual</span>
          <button
            onClick={() => setBilling(b => b === 'monthly' ? 'yearly' : 'monthly')}
            className={`relative w-12 h-6 rounded-full transition-colors ${billing === 'yearly' ? 'bg-purple-600' : 'bg-gray-700'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${billing === 'yearly' ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
          <span className={`text-sm ${billing === 'yearly' ? 'text-white' : 'text-gray-500'}`}>
            Anual <span className="text-green-400 font-medium text-xs ml-1">-20%</span>
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/30 rounded-lg px-4 py-3 mb-6 text-red-300 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Tarjetas de planes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {displayPlans.map((plan) => {
            const baseId = plan.id.replace('_yearly', '_monthly');
            const colors = PLAN_COLORS[baseId] || PLAN_COLORS.starter_ai_monthly;
            const Icon = PLAN_ICONS[baseId] || Brain;
            const isCurrentPlan = currentPlanId === baseId;
            const isBusiness = baseId === 'business_ai_monthly';

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`relative bg-gray-900/60 border rounded-2xl p-6 flex flex-col transition-all duration-200 ${colors.border} ${isBusiness ? 'scale-[1.02]' : ''}`}
              >
                {isBusiness && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    MÁS POPULAR
                  </div>
                )}

                <div className="flex items-center gap-2 mb-4">
                  <Icon className={`w-5 h-5 ${colors.icon}`} />
                  <h3 className="text-white font-bold text-lg">{plan.name}</h3>
                </div>

                <div className="mb-4">
                  <span className="text-4xl font-bold text-white">USD {plan.price}</span>
                  <span className="text-gray-400 text-sm ml-1">/{billing === 'monthly' ? 'mes' : 'año'}</span>
                  {billing === 'yearly' && (
                    <div className="text-green-400 text-xs mt-1">
                      = USD {Math.round(plan.price / 12)}/mes · Ahorrás USD {Math.round(plan.price * 0.25)}
                    </div>
                  )}
                </div>

                <p className="text-gray-400 text-sm mb-5">{plan.description}</p>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="text-xs text-gray-500 mb-4 flex items-center gap-1">
                  <Brain className="w-3 h-3" />
                  <span>Consultas GPT-4.1: <strong className="text-gray-300">{queries(plan.limits.premiumQueries)}</strong></span>
                </div>

                {isCurrentPlan ? (
                  <div className="w-full py-2.5 rounded-lg bg-gray-700 text-gray-400 text-sm text-center font-medium flex items-center justify-center gap-2">
                    <Check className="w-4 h-4 text-green-400" />
                    Plan activo
                  </div>
                ) : (
                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={purchasing !== null}
                    className={`w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${colors.btn} text-white disabled:opacity-50`}
                  >
                    {purchasing === plan.id ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
                    ) : (
                      <><CreditCard className="w-4 h-4" /> Suscribirme</>
                    )}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Pack adicional */}
        {packPlan && (
          <div className="bg-gray-900/40 border border-gray-700/40 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4 mb-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <div className="text-white font-semibold">{packPlan.name}</div>
                <div className="text-gray-400 text-sm">{packPlan.description}</div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <span className="text-2xl font-bold text-white">USD {packPlan.price}</span>
              <button
                onClick={() => handleSubscribe(packPlan.id)}
                disabled={purchasing !== null}
                className="flex items-center gap-2 px-5 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-black font-semibold rounded-lg text-sm transition-all disabled:opacity-50"
              >
                {purchasing === packPlan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Comprar pack
              </button>
            </div>
          </div>
        )}

        {/* Garantías */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {[
            { icon: Shield, title: 'Pago seguro', desc: 'MercadoPago — tarjeta, débito o transferencia' },
            { icon: Clock, title: 'Sin permanencia', desc: 'Cancelá cuando quieras, sin penalidad' },
            { icon: Users, title: 'Todos los usuarios', desc: 'El plan cubre todos los usuarios de tu tenant' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3 bg-gray-900/30 border border-gray-800 rounded-xl p-4">
              <Icon className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-white text-sm font-medium">{title}</div>
                <div className="text-gray-500 text-xs mt-0.5">{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="border border-gray-800 rounded-xl overflow-hidden mb-6">
          <div className="bg-gray-900/40 px-5 py-3 border-b border-gray-800">
            <h3 className="text-white font-semibold text-sm">Preguntas frecuentes</h3>
          </div>
          {faqs.map((faq, i) => (
            <div key={i} className="border-b border-gray-800/60 last:border-0">
              <button
                onClick={() => setShowFaq(showFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-800/30 transition-colors"
              >
                <span className="text-gray-200 text-sm">{faq.q}</span>
                {showFaq === i
                  ? <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />}
              </button>
              <AnimatePresence>
                {showFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <p className="px-5 pb-4 text-gray-400 text-sm">{faq.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
