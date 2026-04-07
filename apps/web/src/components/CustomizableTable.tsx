'use client';

import { useState, useEffect } from 'react';
import {
  Settings, Eye, EyeOff, ChevronDown, ChevronUp,
  Download, Search, Filter, RefreshCw
} from 'lucide-react';

interface Column {
  key: string;
  label: string;
  width?: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, row: any) => React.ReactNode;
}

interface CustomizableTableProps {
  data: any[];
  columns: Column[];
  defaultVisibleColumns?: string[];
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  onFilter?: (column: string, value: any) => void;
  onExport?: (visibleColumns: string[]) => void;
  loading?: boolean;
  className?: string;
}

export default function CustomizableTable({
  data,
  columns,
  defaultVisibleColumns = columns.map(c => c.key),
  onSort,
  onFilter,
  onExport,
  loading = false,
  className = ''
}: CustomizableTableProps) {
  const [visibleColumns, setVisibleColumns] = useState<string[]>(defaultVisibleColumns);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<Record<string, any>>({});

  // Load saved column preferences
  useEffect(() => {
    const saved = localStorage.getItem('table-columns');
    if (saved) {
      try {
        const savedColumns = JSON.parse(saved);
        if (Array.isArray(savedColumns) && savedColumns.length > 0) {
          setVisibleColumns(savedColumns);
        }
      } catch (error) {
        console.error('Error loading column preferences:', error);
      }
    }
  }, []);

  // Save column preferences
  useEffect(() => {
    localStorage.setItem('table-columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const handleColumnToggle = (columnKey: string) => {
    setVisibleColumns(prev => 
      prev.includes(columnKey)
        ? prev.filter(key => key !== columnKey)
        : [...prev, columnKey]
    );
  };

  const handleSort = (columnKey: string) => {
    const newDirection = sortColumn === columnKey && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(columnKey);
    setSortDirection(newDirection);
    onSort?.(columnKey, newDirection);
  };

  const handleFilter = (columnKey: string, value: any) => {
    const newFilters = { ...filters, [columnKey]: value };
    setFilters(newFilters);
    onFilter?.(columnKey, value);
  };

  const clearFilters = () => {
    setFilters({});
    setSearchTerm('');
  };

  const getActiveFiltersCount = () => {
    return Object.values(filters).filter(value => 
      value !== '' && value !== null && value !== undefined
    ).length;
  };

  // Filter data based on search and filters
  const filteredData = data.filter(row => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = visibleColumns.some(columnKey => {
        const value = row[columnKey];
        return value && value.toString().toLowerCase().includes(searchLower);
      });
      if (!matchesSearch) return false;
    }

    // Column filters
    for (const [columnKey, filterValue] of Object.entries(filters)) {
      if (filterValue && filterValue !== '') {
        const rowValue = row[columnKey];
        if (rowValue === null || rowValue === undefined) return false;
        if (!rowValue.toString().toLowerCase().includes(filterValue.toString().toLowerCase())) {
          return false;
        }
      }
    }

    return true;
  });

  // Sort data
  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortColumn) return 0;
    
    const aValue = a[sortColumn];
    const bValue = b[sortColumn];
    
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;
    
    let comparison = 0;
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      comparison = aValue.localeCompare(bValue);
    } else {
      comparison = aValue - bValue;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const visibleColumnDefs = columns.filter(col => visibleColumns.includes(col.key));

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-4 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <span className="text-sm text-gray-600">
              {getActiveFiltersCount()} filtros activos
            </span>
            {getActiveFiltersCount() > 0 && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Column Selector */}
          <div className="relative">
            <button
              onClick={() => setShowColumnSelector(!showColumnSelector)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm">Columnas</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showColumnSelector ? 'rotate-180' : ''}`} />
            </button>

            {showColumnSelector && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                <div className="p-3 border-b border-gray-200">
                  <h3 className="font-medium text-sm">Seleccionar Columnas</h3>
                </div>
                <div className="max-h-64 overflow-y-auto p-3">
                  {columns.map(column => (
                    <label
                      key={column.key}
                      className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns.includes(column.key)}
                        onChange={() => handleColumnToggle(column.key)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{column.label}</span>
                    </label>
                  ))}
                </div>
                <div className="p-3 border-t border-gray-200">
                  <button
                    onClick={() => setVisibleColumns(columns.map(c => c.key))}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Seleccionar todas
                  </button>
                  <span className="mx-2">·</span>
                  <button
                    onClick={() => setVisibleColumns(defaultVisibleColumns)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Restablecer
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Export */}
          {onExport && (
            <button
              onClick={() => onExport(visibleColumns)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm">Exportar</span>
            </button>
          )}

          {/* Refresh */}
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm">Actualizar</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {visibleColumnDefs.map(column => (
                <th
                  key={column.key}
                  className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                  }`}
                  style={{ width: column.width }}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center gap-1">
                    {column.label}
                    {column.sortable && sortColumn === column.key && (
                      sortDirection === 'asc' ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={visibleColumnDefs.length} className="px-4 py-8 text-center">
                  <div className="inline-flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span className="text-sm text-gray-600">Cargando...</span>
                  </div>
                </td>
              </tr>
            ) : sortedData.length === 0 ? (
              <tr>
                <td colSpan={visibleColumnDefs.length} className="px-4 py-8 text-center">
                  <div className="text-gray-500">
                    <div className="text-sm">No se encontraron resultados</div>
                    <div className="text-xs mt-1">
                      {searchTerm || getActiveFiltersCount() > 0 
                        ? 'Probá ajustando los filtros o la búsqueda'
                        : 'No hay datos disponibles'
                      }
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              sortedData.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  {visibleColumnDefs.map(column => (
                    <td key={column.key} className="px-4 py-3 text-sm text-gray-900">
                      {column.render 
                        ? column.render(row[column.key], row)
                        : row[column.key]
                      }
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
        <div className="text-sm text-gray-600">
          Mostrando {sortedData.length} de {data.length} resultados
        </div>
        <div className="text-sm text-gray-600">
          {visibleColumns.length} columnas visibles
        </div>
      </div>
    </div>
  );
}
