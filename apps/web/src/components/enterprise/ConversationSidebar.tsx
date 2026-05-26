'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/api';
import {
  MessageSquare, Plus, Clock, ChevronRight, Brain,
  Database, Loader2, Trash2, Archive, Pin, Search
} from 'lucide-react';

interface Conversation {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  messages?: Array<{ content: string; createdAt: string }>;
  _count?: { messages: number };
}

interface MemoryStats {
  total: number;
  byType: Record<string, number>;
}

interface Props {
  activeConversationId?: string;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function ConversationSidebar({
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  isCollapsed,
  onToggleCollapse,
}: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadConversations();
    loadMemoryStats();
  }, []);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/command-center/conversations?limit=30') as any;
      setConversations(res?.data || []);
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMemoryStats = async () => {
    try {
      const res = await apiFetch('/command-center/memory/stats') as any;
      setMemoryStats(res?.data || null);
    } catch { /* non-critical */ }
  };

  const filteredConversations = searchQuery
    ? conversations.filter(c => c.title?.toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = diffMs / 3600000;
    if (diffHours < 1) return 'Hace minutos';
    if (diffHours < 24) return `Hace ${Math.floor(diffHours)}h`;
    if (diffHours < 48) return 'Ayer';
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  };

  if (isCollapsed) {
    return (
      <motion.div
        initial={{ width: 48 }}
        animate={{ width: 48 }}
        className="bg-gray-900/60 border-r border-gray-700/50 flex flex-col items-center py-4 gap-3"
      >
        <button
          onClick={onToggleCollapse}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          title="Expandir panel"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={onNewConversation}
          className="p-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-colors"
          title="Nueva conversación"
        >
          <Plus className="w-4 h-4" />
        </button>
        <div className="w-6 h-px bg-gray-700 my-1" />
        {conversations.slice(0, 8).map(c => (
          <button
            key={c.id}
            onClick={() => onSelectConversation(c.id)}
            className={`p-2 rounded-lg transition-colors ${
              c.id === activeConversationId
                ? 'bg-purple-500/20 text-purple-400'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
            }`}
            title={c.title}
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ width: 280 }}
      animate={{ width: 280 }}
      className="bg-gray-900/60 border-r border-gray-700/50 flex flex-col h-full"
    >
      {/* Header */}
      <div className="p-3 border-b border-gray-700/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold text-white">Conversaciones</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onNewConversation}
              className="p-1.5 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-colors"
              title="Nueva conversación"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleCollapse}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              title="Colapsar"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar..."
            className="w-full pl-8 pr-3 py-1.5 bg-gray-800/60 border border-gray-700/50 rounded-lg text-xs text-gray-300 placeholder-gray-500 outline-none focus:border-purple-500/50"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-8 px-4">
            <MessageSquare className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-gray-500">
              {searchQuery ? 'Sin resultados' : 'Sin conversaciones aún'}
            </p>
            <button
              onClick={onNewConversation}
              className="mt-2 text-xs text-purple-400 hover:text-purple-300"
            >
              Iniciar nueva conversación
            </button>
          </div>
        ) : (
          <AnimatePresence>
            {filteredConversations.map(conv => (
              <motion.button
                key={conv.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                onClick={() => onSelectConversation(conv.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 group ${
                  conv.id === activeConversationId
                    ? 'bg-purple-500/15 border border-purple-500/30'
                    : 'hover:bg-gray-800/60 border border-transparent'
                }`}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                    conv.id === activeConversationId ? 'text-purple-400' : 'text-gray-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${
                      conv.id === activeConversationId ? 'text-white' : 'text-gray-300'
                    }`}>
                      {conv.title || 'Sin título'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-2.5 h-2.5 text-gray-600" />
                      <span className="text-[10px] text-gray-500">{formatDate(conv.updatedAt)}</span>
                      {conv._count?.messages && (
                        <span className="text-[10px] text-gray-600">{conv._count.messages} msgs</span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Memory Stats Footer */}
      {memoryStats && (
        <div className="p-3 border-t border-gray-700/50">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-3 h-3 text-green-400" />
            <span className="text-[10px] font-medium text-gray-400">Memoria IA</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <div className="bg-gray-800/50 rounded px-2 py-1 text-center">
              <div className="text-xs font-bold text-white">{memoryStats.total}</div>
              <div className="text-[9px] text-gray-500">Total</div>
            </div>
            <div className="bg-gray-800/50 rounded px-2 py-1 text-center">
              <div className="text-xs font-bold text-blue-400">{memoryStats.byType?.CONTEXT || 0}</div>
              <div className="text-[9px] text-gray-500">Contexto</div>
            </div>
            <div className="bg-gray-800/50 rounded px-2 py-1 text-center">
              <div className="text-xs font-bold text-yellow-400">{memoryStats.byType?.PATTERN || 0}</div>
              <div className="text-[9px] text-gray-500">Patrones</div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
