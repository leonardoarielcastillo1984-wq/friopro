'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { X, Loader2, BrainCircuit, Check, Sparkles } from 'lucide-react';

interface Norm { code: string; label: string; description: string; }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

const NORM_FALLBACK: Norm[] = [
  { code: 'ISO9001', label: 'ISO 9001', description: 'Calidad' },
  { code: 'IATF16949', label: 'IATF 16949', description: 'Automotriz' },
  { code: 'ISO14001', label: 'ISO 14001', description: 'Ambiental' },
  { code: 'ISO45001', label: 'ISO 45001', description: 'SST' },
  { code: 'ISO27001', label: 'ISO 27001', description: 'Seguridad Información' },
  { code: 'INTEGRATED', label: 'Integrado', description: 'SGI' },
];

export default function ProcessAIWizard({ isOpen, onClose, onImported }: Props) {
  const [norms, setNorms] = useState<Norm[]>(NORM_FALLBACK);
  const [businessDescription, setBusinessDescription] = useState('');
  const [sites, setSites] = useState('1');
  const [hasProduction, setHasProduction] = useState(true);
  const [hasDesign, setHasDesign] = useState(false);
  const [hasOutsourcing, setHasOutsourcing] = useState(false);
  const [isCertified, setIsCertified] = useState(false);
  const [selectedNorms, setSelectedNorms] = useState<Set<string>>(new Set(['ISO9001']));
  const [mapName, setMapName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setBusinessDescription(''); setSites('1'); setHasProduction(true); setHasDesign(false);
    setHasOutsourcing(false); setIsCertified(false); setSelectedNorms(new Set(['ISO9001']));
    setMapName(''); setError('');
    apiFetch<{ norms: Norm[] }>('/process-templates/norms').then(r => { if (r?.norms?.length) setNorms(r.norms); }).catch(() => {});
  }, [isOpen]);

  function toggleNorm(code: string) {
    setSelectedNorms(prev => { const s = new Set(prev); if (s.has(code)) s.delete(code); else s.add(code); return s; });
  }

  async function generate() {
    if (!businessDescription.trim()) { setError('Contanos a qué se dedica la empresa'); return; }
    if (selectedNorms.size === 0) { setError('Seleccioná al menos una norma'); return; }
    setLoading(true); setError('');
    try {
      await apiFetch('/process-templates/ai-implement', {
        method: 'POST',
        json: {
          businessDescription, sites, hasProduction, hasDesign, hasOutsourcing,
          isCertified, norms: Array.from(selectedNorms), mapName: mapName || undefined,
        },
      });
      onImported();
      onClose();
    } catch (e: any) {
      setError('Error al generar el mapa: ' + (e?.message || ''));
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  const YesNo = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-neutral-700">{label}</span>
      <div className="flex gap-1">
        <button onClick={() => onChange(true)} className={`px-3 py-1 rounded-lg text-xs font-medium ${value ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-500'}`}>Sí</button>
        <button onClick={() => onChange(false)} className={`px-3 py-1 rounded-lg text-xs font-medium ${!value ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-500'}`}>No</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500">
              <BrainCircuit className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900">Implementación Inteligente con IA</h3>
              <p className="text-xs text-neutral-500">Respondé unas preguntas y la IA arma tu mapa de procesos</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100"><X className="h-5 w-5 text-neutral-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">¿A qué se dedica la empresa?</label>
            <textarea value={businessDescription} onChange={e => setBusinessDescription(e.target.value)} rows={2}
              placeholder="Ej: Fabricación de autopartes metálicas para la industria automotriz"
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">¿Cuántas sedes posee?</label>
            <input type="number" min={1} value={sites} onChange={e => setSites(e.target.value)}
              className="w-32 border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </div>

          <div className="rounded-xl border border-neutral-200 divide-y divide-neutral-100 px-4">
            <YesNo label="¿Tiene producción?" value={hasProduction} onChange={setHasProduction} />
            <YesNo label="¿Realiza diseño?" value={hasDesign} onChange={setHasDesign} />
            <YesNo label="¿Tiene procesos tercerizados?" value={hasOutsourcing} onChange={setHasOutsourcing} />
            <YesNo label="¿Está certificada actualmente?" value={isCertified} onChange={setIsCertified} />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">¿Qué normas desea implementar?</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {norms.map(n => {
                const checked = selectedNorms.has(n.code);
                return (
                  <button key={n.code} onClick={() => toggleNorm(n.code)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all ${checked ? 'border-brand-300 bg-brand-50' : 'border-neutral-200 hover:bg-neutral-50'}`}>
                    <div className={`h-4 w-4 rounded flex items-center justify-center flex-shrink-0 border ${checked ? 'bg-brand-600 border-brand-600' : 'border-neutral-300 bg-white'}`}>
                      {checked && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-800 truncate">{n.label}</p>
                      <p className="text-[10px] text-neutral-500 truncate">{n.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Nombre del mapa (opcional)</label>
            <input value={mapName} onChange={e => setMapName(e.target.value)} placeholder="Mapa de Procesos (IA)"
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50 rounded-lg border border-neutral-200">Cancelar</button>
          <button onClick={generate} disabled={loading} className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando con IA...</> : <><Sparkles className="h-4 w-4" /> Generar mapa</>}
          </button>
        </div>
      </div>
    </div>
  );
}
