'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Check, 
  X, 
  CreditCard, 
  Star,
  TrendingUp,
  Users,
  Shield,
  Zap,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useSearchParams } from 'next/navigation';

interface Plan {
  tier: string;
  name: string;
  description: string;
  prices: {
    monthly: number;
    annual: number;
    savings: number;
  };
  limits: {
    users: number;
    storage: number;
  };
  features: string[];
  notIncluded: string[];
}

export default function PlanesPagoPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string>('');
  const searchParams = useSearchParams();

  useEffect(() => {
    loadPlans();
    loadCurrentSubscription();
    
    // Check if coming from upgrade prompt
    const upgradePlan = searchParams.get('upgrade');
    if (upgradePlan) {
      setSelectedPlan(upgradePlan);
    }
  }, [searchParams]);

  const loadPlans = async () => {
    try {
      const response = await apiFetch('/license/plans');
      setPlans(response.plans || []);
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentSubscription = async () => {
    try {
      const response = await apiFetch('/license/subscription');
      if (response.hasSubscription) {
        setCurrentPlan(response.planTier);
        // No setear selectedPlan si es NO_PLAN - el usuario debe seleccionar un plan válido
        if (response.planTier !== 'NO_PLAN') {
          setSelectedPlan(response.planTier);
        }
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
    }
  };

  const handleSelectPlan = async () => {
    console.log("[CHECKOUT] called, plan:", selectedPlan);
    if (!selectedPlan) { console.log("[CHECKOUT] no plan"); return; }

    setProcessing(true);
    try {
      // Create checkout preference
      const response = await apiFetch('/license/checkout', {
        method: 'POST',
        json: {
          planTier: selectedPlan,
          period: billingPeriod
        }
      });

      // Redirect to MercadoPago
      if (response.checkout?.preferenceId) {
        window.location.href = response.checkout?.initPoint;
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      alert(`Error: ${error.message || "Error desconocido al procesar el pago"}`);
    } finally {
      setProcessing(false);
    }
  };

  const getPlanPrice = (plan: Plan) => {
    return billingPeriod === 'monthly' ? plan.prices.monthly : plan.prices.annual;
  };

  const getPopularPlan = () => {
    return plans.find(p => p.tier === 'PROFESSIONAL');
  };

  const isUpgrade = (planTier: string) => {
    const planHierarchy = ['BASIC', 'PROFESSIONAL', 'PREMIUM'];
    const currentIndex = planHierarchy.indexOf(currentPlan);
    const newIndex = planHierarchy.indexOf(planTier);
    return newIndex > currentIndex;
  };

  const isCurrentPlan = (planTier: string) => {
    return planTier === currentPlan;
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mx-auto mb-8"></div>
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-96 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const popularPlan = getPopularPlan();

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Elige tu Plan</h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Selecciona el plan perfecto para tu negocio. Cambia o cancela en cualquier momento.
        </p>
        
        {/* Billing Period Toggle */}
        <div className="flex items-center justify-center space-x-4">
          <Label className={`text-lg ${billingPeriod === 'monthly' ? 'font-semibold' : ''}`}>
            Mensual
          </Label>
          <RadioGroup
            value={billingPeriod}
            onValueChange={(value: 'monthly' | 'annual') => setBillingPeriod(value)}
            className="flex items-center space-x-2"
          >
            <RadioGroupItem value="monthly" id="monthly" />
            <RadioGroupItem value="annual" id="annual" />
          </RadioGroup>
          <Label className={`text-lg ${billingPeriod === 'annual' ? 'font-semibold' : ''}`}>
            Anual
          </Label>
          {billingPeriod === 'annual' && (
            <Badge className="bg-green-100 text-green-800">
              Ahorra 15%
            </Badge>
          )}
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const isPopular = plan.tier === popularPlan?.tier;
          const isSelected = selectedPlan === plan.tier;
          const isCurrent = isCurrentPlan(plan.tier);
          const isPlanUpgrade = isUpgrade(plan.tier);
          const price = getPlanPrice(plan);

          return (
            <Card 
              key={plan.tier} 
              className={`relative transition-all duration-200 ${
                isPopular ? 'border-blue-500 shadow-lg scale-105' : ''
              } ${isSelected ? 'ring-2 ring-blue-500' : ''}
              ${isCurrent ? 'border-green-500 bg-green-50' : ''
              }`}
              onClick={() => !isCurrent && setSelectedPlan(plan.tier)}
              style={{ cursor: isCurrent ? 'default' : 'pointer' }}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-blue-500 text-white px-3 py-1">
                    <Star className="h-3 w-3 mr-1" />
                    Más Popular
                  </Badge>
                </div>
              )}

              {isCurrent && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-green-500 text-white px-3 py-1">
                    <Check className="h-3 w-3 mr-1" />
                    Plan Actual
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription className="text-sm">
                  {plan.description}
                </CardDescription>
                <div className="pt-4">
                  <div className="flex items-baseline justify-center">
                    <span className="text-4xl font-bold">${price}</span>
                    <span className="text-gray-600 ml-2">
                      /{billingPeriod === 'monthly' ? 'mes' : 'año'}
                    </span>
                  </div>
                  {billingPeriod === 'annual' && (
                    <p className="text-sm text-green-600 mt-2">
                      Ahorra ${plan.prices.monthly * 12 - plan.prices.annual} al año
                    </p>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Limits */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center">
                      <Users className="h-4 w-4 mr-2 text-gray-500" />
                      Usuarios
                    </span>
                    <span className="font-semibold">
                      {plan.limits.users === -1 ? 'Ilimitados' : plan.limits.users}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center">
                      <Shield className="h-4 w-4 mr-2 text-gray-500" />
                      Almacenamiento
                    </span>
                    <span className="font-semibold">
                      {plan.limits.storage === -1 ? 'Ilimitado' : `${plan.limits.storage} GB`}
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Features */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Características incluidas:</h4>
                  <div className="space-y-2">
                    {(plan.features || []).slice(0, 5).map((feature, index) => (
                      <div key={index} className="flex items-center text-sm">
                        <Check className="h-4 w-4 mr-2 text-green-500 flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                    {(plan.features?.length ?? 0) > 5 && (
                      <div className="text-sm text-gray-500">
                        +{(plan.features?.length ?? 0) - 5} características más
                      </div>
                    )}
                  </div>
                </div>

                {/* Not included */}
                {(plan.notIncluded?.length ?? 0) > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm">No incluido:</h4>
                      <div className="space-y-2">
                        {(plan.notIncluded || []).slice(0, 3).map((feature, index) => (
                          <div key={index} className="flex items-center text-sm text-gray-500">
                            <X className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* CTA Button */}
                <div className="pt-4">
                  {isCurrent ? (
                    <Button disabled className="w-full" variant="outline">
                      <Check className="h-4 w-4 mr-2" />
                      Plan Actual
                    </Button>
                  ) : isPlanUpgrade ? (
                    <Button 
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={handleSelectPlan}
                      disabled={processing}
                    >
                      {processing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <TrendingUp className="h-4 w-4 mr-2" />
                      )}
                      {isPlanUpgrade ? 'Actualizar Plan' : 'Seleccionar Plan'}
                    </Button>
                  ) : (
                    <Button 
                      className="w-full"
                      variant={isSelected ? "default" : "outline"}
                      onClick={handleSelectPlan}
                      disabled={processing}
                    >
                      {processing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CreditCard className="h-4 w-4 mr-2" />
                      )}
                      {isSelected ? 'Continuar al Pago' : 'Seleccionar Plan'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Selected Plan Summary */}
      {selectedPlan && !isCurrentPlan(selectedPlan) && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">
                  Plan seleccionado: {plans.find(p => p.tier === selectedPlan)?.name}
                </h3>
                <p className="text-gray-600">
                  {billingPeriod === 'monthly' ? 'Facturación mensual' : 'Facturación anual (ahorro 15%)'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">
                  ${getPlanPrice(plans.find(p => p.tier === selectedPlan)!)}
                </p>
                <p className="text-sm text-gray-600">
                  /{billingPeriod === 'monthly' ? 'mes' : 'año'}
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button 
                onClick={handleSelectPlan}
                disabled={processing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Continuar al Pago
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trust Indicators */}
      <div className="text-center space-y-4 pt-8">
        <div className="flex items-center justify-center space-x-8 text-sm text-gray-600">
          <div className="flex items-center">
            <Shield className="h-4 w-4 mr-2 text-green-500" />
            Pago seguro con MercadoPago
          </div>
          <div className="flex items-center">
            <Zap className="h-4 w-4 mr-2 text-blue-500" />
            Activación inmediata
          </div>
          <div className="flex items-center">
            <CreditCard className="h-4 w-4 mr-2 text-purple-500" />
            Cancela cuando quieras
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Todos los pagos son procesados de forma segura a través de MercadoPago
        </p>
      </div>
    </div>
  );
}
