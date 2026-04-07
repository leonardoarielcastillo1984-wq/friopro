'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  CheckCircle, X, Lock, Crown, Zap, Shield, Star,
  ArrowRight, Users, HardDrive, Calendar, DollarSign,
  TrendingUp, Building, Check, AlertCircle, CreditCard
} from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  userLimit: number;
  storageLimit: number;
  isPopular: boolean;
  trialDays: number;
  setupFee: number;
  features: Array<{
    key: string;
    name: string;
    description: string;
    limit?: number;
  }>;
}

interface Addon {
  id: string;
  name: string;
  slug: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const response = await apiFetch('/plans') as { plans: any[], addons: any[] };
      setPlans(response.plans || []);
      setAddons(response.addons || []);
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
    try {
      setUpgrading(planId);
      
      const response = await apiFetch('/subscription/upgrade', {
        method: 'POST',
        body: JSON.stringify({
          planId,
          billingCycle,
          addons: selectedAddons
        })
      }) as { subscription: { initPoint: string } };

      if (response.subscription) {
        // Redirigir a MercadoPago
        window.location.href = response.subscription.initPoint;
      }
    } catch (error) {
      console.error('Error upgrading plan:', error);
    } finally {
      setUpgrading(null);
    }
  };

  const getAnnualSavings = (monthlyPrice: number, annualPrice: number) => {
    const monthlyAnnual = monthlyPrice * 12;
    return monthlyAnnual - annualPrice;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(price);
  };

  const getPlanIcon = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'starter':
        return <Users className="w-6 h-6" />;
      case 'professional':
        return <Zap className="w-6 h-6" />;
      case 'enterprise':
        return <Crown className="w-6 h-6" />;
      default:
        return <Shield className="w-6 h-6" />;
    }
  };

  const getPlanColor = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'starter':
        return 'from-green-500 to-green-600';
      case 'professional':
        return 'from-blue-500 to-blue-600';
      case 'enterprise':
        return 'from-purple-500 to-purple-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Planes SGI360</h1>
              <p className="text-gray-600">Elije el plan perfecto para tu empresa</p>
            </div>
            <Link
              href="/dashboard"
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              Volver al Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Billing Cycle Toggle */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg shadow-sm p-1 flex">
            <button
              onClick={() => setBillingCycle('MONTHLY')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                billingCycle === 'MONTHLY'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => setBillingCycle('ANNUAL')}
              className={`px-6 py-2 rounded-md font-medium transition-colors flex items-center gap-2 ${
                billingCycle === 'ANNUAL'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Anual
              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                Ahorro 10%
              </span>
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl shadow-lg overflow-hidden transform transition-all hover:scale-105 ${
                plan.isPopular ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              {plan.isPopular && (
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 text-center font-medium">
                  Más Popular
                </div>
              )}

              <div className="p-6">
                {/* Plan Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-lg bg-gradient-to-r ${getPlanColor(plan.name)} text-white`}>
                    {getPlanIcon(plan.name)}
                  </div>
                  {plan.isPopular && (
                    <Star className="w-5 h-5 text-yellow-500 fill-current" />
                  )}
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-gray-600 mb-6">{plan.description}</p>

                {/* Pricing */}
                <div className="mb-6">
                  <div className="flex items-baseline">
                    <span className="text-3xl font-bold text-gray-900">
                      {formatPrice(billingCycle === 'ANNUAL' ? plan.annualPrice : plan.monthlyPrice)}
                    </span>
                    <span className="text-gray-600 ml-2">/ {billingCycle === 'ANNUAL' ? 'año' : 'mes'}</span>
                  </div>
                  
                  {billingCycle === 'ANNUAL' && (
                    <div className="mt-2 text-sm text-green-600">
                      Ahorrás {formatPrice(getAnnualSavings(plan.monthlyPrice, plan.annualPrice))} al año
                    </div>
                  )}

                  {plan.setupFee > 0 && (
                    <div className="mt-2 text-sm text-gray-500">
                      + {formatPrice(plan.setupFee)} cargo único de configuración
                    </div>
                  )}
                </div>

                {/* Limits */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Users className="w-4 h-4" />
                      <span className="text-sm">Usuarios</span>
                    </div>
                    <span className="font-medium text-gray-900">
                      {plan.userLimit === -1 ? 'Ilimitados' : plan.userLimit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-600">
                      <HardDrive className="w-4 h-4" />
                      <span className="text-sm">Almacenamiento</span>
                    </div>
                    <span className="font-medium text-gray-900">
                      {plan.storageLimit >= 1000 ? `${plan.storageLimit / 1000}GB` : `${plan.storageLimit}MB`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">Período de prueba</span>
                    </div>
                    <span className="font-medium text-gray-900">{plan.trialDays} días</span>
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium text-gray-900">{feature.name}</div>
                        <div className="text-sm text-gray-600">{feature.description}</div>
                        {feature.limit && (
                          <div className="text-xs text-gray-500">Límite: {feature.limit}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={upgrading === plan.id}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
                    plan.isPopular
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {upgrading === plan.id ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Procesando...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      {plan.isPopular ? 'Actualizar a Professional' : `Elegir ${plan.name}`}
                    </div>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Addons Section */}
        {addons.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Funcionalidades Adicionales</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {addons.map((addon) => (
                <div key={addon.id} className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{addon.name}</h3>
                      <p className="text-gray-600 mt-1">{addon.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">
                        {formatPrice(billingCycle === 'ANNUAL' ? addon.annualPrice : addon.monthlyPrice)}
                      </div>
                      <div className="text-sm text-gray-500">
                        / {billingCycle === 'ANNUAL' ? 'año' : 'mes'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    {addon.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                        <Check className="w-4 h-4 text-green-500" />
                        {feature}
                      </div>
                    ))}
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedAddons.includes(addon.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAddons([...selectedAddons, addon.id]);
                        } else {
                          setSelectedAddons(selectedAddons.filter(id => id !== addon.id));
                        }
                      }}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-900">
                      Agregar a mi plan
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FAQ Section */}
        <div className="mt-12 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Preguntas Frecuentes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="bg-white rounded-lg p-6 text-left">
              <h3 className="font-semibold text-gray-900 mb-2">¿Puedo cambiar de plan?</h3>
              <p className="text-gray-600 text-sm">
                Sí, puedes actualizar tu plan en cualquier momento. Los downgrades se aplican al final del ciclo de facturación.
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 text-left">
              <h3 className="font-semibold text-gray-900 mb-2">¿Hay costo de configuración?</h3>
              <p className="text-gray-600 text-sm">
                Sí, hay un cargo único de USD 400 por configuración inicial y onboarding personalizado.
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 text-left">
              <h3 className="font-semibold text-gray-900 mb-2">¿Qué incluye el período de prueba?</h3>
              <p className="text-gray-600 text-sm">
                Tienes 14 días para probar todas las funcionalidades del plan seleccionado sin compromiso.
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 text-left">
              <h3 className="font-semibold text-gray-900 mb-2">¿Cómo funciona el facturación?</h3>
              <p className="text-gray-600 text-sm">
                La facturación es automática a través de MercadoPago. Puedes pagar mensual o anualmente con 10% de descuento.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
