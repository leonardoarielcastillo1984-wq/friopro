'use client';

import { useRouter } from 'next/navigation';
import { 
  Lock, 
  CreditCard, 
  AlertTriangle, 
  CheckCircle, 
  X,
  ArrowRight,
  Sparkles,
  Zap,
  Crown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { useLicense, type PlanTier } from '@/hooks/useLicense';
import { useState } from 'react';

interface LicenseGateProps {
  children: React.ReactNode;
  module: string;
  fallback?: React.ReactNode;
}

// Pantalla de Setup Inicial Pendiente
function SetupRequiredScreen({ onPay }: { onPay: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full shadow-xl border-0">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">
            Bienvenido a SGI 360
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-slate-600 text-center">
            Para comenzar a utilizar SGI 360, debés completar la implementación inicial
          </p>
          
          <div className="bg-slate-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-slate-700">Configuración inicial del sistema</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-slate-700">Acceso a todos los módulos básicos</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-slate-700">Soporte técnico por 30 días</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-slate-700">Actualizaciones incluidas</span>
            </div>
          </div>

          <div className="text-center">
            <div className="text-3xl font-bold text-slate-900 mb-1">USD 200</div>
            <div className="text-slate-500">pago único</div>
          </div>

          <Button 
            onClick={onPay}
            className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700"
          >
            <CreditCard className="w-5 h-5 mr-2" />
            Activar sistema (USD 200)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Pantalla de Suscripción Expirada
function SubscriptionExpiredScreen({ 
  daysExpired,
  onUpgrade 
}: { 
  daysExpired: number;
  onUpgrade: () => void;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full shadow-xl border-red-200">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">
            Licencia Vencida
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-slate-600 text-center">
            Tu licencia está vencida desde hace {daysExpired} días. 
            Renová tu suscripción para continuar usando el sistema.
          </p>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700 text-sm text-center">
              Durante el período de gracia (5 días) podés visualizar información 
              pero no realizar operaciones de creación o edición.
            </p>
          </div>

          <Button 
            onClick={onUpgrade}
            className="w-full h-12 text-lg bg-red-600 hover:bg-red-700"
          >
            Renovar suscripción
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Pantalla de Upgrade Requerido
function UpgradeRequiredScreen({
  currentPlan,
  requiredPlan,
  moduleName,
  onUpgrade
}: {
  currentPlan: PlanTier;
  requiredPlan: PlanTier;
  moduleName: string;
  onUpgrade: () => void;
}) {
  const planColors: Record<PlanTier, string> = {
    BASIC: 'bg-gray-100 text-gray-700',
    PROFESSIONAL: 'bg-blue-100 text-blue-700',
    PREMIUM: 'bg-purple-100 text-purple-700'
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
            <Lock className="w-6 h-6 text-slate-500" />
          </div>
          <CardTitle className="text-xl">
            Módulo no disponible
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-600 text-center text-sm">
            El módulo <strong>{moduleName}</strong> requiere un plan superior.
          </p>
          
          <div className="flex items-center justify-center gap-2 py-2">
            <Badge className={planColors[currentPlan]}>
              {currentPlan}
            </Badge>
            <ArrowRight className="w-4 h-4 text-slate-400" />
            <Badge className={planColors[requiredPlan]}>
              {requiredPlan}
            </Badge>
          </div>

          <div className="bg-slate-50 rounded-lg p-3 text-sm">
            <p className="text-slate-600">
              Disponible desde plan <strong>{requiredPlan}</strong>
            </p>
          </div>

          <Button 
            onClick={onUpgrade}
            className="w-full"
          >
            Actualizar plan
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Modal de Sugerencia de Upgrade (3 intentos)
function UpgradeSuggestionModal({
  isOpen,
  onClose,
  moduleName,
  onUpgrade
}: {
  isOpen: boolean;
  onClose: () => void;
  moduleName: string;
  onUpgrade: () => void;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            ¿Necesitas más funcionalidades?
          </DialogTitle>
          <DialogDescription className="pt-2">
            Has intentado acceder varias veces al módulo <strong>{moduleName}</strong>.
            Este módulo está disponible en un plan superior.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Ahora no
          </Button>
          <Button onClick={onUpgrade} className="flex-1">
            Actualizar ahora
            <Zap className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Componente principal LicenseGate
export function LicenseGate({ children, module, fallback }: LicenseGateProps) {
  const { status, hasAccessToModule, paySetup, checkModuleAccess } = useLicense();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [accessData, setAccessData] = useState<any>(null);
  const router = useRouter();

  // Verificar acceso al montar
  useState(() => {
    const verifyAccess = async () => {
      const access = await checkModuleAccess(module);
      setAccessData(access);
      if (!access.allowed && access.reason === 'PLAN_UPGRADE_REQUIRED') {
        // Verificar si ya intentó varias veces
        // Esto se maneja en el backend
      }
    };
    verifyAccess();
  });

  if (status.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  // Setup no pagado - bloqueo total
  if (status.setupRequired) {
    return (
      <SetupRequiredScreen 
        onPay={() => {
          paySetup('manual');
          router.push('/planes?setup=1');
        }} 
      />
    );
  }

  // Suscripción expirada (más allá del período de gracia)
  if (status.isExpired) {
    return (
      <SubscriptionExpiredScreen
        daysExpired={Math.abs(status.daysRemaining)}
        onUpgrade={() => router.push('/planes')}
      />
    );
  }

  // Verificar acceso al módulo
  if (!hasAccessToModule(module)) {
    // Usar fallback si existe
    if (fallback) {
      return (
        <>
          {fallback}
          <UpgradeSuggestionModal
            isOpen={showUpgradeModal}
            onClose={() => setShowUpgradeModal(false)}
            moduleName={accessData?.module?.name || module}
            onUpgrade={() => router.push('/planes')}
          />
        </>
      );
    }

    return (
      <UpgradeRequiredScreen
        currentPlan={status.planTier || 'BASIC'}
        requiredPlan={accessData?.requiredPlan || 'PROFESSIONAL'}
        moduleName={accessData?.module?.name || module}
        onUpgrade={() => router.push('/planes')}
      />
    );
  }

  return children;
}

// Banner de período de gracia
export function GracePeriodBanner({ daysRemaining }: { daysRemaining: number }) {
  const router = useRouter();

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <span className="text-amber-800 text-sm">
            Tu licencia está vencida. Tenés {daysRemaining} días para renovarla.
          </span>
        </div>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => router.push('/planes')}
          className="border-amber-300 text-amber-700 hover:bg-amber-100"
        >
          Renovar ahora
        </Button>
      </div>
    </div>
  );
}

// Banner de trial
export function TrialBanner({ daysRemaining }: { daysRemaining: number }) {
  const router = useRouter();

  return (
    <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <span className="text-blue-800 text-sm">
            Tu prueba gratuita finaliza en {daysRemaining} días
          </span>
        </div>
        <Button 
          size="sm"
          onClick={() => router.push('/planes')}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Elegir plan
        </Button>
      </div>
    </div>
  );
}

export default LicenseGate;
