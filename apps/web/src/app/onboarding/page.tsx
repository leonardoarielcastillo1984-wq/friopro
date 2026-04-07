'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Building2, Mail, Lock, Users, CheckCircle, ArrowRight } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    companyName: '',
    adminEmail: '',
    adminName: '',
    adminPassword: '',
    employeeCount: 1,
    industry: '',
    location: ''
  });

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('🔵 Enviando datos de onboarding:', formData);
      
      const response = await apiFetch('/onboarding', {
        method: 'POST',
        body: JSON.stringify(formData)
      }) as any;

      console.log('📡 Respuesta del servidor:', response);

      if (response.success) {
        // Guardar token y datos del usuario
        localStorage.setItem('accessToken', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        localStorage.setItem('tenant', JSON.stringify(response.tenant));

        // Si hay pago de setup, redirigir a pago
        if (response.setupPayment) {
          console.log('💳 Redirigiendo a éxito del onboarding...');
          router.push('/onboarding/success');
        } else {
          router.push('/dashboard');
        }
      } else {
        setError(response.error || 'Error en el registro');
      }
    } catch (error) {
      console.error('❌ Error en onboarding:', error);
      setError('Error de conexión. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const industries = [
    'Manufactura', 'Servicios', 'Tecnología', 'Salud', 
    'Educación', 'Construcción', 'Retail', 'Otro'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo y Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Bienvenido a SGI360</h1>
          <p className="text-gray-600">Comienza tu transformación digital</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((stepNumber) => (
            <div key={stepNumber} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= stepNumber 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {step > stepNumber ? <CheckCircle className="w-4 h-4" /> : stepNumber}
              </div>
              {stepNumber < 3 && (
                <div className={`w-12 h-1 mx-2 ${
                  step > stepNumber ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Información Básica */}
            {step === 1 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre de la Empresa *
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={formData.companyName}
                      onChange={(e) => updateFormData('companyName', e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Mi Empresa S.A."
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Industria
                  </label>
                  <select
                    value={formData.industry}
                    onChange={(e) => updateFormData('industry', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecciona una industria</option>
                    {industries.map(industry => (
                      <option key={industry} value={industry}>{industry}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cantidad de Empleados *
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="number"
                      required
                      min="1"
                      max="10000"
                      value={formData.employeeCount}
                      onChange={(e) => updateFormData('employeeCount', parseInt(e.target.value))}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="10"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Continuar
                  <ArrowRight className="inline-block w-4 h-4 ml-2" />
                </button>
              </>
            )}

            {/* Step 2: Datos del Administrador */}
            {step === 2 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre Completo del Administrador *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.adminName}
                    onChange={(e) => updateFormData('adminName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Juan Pérez"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email del Administrador *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      required
                      value={formData.adminEmail}
                      onChange={(e) => updateFormData('adminEmail', e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="admin@empresa.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contraseña *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={formData.adminPassword}
                      onChange={(e) => updateFormData('adminPassword', e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Mínimo 8 caracteres"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Continuar
                    <ArrowRight className="inline-block w-4 h-4 ml-2" />
                  </button>
                </div>
              </>
            )}

            {/* Step 3: Confirmación */}
            {step === 3 && (
              <>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold text-gray-900 mb-3">Resumen del Registro</h3>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Empresa:</span>
                    <span className="font-medium">{formData.companyName}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Administrador:</span>
                    <span className="font-medium">{formData.adminName}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Email:</span>
                    <span className="font-medium">{formData.adminEmail}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Empleados:</span>
                    <span className="font-medium">{formData.employeeCount}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Plan Inicial:</span>
                    <span className="font-medium text-blue-600">Starter (14 días trial)</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Setup Fee:</span>
                    <span className="font-medium">USD 400 (uno)</span>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                  >
                    Anterior
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Creando Cuenta...
                      </div>
                    ) : (
                      'Crear Cuenta'
                    )}
                  </button>
                </div>
              </>
            )}
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              ¿Ya tienes una cuenta?{' '}
              <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                Inicia Sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
