'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import EnterpriseAIControlTower from '@/components/enterprise/EnterpriseAIControlTower';

// ============================================================
// TIPOS
// ============================================================

interface AISubscription {
  plan: 'STARTER_AI' | 'BUSINESS_AI' | 'ENTERPRISE_AI' | null;
  status: 'active' | 'inactive' | 'suspended';
  premiumQueriesLimit: number;
  premiumQueriesUsed: number;
  premiumQueriesRemaining: number;
  groqEnabled: boolean;
  openaiEnabled: boolean;
  resetDate: Date;
}

interface UserContext {
  tenantId: string;
  userId: string;
  userRole: string;
  permissions: string[];
}

// ============================================================
// COMPONENTE PRINCIPAL - ENTERPRISE AI CONTROL TOWER
// ============================================================

export default function CommandCenterPage() {
  const [subscription, setSubscription] = useState<AISubscription | null>(null);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================================================
  // EFFECTS
  // ============================================================

  useEffect(() => {
    initializeCommandCenter();
  }, []);

  // ============================================================
  // INITIALIZATION
  // ============================================================

  const initializeCommandCenter = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load subscription and user context in parallel
      const [subscriptionResponse, userResponse] = await Promise.all([
        loadSubscription(),
        loadUserContext()
      ]);

      setSubscription(subscriptionResponse);
      setUserContext(userResponse);

    } catch (error) {
      console.error('Error initializing Command Center:', error);
      setError('Error al inicializar el Command Center');
    } finally {
      setLoading(false);
    }
  };

  const loadSubscription = async (): Promise<AISubscription | null> => {
    try {
      const response = await apiFetch('/api/command-center/subscription');
      return response.data;
    } catch (error) {
      console.error('Error loading subscription:', error);
      return null;
    }
  };

  const loadUserContext = async (): Promise<UserContext> => {
    try {
      // Get user info from session or API
      const response = await apiFetch('/api/auth/me');
      const user = response.data;

      return {
        tenantId: user.tenantId || 'default',
        userId: user.id || 'anonymous',
        userRole: user.tenantRole || 'USER',
        permissions: user.permissions || []
      };
    } catch (error) {
      console.error('Error loading user context:', error);
      // Return default context for development
      return {
        tenantId: 'demo',
        userId: 'demo-user',
        userRole: 'TENANT_ADMIN',
        permissions: ['all']
      };
    }
  };

  // ============================================================
  // LOADING STATE
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900/20 to-purple-900/20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Iniciando Enterprise AI Control Tower...</p>
        </div>
      </div>
    );
  }

  // ============================================================
  // ERROR STATE
  // ============================================================

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900/20 to-purple-900/20 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Error de Inicialización</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={initializeCommandCenter}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // MAIN RENDER - ENTERPRISE AI CONTROL TOWER
  // ============================================================

  if (!userContext) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900/20 to-purple-900/20 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">No se pudo cargar el contexto de usuario</p>
        </div>
      </div>
    );
  }

  return (
    <EnterpriseAIControlTower
      tenantId={userContext.tenantId}
      userId={userContext.userId}
      userRole={userContext.userRole}
      permissions={userContext.permissions}
      subscription={subscription}
    />
  );
}
