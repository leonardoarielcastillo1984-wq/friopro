'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Eye, EyeOff, Copy, Check, Key, Mail, Globe, Clock, History } from 'lucide-react';

interface AccessCredentials {
  email: string;
  password: string;
  tenantSlug: string;
  loginUrl: string;
  expiresIn: string;
}

interface CompanyWithAccess {
  id: string;
  companyName: string;
  email: string;
  status: string;
  approvedAt?: string;
  tenantId?: string;
  tenantSlug?: string;
  accessCredentials?: AccessCredentials;
}

export default function CompanyAccessData() {
  const [companies, setCompanies] = useState<CompanyWithAccess[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

  useEffect(() => {
    loadApprovedCompanies();
  }, []);

  async function loadApprovedCompanies() {
    setLoading(true);
    try {
      const data = await apiFetch('/super-admin/company-registrations') as { registrations: any[] };
      const registrations = Array.isArray(data.registrations) ? data.registrations : (Array.isArray(data) ? data : []);
      const approved = registrations
        .filter(r => r.status === 'APPROVED')
        .map(r => ({
          ...r,
          tenantSlug: r.tenantSlug || extractSlugFromData(r),
          accessCredentials: r.accessCredentials || null
        }));
      setCompanies(approved);
    } catch (error) {
      console.error('Error loading approved companies:', error);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }

  function extractSlugFromData(registration: any): string {
    // Intentar extraer el slug de los datos disponibles
    if (registration.tenant?.slug) return registration.tenant.slug;
    if (registration.tenantSlug) return registration.tenantSlug;
    return 'unknown';
  }

  function togglePasswordVisibility(companyId: string) {
    setShowPasswords(prev => ({
      ...prev,
      [companyId]: !prev[companyId]
    }));
  }

  async function copyToClipboard(text: string, type: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  }

  function formatCredentials(creds: AccessCredentials) {
    return `Email: ${creds.email}
Contraseña: ${creds.password}
URL de acceso: ${creds.loginUrl}
Slug: ${creds.tenantSlug}
Vigencia: ${creds.expiresIn}`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Key className="h-12 w-12 mx-auto mb-3 text-gray-300" />
        <p>No hay empresas aprobadas con datos de acceso disponibles</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Key className="h-5 w-5 text-blue-600" />
        <h3 className="font-semibold text-gray-900">Datos de Acceso de Empresas</h3>
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
          {companies.length} empresas
        </span>
      </div>

      {companies.map((company) => (
        <div key={company.id} className="border border-gray-200 rounded-lg overflow-hidden">
          {/* Header */}
          <div 
            className="bg-gray-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
            onClick={() => setExpandedCompany(expandedCompany === company.id ? null : company.id)}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Globe className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">{company.companyName}</h4>
                <p className="text-sm text-gray-500">{company.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                Aprobada
              </span>
              {company.approvedAt && (
                <span className="text-xs text-gray-400">
                  {new Date(company.approvedAt).toLocaleDateString('es-AR')}
                </span>
              )}
              <div className={`transform transition-transform ${expandedCompany === company.id ? 'rotate-180' : ''}`}>
                <Eye className="h-4 w-4 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Expanded Content */}
          {expandedCompany === company.id && (
            <div className="border-t border-gray-200 bg-white p-4">
              {company.accessCredentials ? (
                <div className="space-y-4">
                  {/* Credentials Display */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-medium text-blue-900 flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        Credenciales de Acceso
                      </h5>
                      <button
                        onClick={() => copyToClipboard(
                          formatCredentials(company.accessCredentials!),
                          'credentials'
                        )}
                        className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
                      >
                        {copied === 'credentials' ? (
                          <>
                            <Check className="h-3 w-3" />
                            Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            Copiar todo
                          </>
                        )}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Email */}
                      <div className="flex items-center justify-between bg-white rounded p-2">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">Email</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-700">{company.accessCredentials.email}</span>
                          <button
                            onClick={() => copyToClipboard(company.accessCredentials!.email, 'email')}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {copied === 'email' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>

                      {/* Password */}
                      <div className="flex items-center justify-between bg-white rounded p-2">
                        <div className="flex items-center gap-2">
                          <Key className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">Contraseña</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-700">
                            {showPasswords[company.id] ? company.accessCredentials.password : '••••••••'}
                          </span>
                          <button
                            onClick={() => togglePasswordVisibility(company.id)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {showPasswords[company.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </button>
                          <button
                            onClick={() => copyToClipboard(company.accessCredentials!.password, 'password')}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {copied === 'password' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>

                      {/* Login URL */}
                      <div className="flex items-center justify-between bg-white rounded p-2">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">URL de acceso</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-700">{company.accessCredentials.loginUrl}</span>
                          <button
                            onClick={() => copyToClipboard(company.accessCredentials!.loginUrl, 'url')}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {copied === 'url' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>

                      {/* Expires In */}
                      <div className="flex items-center justify-between bg-white rounded p-2">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">Vigencia</span>
                        </div>
                        <span className="text-sm text-orange-600">{company.accessCredentials.expiresIn}</span>
                      </div>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <h5 className="font-medium text-yellow-900 mb-2 text-sm">Instrucciones para el cliente:</h5>
                    <ol className="text-xs text-yellow-800 space-y-1 list-decimal list-inside">
                      <li>Ir a la URL de inicio de sesión</li>
                      <li>Usar el email y contraseña temporal proporcionados</li>
                      <li>Cambiar la contraseña inmediatamente después del primer ingreso</li>
                      <li>Completar el setup inicial de la empresa</li>
                    </ol>
                  </div>

                  {/* Password History Link */}
                  <div className="flex justify-center">
                    <button
                      onClick={() => window.open(`/super-admin/users/${company.tenantId}/password-history`, '_blank')}
                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <History className="h-3 w-3" />
                      Ver historial de contraseñas
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <Key className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No hay datos de acceso disponibles para esta empresa</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Los datos de acceso se generan cuando se aprueba la empresa
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
