'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import GlassCard from '../../../components/GlassCard';
import GlassButton from '../../../components/GlassButton';
import { supabase } from '../../../lib/supabase';

interface Provider {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface Program {
  id: string;
  name: string;
}

interface GroupPlan {
  id: string;
  plan_name: string;
  effective_date: string | null;
  termination_date: string | null;
  group_id: string;
  group_name: string;
}

interface MedicarePlan {
  id: string;
  plan_name: string;
  created_at: string;
}

export default function ProviderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const providerId = (params?.id ?? '') as string;

  const [provider, setProvider] = useState<Provider | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);
  const [programsDropdownOpen, setProgramsDropdownOpen] = useState(false);
  const [groupPlans, setGroupPlans] = useState<GroupPlan[]>([]);
  const [medicarePlans, setMedicarePlans] = useState<MedicarePlan[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({ name: '' });
  const [isSavingProvider, setIsSavingProvider] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [loadingAllPrograms, setLoadingAllPrograms] = useState(false);
  const [loadingGroupPlans, setLoadingGroupPlans] = useState(true);
  const [loadingMedicarePlans, setLoadingMedicarePlans] = useState(true);
  const [isSavingPrograms, setIsSavingPrograms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const programsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (providerId) {
      fetchProvider();
      fetchPrograms();
      fetchAllPrograms();
      fetchGroupPlans();
      fetchMedicarePlans();
    } else {
      setError('Provider ID is missing');
      setLoading(false);
      setLoadingPrograms(false);
      setLoadingGroupPlans(false);
      setLoadingMedicarePlans(false);
    }
  }, [providerId]);

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

  const fetchProvider = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!providerId) {
        throw new Error('Provider ID is required');
      }

      const { data, error: fetchError } = await supabase
        .from('providers')
        .select('*')
        .eq('id', providerId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      if (!data) {
        throw new Error('Provider not found');
      }

      setProvider(data);
      setFormData({ name: data.name });
    } catch (err: any) {
      console.error('Error fetching provider:', err);
      setError(err.message || 'Failed to load provider');
    } finally {
      setLoading(false);
    }
  };

  const fetchPrograms = async () => {
    try {
      setLoadingPrograms(true);

      if (!providerId) {
        return;
      }

      // First, get all program_providers entries for this provider
      const { data: programProviders, error: junctionError } = await supabase
        .from('program_providers')
        .select('program_id')
        .eq('provider_id', providerId);

      if (junctionError) {
        throw junctionError;
      }

      if (!programProviders || programProviders.length === 0) {
        setPrograms([]);
        setSelectedPrograms([]);
        return;
      }

      // Extract program IDs
      const programIds = programProviders.map((pp: any) => pp.program_id);
      setSelectedPrograms(programIds);

      // Fetch the actual programs
      const { data: programsData, error: programsError } = await supabase
        .from('programs')
        .select('id, name')
        .in('id', programIds)
        .order('name', { ascending: true });

      if (programsError) {
        throw programsError;
      }

      setPrograms(programsData || []);
    } catch (err: any) {
      console.error('Error fetching programs:', err);
    } finally {
      setLoadingPrograms(false);
    }
  };

  const fetchAllPrograms = async () => {
    try {
      setLoadingAllPrograms(true);

      const { data, error: fetchError } = await supabase
        .from('programs')
        .select('*')
        .order('name', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setAllPrograms(data || []);
    } catch (err: any) {
      console.error('Error fetching all programs:', err);
    } finally {
      setLoadingAllPrograms(false);
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

  const handleSavePrograms = async () => {
    if (!providerId) return;

    setIsSavingPrograms(true);
    try {
      // Delete existing program_providers
      const { error: deleteError } = await supabase
        .from('program_providers')
        .delete()
        .eq('provider_id', providerId);

      if (deleteError) {
        throw deleteError;
      }

      // Insert new program_providers
      if (selectedPrograms.length > 0) {
        const programProvidersToInsert = selectedPrograms.map(programId => ({
          provider_id: providerId,
          program_id: programId,
        }));

        const { error: insertError } = await supabase
          .from('program_providers')
          .insert(programProvidersToInsert);

        if (insertError) {
          throw insertError;
        }
      }

      // Refresh the programs list
      await fetchPrograms();
      alert('Programs updated successfully!');
    } catch (err: any) {
      console.error('Error saving programs:', err);
      alert('Failed to update programs. Please try again.');
    } finally {
      setIsSavingPrograms(false);
    }
  };

  const handleEditClick = () => {
    setIsEditMode(true);
    if (provider) {
      setFormData({ name: provider.name });
    }
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    if (provider) {
      setFormData({ name: provider.name });
    }
  };

  const handleProviderNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ name: e.target.value });
  };

  const handleSaveProvider = async () => {
    if (!providerId || !formData.name.trim()) {
      alert('Provider name is required');
      return;
    }

    setIsSavingProvider(true);
    try {
      // Update provider name
      const { data, error: updateError } = await supabase
        .from('providers')
        .update({ name: formData.name.trim() })
        .eq('id', providerId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      setProvider(data);

      // Save programs
      // Delete existing program_providers
      const { error: deleteError } = await supabase
        .from('program_providers')
        .delete()
        .eq('provider_id', providerId);

      if (deleteError) {
        throw deleteError;
      }

      // Insert new program_providers
      if (selectedPrograms.length > 0) {
        const programProvidersToInsert = selectedPrograms.map(programId => ({
          provider_id: providerId,
          program_id: programId,
        }));

        const { error: insertError } = await supabase
          .from('program_providers')
          .insert(programProvidersToInsert);

        if (insertError) {
          throw insertError;
        }
      }

      // Refresh the programs list
      await fetchPrograms();
      setIsEditMode(false);
      alert('Provider updated successfully!');
    } catch (err: any) {
      console.error('Error saving provider:', err);
      alert('Failed to update provider. Please try again.');
    } finally {
      setIsSavingProvider(false);
    }
  };

  const fetchGroupPlans = async () => {
    try {
      setLoadingGroupPlans(true);

      if (!providerId) {
        return;
      }

      // Fetch group plans that use this provider
      const { data: plansData, error: plansError } = await supabase
        .from('group_plans')
        .select('id, plan_name, effective_date, termination_date, group_id')
        .eq('provider_id', providerId)
        .order('effective_date', { ascending: false });

      if (plansError) {
        throw plansError;
      }

      if (!plansData || plansData.length === 0) {
        setGroupPlans([]);
        return;
      }

      // Get unique group IDs
      const groupIds = [...new Set(plansData.map((plan: any) => plan.group_id))];

      // Fetch group names
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('id, name')
        .in('id', groupIds);

      if (groupsError) {
        throw groupsError;
      }

      // Create a map of group IDs to names
      const groupMap = new Map((groupsData || []).map((g: any) => [g.id, g.name]));

      // Transform the data to match our interface
      const transformedPlans: GroupPlan[] = plansData.map((plan: any) => ({
        id: plan.id,
        plan_name: plan.plan_name,
        effective_date: plan.effective_date,
        termination_date: plan.termination_date,
        group_id: plan.group_id,
        group_name: groupMap.get(plan.group_id) || 'Unknown Group',
      }));

      setGroupPlans(transformedPlans);
    } catch (err: any) {
      console.error('Error fetching group plans:', err);
    } finally {
      setLoadingGroupPlans(false);
    }
  };

  const fetchMedicarePlans = async () => {
    try {
      setLoadingMedicarePlans(true);

      if (!providerId) {
        return;
      }

      // Fetch medicare plans that use this provider
      const { data: plansData, error: plansError } = await supabase
        .from('medicare_plans')
        .select('id, plan_name, created_at')
        .eq('provider_id', providerId)
        .order('plan_name', { ascending: true });

      if (plansError) {
        throw plansError;
      }

      setMedicarePlans(plansData || []);
    } catch (err: any) {
      console.error('Error fetching medicare plans:', err);
    } finally {
      setLoadingMedicarePlans(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    // Parse date-only strings (YYYY-MM-DD) as local dates to avoid timezone shifts
    const dateOnlyMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      const localDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return localDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            Loading provider...
          </p>
        </GlassCard>
      </div>
    );
  }

  if (error || !provider) {
    return (
      <div className="max-w-4xl mx-auto">
        <GlassCard>
          <p className="text-red-500 text-center py-8">
            {error || 'Provider not found'}
          </p>
          <div className="flex justify-center mt-4">
            <GlassButton variant="primary" onClick={() => router.push('/providers')}>
              Back to Providers
            </GlassButton>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <button
          onClick={() => router.push('/providers')}
          className="text-[var(--glass-secondary)] hover:text-[var(--glass-secondary-dark)] mb-4 flex items-center gap-2"
        >
          <span>←</span> Back to Providers
        </button>
        <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
          {provider.name}
        </h1>
        <p className="text-[var(--glass-gray-medium)]">
          View provider details and associated programs and plans
        </p>
      </div>

      <GlassCard>
        <div className="space-y-6">
          {/* Provider Information Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-[var(--glass-black-dark)]">
                Provider Information
              </h2>
              {isEditMode ? (
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-6 py-3 rounded-full font-semibold bg-[#C6282B] text-white hover:bg-[#A01F22] shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    Cancel
                  </button>
                  <GlassButton
                    variant="primary"
                    onClick={handleSaveProvider}
                    disabled={isSavingProvider}
                    className={isSavingProvider ? 'opacity-50 cursor-not-allowed' : ''}
                  >
                    {isSavingProvider ? 'Saving...' : 'Save Provider'}
                  </GlassButton>
                </div>
              ) : (
                <GlassButton
                  variant="primary"
                  onClick={handleEditClick}
                >
                  Edit
                </GlassButton>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                Provider Name
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formData.name}
                  onChange={handleProviderNameChange}
                  className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                  placeholder="Enter provider name"
                  required
                />
              ) : (
                <div className="text-lg text-[var(--glass-black-dark)]">
                  {provider.name}
                </div>
              )}
            </div>
          </div>

          {/* Programs Section */}
          <div className="pt-6 border-t border-white/20">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-[var(--glass-black-dark)]">
                Programs
              </h2>
            </div>

            {loadingPrograms || loadingAllPrograms ? (
              <p className="text-[var(--glass-gray-medium)] text-sm py-2">Loading programs...</p>
            ) : isEditMode ? (
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
                          const program = allPrograms.find(p => p.id === programId);
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
                    {allPrograms.map((program) => {
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
            ) : (
              <div>
                {programs.length === 0 ? (
                  <p className="text-[var(--glass-gray-medium)] text-sm py-2">
                    No programs are associated with this provider yet.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {programs.map((program) => (
                      <span
                        key={program.id}
                        className="px-3 py-1 rounded-full text-sm font-semibold bg-[var(--glass-secondary)]/20 text-[var(--glass-secondary)]"
                      >
                        {program.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Group Plans Section */}
          <div className="pt-6 border-t border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-[var(--glass-black-dark)]">
                Group Plans
              </h2>
            </div>

            {loadingGroupPlans ? (
              <p className="text-[var(--glass-gray-medium)] text-center py-4">
                Loading group plans...
              </p>
            ) : groupPlans.length === 0 ? (
              <p className="text-[var(--glass-gray-medium)] text-center py-4">
                No group plans are using this provider yet.
              </p>
            ) : (
              <div className="space-y-3">
                {groupPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="glass-card rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer"
                    onClick={() => router.push(`/groups/${plan.group_id}`)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-[var(--glass-black-dark)] mb-2 text-lg">
                          {plan.plan_name}
                        </h3>
                        <div className="text-sm text-[var(--glass-gray-medium)] mb-1">
                          <span className="font-semibold">Group:</span> {plan.group_name}
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-[var(--glass-gray-medium)]">
                          <span>
                            <span className="font-semibold">Effective:</span> {formatDate(plan.effective_date)}
                          </span>
                          {plan.termination_date && (
                            <span>
                              <span className="font-semibold">Termination:</span> {formatDate(plan.termination_date)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Medicare Plans Section */}
          <div className="pt-6 border-t border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-[var(--glass-black-dark)]">
                Medicare Plans
              </h2>
            </div>

            {loadingMedicarePlans ? (
              <p className="text-[var(--glass-gray-medium)] text-center py-4">
                Loading medicare plans...
              </p>
            ) : medicarePlans.length === 0 ? (
              <p className="text-[var(--glass-gray-medium)] text-center py-4">
                No medicare plans are using this provider yet.
              </p>
            ) : (
              <div className="space-y-3">
                {medicarePlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="glass-card rounded-xl p-4 hover:bg-white/10 transition-all"
                  >
                    <h3 className="font-semibold text-[var(--glass-black-dark)] text-lg">
                      {plan.plan_name}
                    </h3>
                    <div className="text-sm text-[var(--glass-gray-medium)] mt-1">
                      Created: {formatDate(plan.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
