'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { 
  Lightbulb, 
  AlertTriangle, 
  MessageSquare, 
  ShieldAlert, 
  HelpCircle,
  Rocket,
  AlertOctagon,
  Sparkles,
  Send,
  CheckCircle,
  Loader2,
  Building2
} from 'lucide-react';

const SUGGESTION_TYPES = [
  { id: 'SUGGESTION', label: 'Sugerencia', icon: Lightbulb, color: 'bg-amber-100 text-amber-700' },
  { id: 'COMPLAINT', label: 'Reclamo', icon: MessageSquare, color: 'bg-red-100 text-red-700' },
  { id: 'ALERT', label: 'Alerta', icon: AlertTriangle, color: 'bg-orange-100 text-orange-700' },
  { id: 'RISK', label: 'Riesgo', icon: ShieldAlert, color: 'bg-rose-100 text-rose-700' },
  { id: 'CONCERN', label: 'Inquietud', icon: HelpCircle, color: 'bg-blue-100 text-blue-700' },
  { id: 'OPPORTUNITY', label: 'Oportunidad', icon: Rocket, color: 'bg-green-100 text-green-700' },
  { id: 'INCIDENT', label: 'Incidente', icon: AlertOctagon, color: 'bg-purple-100 text-purple-700' },
  { id: 'IDEA', label: 'Idea', icon: Sparkles, color: 'bg-cyan-100 text-cyan-700' },
];

const CATEGORIES = [
  { id: 'WORK_ENVIRONMENT', label: 'Ambiente Laboral' },
  { id: 'PROCESS', label: 'Procesos' },
  { id: 'SAFETY', label: 'Seguridad' },
  { id: 'QUALITY', label: 'Calidad' },
  { id: 'COMMUNICATION', label: 'Comunicación' },
  { id: 'OTHER', label: 'Otro' },
];

const PRIORITIES = [
  { id: 'LOW', label: 'Baja', color: 'bg-gray-100 text-gray-700' },
  { id: 'MEDIUM', label: 'Media', color: 'bg-blue-100 text-blue-700' },
  { id: 'HIGH', label: 'Alta', color: 'bg-orange-100 text-orange-700' },
  { id: 'CRITICAL', label: 'Crítica', color: 'bg-red-100 text-red-700' },
];

interface CanalInfo {
  valid: boolean;
  tenant: {
    id: string;
    name: string;
    logoUrl?: string;
    primaryColor?: string;
  };
  config: {
    title: string;
    subtitle: string;
    message: string;
    footer: string;
  };
}

export default function CanalPage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canalInfo, setCanalInfo] = useState<CanalInfo | null>(null);
  
  // Form state
  const [step, setStep] = useState<'type' | 'form' | 'success'>('type');
  const [selectedType, setSelectedType] = useState<string>('');
  const [formData, setFormData] = useState({
    category: 'OTHER',
    title: '',
    description: '',
    priority: 'MEDIUM',
    isAnonymous: true,
    contactEmail: '',
    contactPhone: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function validateToken() {
      try {
        const res = await fetch(`/api/clima/canal/${token}`);
        if (!res.ok) throw new Error('Canal no válido');
        const data = await res.json();
        setCanalInfo(data);
      } catch (err) {
        setError('Este enlace no es válido o ha expirado.');
      } finally {
        setLoading(false);
      }
    }
    validateToken();
  }, [token]);

  const handleTypeSelect = (type: string) => {
    setSelectedType(type);
    setStep('form');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/clima/canal/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          ...formData,
        }),
      });

      if (!res.ok) throw new Error('Error al enviar');
      setStep('success');
    } catch (err) {
      alert('Error al enviar. Por favor intentá nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-3" />
          <p className="text-gray-600">Cargando canal...</p>
        </div>
      </div>
    );
  }

  if (error || !canalInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 shadow-lg text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertOctagon className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Enlace no válido</h2>
          <p className="text-gray-600">{error || 'Este canal de participación no está disponible.'}</p>
        </div>
      </div>
    );
  }

  const primaryColor = canalInfo.tenant.primaryColor || '#2563eb';

  // Step 1: Select type
  if (step === 'type') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <div className="max-w-md mx-auto px-4 py-8">
          {/* Header */}
          <div className="text-center mb-8">
            {canalInfo.tenant.logoUrl && (
              <img 
                src={canalInfo.tenant.logoUrl} 
                alt={canalInfo.tenant.name}
                className="h-12 mx-auto mb-4 object-contain"
              />
            )}
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {canalInfo.config.title}
            </h1>
            <p className="text-gray-600">{canalInfo.config.subtitle}</p>
          </div>

          {/* Type Selection */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700 text-center mb-4">
              ¿Qué querés compartir?
            </p>
            {SUGGESTION_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id}
                  onClick={() => handleTypeSelect(type.id)}
                  className="w-full bg-white rounded-xl p-4 shadow-sm border border-gray-200 
                           active:scale-[0.98] transition-all flex items-center gap-4
                           hover:shadow-md hover:border-gray-300"
                  style={{ touchAction: 'manipulation' }}
                >
                  <div className={`w-12 h-12 rounded-xl ${type.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="font-medium text-gray-900">{type.label}</span>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-gray-500 mt-8">
            {canalInfo.config.footer}
          </p>
        </div>
      </div>
    );
  }

  // Step 2: Form
  if (step === 'form') {
    const selectedTypeInfo = SUGGESTION_TYPES.find(t => t.id === selectedType);
    const TypeIcon = selectedTypeInfo?.icon || MessageSquare;

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <div className="max-w-md mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setStep('type')}
              className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center
                       active:scale-95 transition-transform"
            >
              ←
            </button>
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-xl ${selectedTypeInfo?.color} flex items-center justify-center`}>
                <TypeIcon className="w-5 h-5" />
              </div>
              <span className="font-semibold text-gray-900">{selectedTypeInfo?.label}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Título breve
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ej: Mejora en iluminación del depósito"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 
                         focus:ring-blue-500 focus:border-transparent outline-none
                         text-base"
                required
                maxLength={200}
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Área relacionada
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 
                         focus:ring-blue-500 focus:border-transparent outline-none
                         text-base bg-white"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Descripción detallada
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Contanos los detalles... ¿Qué pasó? ¿Cuándo? ¿Dónde? ¿Quién estuvo involucrado?"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 
                         focus:ring-blue-500 focus:border-transparent outline-none
                         text-base min-h-[120px] resize-none"
                required
                maxLength={5000}
              />
              <p className="text-xs text-gray-500 mt-1 text-right">
                {formData.description.length}/5000
              </p>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prioridad
              </label>
              <div className="grid grid-cols-4 gap-2">
                {PRIORITIES.map(prio => (
                  <button
                    key={prio.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, priority: prio.id })}
                    className={`py-2 px-1 rounded-lg text-xs font-medium transition-all
                              ${formData.priority === prio.id 
                                ? `${prio.color} ring-2 ring-offset-1 ring-gray-400` 
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {prio.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Anonymous toggle */}
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isAnonymous}
                  onChange={(e) => setFormData({ ...formData, isAnonymous: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 mt-0.5"
                />
                <div>
                  <span className="font-medium text-gray-900">Envío anónimo</span>
                  <p className="text-sm text-gray-500">
                    Tu identidad no será revelada a quienes revisen esta sugerencia.
                  </p>
                </div>
              </label>
            </div>

            {/* Contact info (optional) */}
            {!formData.isAnonymous && (
              <div className="space-y-3 animate-in slide-in-from-top-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email (opcional)
                  </label>
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    placeholder="tu@email.com"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 
                             focus:ring-blue-500 focus:border-transparent outline-none
                             text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Teléfono (opcional)
                  </label>
                  <input
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    placeholder="+54 11 1234-5678"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 
                             focus:ring-blue-500 focus:border-transparent outline-none
                             text-base"
                  />
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || !formData.title.trim() || !formData.description.trim()}
              className="w-full bg-blue-600 text-white font-semibold py-4 rounded-xl
                       active:scale-[0.98] transition-all flex items-center justify-center gap-2
                       disabled:opacity-50 disabled:cursor-not-allowed
                       shadow-lg shadow-blue-600/20"
              style={{ backgroundColor: primaryColor }}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Enviar mensaje
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-sm text-gray-500 mt-6">
            {canalInfo.config.footer}
          </p>
        </div>
      </div>
    );
  }

  // Step 3: Success
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-8 shadow-lg text-center max-w-sm w-full">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
             style={{ backgroundColor: `${primaryColor}20` }}>
          <CheckCircle className="w-8 h-8" style={{ color: primaryColor }} />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">¡Gracias!</h2>
        <p className="text-gray-600 mb-6">
          Tu mensaje fue recibido y será revisado por el equipo correspondiente.
        </p>
        <button
          onClick={() => {
            setStep('type');
            setSelectedType('');
            setFormData({
              category: 'OTHER',
              title: '',
              description: '',
              priority: 'MEDIUM',
              isAnonymous: true,
              contactEmail: '',
              contactPhone: '',
            });
          }}
          className="w-full py-3 rounded-xl font-medium transition-all active:scale-[0.98]"
          style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
        >
          Enviar otro mensaje
        </button>
      </div>
    </div>
  );
}
