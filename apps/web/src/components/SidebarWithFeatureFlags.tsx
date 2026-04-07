'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import {
  Home, BarChart3, ClipboardList, Target, Wrench, Shield, AlertTriangle,
  TrendingUp, Brain, Search, Heart, Users, Settings, Menu, X,
  Lock, Crown, Zap, ChevronDown, ChevronRight
} from 'lucide-react';

interface ModuleAccess {
  key: string;
  name: string;
  icon: any;
  route: string;
  hasAccess: boolean;
  isBlocked: boolean;
  requiredPlan: string;
  upgradeUrl: string;
  tooltip: string;
  description: string;
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function SidebarWithFeatureFlags({ isOpen, onToggle }: SidebarProps) {
  const [modules, setModules] = useState<ModuleAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const pathname = usePathname();

  useEffect(() => {
    loadModuleAccess();
  }, []);

  const loadModuleAccess = async () => {
    try {
      setLoading(true);
      const response = await apiFetch('/modules/access');
      setModules(response.modules || []);
    } catch (error) {
      console.error('Error loading module access:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getIcon = (iconName: string) => {
    const icons: Record<string, any> = {
      'BarChart3': BarChart3,
      'ClipboardList': ClipboardList,
      'Target': Target,
      'Wrench': Wrench,
      'Shield': Shield,
      'AlertTriangle': AlertTriangle,
      'TrendingUp': TrendingUp,
      'Brain': Brain,
      'Search': Search,
      'Heart': Heart
    };
    return icons[iconName] || BarChart3;
  };

  const getPlanColor = (plan: string) => {
    switch (plan.toLowerCase()) {
      case 'starter':
        return 'text-green-600';
      case 'professional':
        return 'text-blue-600';
      case 'enterprise':
        return 'text-purple-600';
      case 'addon':
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  };

  const getPlanBadge = (plan: string) => {
    switch (plan.toLowerCase()) {
      case 'starter':
        return 'bg-green-100 text-green-800';
      case 'professional':
        return 'bg-blue-100 text-blue-800';
      case 'enterprise':
        return 'bg-purple-100 text-purple-800';
      case 'addon':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className={`bg-white shadow-lg transform transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } fixed left-0 top-0 h-full w-64 z-40`}>
        <div className="p-4 space-y-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-100 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Group modules by category
  const coreModules = modules.filter(m => ['dashboard', 'audits', 'documents'].includes(m.key));
  const advancedModules = modules.filter(m => ['projects', 'maintenance', 'drills', 'risks', 'indicators'].includes(m.key));
  const enterpriseModules = modules.filter(m => ['bi', 'audit360', 'hse360'].includes(m.key));

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div className={`bg-white shadow-lg transform transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } fixed left-0 top-0 h-full w-64 z-40 lg:translate-x-0 lg:static lg:z-0`}>
        
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">SGI</span>
              </div>
              <div>
                <h2 className="font-bold text-gray-900">SGI360</h2>
                <p className="text-xs text-gray-500">Sistema Integrado</p>
              </div>
            </div>
            <button
              onClick={onToggle}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-6 overflow-y-auto h-full pb-20">
          {/* Core Modules */}
          <div>
            <button
              onClick={() => toggleSection('core')}
              className="flex items-center gap-2 w-full text-left font-medium text-gray-700 hover:text-gray-900 mb-3"
            >
              {expandedSections.core ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Módulos Básicos
            </button>
            
            {expandedSections.core && (
              <div className="space-y-1 ml-6">
                <Link
                  href="/dashboard"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    pathname === '/dashboard' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Home className="w-4 h-4" />
                  <span>Dashboard</span>
                </Link>

                {coreModules.map((module) => (
                  <div key={module.key} className="relative group">
                    <Link
                      href={module.hasAccess ? module.route : '#'}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        pathname === module.route ? 'bg-blue-50 text-blue-600' : 
                        module.isBlocked ? 'text-gray-400 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                      onClick={(e) => {
                        if (module.isBlocked) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <module.icon className="w-4 h-4" />
                      <span className="flex-1">{module.name}</span>
                      {module.isBlocked && <Lock className="w-3 h-3" />}
                    </Link>

                    {/* Tooltip for blocked modules */}
                    {module.isBlocked && (
                      <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-64 z-50">
                        <div className="font-semibold mb-1">{module.name}</div>
                        <div className="text-gray-300 text-xs mb-2 leading-relaxed">{module.description}</div>
                        <div className="flex items-center gap-2 border-t border-gray-700 pt-2 mt-2">
                          <Lock className="w-3 h-3 text-amber-400" />
                          <span className="text-gray-400">Requiere:</span>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${getPlanBadge(module.requiredPlan)}`}>
                            {module.requiredPlan}
                          </span>
                        </div>
                        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900 rotate-45"></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Advanced Modules */}
          <div>
            <button
              onClick={() => toggleSection('advanced')}
              className="flex items-center gap-2 w-full text-left font-medium text-gray-700 hover:text-gray-900 mb-3"
            >
              {expandedSections.advanced ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Módulos Avanzados
            </button>
            
            {expandedSections.advanced && (
              <div className="space-y-1 ml-6">
                {advancedModules.map((module) => (
                  <div key={module.key} className="relative group">
                    <Link
                      href={module.hasAccess ? module.route : '#'}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        pathname === module.route ? 'bg-blue-50 text-blue-600' : 
                        module.isBlocked ? 'text-gray-400 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                      onClick={(e) => {
                        if (module.isBlocked) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <module.icon className="w-4 h-4" />
                      <span className="flex-1">{module.name}</span>
                      {module.isBlocked && <Lock className="w-3 h-3" />}
                    </Link>

                    {/* Tooltip for blocked modules */}
                    {module.isBlocked && (
                      <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-64 z-50">
                        <div className="font-semibold mb-1">{module.name}</div>
                        <div className="text-gray-300 text-xs mb-2 leading-relaxed">{module.description}</div>
                        <div className="flex items-center gap-2 border-t border-gray-700 pt-2 mt-2">
                          <Lock className="w-3 h-3 text-amber-400" />
                          <span className="text-gray-400">Requiere:</span>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${getPlanBadge(module.requiredPlan)}`}>
                            {module.requiredPlan}
                          </span>
                        </div>
                        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900 rotate-45"></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Enterprise Modules */}
          <div>
            <button
              onClick={() => toggleSection('enterprise')}
              className="flex items-center gap-2 w-full text-left font-medium text-gray-700 hover:text-gray-900 mb-3"
            >
              {expandedSections.enterprise ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Enterprise
            </button>
            
            {expandedSections.enterprise && (
              <div className="space-y-1 ml-6">
                {enterpriseModules.map((module) => (
                  <div key={module.key} className="relative group">
                    <Link
                      href={module.hasAccess ? module.route : '#'}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        pathname === module.route ? 'bg-blue-50 text-blue-600' : 
                        module.isBlocked ? 'text-gray-400 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                      onClick={(e) => {
                        if (module.isBlocked) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <module.icon className="w-4 h-4" />
                      <span className="flex-1">{module.name}</span>
                      {module.isBlocked && <Lock className="w-3 h-3" />}
                    </Link>

                    {/* Tooltip for blocked modules */}
                    {module.isBlocked && (
                      <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-64 z-50">
                        <div className="font-semibold mb-1">{module.name}</div>
                        <div className="text-gray-300 text-xs mb-2 leading-relaxed">{module.description}</div>
                        <div className="flex items-center gap-2 border-t border-gray-700 pt-2 mt-2">
                          <Lock className="w-3 h-3 text-amber-400" />
                          <span className="text-gray-400">Requiere:</span>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${getPlanBadge(module.requiredPlan)}`}>
                            {module.requiredPlan}
                          </span>
                        </div>
                        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900 rotate-45"></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upgrade CTA */}
          <div className="border-t border-gray-200 pt-4">
            <Link
              href="/plans"
              className="flex items-center gap-3 px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all"
            >
              <Crown className="w-4 h-4" />
              <span>Actualizar Plan</span>
            </Link>
          </div>

          {/* Settings */}
          <div className="border-t border-gray-200 pt-4">
            <Link
              href="/settings"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                pathname === '/settings' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Configuración</span>
            </Link>
          </div>
        </nav>
      </div>
    </>
  );
}
