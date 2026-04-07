'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

export type PlanTier = 'BASIC' | 'PROFESSIONAL' | 'PREMIUM';

export interface LicenseStatus {
  // Setup
  setupRequired: boolean;
  setupPaid: boolean;
  setupAmount: number;
  
  // Suscripción
  hasSubscription: boolean;
  planTier: PlanTier | null;
  status: 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | null;
  startedAt: Date | null;
  endsAt: Date | null;
  daysRemaining: number;
  isInGracePeriod: boolean;
  graceDaysRemaining: number;
  isExpired: boolean;
  
  // Loading
  loading: boolean;
  error: string | null;
}

export interface Plan {
  tier: PlanTier;
  name: string;
  description: string;
  prices: {
    monthly: number;
    annual: number;
    savings: number;
  };
  limits: {
    maxUsers: number;
    modules: string[];
    features: string[];
  };
  features: string[];
  notIncluded: string[];
}

export interface ModuleAccess {
  allowed: boolean;
  reason?: 'SETUP_REQUIRED' | 'NO_SUBSCRIPTION' | 'SUBSCRIPTION_EXPIRED' | 'PLAN_UPGRADE_REQUIRED';
  currentPlan?: PlanTier;
  requiredPlan?: PlanTier;
  message?: string;
  module?: {
    name: string;
    minPlan: PlanTier;
    icon: string;
  };
}

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  period: 'monthly' | 'annual';
  planTier: PlanTier;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paidAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

export interface LicenseNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  expiresAt: string | null;
}

export function useLicense() {
  const [status, setStatus] = useState<LicenseStatus>({
    setupRequired: true,
    setupPaid: false,
    setupAmount: 200,
    hasSubscription: false,
    planTier: null,
    status: null,
    startedAt: null,
    endsAt: null,
    daysRemaining: 0,
    isInGracePeriod: false,
    graceDaysRemaining: 0,
    isExpired: false,
    loading: true,
    error: null
  });

  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [notifications, setNotifications] = useState<LicenseNotification[]>([]);

  // Obtener estado del setup
  const fetchSetupStatus = useCallback(async () => {
    try {
      const response = await apiFetch<{ 
        status: string; 
        amount: number; 
        currency: string;
        paidAt: string | null;
        required: boolean;
        message: string;
      }>('/license/setup');

      setStatus(prev => ({
        ...prev,
        setupRequired: response.required,
        setupPaid: response.status === 'PAID',
        setupAmount: response.amount
      }));

      return response;
    } catch (error) {
      console.error('Error fetching setup status:', error);
      return null;
    }
  }, []);

  // Obtener suscripción actual
  const fetchSubscription = useCallback(async () => {
    try {
      const response = await apiFetch<{
        hasSubscription: boolean;
        planTier: PlanTier;
        status: 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
        startedAt: string;
        endsAt: string | null;
        daysRemaining: number;
        isInGracePeriod: boolean;
        graceDaysRemaining: number;
        isExpired: boolean;
      }>('/license/subscription');

      setStatus(prev => ({
        ...prev,
        hasSubscription: response.hasSubscription,
        planTier: response.planTier,
        status: response.status,
        startedAt: response.startedAt ? new Date(response.startedAt) : null,
        endsAt: response.endsAt ? new Date(response.endsAt) : null,
        daysRemaining: response.daysRemaining,
        isInGracePeriod: response.isInGracePeriod,
        graceDaysRemaining: response.graceDaysRemaining,
        isExpired: response.isExpired,
        loading: false
      }));

      return response;
    } catch (error) {
      setStatus(prev => ({ ...prev, loading: false, error: String(error) }));
      return null;
    }
  }, []);

  // Cargar planes disponibles
  const fetchPlans = useCallback(async () => {
    try {
      const response = await apiFetch<{ plans: Plan[] }>('/license/plans');
      setPlans(response.plans);
      return response.plans;
    } catch (error) {
      console.error('Error fetching plans:', error);
      return [];
    }
  }, []);

  // Verificar acceso a un módulo
  const checkModuleAccess = useCallback(async (module: string): Promise<ModuleAccess> => {
    try {
      const response = await apiFetch<ModuleAccess>(`/license/check-access/${module}`);
      return response;
    } catch (error: any) {
      if (error.status === 403) {
        return error.data as ModuleAccess;
      }
      return { allowed: false, message: 'Error checking access' };
    }
  }, []);

  // Obtener historial de pagos
  const fetchPayments = useCallback(async () => {
    try {
      const response = await apiFetch<{ payments: Payment[] }>('/license/payments');
      setPayments(response.payments);
      return response.payments;
    } catch (error) {
      console.error('Error fetching payments:', error);
      return [];
    }
  }, []);

  // Obtener notificaciones de licencia
  const fetchNotifications = useCallback(async () => {
    try {
      const response = await apiFetch<{ notifications: LicenseNotification[] }>('/license/notifications');
      setNotifications(response.notifications);
      return response.notifications;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }, []);

  // Marcar notificación como leída
  const markNotificationAsRead = useCallback(async (id: string) => {
    try {
      await apiFetch(`/license/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  // Completar pago de setup
  const paySetup = useCallback(async (provider: string = 'manual', providerRef?: string) => {
    try {
      const response = await apiFetch('/license/setup/pay', {
        method: 'POST',
        json: { provider, providerRef }
      });
      await fetchSetupStatus();
      return response;
    } catch (error) {
      console.error('Error paying setup:', error);
      throw error;
    }
  }, [fetchSetupStatus]);

  // Crear suscripción
  const createSubscription = useCallback(async (
    planTier: PlanTier, 
    period: 'monthly' | 'annual' = 'monthly',
    provider: string = 'manual'
  ) => {
    try {
      const response = await apiFetch('/license/subscription', {
        method: 'POST',
        json: { planTier, period, provider }
      });
      await fetchSubscription();
      return response;
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  }, [fetchSubscription]);

  // Registrar pago
  const recordPayment = useCallback(async (paymentData: {
    amount: number;
    currency: string;
    period: 'monthly' | 'annual';
    planTier: PlanTier;
    provider?: string;
    providerRef?: string;
  }) => {
    try {
      const response = await apiFetch('/license/payments', {
        method: 'POST',
        json: paymentData
      });
      await fetchPayments();
      return response;
    } catch (error) {
      console.error('Error recording payment:', error);
      throw error;
    }
  }, [fetchPayments]);

  // Cargar datos iniciales
  useEffect(() => {
    const loadInitialData = async () => {
      await Promise.all([
        fetchSetupStatus(),
        fetchSubscription(),
        fetchPlans()
      ]);
    };
    loadInitialData();
  }, [fetchSetupStatus, fetchSubscription, fetchPlans]);

  // Helpers
  const hasAccessToModule = useCallback((module: string): boolean => {
    const moduleConfig: Record<string, { minPlan: PlanTier }> = {
      dashboard: { minPlan: 'BASIC' },
      documents: { minPlan: 'BASIC' },
      ncr: { minPlan: 'BASIC' },
      indicators: { minPlan: 'BASIC' },
      risks: { minPlan: 'BASIC' },
      audits: { minPlan: 'PROFESSIONAL' },
      trainings: { minPlan: 'PROFESSIONAL' },
      maintenance: { minPlan: 'PROFESSIONAL' },
      project360: { minPlan: 'PROFESSIONAL' },
      simulacros: { minPlan: 'PROFESSIONAL' },
      normativos: { minPlan: 'PROFESSIONAL' },
      clientes: { minPlan: 'PROFESSIONAL' },
      encuestas: { minPlan: 'PROFESSIONAL' },
      rrhh: { minPlan: 'PREMIUM' },
      audit: { minPlan: 'PREMIUM' },
      intelligence: { minPlan: 'PREMIUM' }
    };

    if (!status.planTier) return false;
    
    const planHierarchy: PlanTier[] = ['BASIC', 'PROFESSIONAL', 'PREMIUM'];
    const currentPlanIndex = planHierarchy.indexOf(status.planTier);
    const requiredPlanIndex = planHierarchy.indexOf(moduleConfig[module]?.minPlan || 'BASIC');

    return currentPlanIndex >= requiredPlanIndex;
  }, [status.planTier]);

  const canCreateUser = useCallback((): boolean => {
    if (!status.planTier) return false;
    // Este es un valor simplificado - debería venir del backend
    const maxUsers: Record<PlanTier, number> = {
      BASIC: 5,
      PROFESSIONAL: 15,
      PREMIUM: 50
    };
    return status.planTier === 'PREMIUM' || true; // Placeholder - debería verificar conteo real
  }, [status.planTier]);

  return {
    // Estado
    status,
    plans,
    payments,
    notifications,
    
    // Acciones
    fetchSetupStatus,
    fetchSubscription,
    fetchPlans,
    checkModuleAccess,
    fetchPayments,
    fetchNotifications,
    markNotificationAsRead,
    paySetup,
    createSubscription,
    recordPayment,
    
    // Helpers
    hasAccessToModule,
    canCreateUser
  };
}
