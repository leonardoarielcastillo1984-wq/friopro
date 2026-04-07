'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface ComboSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  onAddCustom?: (newOption: Option) => void;
  placeholder?: string;
  label?: string;
  allowCustom?: boolean;
}

export default function ComboSelect({
  options,
  value,
  onChange,
  onAddCustom,
  placeholder = 'Seleccionar...',
  label,
  allowCustom = true
}: ComboSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [allOptions, setAllOptions] = useState<Option[]>(options);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAllOptions(options);
  }, [options]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = allOptions.filter(opt =>
    opt.label.toLowerCase().includes(searchText.toLowerCase())
  );

  const selectedOption = allOptions.find(opt => opt.value === value);
  const hasCustomValue = searchText && !filteredOptions.some(opt => opt.value === searchText);

  const handleSelectOption = (option: Option) => {
    onChange(option.value);
    setSearchText('');
    setIsOpen(false);
  };

  const handleAddCustom = () => {
    if (!searchText.trim()) return;

    const newOption: Option = {
      value: searchText.toLowerCase().replace(/\s+/g, '_'),
      label: searchText
    };

    setAllOptions([...allOptions, newOption]);
    onChange(newOption.value);
    onAddCustom?.(newOption);
    setSearchText('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && allowCustom && hasCustomValue) {
      e.preventDefault();
      handleAddCustom();
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
            {/* Search Input */}
            <div className="p-2 border-b border-gray-200">
              <input
                type="text"
                placeholder="Buscar o escribir..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>

            {/* Options */}
            <div className="max-h-48 overflow-y-auto">
              {filteredOptions.length === 0 && !hasCustomValue ? (
                <div className="px-3 py-2 text-sm text-gray-500">No hay opciones</div>
              ) : (
                <>
                  {filteredOptions.map((option) => (
                    <div
                      key={option.value}
                      onClick={() => handleSelectOption(option)}
                      className={`w-full text-left px-3 py-2 hover:bg-blue-50 cursor-pointer ${
                        value === option.value ? 'bg-blue-100 font-medium' : ''
                      }`}
                    >
                      {option.label}
                    </div>
                  ))}

                  {/* Add Custom Option */}
                  {allowCustom && hasCustomValue && (
                    <div
                      onClick={handleAddCustom}
                      className="w-full text-left px-3 py-2 border-t border-gray-200 text-blue-600 hover:bg-blue-50 flex items-center gap-2 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar "{searchText}"
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
