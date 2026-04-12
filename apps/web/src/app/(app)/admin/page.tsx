'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import PaymentManagement from './payment-management';
import CompanyAccessData from './company-access-data';
import LandingPageConfig from './landing-page-config';
import {
  Shield, Building2, Users, CreditCard, Plus, X, Loader2, Key, Pause, Play,
  AlertCircle, CheckCircle2, Crown, ChevronDown, ChevronUp,
  UserPlus, Zap, Globe, Wallet, TrendingUp, AlertTriangle,
  Package, RefreshCw, DollarSign, Briefcase, ThumbsUp, ThumbsDown, Trash2,
} from 'lucide-react';

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  memberCount: number;
  subscription: {
    id: string;
    status: string;
    startedAt: string;
    endsAt: string | null;
    plan: { id: string; tier: string; name: string };
  } | null;
};

type PlanRow = {
  id: string;
  tier: string;
  name: string;
  features: Record<string, boolean>;
  limits: Record<string, number>;
};

const PLAN_COLORS: Record<string, string> = {
  BASIC: 'bg-slate-100 text-slate-700 border-slate-200',
  PROFESSIONAL: 'bg-blue-100 text-blue-700 border-blue-200',
  PREMIUM: 'bg-amber-100 text-amber-700 border-amber-200',
};

const SUB_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  TRIAL: 'bg-blue-100 text-blue-700',
  PAST_DUE: 'bg-red-100 text-red-700',
  CANCELED: 'bg-neutral-100 text-neutral-500',
};

const FEATURE_LABELS: Record<string, string> = {
  // Menús del sidebar (exactos)
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
  // Alternativas/compatibilidad
  normativos_compliance: 'Normativos',
  ncr: 'No Conformidades',
  trainings: 'Capacitaciones',
  drills: 'Simulacros',
  maintenance: 'Mantenimiento',
  risks: 'Riesgos',
  indicators: 'Indicadores',
  audits: 'Auditorías ISO',
  intelligence: 'Inteligencia',
  audit: 'Auditoría IA',
};

type SetupFeeRow = {
  id: string;
  amount: number;
  currency: string;
  isActive: boolean;
  description: string | null;
};

// Componente para Gestión de Registros de Empresas
function CompanyRegistrations() {
  const [registrations, setRegistrations] = useState<CompanyRegistration[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approvalResult, setApprovalResult] = useState<any>(null);
  const [approvalData, setApprovalData] = useState<{id: string, customEmail: string, customPassword: string} | null>(null);
  const [showCustomCredentials, setShowCustomCredentials] = useState(false);

  useEffect(() => {
    loadRegistrations();
  }, []);

  async function loadRegistrations() {
    setLoading(true);
    try {
      const data = await apiFetch('/super-admin/company-registrations') as { registrations: any[] };
      setRegistrations(data.registrations || []);
    } catch (error) {
      console.error('Error loading registrations:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: string) {
    // Mostrar formulario de credenciales personalizadas
    setApprovalData({ id, customEmail: '', customPassword: '' });
    setShowCustomCredentials(true);
  }

  async function executeApproval() {
    if (!approvalData) return;
    
    setProcessing(approvalData.id);
    try {
      const result = await apiFetch(`/super-admin/company-registrations/${approvalData.id}/approve`, {
        method: 'POST',
        json: {
          customEmail: approvalData.customEmail || undefined,
          customPassword: approvalData.customPassword || undefined,
        },
      });
      setApprovalResult(result);
      loadRegistrations();
      setShowCustomCredentials(false);
      setApprovalData(null);
      setTimeout(() => setApprovalResult(null), 8000);
    } catch (error: any) {
      alert('Error al aprobar: ' + (error.message || 'Error desconocido'));
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) {
      alert('Por favor ingresa una razón de rechazo');
      return;
    }
    setProcessing(id);
    try {
      await apiFetch(`/super-admin/company-registrations/${id}/reject`, {
        method: 'POST',
        json: { reason: rejectReason },
      });
      setRejectingId(null);
      setRejectReason('');
      loadRegistrations();
    } catch (error: any) {
      alert('Error al rechazar: ' + (error.message || 'Error desconocido'));
    } finally {
      setProcessing(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Estás seguro de eliminar esta solicitud? Esta acción no se puede deshacer.')) {
      return;
    }
    setProcessing(id);
    try {
      await apiFetch(`/super-admin/company-registrations/${id}`, {
        method: 'DELETE',
      });
      loadRegistrations();
      alert('Solicitud eliminada exitosamente');
    } catch (error: any) {
      alert('Error al eliminar: ' + (error.message || 'Error desconocido'));
    } finally {
      setProcessing(null);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const pendingRegistrations = registrations.filter(r => r.status === 'PENDING');
  const approvedRegistrations = registrations.filter(r => r.status === 'APPROVED');
  const rejectedRegistrations = registrations.filter(r => r.status === 'REJECTED');

  return (
    <div className="space-y-6">
      {approvalResult && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <p className="font-medium text-green-900">¡Empresa aprobada exitosamente!</p>
          </div>
          <div className="text-sm text-green-800 space-y-1">
            <p><strong>Email del Admin:</strong> {approvalResult.user?.email || approvalResult.userEmail}</p>
            <p><strong>Contraseña Temporal:</strong> <code className="bg-green-100 px-2 py-1 rounded">{approvalResult.user?.password || approvalResult.tempPassword}</code></p>
            <p className="text-xs mt-2">⚠️ El usuario debe cambiar esta contraseña en el primer acceso</p>
          </div>
        </div>
      )}

      {pendingRegistrations.length === 0 && approvedRegistrations.length === 0 && rejectedRegistrations.length === 0 ? (
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-8 text-center">
          <Briefcase className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No hay registros de empresas</p>
        </div>
      ) : (
        <>
          {/* Pending Registrations */}
          {pendingRegistrations.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
              <div className="p-4 border-b border-amber-200 flex items-center gap-2 bg-amber-100/50">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <h3 className="font-semibold text-amber-900">Registros Pendientes ({pendingRegistrations.length})</h3>
              </div>
              <div className="space-y-4 p-4">
                {pendingRegistrations.map(reg => (
                  <div key={reg.id} className="border border-amber-200 rounded-lg p-4 bg-white">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Nombre Empresa</p>
                        <p className="font-medium text-gray-900">{reg.companyName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Razón Social</p>
                        <p className="font-medium text-gray-900">{reg.socialReason || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">RUT / Tax ID</p>
                        <p className="font-medium text-gray-900">{reg.rut}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Email</p>
                        <p className="font-medium text-gray-900">{reg.email}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Teléfono</p>
                        <p className="font-medium text-gray-900">{reg.phone}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Dirección</p>
                        <p className="font-medium text-gray-900">{reg.address}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleApprove(reg.id)}
                        disabled={processing !== null}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-sm"
                      >
                        {processing === reg.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
                        Aprobar
                      </button>
                      <button
                        onClick={() => setRejectingId(reg.id)}
                        disabled={processing !== null}
                        className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium text-sm"
                      >
                        <ThumbsDown className="h-4 w-4" />
                        Rechazar
                      </button>
                      <button
                        onClick={() => handleDelete(reg.id)}
                        disabled={processing !== null}
                        className="flex items-center justify-center gap-2 bg-slate-600 text-white px-4 py-2 rounded-lg hover:bg-slate-700 disabled:opacity-50 font-medium text-sm"
                        title="Eliminar solicitud"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Reject Form */}
                    {rejectingId === reg.id && (
                      <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Razón del Rechazo</label>
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Explain why you're rejecting this registration..."
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500"
                          rows={3}
                        />
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleReject(reg.id)}
                            disabled={processing !== null || !rejectReason.trim()}
                            className="flex-1 bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium text-sm"
                          >
                            {processing === reg.id ? <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> : null}
                            Confirmar Rechazo
                          </button>
                          <button
                            onClick={() => { setRejectingId(null); setRejectReason(''); }}
                            disabled={processing !== null}
                            className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 font-medium text-sm"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approved Registrations */}
          {approvedRegistrations.length > 0 && (
            <div className="rounded-lg border border-green-200 bg-green-50 overflow-hidden">
              <div className="p-4 border-b border-green-200 flex items-center gap-2 bg-green-100/50">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-green-900">Registros Aprobados ({approvedRegistrations.length})</h3>
              </div>
              <div className="space-y-2 p-4">
                {approvedRegistrations.map(reg => (
                  <div key={reg.id} className="flex items-center justify-between p-3 bg-white border border-green-200 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{reg.companyName}</p>
                      <p className="text-sm text-gray-500">{reg.email}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">Aprobado</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rejected Registrations */}
          {rejectedRegistrations.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 overflow-hidden">
              <div className="p-4 border-b border-red-200 flex items-center gap-2 bg-red-100/50">
                <ThumbsDown className="h-5 w-5 text-red-600" />
                <h3 className="font-semibold text-red-900">Registros Rechazados ({rejectedRegistrations.length})</h3>
              </div>
              <div className="space-y-2 p-4">
                {rejectedRegistrations.map(reg => (
                  <div key={reg.id} className="flex items-center justify-between p-3 bg-white border border-red-200 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{reg.companyName}</p>
                      <p className="text-xs text-gray-500 mt-1">{reg.rejectionReason}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">Rechazado</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal de Credenciales Personalizadas */}
      {showCustomCredentials && approvalData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">
              Configurar Credenciales de Acceso
            </h3>
            <p className="text-sm text-neutral-600 mb-4">
              Puedes personalizar el email y contraseña para el cliente. Si dejas los campos vacíos, se usarán los datos por defecto.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Email Personalizado (opcional)
                </label>
                <input
                  type="email"
                  value={approvalData.customEmail}
                  onChange={(e) => setApprovalData({...approvalData, customEmail: e.target.value})}
                  placeholder="cliente@empresa.com"
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Contraseña Personalizada (opcional)
                </label>
                <input
                  type="password"
                  value={approvalData.customPassword}
                  onChange={(e) => setApprovalData({...approvalData, customPassword: e.target.value})}
                  placeholder="Contraseña segura"
                  minLength={8}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Mínimo 8 caracteres. Si no se especifica, se usará "TempPassword123!"
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCustomCredentials(false);
                  setApprovalData(null);
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={executeApproval}
                disabled={processing !== null}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Aprobar y Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente para Configuración de MercadoPago
function MercadoPagoConfig() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mpConfig, setMpConfig] = useState<any>(null);
  const [formData, setFormData] = useState({
    accessToken: '',
    publicKey: '',
    userId: '',
  });

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    try {
      const config = await apiFetch('/super-admin/mercadopago-config');
      setMpConfig(config);
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/super-admin/mercadopago-config', {
        method: 'PUT',
        json: formData,
      });
      setFormData({ accessToken: '', publicKey: '', userId: '' });
      loadConfig();
      alert('✅ Configuración de MercadoPago guardada correctamente');
    } catch (error: any) {
      alert('❌ Error: ' + (error.message || 'No se pudo guardar la configuración'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {mpConfig?.configured ? (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <p className="font-medium text-green-900">MercadoPago configurado</p>
          </div>
          <p className="text-sm text-green-800">Public Key: {mpConfig.publicKey}</p>
          <p className="text-sm text-green-800">User ID: {mpConfig.userId}</p>
        </div>
      ) : (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm text-amber-900">⚠️ MercadoPago aún no está configurado</p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
          <input
            type="password"
            value={formData.accessToken}
            onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
            placeholder="MP_ACCESS_TOKEN=TEST-..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
          />
          <p className="text-xs text-gray-500 mt-1">Token de acceso de tu cuenta MercadoPago</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Public Key</label>
          <input
            type="text"
            value={formData.publicKey}
            onChange={(e) => setFormData({ ...formData, publicKey: e.target.value })}
            placeholder="TEST-a8a23709-b391-442e..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
          />
          <p className="text-xs text-gray-500 mt-1">Clave pública para el frontend</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
          <input
            type="text"
            value={formData.userId}
            onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
            placeholder="75716951"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
          />
          <p className="text-xs text-gray-500 mt-1">Tu ID de usuario en MercadoPago</p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Guardar Configuración
        </button>
      </form>
    </div>
  );
}

type PaymentRow = {
  id: string;
  tenantId: string;
  tenantName: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  paidAt: string | null;
  createdAt: string;
};

type CompanyRegistration = {
  id: string;
  companyName: string;
  socialReason: string | null;
  rut: string;
  email: string;
  phone: string;
  website: string | null;
  address: string;
  primaryColor: string;
  logo: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  rejectionReason?: string | null;
};

type LicenseMetrics = {
  totalTenants: number;
  setupRequiredCount: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  gracePeriodCount: number;
  expiredCount: number;
  totalRevenue: number;
  pendingSetupFee: number;
  mrr: number;
};

export default function AdminPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create tenant form
  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantSlug, setNewTenantSlug] = useState('');
  const [creating, setCreating] = useState(false);

  // Add admin form
  const [adminTenantId, setAdminTenantId] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);

  // Subscription form - Per-tenant state to avoid conflicts when switching tenants
  const [subscriptionForm, setSubscriptionForm] = useState<Record<string, { planTier: string | null; status: string; price: string }>>({});
  const [updatingSub, setUpdatingSub] = useState(false);

  // Helper to get form state for a specific tenant
  const getSubFormState = (tenantId: string, tenant: TenantRow) => {
    if (!subscriptionForm[tenantId]) {
      return {
        planTier: tenant.subscription?.plan.tier || 'NO_PLAN',
        status: tenant.subscription?.status || 'TRIAL',
        price: ''
      };
    }
    return subscriptionForm[tenantId];
  };

  // Helper to update form state for a specific tenant
  const updateSubFormState = (tenantId: string, updates: Partial<{ planTier: string | null; status: string; price: string }>) => {
    setSubscriptionForm(prev => ({
      ...prev,
      [tenantId]: {
        ...getSubFormState(tenantId, tenants.find(t => t.id === tenantId) || {} as TenantRow),
        ...updates
      }
    }));
  };

  // Expanded tenant
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // License management state
  const [metrics, setMetrics] = useState<LicenseMetrics | null>(null);
  const [setupFees, setSetupFees] = useState<SetupFeeRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [showLicenseSection, setShowLicenseSection] = useState(false);
  const [updatingSetupFee, setUpdatingSetupFee] = useState(false);
  const [setupFeeAmount, setSetupFeeAmount] = useState(50);
  const [setupFeeActive, setSetupFeeActive] = useState(true);

  // Plan editing state
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editingPlanData, setEditingPlanData] = useState<PlanRow | null>(null);
  const [updatingPlan, setUpdatingPlan] = useState(false);

  // Company registrations state
  const [companyRegistrations, setCompanyRegistrations] = useState<CompanyRegistration[]>([]);

  useEffect(() => {
    if (!authLoading && user?.globalRole !== 'SUPER_ADMIN') {
      router.push('/dashboard');
    }
  }, [authLoading, user, router]);

  async function loadLicenseMetrics() {
    try {
      const m = await apiFetch<LicenseMetrics>('/license/admin/metrics');
      setMetrics(m ?? null);
    } catch {
      // Silently fail
    }
  }

  async function loadSetupFees() {
    try {
      const fees = await apiFetch<SetupFeeRow[]>('/license/admin/setup-fees');
      setSetupFees(fees ?? []);
      if (fees && fees.length > 0) {
        setSetupFeeAmount(fees[0].amount);
        setSetupFeeActive(fees[0].isActive);
      }
    } catch {
      // Silently fail
    }
  }

  async function loadPayments() {
    try {
      const p = await apiFetch<PaymentRow[]>('/license/admin/payments');
      setPayments(Array.isArray(p) ? p : []);
    } catch {
      setPayments([]);
    }
  }

  async function handleUpdateSetupFee(e: React.FormEvent) {
    e.preventDefault();
    setUpdatingSetupFee(true);
    setError('');
    try {
      await apiFetch('/license/admin/setup-fee', {
        method: 'PUT',
        json: { amount: setupFeeAmount, isActive: setupFeeActive },
      });
      flash('Setup fee actualizado');
      loadSetupFees();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUpdatingSetupFee(false);
    }
  }

  async function loadCompanyRegistrations() {
    try {
      const data = await apiFetch('/super-admin/company-registrations') as { registrations: any[] };
      setCompanyRegistrations(data.registrations || []);
    } catch (error) {
      console.error('Error loading registrations:', error);
    }
  }

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [t, p] = await Promise.all([
        apiFetch<{ tenants: TenantRow[] }>('/super-admin/tenants'),
        apiFetch<{ plans: PlanRow[] }>('/super-admin/plans'),
      ]);
      setTenants(t?.tenants ?? []);
      setPlans(p?.plans ?? []);
      setError('');
    } catch {
      setTenants([]);
      setPlans([]);
      setError('');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.globalRole === 'SUPER_ADMIN') {
      loadData();
      loadCompanyRegistrations();
      loadLicenseMetrics();
      loadSetupFees();
      loadPayments();
    }
  }, [user]);

  async function handleUpdatePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPlanData) return;
    setUpdatingPlan(true);
    setError('');
    try {
      await apiFetch(`/super-admin/plans/${editingPlanData.id}`, {
        method: 'PUT',
        json: {
          name: editingPlanData.name,
          features: editingPlanData.features,
          limits: editingPlanData.limits,
          isActive: true,
        },
      });
      flash('Plan actualizado exitosamente');
      setEditingPlanId(null);
      setEditingPlanData(null);
      loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUpdatingPlan(false);
    }
  }

  function startEditingPlan(plan: PlanRow) {
    setEditingPlanId(plan.id);
    setEditingPlanData({ ...plan });
  }

  function cancelEditingPlan() {
    setEditingPlanId(null);
    setEditingPlanData(null);
  }

  function updatePlanFeature(key: string, value: boolean) {
    if (!editingPlanData) return;
    setEditingPlanData({
      ...editingPlanData,
      features: { ...editingPlanData.features, [key]: value },
    });
  }

  function updatePlanLimit(key: string, value: number) {
    if (!editingPlanData) return;
    setEditingPlanData({
      ...editingPlanData,
      limits: { ...editingPlanData.limits, [key]: value },
    });
  }

  function updatePlanName(name: string) {
    if (!editingPlanData) return;
    setEditingPlanData({ ...editingPlanData, name });
  }

  function flash(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  }

  async function handleCreateTenant(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const slug = newTenantSlug || newTenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      await apiFetch('/super-admin/tenants', {
        method: 'POST',
        json: { name: newTenantName, slug },
      });
      setNewTenantName('');
      setNewTenantSlug('');
      setShowCreateTenant(false);
      flash('Tenant creado exitosamente');
      loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleAddAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!adminTenantId) return;
    setAddingAdmin(true);
    setError('');
    try {
      await apiFetch(`/super-admin/tenants/${adminTenantId}/admin`, {
        method: 'POST',
        json: { email: adminEmail, password: adminPassword },
      });
      setAdminEmail('');
      setAdminPassword('');
      setAdminTenantId(null);
      flash('Administrador agregado correctamente');
      loadData();
    } catch (e: any) {
      console.error('Error adding admin:', e);
      
      // Si el error tiene status 409 o menciona que el usuario ya existe
      if (e.status === 409 || e.message?.includes('already exists') || e.message?.includes('User already')) {
        // Usuario existe pero no tiene membresía - ofrecer resetear contraseña
        const resetPassword = confirm(`El usuario ${adminEmail} ya existe en el sistema.\n\n¿Deseas resetear su contraseña para que pueda ingresar?\n\nContraseña actual: ${adminPassword}`);
        if (resetPassword && adminPassword.length >= 8) {
          const success = await handleResetPassword(adminEmail, adminPassword);
          if (success) {
            // Ahora intentar agregar la membresía
            try {
              await apiFetch(`/super-admin/tenants/${adminTenantId}/admin`, {
                method: 'POST',
                json: { email: adminEmail, password: adminPassword },
              });
              setAdminEmail('');
              setAdminPassword('');
              setAdminTenantId(null);
              flash('Usuario agregado como administrador correctamente');
              loadData();
            } catch (membershipError: any) {
              setError('Contraseña actualizada pero error agregando membresía: ' + (membershipError.message || 'Error desconocido'));
            }
          }
        } else if (!adminPassword || adminPassword.length < 8) {
          setError('La contraseña debe tener al menos 8 caracteres para resetear.');
        }
      } else if (e.message.includes('User already has membership in this tenant')) {
        setError(`El usuario ${adminEmail} ya es miembro de este tenant. No se puede agregar nuevamente.`);
      } else {
        setError(e.message || 'Error agregando administrador');
      }
    } finally {
      setAddingAdmin(false);
    }
  }

  async function handleResetPassword(email: string, newPassword: string) {
    try {
      await apiFetch(`/super-admin/users/${encodeURIComponent(email)}/reset-password`, {
        method: 'PUT',
        json: { newPassword }
      });
      flash(`Contraseña de ${email} actualizada correctamente`);
      return true;
    } catch (e: any) {
      setError(e.message || 'Error reseteando contraseña');
      return false;
    }
  }

  async function handleUpdateSubscription(e: React.FormEvent, tenantId: string) {
    e.preventDefault();
    if (!tenantId) {
      setError('Selecciona un tenant');
      return;
    }
    setUpdatingSub(true);
    setError('');
    try {
      const formState = subscriptionForm[tenantId];

      console.log('Enviando actualización de suscripción:', {
        tenantId,
        planTier: formState.planTier,
        status: formState.status,
        price: formState.price ? parseFloat(formState.price) : undefined
      });

      const response = await apiFetch(`/super-admin/tenants/${tenantId}/subscription`, {
        method: 'PUT',
        json: {
          planTier: formState.planTier,
          status: formState.status,
          ...(formState.price && { price: parseFloat(formState.price) })
        },
      });

      console.log('Respuesta de la API:', response);
      flash('✅ Suscripción actualizada correctamente');

      // Reset form state for this tenant after successful update
      setSubscriptionForm(prev => ({
        ...prev,
        [tenantId]: {
          planTier: formState.planTier,
          status: formState.status,
          price: ''
        }
      }));
      loadData(); // Reload to get fresh data








    } catch (e: any) {
      console.error('Error al actualizar suscripción:', e);
      setError(`Error: ${e.message || 'Error desconocido'}`);
    } finally {
      setUpdatingSub(false);
    }
  }

  async function handleDeleteTenant(tenantId: string) {
    if (!confirm('¿Estás seguro? Esta acción eliminará permanentemente el tenant y todos sus datos.')) {
      return;
    }
    
    setError('');
    try {
      await apiFetch(`/super-admin/tenants/${tenantId}`, {
        method: 'DELETE',
      });
      flash('Tenant eliminado correctamente');
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleSuspendTenant(tenantId: string, tenantName: string) {
    const reason = prompt(`¿Por qué quieres suspender el tenant "${tenantName}"?`);
    if (reason === null) return; // Usuario canceló
    
    setError('');
    try {
      await apiFetch(`/super-admin/tenants/${tenantId}/suspend`, {
        method: 'PUT',
        json: { reason }
      });
      flash(`Tenant "${tenantName}" suspendido correctamente`);
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleReactivateTenant(tenantId: string, tenantName: string) {
    if (!confirm(`¿Estás seguro de reactivar el tenant "${tenantName}"?`)) {
      return;
    }
    
    setError('');
    try {
      await apiFetch(`/super-admin/tenants/${tenantId}/reactivate`, {
        method: 'PUT',
      });
      flash(`Tenant "${tenantName}" reactivado correctamente`);
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (authLoading || (user?.globalRole !== 'SUPER_ADMIN')) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
            <Shield className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Super Admin</h1>
            <p className="text-sm text-neutral-500">Gestión de tenants, planes y suscripciones</p>
          </div>
        </div>
        <button
          onClick={() => { setShowCreateTenant(!showCreateTenant); setError(''); }}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
        >
          {showCreateTenant ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showCreateTenant ? 'Cancelar' : 'Nuevo Tenant'}
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 text-green-700 text-sm">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> {success}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2"><Building2 className="h-5 w-5 text-blue-600" /></div>
            <div>
              <div className="text-2xl font-bold text-neutral-900">{tenants.length}</div>
              <div className="text-xs text-neutral-500">Tenants</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 p-2"><Briefcase className="h-5 w-5 text-amber-600" /></div>
            <div>
              <div className="text-2xl font-bold text-neutral-900">{companyRegistrations.filter(r => r.status === 'PENDING').length}</div>
              <div className="text-xs text-neutral-500">Solicitudes pendientes</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-50 p-2"><Users className="h-5 w-5 text-green-600" /></div>
            <div>
              <div className="text-2xl font-bold text-neutral-900">{tenants.reduce((s, t) => s + t.memberCount, 0)}</div>
              <div className="text-xs text-neutral-500">Usuarios totales</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 p-2"><CreditCard className="h-5 w-5 text-amber-600" /></div>
            <div>
              <div className="text-2xl font-bold text-neutral-900">{tenants.filter(t => t.subscription?.status === 'ACTIVE').length}</div>
              <div className="text-xs text-neutral-500">Suscripciones activas</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-50 p-2"><Zap className="h-5 w-5 text-purple-600" /></div>
            <div>
              <div className="text-2xl font-bold text-neutral-900">{plans.length}</div>
              <div className="text-xs text-neutral-500">Planes disponibles</div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Tenant Form */}
      {showCreateTenant && (
        <form onSubmit={handleCreateTenant} className="rounded-xl border border-brand-200 bg-brand-50/30 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-lg bg-brand-100 p-2"><Building2 className="h-5 w-5 text-brand-600" /></div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Crear Nuevo Tenant</h2>
              <p className="text-sm text-neutral-500">Se creará una organización vacía sin suscripción</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Nombre</label>
              <input
                value={newTenantName}
                onChange={e => { setNewTenantName(e.target.value); if (!newTenantSlug) setNewTenantSlug(''); }}
                placeholder="Acme Corp"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Slug (URL)</label>
              <input
                value={newTenantSlug || newTenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}
                onChange={e => setNewTenantSlug(e.target.value)}
                placeholder="acme-corp"
                pattern="^[a-z0-9-]+$"
                title="Solo letras minúsculas, números y guiones"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={creating || !newTenantName}
            className="mt-4 flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Crear Tenant
          </button>
        </form>
      )}

      {/* Tenants Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="p-5 border-b border-neutral-200 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-neutral-600" />
          <h2 className="font-semibold text-neutral-900">Tenants</h2>
          <span className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full">{tenants.length}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
          </div>
        ) : tenants.length === 0 ? (
          <div className="py-12 text-center">
            <Globe className="mx-auto h-10 w-10 text-neutral-200" />
            <p className="mt-3 text-sm text-neutral-400">No hay tenants registrados</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {tenants.map(t => (
              <div key={t.id}>
                <button
                  onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 text-brand-600 text-sm font-bold flex-shrink-0">
                    {t.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-neutral-900 text-sm">{t.name}</span>
                      <span className="text-xs text-neutral-400 font-mono">/{t.slug}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-neutral-500">{t.memberCount} miembros</span>
                      <span className="text-xs text-neutral-300">•</span>
                      <span className="text-xs text-neutral-500">{new Date(t.createdAt).toLocaleDateString('es-AR')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {t.subscription ? (
                      <>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${PLAN_COLORS[t.subscription.plan.tier] || PLAN_COLORS.BASIC}`}>
                          {t.subscription.plan.name}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SUB_STATUS_COLORS[t.subscription.status] || SUB_STATUS_COLORS.ACTIVE}`}>
                          {t.subscription.status}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-400 font-medium">Sin plan</span>
                    )}
                    {expandedId === t.id ? <ChevronUp className="h-4 w-4 text-neutral-400" /> : <ChevronDown className="h-4 w-4 text-neutral-400" />}
                  </div>
                </button>

                {/* Expanded Actions */}
                {expandedId === t.id && (
                  <div className="px-5 pb-5 bg-neutral-50/50 border-t border-neutral-100">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
                      {/* Add Admin */}
                      <div className="rounded-xl border border-neutral-200 bg-white p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <UserPlus className="h-4 w-4 text-neutral-600" />
                          <h3 className="font-medium text-neutral-900 text-sm">Agregar Admin</h3>
                        </div>
                        <form onSubmit={(e) => { setAdminTenantId(t.id); handleAddAdmin(e); }} className="space-y-3">
                          <input type="hidden" value={t.id} />
                          <input
                            type="email"
                            value={adminTenantId === t.id ? adminEmail : ''}
                            onFocus={() => setAdminTenantId(t.id)}
                            onChange={e => { setAdminTenantId(t.id); setAdminEmail(e.target.value); }}
                            placeholder="admin@empresa.com"
                            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                            required
                          />
                          <input
                            type="password"
                            value={adminTenantId === t.id ? adminPassword : ''}
                            onFocus={() => setAdminTenantId(t.id)}
                            onChange={e => { setAdminTenantId(t.id); setAdminPassword(e.target.value); }}
                            placeholder="Contraseña (min 12 chars)"
                            minLength={12}
                            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                            required
                          />
                          <button
                            type="submit"
                            disabled={addingAdmin}
                            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-700 disabled:bg-neutral-300 transition-colors"
                          >
                            {addingAdmin ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                            Crear Admin
                          </button>
                        </form>
                      </div>

                      {/* Update Subscription */}
                      <div className="rounded-xl border border-neutral-200 bg-white p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <CreditCard className="h-4 w-4 text-neutral-600" />
                          <h3 className="font-medium text-neutral-900 text-sm">Suscripción</h3>
                        </div>
                        {(() => {
                          const formState = getSubFormState(t.id, t);
                          return (
                            <form onSubmit={(e) => handleUpdateSubscription(e, t.id)} className="space-y-3">
                              <div>
                                <label className="text-xs text-neutral-500 mb-1 block">Plan</label>
                                <select
                                  value={formState.planTier || ''}
                                  onChange={e => updateSubFormState(t.id, { planTier: e.target.value || 'NO_PLAN' })}
                                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                                >
                                  <option value="">Sin Plan</option>
                                  {plans.map(p => (
                                    <option key={p.tier} value={p.tier}>{p.name} ({p.tier})</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-neutral-500 mb-1 block">Estado</label>
                                <select
                                  value={formState.status}
                                  onChange={e => updateSubFormState(t.id, { status: e.target.value })}
                                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                                >
                                  <option value="TRIAL">Trial</option>
                                  <option value="ACTIVE">Activo</option>
                                  <option value="PAST_DUE">Vencido</option>
                                  <option value="CANCELED">Cancelado</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-neutral-500 mb-1 block">Precio Personalizado (opcional)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={formState.price}
                                  onChange={e => updateSubFormState(t.id, { price: e.target.value })}
                                  placeholder="Dejar vacío para usar precio por defecto"
                                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                                />
                              </div>
                              <button
                                type="submit"
                                disabled={updatingSub}
                                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-700 disabled:bg-neutral-300 transition-colors"
                              >
                                {updatingSub ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                                Actualizar Plan
                              </button>
                            </form>
                          );
                        })()}
                      </div>

                      {/* Suspend/Reactivate Tenant */}
                      <div className={`rounded-xl border ${t.status === 'SUSPENDED' ? 'border-orange-200 bg-orange-50' : 'border-yellow-200 bg-yellow-50'} p-4`}>
                        <div className="flex items-center gap-2 mb-3">
                          {t.status === 'SUSPENDED' ? (
                            <Play className="h-4 w-4 text-orange-600" />
                          ) : (
                            <Pause className="h-4 w-4 text-yellow-600" />
                          )}
                          <h3 className={`font-medium text-sm ${t.status === 'SUSPENDED' ? 'text-orange-900' : 'text-yellow-900'}`}>
                            {t.status === 'SUSPENDED' ? 'Reactivar Tenant' : 'Suspender Tenant'}
                          </h3>
                        </div>
                        <div className="space-y-3">
                          <p className={`text-xs ${t.status === 'SUSPENDED' ? 'text-orange-700' : 'text-yellow-700'}`}>
                            {t.status === 'SUSPENDED' ? (
                              <>
                                <strong>Estado:</strong> El tenant está suspendido.<br />
                                Los usuarios no pueden acceder al sistema.
                              </>
                            ) : (
                              <>
                                <strong>Advertencia:</strong> Suspender el tenant impedirá que los usuarios accedan.
                              </>
                            )}
                          </p>
                          <div className={`text-xs space-y-1 ${t.status === 'SUSPENDED' ? 'text-orange-600' : 'text-yellow-600'}`}>
                            {t.status === 'SUSPENDED' ? (
                              <>
                                <p>• Se reactivarán todas las membresías</p>
                                <p>• Se reactivarán suscripciones canceladas</p>
                                <p>• Los usuarios volverán a tener acceso</p>
                              </>
                            ) : (
                              <>
                                <p>• Se suspenderán todas las membresías</p>
                                <p>• Se cancelarán las suscripciones</p>
                                <p>• Los usuarios perderán acceso</p>
                                <p>• Los datos no se eliminarán</p>
                              </>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              if (t.status === 'SUSPENDED') {
                                handleReactivateTenant(t.id, t.name);
                              } else {
                                handleSuspendTenant(t.id, t.name);
                              }
                            }}
                            className={`w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition-colors ${
                              t.status === 'SUSPENDED' 
                                ? 'bg-orange-600 hover:bg-orange-700' 
                                : 'bg-yellow-600 hover:bg-yellow-700'
                            }`}
                          >
                            {t.status === 'SUSPENDED' ? (
                              <>
                                <Play className="h-3.5 w-3.5" />
                                Reactivar
                              </>
                            ) : (
                              <>
                                <Pause className="h-3.5 w-3.5" />
                                Suspender
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Delete Tenant */}
                      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Trash2 className="h-4 w-4 text-red-600" />
                          <h3 className="font-medium text-red-900 text-sm">Eliminar Tenant</h3>
                        </div>
                        <div className="space-y-3">
                          <p className="text-xs text-red-700">
                            <strong>⚠️ Advertencia:</strong> Esta acción eliminará permanentemente el tenant y todos sus datos.
                          </p>
                          <div className="text-xs text-red-600 space-y-1">
                            <p>• Se eliminarán todos los usuarios ({t.memberCount} miembros)</p>
                            <p>• Se eliminarán todas las suscripciones</p>
                            <p>• Se eliminarán todos los datos asociados</p>
                            <p>• Esta acción no se puede deshacer</p>
                          </div>
                          <button
                            onClick={() => {
                              if (confirm(`¿Estás seguro de eliminar el tenant "${t.name}"?\n\nEsta acción eliminará permanentemente todos los datos asociados y no se puede deshacer.`)) {
                                handleDeleteTenant(t.id);
                              }
                            }}
                            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Eliminar Tenant
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Tenant metadata */}
                    <div className="mt-3 flex items-center gap-4 text-xs text-neutral-400">
                      <span>ID: <span className="font-mono">{t.id.slice(0, 8)}…</span></span>
                      <span>Estado: {t.status}</span>
                      {t.subscription && (
                        <span>Desde: {new Date(t.subscription.startedAt).toLocaleDateString('es-AR')}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* License Management Section */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <button
          onClick={() => setShowLicenseSection(!showLicenseSection)}
          className="w-full flex items-center justify-between p-5 border-b border-neutral-200 hover:bg-neutral-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
              <Shield className="h-5 w-5 text-amber-600" />
            </div>
            <div className="text-left">
              <h2 className="font-semibold text-neutral-900">Gestión de Licencias</h2>
              <p className="text-sm text-neutral-500">Setup fees, pagos y métricas del sistema</p>
            </div>
          </div>
          {showLicenseSection ? <ChevronUp className="h-5 w-5 text-neutral-400" /> : <ChevronDown className="h-5 w-5 text-neutral-400" />}
        </button>

        {showLicenseSection && (
          <div className="p-5 space-y-6">
            {/* License Metrics */}
            {metrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-50 p-2"><Building2 className="h-5 w-5 text-blue-600" /></div>
                    <div>
                      <div className="text-2xl font-bold text-neutral-900">{metrics.setupRequiredCount}</div>
                      <div className="text-xs text-neutral-500">Setup pendiente</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-green-50 p-2"><TrendingUp className="h-5 w-5 text-green-600" /></div>
                    <div>
                      <div className="text-2xl font-bold text-neutral-900">{metrics.mrr}</div>
                      <div className="text-xs text-neutral-500">MRR (USD)</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-amber-50 p-2"><AlertTriangle className="h-5 w-5 text-amber-600" /></div>
                    <div>
                      <div className="text-2xl font-bold text-neutral-900">{metrics.gracePeriodCount}</div>
                      <div className="text-xs text-neutral-500">En gracia</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-purple-50 p-2"><DollarSign className="h-5 w-5 text-purple-600" /></div>
                    <div>
                      <div className="text-2xl font-bold text-neutral-900">${metrics.totalRevenue}</div>
                      <div className="text-xs text-neutral-500">Ingresos totales</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Setup Fee Configuration */}
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-5">
              <div className="flex items-center gap-3 mb-4">
                <Wallet className="h-5 w-5 text-neutral-600" />
                <h3 className="font-semibold text-neutral-900">Configuración de Setup Fee</h3>
              </div>
              <form onSubmit={handleUpdateSetupFee} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Monto (USD)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={setupFeeAmount}
                    onChange={e => setSetupFeeAmount(Number(e.target.value))}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                    required
                  />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="setupFeeActive"
                    checked={setupFeeActive}
                    onChange={e => setSetupFeeActive(e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                  />
                  <label htmlFor="setupFeeActive" className="text-sm font-medium text-neutral-700">Activo</label>
                </div>
                <button
                  type="submit"
                  disabled={updatingSetupFee}
                  className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:bg-neutral-300 transition-colors"
                >
                  {updatingSetupFee ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Actualizar
                </button>
              </form>
            </div>

            {/* Recent Payments */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <CreditCard className="h-5 w-5 text-neutral-600" />
                <h3 className="font-semibold text-neutral-900">Pagos Recientes</h3>
                <span className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full">{payments.length}</span>
              </div>
              {payments.length === 0 ? (
                <div className="text-center py-8 text-neutral-400">
                  <Package className="mx-auto h-8 w-8 mb-2" />
                  <p className="text-sm">No hay pagos registrados</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="text-left font-medium text-neutral-700 px-4 py-3 rounded-tl-lg">Tenant</th>
                        <th className="text-left font-medium text-neutral-700 px-4 py-3">Monto</th>
                        <th className="text-left font-medium text-neutral-700 px-4 py-3">Estado</th>
                        <th className="text-left font-medium text-neutral-700 px-4 py-3">Descripción</th>
                        <th className="text-left font-medium text-neutral-700 px-4 py-3 rounded-tr-lg">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {payments.slice(0, 10).map(p => (
                        <tr key={p.id} className="hover:bg-neutral-50">
                          <td className="px-4 py-3 font-medium text-neutral-900">{p.tenantName}</td>
                          <td className="px-4 py-3">${p.amount} {p.currency}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              p.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                              p.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-neutral-500">{p.description || '-'}</td>
                          <td className="px-4 py-3 text-neutral-400">
                            {new Date(p.createdAt).toLocaleDateString('es-AR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Company Registrations Section */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="p-5 border-b border-neutral-200 flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-amber-600" />
          <h2 className="font-semibold text-neutral-900">Gestión de Registros de Empresas</h2>
        </div>
        <div className="p-5">
          <CompanyRegistrations />

      {/* Company Access Data Section */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="p-5 border-b border-neutral-200 flex items-center gap-2">
          <Key className="h-5 w-5 text-blue-600" />
          <h2 className="font-semibold text-neutral-900">Datos de Acceso de Empresas</h2>
        </div>
        <div className="p-5">
          <CompanyAccessData />
        </div>
      </div>
        </div>
      </div>

      {/* MercadoPago Configuration Section */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="p-5 border-b border-neutral-200 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          <h2 className="font-semibold text-neutral-900">Configuración de MercadoPago</h2>
        </div>
        <div className="p-5">
          <MercadoPagoConfig />
        </div>
      </div>

      {/* Payment Notifications Section */}
      <PaymentNotifications />

      {/* Payment Management Section */}
      <PaymentManagement />

      {/* Plans Management Section */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="p-5 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            <h2 className="font-semibold text-neutral-900">Gestión de Planes</h2>
            <span className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full">{plans.length}</span>
          </div>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {plans.map(p => (
              <div key={p.tier} className={`rounded-xl border-2 p-5 ${PLAN_COLORS[p.tier] || PLAN_COLORS.BASIC}`}>
                {editingPlanId === p.id ? (
                  // Edit Mode
                  <form onSubmit={handleUpdatePlan} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium mb-1 opacity-75">Nombre del Plan</label>
                      <input
                        type="text"
                        value={editingPlanData?.name || ''}
                        onChange={e => updatePlanName(e.target.value)}
                        className="w-full rounded-lg border border-current bg-white/50 px-3 py-2 text-sm font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-2 opacity-75">Módulos Incluidos</label>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {Object.entries(editingPlanData?.features || {}).map(([key, value]) => (
                          <label key={key} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={value}
                              onChange={e => updatePlanFeature(key, e.target.checked)}
                              className="h-4 w-4 rounded border-current"
                            />
                            <span className="text-sm">{FEATURE_LABELS[key] || key.replace(/_/g, ' ')}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-2 opacity-75">Límites</label>
                      <div className="space-y-2">
                        {Object.entries(editingPlanData?.limits || {}).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between gap-2">
                            <span className="text-sm">{key.replace('max_', '').replace(/_/g, ' ')}</span>
                            <input
                              type="number"
                              min="0"
                              value={value}
                              onChange={e => updatePlanLimit(key, parseInt(e.target.value) || 0)}
                              className="w-20 rounded-lg border border-current bg-white/50 px-2 py-1 text-sm text-right"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="submit"
                        disabled={updatingPlan}
                        className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-blue-600 text-white px-3 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        {updatingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditingPlan}
                        disabled={updatingPlan}
                        className="flex items-center justify-center gap-1 rounded-lg border border-current px-3 py-2 text-sm font-medium hover:bg-white/20 disabled:opacity-50"
                      >
                        <X className="h-4 w-4" />
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  // View Mode
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-lg">{p.name}</h3>
                        <p className="text-xs opacity-75">{p.tier}</p>
                      </div>
                      <button
                        onClick={() => startEditingPlan(p)}
                        className="p-2 rounded-lg hover:bg-white/30 transition-colors"
                        title="Editar plan"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>

                    <div className="space-y-1 mb-4">
                      {Object.entries(p.features as Record<string, boolean>).map(([k, v]) => (
                        <div key={k} className="flex items-center gap-1.5 text-sm">
                          {v ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4 opacity-40" />}
                          <span className={v ? '' : 'opacity-40 line-through'}>{FEATURE_LABELS[k] || k.replace(/_/g, ' ')}</span>
                        </div>
                      ))}
                    </div>

                    {p.limits && Object.keys(p.limits).length > 0 && (
                      <div className="pt-3 border-t border-current/20 space-y-2">
                        <p className="text-xs font-medium opacity-75">Límites:</p>
                        {Object.entries(p.limits as Record<string, number>).map(([k, v]) => (
                          <div key={k} className="flex justify-between text-sm">
                            <span className="opacity-75">{k.replace('max_', '').replace(/_/g, ' ')}</span>
                            <span className="font-semibold">{v.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente para Notificaciones de Pagos
function PaymentNotifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    setLoading(true);
    try {
      const data = await apiFetch('/super-admin/notifications') as { notifications: any[] };
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(id: string) {
    try {
      await apiFetch(`/super-admin/notifications/${id}/read`, {
        method: 'POST',
      });
      setNotifications(notifications.map(n => 
        n.id === id ? { ...n, isRead: true } : n
      ));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-neutral-600" />
          <h2 className="font-semibold text-neutral-900">Notificaciones de Pagos</h2>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
              {unreadCount} nuevas
            </span>
          )}
        </div>
        <button
          onClick={loadNotifications}
          className="text-neutral-400 hover:text-neutral-600 transition-colors"
          title="Recargar"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="py-12 text-center">
          <DollarSign className="mx-auto h-10 w-10 text-neutral-200" />
          <p className="mt-3 text-sm text-neutral-400">No hay notificaciones de pago</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-4 rounded-lg border transition-all ${
                notification.isRead
                  ? 'bg-neutral-50 border-neutral-200'
                  : 'bg-blue-50 border-blue-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  notification.type === 'PAYMENT_RECEIVED'
                    ? 'bg-green-100'
                    : 'bg-yellow-100'
                }`}>
                  {notification.type === 'PAYMENT_RECEIVED' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-neutral-900 text-sm">
                      {notification.title}
                    </h3>
                    {!notification.isRead && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        Marcar como leído
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-neutral-600 mt-1">
                    {notification.message}
                  </p>
                  <p className="text-xs text-neutral-400 mt-2">
                    {new Date(notification.createdAt).toLocaleString('es-AR')}
                  </p>
                  {notification.actionLink && (
                    <a
                      href={notification.actionLink}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 mt-2"
                    >
                      {notification.actionLabel || 'Ver detalles'}
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Landing Page Configuration Section */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="p-5 border-b border-neutral-200 flex items-center gap-2">
          <Globe className="h-5 w-5 text-purple-600" />
          <h2 className="font-semibold text-neutral-900">Configuración de Página de Inicio</h2>
        </div>
        <div className="p-5">
          <LandingPageConfig />
        </div>
      </div>
    </div>
  );
}
