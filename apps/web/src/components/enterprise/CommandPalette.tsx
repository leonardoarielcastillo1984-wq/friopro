'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Command, Zap, BarChart3, Shield, Truck, Users,
  FileText, AlertTriangle, Kanban, Activity, Brain,
  ArrowRight, Clock, Star
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  description: string;
  icon: any;
  category: string;
  action: () => void;
  shortcut?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  onAsk: (query: string) => void;
}

export default function CommandPalette({ isOpen, onClose, onNavigate, onAsk }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = [
    // Navigation
    { id: 'nav-dashboard', label: 'Dashboard', description: 'Ir al panel principal', icon: BarChart3, category: 'Navegación', action: () => onNavigate('/dashboard'), shortcut: '⌘D' },
    { id: 'nav-projects', label: 'Proyectos', description: 'Gestión de proyectos', icon: Kanban, category: 'Navegación', action: () => onNavigate('/proyectos') },
    { id: 'nav-quality', label: 'Calidad', description: 'NCRs, CAPAs, mejora continua', icon: Shield, category: 'Navegación', action: () => onNavigate('/calidad') },
    { id: 'nav-fleet', label: 'Flota', description: 'Gestión de vehículos', icon: Truck, category: 'Navegación', action: () => onNavigate('/infraestructura') },
    { id: 'nav-hr', label: 'RRHH', description: 'Recursos humanos', icon: Users, category: 'Navegación', action: () => onNavigate('/rrhh') },
    { id: 'nav-audits', label: 'Auditorías', description: 'Gestión de auditorías', icon: FileText, category: 'Navegación', action: () => onNavigate('/auditorias') },
    { id: 'nav-risks', label: 'Riesgos', description: 'Matriz de riesgos', icon: AlertTriangle, category: 'Navegación', action: () => onNavigate('/riesgos') },
    { id: 'nav-docs', label: 'Documentos', description: 'Gestión documental', icon: FileText, category: 'Navegación', action: () => onNavigate('/documentos') },
    // AI Actions
    { id: 'ai-status', label: 'Estado general', description: 'Preguntar por el estado general', icon: Brain, category: 'IA', action: () => onAsk('¿Cuál es el estado general de la organización?') },
    { id: 'ai-fleet', label: 'Estado de flota', description: 'Indicadores de flota', icon: Truck, category: 'IA', action: () => onAsk('Generame un dashboard con el estado de la flota') },
    { id: 'ai-kpis', label: 'KPIs operativos', description: 'Ver indicadores clave', icon: Activity, category: 'IA', action: () => onAsk('Mostrame los KPIs operativos principales') },
    { id: 'ai-anomalies', label: 'Detectar anomalías', description: 'Análisis de anomalías', icon: Zap, category: 'IA', action: () => onAsk('Hay alguna anomalía o alerta que deba atender?') },
    { id: 'ai-correlations', label: 'Correlaciones', description: 'Análisis cross-module', icon: Activity, category: 'IA', action: () => onAsk('Qué correlaciones detectás entre los módulos?') },
    { id: 'ai-risks', label: 'Análisis de riesgos', description: 'Estado de riesgos operativos', icon: AlertTriangle, category: 'IA', action: () => onAsk('Cuáles son los principales riesgos operativos?') },
    // Quick actions
    { id: 'act-ncr', label: 'Crear NCR', description: 'Nueva no conformidad', icon: Shield, category: 'Acciones', action: () => onAsk('Crear una NCR') },
    { id: 'act-project', label: 'Crear Proyecto', description: 'Nuevo proyecto', icon: Kanban, category: 'Acciones', action: () => onAsk('Crear un nuevo proyecto') },
    { id: 'act-report', label: 'Generar Reporte', description: 'Reporte ejecutivo', icon: FileText, category: 'Acciones', action: () => onAsk('Generame un reporte ejecutivo') },
  ];

  const filtered = query.trim()
    ? commands.filter(cmd =>
        cmd.label.toLowerCase().includes(query.toLowerCase()) ||
        cmd.description.toLowerCase().includes(query.toLowerCase()) ||
        cmd.category.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
        onClose();
      } else if (query.trim()) {
        onAsk(query.trim());
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filtered, selectedIndex, query, onClose, onAsk]);

  if (!isOpen) return null;

  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, cmd) => {
    (acc[cmd.category] = acc[cmd.category] || []).push(cmd);
    return acc;
  }, {});

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: -10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-xl bg-gray-900 border border-gray-700/60 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/60">
            <Search className="w-5 h-5 text-gray-500" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar comando, módulo o preguntar a la IA..."
              className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none"
            />
            <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-[10px] text-gray-400">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[360px] overflow-y-auto py-2">
            {Object.entries(grouped).length === 0 && query.trim() && (
              <div className="px-4 py-6 text-center">
                <Brain className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Preguntarle a la IA:</p>
                <p className="text-xs text-gray-500 mt-1">&ldquo;{query}&rdquo;</p>
                <p className="text-[10px] text-gray-600 mt-2">Presioná Enter para enviar</p>
              </div>
            )}

            {Object.entries(grouped).map(([category, items]) => {
              let globalIdx = 0;
              for (const [cat, catItems] of Object.entries(grouped)) {
                if (cat === category) break;
                globalIdx += catItems.length;
              }

              return (
                <div key={category} className="mb-1">
                  <div className="px-3 py-1">
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{category}</span>
                  </div>
                  {items.map((item, i) => {
                    const idx = globalIdx + i;
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        onClick={() => { item.action(); onClose(); }}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                          isSelected ? 'bg-purple-500/10 text-white' : 'text-gray-300 hover:bg-gray-800/50'
                        }`}
                      >
                        <item.icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-purple-400' : 'text-gray-500'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{item.label}</p>
                          <p className="text-[10px] text-gray-500 truncate">{item.description}</p>
                        </div>
                        {item.shortcut && (
                          <kbd className="text-[9px] px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-gray-500">
                            {item.shortcut}
                          </kbd>
                        )}
                        {isSelected && <ArrowRight className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-800/60 flex items-center justify-between">
            <div className="flex items-center gap-3 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-gray-800 rounded">↑↓</kbd> Navegar</span>
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-gray-800 rounded">⏎</kbd> Seleccionar</span>
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-gray-800 rounded">Esc</kbd> Cerrar</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-purple-400">
              <Command className="w-3 h-3" />
              <span>+K</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
