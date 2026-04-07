'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Check, 
  X, 
  Sparkles, 
  Zap, 
  Crown,
  CreditCard,
  ArrowRight,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLicense, type Plan } from '@/hooks/useLicense';

const PLAN_ICONS = {
  BASIC: Shield,
  PROFESSIONAL: Zap,
  PREMIUM: Crown
};

const PLAN_COLORS = {
  BASIC: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    badge: 'bg-gray-100 text-gray-700',
    button: 'bg-gray-900 hover:bg-gray-800'
  },
  PROFESSIONAL: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
    button: 'bg-blue-600 hover:bg-blue-700'
  },
  PREMIUM: {
    bg: 'bg-gradient-to-br from-purple-50 to-pink-50',
    border: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-700',
    button: 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
  }
};

export default function PlanesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSetup = searchParams.get('setup') === '1';
  
  const { 
    status, 
    plans, 
    fetchPlans, 
    createSubscription,
    paySetup 
  } = useLicense();
  
  const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleSelectPlan = async (planTier: string) => {
    setLoading(true);
    setSelectedPlan(planTier);
    
    try {
      // Si es setup, primero pagar el setup
      if (isSetup && !status.setupPaid) {
        await paySetup('manual');
      }
      
      // Crear suscripción
      await createSubscription(planTier as any, period, 'manual');
      
      // Redirigir al dashboard
      router.push('/panel');
      router.refresh();
    } catch (error) {
      console.error('Error selecting plan:', error);
    } finally {
      setLoading(false);
    }
  };

  if (status.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          {isSetup ? (
            <>
              <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
                <Sparkles className="w-4 h-4" />
                Paso final: Seleccioná tu plan
              </div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                ¡Setup completado! Elegí tu plan
              </h1>
              <p className="text-slate-600 max-w-xl mx-auto">
                Tu implementación inicial está activada. Ahora seleccioná el plan 
                que mejor se adapte a las necesidades de tu organización.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Planes SGI 360
              </h1>
              <p className="text-slate-600 max-w-xl mx-auto">
                Elegí el plan que mejor se adapte a las necesidades de tu organización. 
                Podés cambiar de plan en cualquier momento.
              </p>
            </>
          )}
        </div>

        {/* Período de facturación */}
        <div className="flex justify-center mb-8">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as any)}>
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="monthly">
                Mensual
              </TabsTrigger>
              <TabsTrigger value="annual">
                Anual
                <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700">
                  Ahorrá 5%
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Planes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const Icon = PLAN_ICONS[plan.tier];
            const colors = PLAN_COLORS[plan.tier];
            const isCurrentPlan = status.planTier === plan.tier;
            
            return (
              <Card 
                key={plan.tier}
                className={`relative overflow-hidden ${colors.border} ${plan.tier === 'PREMIUM' ? 'md:scale-105 shadow-xl' : 'shadow-md'}`}
              >
                <div className={`${colors.bg} px-6 py-8`}>
                  {/* Badge de popular/más vendido */}
                  {plan.tier === 'PROFESSIONAL' && (
                    <div className="absolute top-4 right-4">
                      <Badge className="bg-amber-100 text-amber-700">
                        Más popular
                      </Badge>
                    </div>
                  )}
                  
                  {/* Badge de plan actual */}
                  {isCurrentPlan && (
                    <div className="absolute top-4 right-4">
                      <Badge className="bg-green-100 text-green-700">
                        Tu plan
                      </Badge>
                    </div>
                  )}

                  <div className={`w-12 h-12 rounded-lg ${colors.badge} flex items-center justify-center mb-4`}>
                    <Icon className="w-6 h-6" />
                  </div>

                  <CardTitle className="text-xl mb-1">{plan.name}</CardTitle>
                  <CardDescription className="text-sm">
                    {plan.description}
                  </CardDescription>

                  <div className="mt-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">
                        USD {period === 'monthly' ? plan.prices.monthly : plan.prices.annual}
                      </span>
                      <span className="text-slate-500">
                        /{period === 'monthly' ? 'mes' : 'año'}
                      </span>
                    </div>
                    {period === 'annual' && (
                      <p className="text-sm text-green-600 mt-1">
                        Ahorrás {plan.prices.savings}%
                      </p>
                    )}
                  </div>
                </div>

                <CardContent className="p-6 space-y-6">
                  {/* Features incluidos */}
                  <div className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-slate-700">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* Features NO incluidos */}
                  {plan.notIncluded.length > 0 && (
                    <div className="space-y-2 pt-4 border-t">
                      <p className="text-xs font-medium text-slate-500 uppercase">
                        No incluido
                      </p>
                      {plan.notIncluded.slice(0, 3).map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-3 opacity-50">
                          <X className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-slate-600">{feature}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Botón */}
                  <Button
                    onClick={() => handleSelectPlan(plan.tier)}
                    disabled={loading || isCurrentPlan}
                    className={`w-full h-11 ${colors.button}`}
                  >
                    {loading && selectedPlan === plan.tier ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    ) : isCurrentPlan ? (
                      'Plan actual'
                    ) : (
                      <>
                        Seleccionar plan
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-sm text-slate-500 mb-4">
            Todos los planes incluyen soporte técnico y actualizaciones automáticas.
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Pago seguro</span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              <span>Cancelá cuando quieras</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
