'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import {
  Settings, Users, Shield, Building2, CreditCard,
  CheckCircle2, XCircle, Crown, UserPlus,
  Loader2, AlertCircle, Pencil, Save, X, Trash2,
  User, Lock, Eye, EyeOff, ArrowRight, Sparkles,
  Zap, Wallet
} from 'lucide-react';

type Member = {
  id: string; userId: string; email: string;
  role: string; status: string; isActive: boolean; joinedAt: string;
};
type PlanInfo = {
  plan: { id: string; tier: string; name: string; features: Record<string, boolean>; limits: Record<string, number> } | null;
  subscription: { id: string; status: string; startedAt: string; endsAt: string | null } | null;
};
type TenantInfo = { id: string; name: string; slug: string; status: string; createdAt: string } | null;

const TABS = ['Mi Perfil', 'Usuarios', 'Plan y Facturación', 'Datos de la Empresa'] as const;
type TabType = typeof TABS[number];

const ROLE_LABELS: Record<string, string> = { TENANT_ADMIN: 'Administrador', TENANT_USER: 'Usuario' };
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Activo', color: 'bg-green-100 text-green-700' },
  INVITED: { label: 'Invitado', color: 'bg-blue-100 text-blue-700' },
  SUSPENDED: { label: 'Suspendido', color: 'bg-red-100 text-red-700' },
};

const FEATURE_LABELS: Record<string, string> = {
  documentos: 'Documentos', indicadores: 'Indicadores (KPI)',
  no_conformidades: 'No Conformidades', riesgos: 'Gestión de Riesgos',
  auditorias: 'Auditorías', normativos_compliance: 'Cumplimiento Normativo',
  capacitaciones: 'Capacitaciones', rrhh: 'RRHH',
  sistemas: 'Sistemas', ia_asistente: 'IA Asistente', ia_auditora: 'IA Auditora',
};

export default function ConfiguracionPage() {
  const router = useRouter();
  const { user, tenantRole, refreshAuth } = useAuth();
  const isAdmin = tenantRole === 'TENANT_ADMIN';

  const [tab, setTab] = useState<TabType>('Mi Perfil');
  const [members, setMembers] = useState<Member[]>([]);
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [tenant, setTenant] = useState<TenantInfo>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Invite modal state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'TENANT_ADMIN' | 'TENANT_USER'>('TENANT_USER');
  const [inviting, setInviting] = useState(false);

  // Member action menu
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPw, setChangingPw] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Tenant edit
  const [editingTenant, setEditingTenant] = useState(false);
  const [editTenantName, setEditTenantName] = useState('');
  const [savingTenant, setSavingTenant] = useState(false);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [m, p, t] = await Promise.all([
        apiFetch<{ members: Member[] }>('/settings/members'),
        apiFetch<PlanInfo>('/settings/plan'),
        apiFetch<{ tenant: TenantInfo }>('/settings/tenant'),
      ]);
      setMembers(m.members);
      setPlanInfo(p);
      setTenant(t.tenant);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  }

  // ── Invite member ──
  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setError('');
    try {
      await apiFetch('/settings/members', {
        method: 'POST',
        json: { email: inviteEmail.trim(), role: inviteRole },
      });
      setShowInvite(false);
      setInviteEmail('');
      setInviteRole('TENANT_USER');
      showSuccess(`Invitación enviada a ${inviteEmail}`);
      loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setInviting(false);
    }
  }

  // ── Update member role ──
  async function handleChangeRole(memberId: string, newRole: string) {
    setError('');
    try {
      await apiFetch(`/settings/members/${memberId}`, {
        method: 'PATCH',
        json: { role: newRole },
      });
      showSuccess('Rol actualizado');
      setActionMenuId(null);
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  }

  // ── Suspend/activate member ──
  async function handleToggleStatus(memberId: string, currentStatus: string) {
    const newStatus = currentStatus === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    setError('');
    try {
      await apiFetch(`/settings/members/${memberId}`, {
        method: 'PATCH',
        json: { status: newStatus },
      });
      showSuccess(newStatus === 'SUSPENDED' ? 'Miembro suspendido' : 'Miembro reactivado');
      setActionMenuId(null);
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  }

  // ── Remove member ──
  async function handleRemoveMember(memberId: string, email: string) {
    if (!confirm(`¿Estás seguro de eliminar a ${email} del equipo?`)) return;
    setError('');
    try {
      await apiFetch(`/settings/members/${memberId}`, { method: 'DELETE' });
      showSuccess(`${email} eliminado del equipo`);
      setActionMenuId(null);
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  }

  // ── Save tenant name ──
  async function handleSaveTenant() {
    if (!editTenantName.trim()) return;
    setSavingTenant(true);
    setError('');
    try {
      const res = await apiFetch<{ tenant: TenantInfo }>('/settings/tenant', {
        method: 'PATCH',
        json: { name: editTenantName.trim() },
      });
      setTenant(res.tenant);
      setEditingTenant(false);
      showSuccess('Nombre de la organización actualizado');
      refreshAuth();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingTenant(false);
    }
  }

  // ── Change password ──
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmNewPassword) {
      setError('Las contraseñas nuevas no coinciden');
      return;
    }
    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    setChangingPw(true);
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        json: { currentPassword, newPassword },
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      showSuccess('Contraseña actualizada correctamente');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setChangingPw(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Configuración</h1>
        <p className="text-neutral-500 mt-1">Gestiona usuarios, plan y datos de tu organización</p>
      </div>

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

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-100 rounded-lg p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => { setTab(t); setActionMenuId(null); }} className={`flex-1 min-w-fit py-2 px-4 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
            tab === t ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
          }`}>{t}</button>
        ))}
      </div>

      {/* ═══════════════ MI PERFIL ═══════════════ */}
      {tab === 'Mi Perfil' && (
        <div className="space-y-6">
          {/* User info card */}
          <div className="bg-white border border-neutral-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <User className="h-5 w-5 text-neutral-600" />
              <h2 className="font-semibold text-neutral-900">Mi Cuenta</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-neutral-400 uppercase">Email</label>
                <p className="text-sm text-neutral-900 font-medium mt-1">{user?.email || '—'}</p>
              </div>
              <div>
                <label className="text-xs text-neutral-400 uppercase">Rol en la organización</label>
                <p className="text-sm text-neutral-900 mt-1">
                  <span className="inline-flex items-center gap-1">
                    {tenantRole === 'TENANT_ADMIN' && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                    {ROLE_LABELS[tenantRole || ''] || tenantRole || '—'}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-xs text-neutral-400 uppercase">Organización</label>
                <p className="text-sm text-neutral-900 mt-1">{tenant?.name || '—'}</p>
              </div>
              <div>
                <label className="text-xs text-neutral-400 uppercase">ID de usuario</label>
                <p className="text-sm text-neutral-400 font-mono mt-1">{user?.id?.slice(0, 8)}…</p>
              </div>
            </div>
          </div>

          {/* Change password */}
          <div className="bg-white border border-neutral-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Lock className="h-5 w-5 text-neutral-600" />
              <h2 className="font-semibold text-neutral-900">Cambiar Contraseña</h2>
            </div>
            <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
              <div>
                <label className="text-sm font-medium text-neutral-700">Contraseña actual</label>
                <div className="relative mt-1.5">
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm pr-10 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700">Nueva contraseña</label>
                <div className="relative mt-1.5">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    required
                    minLength={8}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm pr-10 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700">Confirmar nueva contraseña</label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)}
                  placeholder="Repetí la nueva contraseña"
                  required
                  minLength={8}
                  className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
              <button
                type="submit"
                disabled={changingPw || !currentPassword || !newPassword || !confirmNewPassword}
                className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60 transition-colors"
              >
                {changingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Cambiar contraseña
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════ USUARIOS ═══════════════ */}
      {tab === 'Usuarios' && (
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-neutral-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-neutral-600" />
              <h2 className="font-semibold text-neutral-900">Miembros del Equipo</h2>
              <span className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full">{members.length}</span>
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowInvite(true)}
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
              >
                <UserPlus className="h-4 w-4" /> Invitar
              </button>
            )}
          </div>

          {/* Invite Modal */}
          {showInvite && (
            <div className="border-b border-neutral-200 bg-brand-50/50 p-5">
              <form onSubmit={handleInvite} className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Email</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="usuario@empresa.com"
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                    required
                  />
                </div>
                <div className="w-48">
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Rol</label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as any)}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  >
                    <option value="TENANT_USER">Usuario</option>
                    <option value="TENANT_ADMIN">Administrador</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:bg-neutral-300 transition-colors"
                >
                  {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Invitar
                </button>
                <button
                  type="button"
                  onClick={() => { setShowInvite(false); setInviteEmail(''); }}
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </form>
            </div>
          )}

          {members.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
              {members.map(m => {
                const st = STATUS_LABELS[m.status] || STATUS_LABELS.ACTIVE;
                const isSelf = m.userId === user?.id;
                return (
                  <div key={m.id} className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 text-sm font-bold">
                        {m.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-neutral-900 truncate">{m.email}</div>
                        {isSelf && <span className="text-[10px] bg-brand-100 text-brand-600 px-1.5 py-0.5 rounded font-medium">Vos</span>}
                      </div>
                    </div>
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-neutral-400">Rol</span>
                        <div className="flex items-center gap-1 text-sm text-neutral-700">
                          {m.role === 'TENANT_ADMIN' && <Crown className="h-3 w-3 text-amber-500" />}
                          {ROLE_LABELS[m.role] || m.role}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-neutral-400">Estado</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-neutral-400">Desde</span>
                        <span className="text-sm text-neutral-500">
                          {new Date(m.joinedAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    {isAdmin && !isSelf && (
                      <div className="flex gap-2 pt-3 border-t border-neutral-100">
                        <button
                          onClick={() => handleChangeRole(m.id, m.role === 'TENANT_ADMIN' ? 'TENANT_USER' : 'TENANT_ADMIN')}
                          className="flex-1 flex items-center justify-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-colors"
                        >
                          <Shield className="h-3 w-3" />
                          {m.role === 'TENANT_ADMIN' ? 'A Usuario' : 'A Admin'}
                        </button>
                        <button
                          onClick={() => handleToggleStatus(m.id, m.status)}
                          className={`flex-1 flex items-center justify-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition-colors ${
                            m.status === 'SUSPENDED'
                              ? 'border-green-200 text-green-700 hover:bg-green-50'
                              : 'border-amber-200 text-amber-700 hover:bg-amber-50'
                          }`}
                        >
                          {m.status === 'SUSPENDED' ? (
                            <><CheckCircle2 className="h-3 w-3" /> Reactivar</>
                          ) : (
                            <><XCircle className="h-3 w-3" /> Suspender</>
                          )}
                        </button>
                        <button
                          onClick={() => handleRemoveMember(m.id, m.email)}
                          className="flex items-center justify-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-neutral-400">No hay miembros registrados</div>
          )}
        </div>
      )}

      {/* ═══════════════ PLAN ═══════════════ */}
      {tab === 'Plan y Facturación' && (
        <div className="space-y-6">
          {planInfo?.plan ? (
            <>
              <div className="bg-gradient-to-br from-brand-600 to-indigo-700 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-brand-200 text-sm">Plan Actual</p>
                    <h2 className="text-2xl font-bold">{planInfo.plan.name}</h2>
                  </div>
                  <CreditCard className="h-8 w-8 text-brand-200" />
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    planInfo.subscription?.status === 'ACTIVE' ? 'bg-green-500/20 text-green-200' :
                    planInfo.subscription?.status === 'TRIAL' ? 'bg-yellow-500/20 text-yellow-200' :
                    'bg-red-500/20 text-red-200'
                  }`}>{planInfo.subscription?.status}</span>
                  {planInfo.subscription?.startedAt && (
                    <span className="text-brand-200">
                      Desde: {new Date(planInfo.subscription.startedAt).toLocaleDateString('es-AR')}
                    </span>
                  )}
                </div>
                {/* Botón para cambiar de plan */}
                <div className="mt-6 pt-4 border-t border-white/20">
                  <button
                    onClick={() => router.push('/planes')}
                    className="flex items-center gap-2 bg-white text-brand-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-50 transition-colors"
                  >
                    <Sparkles className="h-4 w-4" />
                    Ver planes disponibles
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Métodos de Pago */}
              <div className="bg-white border border-neutral-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-neutral-600" />
                    <h3 className="font-semibold text-neutral-900">Método de Pago</h3>
                  </div>
                </div>
                <div className="space-y-4">
                  {/* MercadoPago */}
                  <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                        MP
                      </div>
                      <div>
                        <p className="font-medium text-neutral-900">MercadoPago</p>
                        <p className="text-sm text-neutral-500">Pago con tarjeta, efectivo o transferencia</p>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push('/planes?payment=mercadopago')}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Pagar ahora
                    </button>
                  </div>
                  {/* Pago manual */}
                  <div className="flex items-center justify-between p-4 bg-neutral-50 border border-neutral-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-neutral-600 rounded-lg flex items-center justify-center text-white">
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-neutral-900">Transferencia Bancaria</p>
                        <p className="text-sm text-neutral-500">Pago manual con confirmación</p>
                      </div>
                    </div>
                    <span className="text-xs text-neutral-400">Contactar soporte</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-neutral-200 rounded-xl p-5">
                <h3 className="font-semibold text-neutral-900 mb-4">Módulos Incluidos</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(planInfo.plan.features as Record<string, boolean>).map(([key, enabled]) => (
                    <div key={key} className="flex items-center gap-2 py-2">
                      {enabled
                        ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                        : <XCircle className="h-4 w-4 text-neutral-300" />
                      }
                      <span className={`text-sm ${enabled ? 'text-neutral-700' : 'text-neutral-400'}`}>
                        {FEATURE_LABELS[key] || key}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {planInfo.plan.limits && (
                <div className="bg-white border border-neutral-200 rounded-xl p-5">
                  <h3 className="font-semibold text-neutral-900 mb-4">Límites del Plan</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {Object.entries(planInfo.plan.limits as Record<string, number>).map(([key, val]) => (
                      <div key={key} className="text-center p-3 bg-neutral-50 rounded-lg">
                        <div className="text-2xl font-bold text-neutral-900">{val.toLocaleString()}</div>
                        <div className="text-xs text-neutral-500">{key.replace('max_', 'Máx. ').replace('_', ' ')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
              <CreditCard className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-500 mb-4">No hay plan activo</p>
              <button
                onClick={() => router.push('/planes')}
                className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                Elegir un plan
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ DATOS DE LA EMPRESA ═══════════════ */}
      {tab === 'Datos de la Empresa' && (
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-neutral-600" />
              <h2 className="font-semibold text-neutral-900">Información de la Organización</h2>
            </div>
            {isAdmin && !editingTenant && (
              <button
                onClick={() => { setEditingTenant(true); setEditTenantName(tenant?.name || ''); }}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
            )}
          </div>
          {tenant ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-neutral-400 uppercase">Nombre</label>
                {editingTenant ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      value={editTenantName}
                      onChange={e => setEditTenantName(e.target.value)}
                      className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                    />
                    <button
                      onClick={handleSaveTenant}
                      disabled={savingTenant || !editTenantName.trim()}
                      className="rounded-lg bg-brand-600 p-1.5 text-white hover:bg-brand-700 disabled:bg-neutral-300"
                    >
                      {savingTenant ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => setEditingTenant(false)}
                      className="rounded-lg border border-neutral-300 bg-white p-1.5 text-neutral-500 hover:bg-neutral-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-900 font-medium mt-1">{tenant.name}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-neutral-400 uppercase">Slug</label>
                <p className="text-sm text-neutral-900 font-mono mt-1">{tenant.slug}</p>
              </div>
              <div>
                <label className="text-xs text-neutral-400 uppercase">Estado</label>
                <p className="text-sm mt-1">
                  <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded-full text-xs font-medium">
                    <CheckCircle2 className="h-3 w-3" /> {tenant.status}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-xs text-neutral-400 uppercase">Fecha de Creación</label>
                <p className="text-sm text-neutral-900 mt-1">
                  {new Date(tenant.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-neutral-400">No se pudo cargar la información</p>
          )}
        </div>
      )}

      {/* Click outside to close action menus */}
      {actionMenuId && (
        <div className="fixed inset-0 z-0" onClick={() => setActionMenuId(null)} />
      )}
    </div>
  );
}
