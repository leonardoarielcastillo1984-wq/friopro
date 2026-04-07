'use client';

import { useState } from 'react';
import {
  Filter, X, ChevronDown, ChevronUp, Calendar, User,
  Tag, AlertCircle, CheckCircle2, Clock, Search
} from 'lucide-react';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterGroup {
  key: string;
  label: string;
  type: 'select' | 'date' | 'text' | 'multi';
  options?: FilterOption[];
  icon?: React.ReactNode;
}

interface AdvancedFiltersProps {
  groups: FilterGroup[];
  filters: Record<string, any>;
  onFiltersChange: (filters: Record<string, any>) => void;
  onClear: () => void;
  className?: string;
}

export default function AdvancedFilters({
  groups,
  filters,
  onFiltersChange,
  onClear,
  className = ''
}: AdvancedFiltersProps) {
  const [expanded, setExpanded] = useState<string[]>([]);
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});

  const toggleGroup = (key: string) => {
    setExpanded(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...filters, [key]: value };
    onFiltersChange(newFilters);
  };

  const handleMultiSelect = (key: string, value: string) => {
    const currentValues = filters[key] || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v: string) => v !== value)
      : [...currentValues, value];
    handleFilterChange(key, newValues);
  };

  const getActiveFiltersCount = () => {
    return Object.values(filters).filter(value => 
      value && value !== '' && (!Array.isArray(value) || value.length > 0)
    ).length;
  };

  const getGroupIcon = (group: FilterGroup) => {
    if (group.icon) return group.icon;
    
    switch (group.type) {
      case 'date': return <Calendar className="w-4 h-4" />;
      case 'select': return <Tag className="w-4 h-4" />;
      case 'text': return <Search className="w-4 h-4" />;
      default: return <Filter className="w-4 h-4" />;
    }
  };

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-600" />
          <span className="font-medium text-gray-900">Filtros Avanzados</span>
          {activeFiltersCount > 0 && (
            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
              {activeFiltersCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <button
              onClick={onClear}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Limpiar
            </button>
          )}
          <button
            onClick={() => setExpanded(expanded.length === groups.length ? [] : groups.map(g => g.key))}
            className="text-gray-600 hover:text-gray-900"
          >
            {expanded.length === groups.length ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Filter Groups */}
      <div className="p-4 space-y-4">
        {groups.map(group => {
          const isExpanded = expanded.includes(group.key);
          const currentValue = filters[group.key];
          
          return (
            <div key={group.key} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(group.key)}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="text-gray-600">
                    {getGroupIcon(group)}
                  </div>
                  <span className="font-medium text-gray-900 text-sm">
                    {group.label}
                  </span>
                  {currentValue && (
                    <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                      ✓
                    </span>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {/* Group Content */}
              {isExpanded && (
                <div className="p-3 border-t border-gray-200 bg-gray-50">
                  {group.type === 'select' && group.options && (
                    <select
                      value={currentValue || ''}
                      onChange={(e) => handleFilterChange(group.key, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Todos</option>
                      {group.options.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                          {option.count !== undefined && ` (${option.count})`}
                        </option>
                      ))}
                    </select>
                  )}

                  {group.type === 'multi' && group.options && (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Buscar..."
                          value={searchTerms[group.key] || ''}
                          onChange={(e) => setSearchTerms(prev => ({ ...prev, [group.key]: e.target.value }))}
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {group.options
                          .filter(option => 
                            !searchTerms[group.key] || 
                            option.label.toLowerCase().includes(searchTerms[group.key].toLowerCase())
                          )
                          .map(option => (
                            <label
                              key={option.value}
                              className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={(currentValue || []).includes(option.value)}
                                onChange={() => handleMultiSelect(group.key, option.value)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">{option.label}</span>
                              {option.count !== undefined && (
                                <span className="text-xs text-gray-500 ml-auto">({option.count})</span>
                              )}
                            </label>
                          ))}
                      </div>
                    </div>
                  )}

                  {group.type === 'date' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Desde</label>
                        <input
                          type="date"
                          value={currentValue?.from || ''}
                          onChange={(e) => handleFilterChange(group.key, { ...currentValue, from: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Hasta</label>
                        <input
                          type="date"
                          value={currentValue?.to || ''}
                          onChange={(e) => handleFilterChange(group.key, { ...currentValue, to: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {group.type === 'text' && (
                    <input
                      type="text"
                      placeholder="Buscar..."
                      value={currentValue || ''}
                      onChange={(e) => handleFilterChange(group.key, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Active Filters Summary */}
      {activeFiltersCount > 0 && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex flex-wrap gap-2">
            {Object.entries(filters).map(([key, value]) => {
              if (!value || (Array.isArray(value) && value.length === 0)) return null;
              
              const group = groups.find(g => g.key === key);
              const label = group?.label || key;
              
              let displayValue = value;
              if (Array.isArray(value)) {
                displayValue = value.length === 1 
                  ? value[0] 
                  : `${value.length} seleccionados`;
              }
              
              if (typeof value === 'object' && value !== null) {
                if (value.from || value.to) {
                  const parts = [];
                  if (value.from) parts.push(`desde ${value.from}`);
                  if (value.to) parts.push(`hasta ${value.to}`);
                  displayValue = parts.join(' ');
                }
              }
              
              return (
                <div
                  key={key}
                  className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm flex items-center gap-1"
                >
                  <span className="font-medium">{label}:</span>
                  <span>{displayValue}</span>
                  <button
                    onClick={() => handleFilterChange(key, group?.type === 'multi' ? [] : '')}
                    className="ml-1 hover:text-blue-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
