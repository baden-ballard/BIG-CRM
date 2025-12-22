'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import GlassCard from '../../../components/GlassCard';
import GlassButton from '../../../components/GlassButton';
import { supabase } from '../../../lib/supabase';

interface Program {
  id: string;
  name: string;
}

export default function NewProviderPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
  });
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [programsDropdownOpen, setProgramsDropdownOpen] = useState(false);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const programsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPrograms();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (programsDropdownRef.current && !programsDropdownRef.current.contains(event.target as Node)) {
        setProgramsDropdownOpen(false);
      }
    };

    if (programsDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [programsDropdownOpen]);

  const fetchPrograms = async () => {
    try {
      setLoadingPrograms(true);

      const { data, error: fetchError } = await supabase
        .from('programs')
        .select('*')
        .order('name', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setPrograms(data || []);
    } catch (err: any) {
      console.error('Error fetching programs:', err);
    } finally {
      setLoadingPrograms(false);
    }
  };

  const toggleProgram = (programId: string) => {
    setSelectedPrograms(prev => {
      if (prev.includes(programId)) {
        return prev.filter(id => id !== programId);
      } else {
        return [...prev, programId];
      }
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Insert provider into database
      const { data, error } = await supabase
        .from('providers')
        .insert([{ name: formData.name }])
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log('Provider created successfully:', data);

      // Insert program_providers associations if any programs are selected
      if (selectedPrograms.length > 0 && data) {
        const programProvidersToInsert = selectedPrograms.map(programId => ({
          provider_id: data.id,
          program_id: programId,
        }));

        const { error: insertError } = await supabase
          .from('program_providers')
          .insert(programProvidersToInsert);

        if (insertError) {
          throw insertError;
        }
      }
      
      // Redirect to providers page
      router.push('/providers');
    } catch (error) {
      console.error('Error creating provider:', error);
      alert('Failed to create provider. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="text-[var(--glass-secondary)] hover:text-[var(--glass-secondary-dark)] mb-4 flex items-center gap-2"
        >
          <span>←</span> Back to Providers
        </button>
        <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
          Add New Provider
        </h1>
        <p className="text-[var(--glass-gray-medium)]">
          Create a new insurance provider
        </p>
      </div>

      <GlassCard>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Provider Information Section */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-4">
              Provider Information
            </h2>

            {/* Row: Provider Name and Programs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Provider Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  Provider Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                  placeholder="Enter provider name"
                />
              </div>

              {/* Programs */}
              <div>
                <label htmlFor="programs" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  Programs
                </label>
                {loadingPrograms ? (
                  <p className="text-[var(--glass-gray-medium)] text-sm py-2">Loading programs...</p>
                ) : (
                  <div className="relative" ref={programsDropdownRef}>
                    {/* Dropdown Button */}
                    <button
                      type="button"
                      onClick={() => setProgramsDropdownOpen(!programsDropdownOpen)}
                      className="glass-input-enhanced w-full px-4 py-3 rounded-xl text-left flex items-center justify-between"
                    >
                      <span className={selectedPrograms.length === 0 ? 'text-[var(--glass-gray-medium)]' : 'text-[var(--glass-black-dark)]'}>
                        {selectedPrograms.length === 0 
                          ? 'Select programs' 
                          : selectedPrograms.map(programId => {
                              const program = programs.find(p => p.id === programId);
                              return program?.name;
                            }).filter(Boolean).join(', ')
                        }
                      </span>
                      <span className="text-[var(--glass-gray-medium)]">
                        {programsDropdownOpen ? '▲' : '▼'}
                      </span>
                    </button>

                    {/* Dropdown Menu */}
                    {programsDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-white/95 backdrop-blur-md border border-white/30 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                        {programs.map((program) => {
                          const isSelected = selectedPrograms.includes(program.id);
                          return (
                            <div
                              key={program.id}
                              onClick={() => toggleProgram(program.id)}
                              className={`px-4 py-3 cursor-pointer hover:bg-white/50 transition-colors flex items-center gap-2 ${
                                isSelected ? 'bg-[var(--glass-secondary)]/20' : ''
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="w-4 h-4 text-[var(--glass-secondary)] rounded border-gray-300 focus:ring-[var(--glass-secondary)]"
                              />
                              <span className={isSelected ? 'text-[var(--glass-secondary)] font-semibold' : 'text-[var(--glass-black-dark)]'}>
                                {program.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-white/20">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 rounded-full font-semibold bg-red-500 text-white hover:bg-red-600 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Cancel
            </button>
            <GlassButton
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className={isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
            >
              {isSubmitting ? 'Creating...' : 'Create Provider'}
            </GlassButton>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}

