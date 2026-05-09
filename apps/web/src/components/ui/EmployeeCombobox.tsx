'use client';

import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { Search, X, ChevronDown, User } from 'lucide-react';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position?: { name: string } | null;
}

interface EmployeeComboboxProps {
  value: string;
  onChange: (id: string, name?: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  allowFreeText?: boolean;
  label?: string;
}

export function EmployeeCombobox({
  value,
  onChange,
  placeholder = 'Seleccionar responsable...',
  className = '',
  disabled = false,
  allowFreeText = false,
}: EmployeeComboboxProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [displayValue, setDisplayValue] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch<{ employees: Employee[] }>('/hr/employees')
      .then(res => setEmployees(res?.employees || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!value) {
      setDisplayValue('');
      return;
    }
    const emp = employees.find(e => e.id === value);
    if (emp) {
      setDisplayValue(`${emp.firstName} ${emp.lastName}`);
    } else if (allowFreeText) {
      setDisplayValue(value);
    }
  }, [value, employees, allowFreeText]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        if (allowFreeText && query && !employees.find(e => e.id === value)) {
          onChange(query);
        }
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [query, value, employees, allowFreeText, onChange]);

  const filtered = query.length > 0
    ? employees.filter(e =>
        `${e.firstName} ${e.lastName} ${e.email}`.toLowerCase().includes(query.toLowerCase())
      )
    : employees;

  const handleSelect = (emp: Employee) => {
    onChange(emp.id, `${emp.firstName} ${emp.lastName}`);
    setDisplayValue(`${emp.firstName} ${emp.lastName}`);
    setQuery('');
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setDisplayValue('');
    setQuery('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setDisplayValue(e.target.value);
    if (allowFreeText) onChange(e.target.value);
    setOpen(true);
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div
        className={`flex items-center w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-text'}`}
        onClick={() => !disabled && setOpen(true)}
      >
        <User className="w-3.5 h-3.5 text-gray-400 mr-2 flex-shrink-0" />
        <input
          type="text"
          value={open ? query : displayValue}
          onChange={handleInputChange}
          onFocus={() => { setOpen(true); setQuery(''); }}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 outline-none bg-transparent text-gray-900 placeholder-gray-400 min-w-0"
          readOnly={!open && !allowFreeText}
        />
        {value && !disabled && (
          <button onClick={handleClear} className="p-0.5 text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {!value && <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400">
              {allowFreeText && query
                ? <span>Usar "<strong>{query}</strong>" como texto libre</span>
                : 'Sin resultados'}
            </div>
          ) : (
            filtered.map(emp => (
              <button
                key={emp.id}
                type="button"
                onClick={() => handleSelect(emp)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2 ${value === emp.id ? 'bg-blue-50 text-blue-700' : 'text-gray-900'}`}
              >
                <span className="flex-1 font-medium">{emp.firstName} {emp.lastName}</span>
                {emp.position?.name && (
                  <span className="text-xs text-gray-400 truncate max-w-32">{emp.position.name}</span>
                )}
              </button>
            ))
          )}
          {allowFreeText && query && !filtered.find(e => `${e.firstName} ${e.lastName}`.toLowerCase() === query.toLowerCase()) && (
            <button
              type="button"
              onClick={() => { onChange(query); setDisplayValue(query); setOpen(false); setQuery(''); }}
              className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 border-t border-gray-100 italic"
            >
              Usar "{query}" como texto libre
            </button>
          )}
        </div>
      )}
    </div>
  );
}
