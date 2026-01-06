'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import type { ReactNode, MutableRefObject } from 'react';
import GlassCard from './GlassCard';

interface FilterOption {
  label: string;
  value: string;
}

interface SearchFilterProps<T> {
  data: T[];
  onFilteredDataChange: (filteredData: T[]) => void;
  searchFields: Array<keyof T | string>;
  filterOptions?: {
    field: keyof T | string;
    label: string;
    options: FilterOption[];
    searchable?: boolean;
  }[];
  placeholder?: string;
  actions?: ReactNode;
  customResultsCount?: number;
  customTotalCount?: number;
  onFiltersActiveChange?: (hasActiveFilters: boolean) => void;
  clearFiltersRef?: MutableRefObject<(() => void) | null>;
}

export default function SearchFilter<T extends Record<string, any>>({
  data,
  onFilteredDataChange,
  searchFields,
  filterOptions = [],
  placeholder = 'Search...',
  actions,
  customResultsCount,
  customTotalCount,
  onFiltersActiveChange,
  clearFiltersRef,
}: SearchFilterProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [filterSearchQueries, setFilterSearchQueries] = useState<Record<string, string>>({});
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
  const prevFilteredDataRef = useRef<T[]>([]);
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((item) => {
        return searchFields.some((field) => {
          const value = item[field as string];
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(query);
        });
      });
    }

    // Apply filters
    filterOptions.forEach((filterOption) => {
      const filterValue = activeFilters[filterOption.field as string];
      if (filterValue && filterValue !== 'all' && filterValue !== '') {
        result = result.filter((item) => {
          const value = item[filterOption.field as string];
          // Handle null values specially
          if (filterValue === 'null') {
            return value === null || value === undefined;
          }
          // Handle 'assigned' value for group_id (shows participants with any group)
          if (filterValue === 'assigned' && filterOption.field === 'group_id') {
            return value !== null && value !== undefined;
          }
          return String(value) === filterValue;
        });
      }
    });

    return result;
  }, [data, searchQuery, activeFilters, searchFields, filterOptions]);

  // Handle clicking outside dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      Object.keys(openDropdowns).forEach((field) => {
        if (openDropdowns[field] && dropdownRefs.current[field] && !dropdownRefs.current[field]?.contains(event.target as Node)) {
          setOpenDropdowns(prev => ({ ...prev, [field]: false }));
        }
      });
    };

    if (Object.values(openDropdowns).some(open => open)) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdowns]);

  // Notify parent of filtered data changes
  useEffect(() => {
    // Use a ref to prevent calling if data hasn't meaningfully changed
    const prev = prevFilteredDataRef.current || [];
    const prevIds = prev.map((item: any) => item?.id).join(',');
    const currentIds = filteredData.map((item: any) => item?.id).join(',');
    
    if (prevIds !== currentIds) {
      prevFilteredDataRef.current = filteredData;
      onFilteredDataChange(filteredData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredData]);

  const handleFilterChange = (field: string, value: string) => {
    setActiveFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const clearFilters = () => {
    setSearchQuery('');
    setActiveFilters({});
    setFilterSearchQueries({});
  };

  const hasActiveFilters = searchQuery.trim() !== '' || Object.values(activeFilters).some((v) => v && v !== 'all' && v !== '');

  // Notify parent when filters change
  useEffect(() => {
    if (onFiltersActiveChange) {
      onFiltersActiveChange(hasActiveFilters);
    }
  }, [hasActiveFilters, onFiltersActiveChange]);

  // Expose clearFilters function to parent via ref
  useEffect(() => {
    if (clearFiltersRef) {
      clearFiltersRef.current = clearFilters;
    }
  }, [clearFiltersRef, clearFilters]);

  return (
    <GlassCard className="mb-6">
      <div className="space-y-4">
        {/* Search Input */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full px-4 py-3 rounded-xl bg-white/20 backdrop-blur-md border border-gray-400 text-[var(--glass-black-dark)] placeholder:text-[var(--glass-gray-medium)] focus:outline-none focus:ring-2 focus:ring-[var(--glass-secondary)] focus:border-gray-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--glass-gray-medium)] hover:text-[var(--glass-black-dark)] transition-colors"
              >
                ✕
              </button>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-4 flex-shrink-0">
              {actions}
            </div>
          )}
        </div>

        {/* Filter Options */}
        {filterOptions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filterOptions.map((filterOption) => {
              const isSearchable = filterOption.searchable;
              const filterSearchQuery = filterSearchQueries[filterOption.field as string] || '';
              const isOpen = openDropdowns[filterOption.field as string] || false;
              const currentValue = activeFilters[filterOption.field as string] || '';
              
              // Filter options based on search query
              const filteredOptions = isSearchable && filterSearchQuery
                ? filterOption.options.filter(option =>
                    option.label.toLowerCase().includes(filterSearchQuery.toLowerCase())
                  )
                : filterOption.options;
              
              // Get display value
              const displayValue = currentValue === ''
                ? 'Select Option'
                : currentValue === 'assigned' && filterOption.field === 'group_id'
                ? 'Group Assigned'
                : filterOption.options.find(opt => opt.value === currentValue)?.label || 'Select Option';
              
              if (isSearchable) {
                return (
                  <div key={filterOption.field as string} className="relative" ref={(el) => { dropdownRefs.current[filterOption.field as string] = el; }}>
                    <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                      {filterOption.label}
                    </label>
                    <button
                      type="button"
                      onClick={() => setOpenDropdowns(prev => ({ ...prev, [filterOption.field as string]: !isOpen }))}
                      className="w-full px-4 py-2 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 text-[var(--glass-black-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--glass-secondary)] focus:border-transparent transition-all text-left flex items-center justify-between"
                    >
                      <span>{displayValue}</span>
                      <span>{isOpen ? '▲' : '▼'}</span>
                    </button>
                    {isOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-white/95 backdrop-blur-md border border-white/30 rounded-xl shadow-lg max-h-60 overflow-hidden flex flex-col">
                        <input
                          type="text"
                          value={filterSearchQuery}
                          onChange={(e) => setFilterSearchQueries(prev => ({ ...prev, [filterOption.field as string]: e.target.value }))}
                          placeholder="Search..."
                          className="px-4 py-2 border-b border-white/20 bg-transparent text-[var(--glass-black-dark)] focus:outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="overflow-y-auto max-h-48">
                          <button
                            type="button"
                            onClick={() => {
                              handleFilterChange(filterOption.field as string, '');
                              setOpenDropdowns(prev => ({ ...prev, [filterOption.field as string]: false }));
                              setFilterSearchQueries(prev => ({ ...prev, [filterOption.field as string]: '' }));
                            }}
                            className={`w-full px-4 py-2 text-left hover:bg-white/50 transition-colors ${
                              currentValue === '' ? 'bg-[var(--glass-secondary)]/20 font-semibold' : ''
                            }`}
                          >
                            Select Option
                          </button>
                          {filterOption.field === 'group_id' && (
                            <button
                              type="button"
                              onClick={() => {
                                handleFilterChange(filterOption.field as string, 'assigned');
                                setOpenDropdowns(prev => ({ ...prev, [filterOption.field as string]: false }));
                                setFilterSearchQueries(prev => ({ ...prev, [filterOption.field as string]: '' }));
                              }}
                              className={`w-full px-4 py-2 text-left hover:bg-white/50 transition-colors ${
                                currentValue === 'assigned' ? 'bg-[var(--glass-secondary)]/20 font-semibold' : ''
                              }`}
                            >
                              Group Assigned
                            </button>
                          )}
                          {filteredOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                handleFilterChange(filterOption.field as string, option.value);
                                setOpenDropdowns(prev => ({ ...prev, [filterOption.field as string]: false }));
                                setFilterSearchQueries(prev => ({ ...prev, [filterOption.field as string]: '' }));
                              }}
                              className={`w-full px-4 py-2 text-left hover:bg-white/50 transition-colors ${
                                currentValue === option.value ? 'bg-[var(--glass-secondary)]/20 font-semibold' : ''
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              } else {
                return (
                  <div key={filterOption.field as string}>
                    <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                      {filterOption.label}
                    </label>
                    <select
                      value={activeFilters[filterOption.field as string] || 'all'}
                      onChange={(e) => handleFilterChange(filterOption.field as string, e.target.value)}
                      className="w-full px-4 py-2 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 text-[var(--glass-black-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--glass-secondary)] focus:border-transparent transition-all"
                    >
                      <option value="all">All {filterOption.label}</option>
                      {filterOption.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }
            })}
          </div>
        )}

        {/* Results Count */}
        <div className="flex items-center justify-between pt-2 border-t border-white/20">
          <span className="text-sm text-[var(--glass-gray-medium)]">
            Showing {customResultsCount !== undefined ? customResultsCount : filteredData.length} of {customTotalCount !== undefined ? customTotalCount : data.length} results
          </span>
        </div>
      </div>
    </GlassCard>
  );
}



