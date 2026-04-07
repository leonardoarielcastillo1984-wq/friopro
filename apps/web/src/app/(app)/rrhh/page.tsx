'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Users, Building, Briefcase, GraduationCap, Brain, Settings } from 'lucide-react';

interface HRStats {
  totalEmployees: number;
  activeEmployees: number;
  departments: number;
  positions: number;
  trainings: number;
  competencies: number;
}

export default function RRHHPage() {
  const [stats, setStats] = useState<HRStats>({
    totalEmployees: 0,
    activeEmployees: 0,
    departments: 0,
    positions: 0,
    trainings: 0,
    competencies: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<{ stats: HRStats }>('/hr/stats');
      const safeStats = res?.stats;
      setStats({
        totalEmployees: safeStats?.totalEmployees ?? 0,
        activeEmployees: safeStats?.activeEmployees ?? 0,
        departments: safeStats?.departments ?? 0,
        positions: safeStats?.positions ?? 0,
        trainings: safeStats?.trainings ?? 0,
        competencies: safeStats?.competencies ?? 0,
      });
    } catch (error) {
      console.error('🔴 Error loading HR stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const modules = [
    {
      title: 'Empleados',
      description: 'Gestión completa de empleados y personal',
      icon: Users,
      href: '/rrhh/empleados',
      color: 'bg-blue-500',
      count: stats.totalEmployees,
      stats: `${stats.activeEmployees} activos`
    },
    {
      title: 'Organigrama',
      description: 'Estructura organizacional jerárquica',
      icon: Building,
      href: '/rrhh/organigrama',
      color: 'bg-green-500',
      count: stats.departments,
      stats: `${stats.positions} puestos`
    },
    {
      title: 'Perfiles de Puesto',
      description: 'Definición y gestión de perfiles laborales',
      icon: Briefcase,
      href: '/rrhh/perfiles',
      color: 'bg-purple-500',
      count: stats.positions,
      stats: 'Activos'
    },
    {
      title: 'Capacitaciones',
      description: 'Plan de formación y entrenamiento',
      icon: GraduationCap,
      href: '/rrhh/capacitaciones',
      color: 'bg-orange-500',
      count: stats.trainings,
      stats: 'Programadas'
    },
    {
      title: 'Competencias',
      description: 'Gestión de competencias y habilidades',
      icon: Brain,
      href: '/rrhh/competencias',
      color: 'bg-pink-500',
      count: stats.competencies,
      stats: 'Definidas'
    },
    {
      title: 'Configuración',
      description: 'Configuración del módulo RRHH',
      icon: Settings,
      href: '/rrhh/configuracion',
      color: 'bg-gray-500',
      count: null,
      stats: 'General'
    }
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Recursos Humanos</h1>
        <p className="text-gray-500 mt-2">
          Gestión integral de empleados, competencias y desarrollo organizacional
        </p>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-lg border border-gray-200 animate-pulse">
              <div className="h-6 bg-gray-200 rounded mb-4"></div>
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Empleados</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalEmployees}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Building className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Departamentos</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.departments}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Briefcase className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Puestos</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.positions}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <GraduationCap className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Capacitaciones</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.trainings}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Modules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map((module) => {
              const Icon = module.icon;
              return (
                <Link key={module.title} href={module.href}>
                  <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 ${module.color} rounded-lg`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      {module.count !== null && (
                        <div className="text-2xl font-bold text-gray-900">{module.count}</div>
                      )}
                    </div>
                    
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{module.title}</h3>
                    <p className="text-sm text-gray-600 mb-3">{module.description}</p>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{module.stats}</span>
                      <span className="text-blue-600 text-sm font-medium hover:text-blue-700">
                        Acceder →
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Empty State */}
          {stats.totalEmployees === 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center mt-8">
              <Users className="h-12 w-12 text-blue-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                Comienza a gestionar tu equipo
              </h3>
              <p className="text-blue-700 mb-6">
                Crea tu primer empleado para empezar a utilizar todas las funcionalidades del módulo de Recursos Humanos.
              </p>
              <Link
                href="/rrhh/empleados"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Users className="h-4 w-4 mr-2" />
                Crear Primer Empleado
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
