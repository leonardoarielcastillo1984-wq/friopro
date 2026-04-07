'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import {
  Search, X, FileText, AlertTriangle, Shield, TrendingUp,
  BookOpen, Users, Headphones, ChevronRight, Loader2,
  FileBarChart, BrainCircuit, GraduationCap
} from 'lucide-react';

interface SearchResult {
  type: 'ncr' | 'risk' | 'indicator' | 'training' | 'document' | 'normative' | 'audit' | 'customer';
  id: string;
  title: string;
  description?: string;
  code?: string;
  status?: string;
  severity?: string;
  url: string;
  icon: React.ReactNode;
}

const TYPE_CONFIG = {
  ncr: { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-red-600', label: 'No Conformidad' },
  risk: { icon: <Shield className="w-4 h-4" />, color: 'text-purple-600', label: 'Riesgo' },
  indicator: { icon: <TrendingUp className="w-4 h-4" />, color: 'text-emerald-600', label: 'Indicador' },
  training: { icon: <GraduationCap className="w-4 h-4" />, color: 'text-blue-600', label: 'Capacitación' },
  document: { icon: <FileText className="w-4 h-4" />, color: 'text-gray-600', label: 'Documento' },
  normative: { icon: <BookOpen className="w-4 h-4" />, color: 'text-amber-600', label: 'Normativo' },
  audit: { icon: <BrainCircuit className="w-4 h-4" />, color: 'text-purple-600', label: 'Auditoría' },
  customer: { icon: <Headphones className="w-4 h-4" />, color: 'text-indigo-600', label: 'Reclamo Cliente' },
};

export default function GlobalSearch() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
        setResults([]);
      }
      if (isOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % results.length);
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(prev => prev === 0 ? results.length - 1 : prev - 1);
        }
        if (e.key === 'Enter' && results[selectedIndex]) {
          e.preventDefault();
          handleResultClick(results[selectedIndex]);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    try {
      // Search in multiple modules
      const searchPromises = [
        // NCRs
        apiFetch<{ ncrs: any[] }>('/ncr').then(res => 
          res.ncrs
            .filter(ncr => 
              ncr.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              ncr.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
              ncr.description.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map(ncr => ({
              type: 'ncr' as const,
              id: ncr.id,
              title: ncr.title,
              description: ncr.description,
              code: ncr.code,
              status: ncr.status,
              severity: ncr.severity,
              url: `/no-conformidades/${ncr.id}`,
              icon: TYPE_CONFIG.ncr.icon
            }))
        ),
        
        // Risks
        apiFetch<{ risks: any[] }>('/risks').then(res =>
          res.risks
            .filter(risk => 
              risk.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              risk.description.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map(risk => ({
              type: 'risk' as const,
              id: risk.id,
              title: risk.title,
              description: risk.description,
              status: risk.status,
              url: `/riesgos/${risk.id}`,
              icon: TYPE_CONFIG.risk.icon
            }))
        ),

        // Indicators
        apiFetch<{ indicators: any[] }>('/indicators').then(res =>
          res.indicators
            .filter(indicator => 
              indicator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              indicator.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
              indicator.description?.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map(indicator => ({
              type: 'indicator' as const,
              id: indicator.id,
              title: indicator.name,
              description: indicator.description,
              code: indicator.code,
              url: `/indicadores/${indicator.id}`,
              icon: TYPE_CONFIG.indicator.icon
            }))
        ),

        // Trainings
        apiFetch<{ trainings: any[] }>('/trainings').then(res =>
          res.trainings
            .filter(training => 
              training.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              training.code.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map(training => ({
              type: 'training' as const,
              id: training.id,
              title: training.title,
              code: training.code,
              status: training.status,
              url: `/capacitaciones/${training.id}`,
              icon: TYPE_CONFIG.training.icon
            }))
        ),

        // Customer complaints
        apiFetch<{ complaints: any[] }>('/customer-management/complaints?limit=50').then(res =>
          res.complaints
            .filter(complaint => 
              complaint.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              complaint.code.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map(complaint => ({
              type: 'customer' as const,
              id: complaint.id,
              title: complaint.title,
              code: complaint.code,
              status: complaint.status,
              severity: complaint.severity,
              url: `/no-conformidades/${complaint.id}`,
              icon: TYPE_CONFIG.customer.icon
            }))
        ),
      ];

      const searchResults = await Promise.all(searchPromises);
      const allResults = searchResults.flat().slice(0, 10); // Limit to 10 results
      setResults(allResults);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    router.push(result.url);
    setIsOpen(false);
    setQuery('');
    setResults([]);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-20 z-50">
      <div className="w-full max-w-2xl mx-4">
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200">
          {/* Search Input */}
          <div className="flex items-center gap-3 p-4 border-b border-gray-200">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en toda la aplicación... (⌘K)"
              className="flex-1 outline-none text-gray-900 placeholder-gray-500"
              autoFocus
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  inputRef.current?.focus();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => {
                setIsOpen(false);
                setQuery('');
                setResults([]);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : query.length < 2 ? (
              <div className="text-center py-8">
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Escribe al menos 2 caracteres para buscar</p>
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-8">
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No se encontraron resultados</p>
              </div>
            ) : (
              <div className="py-2">
                {results.map((result, index) => (
                  <div
                    key={`${result.type}-${result.id}`}
                    className={`px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                      index === selectedIndex ? 'bg-gray-50' : ''
                    }`}
                    onClick={() => handleResultClick(result)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 ${TYPE_CONFIG[result.type].color}`}>
                        {result.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-medium ${TYPE_CONFIG[result.type].color}`}>
                            {TYPE_CONFIG[result.type].label}
                          </span>
                          {result.code && (
                            <span className="text-xs text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                              {result.code}
                            </span>
                          )}
                          {result.status && (
                            <span className="text-xs text-gray-500">
                              {result.status}
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {result.title}
                        </h3>
                        {result.description && (
                          <p className="text-xs text-gray-600 line-clamp-1 mt-0.5">
                            {result.description}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 mt-0.5" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
            <p>Navegá con ↑↓ • Enter para seleccionar • Esc para cerrar</p>
          </div>
        </div>
      </div>
    </div>
  );
}
