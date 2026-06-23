'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, BookOpen, Play, ChevronDown, ChevronUp, Lightbulb, ListChecks,
  Info, Eye, MessageCircle, ExternalLink, Layers,
} from 'lucide-react';
import PageTitleHelp from '@/components/ui/PageTitleHelp';
import { guides, difficultyConfig, type Screenshot } from './_guides';

/* ───────── Resaltado de búsqueda ───────── */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${q})`, 'gi'));
  return <>{parts.map((p, i) => p.toLowerCase() === query.toLowerCase() ? <mark key={i} className="bg-yellow-200 rounded px-0.5">{p}</mark> : <span key={i}>{p}</span>)}</>;
}

/* ───────── Captura de pantalla (carga imagen real o muestra placeholder) ───────── */
function ScreenshotDisplay({ guideId, index, sc, onOpen }: { guideId: string; index: number; sc: Screenshot; onOpen?: (route: string) => void }) {
  const [failed, setFailed] = useState(false);
  const imgSrc = `/help/${guideId}-${index + 1}.png`;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center gap-2">
        <Eye className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-700">{sc.label}</span>
        <span className="text-xs text-gray-400">— {sc.caption}</span>
        {sc.route && onOpen && (
          <button
            onClick={() => onOpen(sc.route!)}
            className="ml-auto inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Ver pantalla
          </button>
        )}
      </div>
      {!failed ? (
        <div className="p-4 bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc}
            alt={sc.caption}
            className="w-full rounded-lg border border-gray-200 shadow-sm"
            onError={() => setFailed(true)}
          />
        </div>
      ) : (
        <div className="p-6 bg-gray-100 flex flex-col items-center justify-center min-h-[180px]">
          <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-8 text-center max-w-md">
            <Info className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-600">Captura pendiente</p>
            <p className="text-xs text-gray-400 mt-1">Se mostrará automáticamente cuando exista <code className="bg-gray-100 px-1 rounded">{guideId}-{index + 1}.png</code> en <code className="bg-gray-100 px-1 rounded">/public/help/</code></p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CentroDeAyudaPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string>(guides[0].id);
  const [tab, setTab] = useState<'info' | 'pasos' | 'screenshots'>('info');
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return guides;
    return guides.filter(g =>
      g.title.toLowerCase().includes(q) ||
      g.purpose.toLowerCase().includes(q) ||
      g.group.toLowerCase().includes(q) ||
      g.mainFeatures.some(f => f.toLowerCase().includes(q)) ||
      g.actions.some(a => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)) ||
      g.steps.some(s => s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)) ||
      (g.tabs ?? []).some(t => t.label.toLowerCase().includes(q)) ||
      g.tips.some(t => t.toLowerCase().includes(q))
    );
  }, [q]);

  // Agrupar guías filtradas por grupo, conservando el orden de aparición
  const grouped = useMemo(() => {
    const map = new Map<string, typeof guides>();
    for (const g of filtered) {
      if (!map.has(g.group)) map.set(g.group, [] as unknown as typeof guides);
      (map.get(g.group) as any).push(g);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const current = guides.find(g => g.id === active) || guides[0];
  const CurrentIcon = current.icon;
  const diff = current.difficulty ? difficultyConfig[current.difficulty] : null;

  function openScreen(route: string) {
    router.push(route);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Centro de Ayuda <PageTitleHelp moduleHref="/modo-de-uso" /></h1>
                <p className="text-sm text-gray-500">Guía y consulta de cada módulo del sistema: funciones, pasos y pantallas reales.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 max-w-md w-full">
              <Search className="h-4 w-4 text-gray-400 shrink-0" />
              <input
                value={query}
                onChange={e => { setQuery(e.target.value); setTab('info'); }}
                placeholder="Buscar módulo o función..."
                className="bg-transparent text-sm w-full outline-none text-gray-800 placeholder:text-gray-400"
              />
              {query && <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600 text-xs">Limpiar</button>}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6">
        {/* Sidebar agrupado */}
        <aside className="bg-white border border-gray-200 rounded-xl p-4 h-fit md:sticky md:top-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">Módulos ({filtered.length})</h2>
          <nav className="space-y-3 max-h-[72vh] overflow-y-auto pr-1">
            {grouped.length === 0 && <p className="text-xs text-gray-500 px-3 py-2">Sin resultados</p>}
            {grouped.map(([group, items]) => (
              <div key={group}>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">{group}</p>
                <div className="space-y-1">
                  {items.map(g => {
                    const Icon = g.icon;
                    return (
                      <button key={g.id} onClick={() => { setActive(g.id); setTab('info'); setExpandedStep(null); }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${active === g.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate"><Highlight text={g.title} query={query} /></span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Contenido */}
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 pt-6 pb-2 border-b border-gray-100">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                <CurrentIcon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-xl font-semibold text-gray-900">{current.title}</h2>
                  {diff && (
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${diff.bg} ${diff.color} ${diff.border}`}>
                      {current.difficulty}
                    </span>
                  )}
                  {current.estimatedTime && (
                    <span className="text-xs text-gray-500">⏱️ {current.estimatedTime}</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">{current.purpose}</p>
                {current.isoRef && (
                  <p className="text-xs text-blue-600 mt-1">📋 {current.isoRef}</p>
                )}
              </div>
              <button
                onClick={() => openScreen(current.route)}
                className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <ExternalLink className="h-4 w-4" /> Abrir esta pantalla
              </button>
            </div>

            {current.tabs && current.tabs.length > 0 && (
              <div className="mb-3 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-xs text-gray-400"><Layers className="h-3.5 w-3.5" /> Pestañas:</span>
                {current.tabs.map(t => (
                  <span key={t.key} className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs text-gray-600">{t.label}</span>
                ))}
              </div>
            )}

            <div className="flex gap-1">
              {(['info', 'pasos', 'screenshots'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${tab === t ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                  {t === 'info' ? 'Información' : t === 'pasos' ? 'Pasos de uso' : 'Capturas de pantalla'}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {/* INFO */}
            {tab === 'info' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Funcionalidades principales</h3>
                  <ul className="space-y-2">
                    {current.mainFeatures.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-800">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                        <span><Highlight text={f} query={query} /></span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Botones y acciones</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {current.actions.map((a, i) => (
                      <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-2 font-medium text-gray-900 text-sm">
                          <Play className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          <Highlight text={a.name} query={query} />
                        </div>
                        <p className="text-sm text-gray-600 mt-1 ml-5"><Highlight text={a.description} query={query} /></p>
                        {a.detail && (
                          <p className="text-xs text-gray-400 mt-1 ml-5 italic"><Highlight text={a.detail} query={query} /></p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {current.tips.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                    <Lightbulb className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-900">
                      <strong className="block mb-1">Buenas prácticas</strong>
                      <ul className="space-y-1">
                        {current.tips.map((t, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-yellow-600 mt-0.5">•</span>
                            {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                {current.related.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Módulos relacionados</h3>
                    <div className="flex flex-wrap gap-2">
                      {current.related.map((r, i) => {
                        const relatedGuide = guides.find(g => g.id === r);
                        if (!relatedGuide) return null;
                        const RIcon = relatedGuide.icon;
                        return (
                          <button key={i} onClick={() => { setActive(r); setTab('info'); setExpandedStep(null); }}
                            className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors">
                            <RIcon className="h-3.5 w-3.5" />
                            {relatedGuide.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start gap-3">
                  <MessageCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <strong className="block mb-1">¿Tenés dudas?</strong>
                    <p>Usá el botón <strong>"Abrir esta pantalla"</strong> para ir directo al módulo, o el asistente de IA contextual disponible en cada pantalla.</p>
                  </div>
                </div>
              </div>
            )}

            {/* PASOS */}
            {tab === 'pasos' && (
              <div className="space-y-3">
                {current.steps.length > 0 ? current.steps.map((s, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedStep(expandedStep === i ? null : i)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shrink-0">{i + 1}</div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 text-sm">{s.title}</h4>
                        <p className="text-xs text-gray-500">{s.description}</p>
                      </div>
                      {expandedStep === i ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                    </button>
                    {expandedStep === i && s.subSteps && (
                      <div className="px-4 pb-3 pl-16">
                        <ul className="space-y-1.5">
                          {s.subSteps.map((sub, j) => (
                            <li key={j} className="flex items-start gap-2 text-sm text-gray-700">
                              <ListChecks className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                              {sub}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )) : <p className="text-sm text-gray-500">No hay pasos detallados para este módulo.</p>}
                <button
                  onClick={() => openScreen(current.route)}
                  className="mt-2 inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" /> Probar en {current.title}
                </button>
              </div>
            )}

            {/* CAPTURAS */}
            {tab === 'screenshots' && (
              <div className="space-y-4">
                {current.screenshots.length > 0 ? current.screenshots.map((sc, i) => (
                  <ScreenshotDisplay key={i} guideId={current.id} index={i} sc={sc} onOpen={openScreen} />
                )) : <p className="text-sm text-gray-500">No hay capturas documentadas para este módulo.</p>}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
