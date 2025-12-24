'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import GlassCard from '../../components/GlassCard';
import GlassButton from '../../components/GlassButton';
import SearchFilter from '../../components/SearchFilter';
import { supabase } from '../../lib/supabase';

interface MedicarePlan {
  id: string;
  provider_id: string;
  plan_name: string;
  effective_date: string | null;
  termination_date: string | null;
  plan_type: string | null;
  created_at: string;
  updated_at: string;
  provider_name?: string;
}

interface Provider {
  id: string;
  name: string;
}

export default function MedicarePlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<MedicarePlan[]>([]);
  const [filteredPlans, setFilteredPlans] = useState<MedicarePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRenewalForm, setShowRenewalForm] = useState(false);
  const [newRenewal, setNewRenewal] = useState({
    renewal_date: new Date().toISOString().split('T')[0],
    selected_plan_ids: [] as string[],
  });
  const [renewalPlansDropdownOpen, setRenewalPlansDropdownOpen] = useState(false);
  const renewalPlansDropdownRef = useRef<HTMLDivElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (renewalPlansDropdownRef.current && !renewalPlansDropdownRef.current.contains(event.target as Node)) {
        setRenewalPlansDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('medicare_plans')
        .select('*')
        .order('plan_name', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      if (!data || data.length === 0) {
        setPlans([]);
        setFilteredPlans([]);
        return;
      }

      // Fetch provider names for each plan
      const providerMap = new Map<string, string>();
      const providerIds = [...new Set(data.map((plan: any) => plan.provider_id))];
      
      if (providerIds.length > 0) {
        const { data: providersData } = await supabase
          .from('providers')
          .select('id, name')
          .in('id', providerIds);

        if (providersData) {
          providersData.forEach((provider: Provider) => {
            providerMap.set(provider.id, provider.name);
          });
        }
      }

      // Transform plans with provider names
      const plansWithProviderNames: MedicarePlan[] = data.map((plan: any) => ({
        ...plan,
        provider_name: providerMap.get(plan.provider_id) || 'Unknown Provider',
      }));

      setPlans(plansWithProviderNames);
      setFilteredPlans(plansWithProviderNames);
    } catch (err: any) {
      console.error('Error fetching Medicare plans:', err);
      setError(err.message || 'Failed to load Medicare plans');
    } finally {
      setLoading(false);
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

  const isPlanActive = (plan: MedicarePlan) => {
    return !plan.termination_date || new Date(plan.termination_date) > new Date();
  };

  const toggleRenewalPlan = (planId: string) => {
    setNewRenewal(prev => {
      if (prev.selected_plan_ids.includes(planId)) {
        return {
          ...prev,
          selected_plan_ids: prev.selected_plan_ids.filter(id => id !== planId),
        };
      } else {
        return {
          ...prev,
          selected_plan_ids: [...prev.selected_plan_ids, planId],
        };
      }
    });
  };

  const handleAddRenewal = async () => {
    if (!newRenewal.renewal_date) {
      alert('Please select a renewal date');
      return;
    }

    if (newRenewal.selected_plan_ids.length === 0) {
      alert('Please select at least one Medicare plan to renew');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create the Medicare renewal
      const { data: renewalData, error: renewalError } = await supabase
        .from('medicare_renewals')
        .insert([{
          renewal_date: newRenewal.renewal_date,
        }])
        .select()
        .single();

      if (renewalError) {
        throw renewalError;
      }

      // Link the selected plans to the renewal
      const renewalPlanLinks = newRenewal.selected_plan_ids.map(planId => ({
        renewal_id: renewalData.id,
        medicare_plan_id: planId,
      }));

      const { error: linksError } = await supabase
        .from('renewal_medicare_plans')
        .insert(renewalPlanLinks);

      if (linksError) {
        throw linksError;
      }

      // Reset form
      setNewRenewal({
        renewal_date: new Date().toISOString().split('T')[0],
        selected_plan_ids: [],
      });
      setShowRenewalForm(false);

      alert('Medicare renewal added successfully! All active participants have been connected to the new rates.');
    } catch (err: any) {
      // Extract error details for better logging
      const errorMessage = err?.message || 'Unknown error';
      const errorCode = err?.code || 'NO_CODE';
      const errorDetails = err?.details || '';
      const errorHint = err?.hint || '';
      
      console.error('Error adding Medicare renewal:', {
        message: errorMessage,
        code: errorCode,
        details: errorDetails,
        hint: errorHint,
        fullError: err
      });
      
      // Show user-friendly error message
      const userMessage = errorMessage || 'Failed to add Medicare renewal. Please try again.';
      alert(`Failed to add Medicare renewal: ${userMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRenewal = () => {
    setNewRenewal({
      renewal_date: new Date().toISOString().split('T')[0],
      selected_plan_ids: [],
    });
    setShowRenewalForm(false);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
            Medicare Plans
          </h1>
          <p className="text-[var(--glass-gray-medium)]">
            Manage Medicare-specific insurance plans
          </p>
        </div>
        <div className="flex items-center gap-3">
          <GlassButton 
            variant="outline" 
            type="button"
            onClick={() => setShowRenewalForm(true)}
          >
            Renew Medicare Plans
          </GlassButton>
          <GlassButton variant="primary" href="/medicare-plans/new">
            + New Medicare Plan
          </GlassButton>
        </div>
      </div>

      {/* Medicare Renewal Form */}
      {showRenewalForm && (
        <GlassCard className="mb-6 bg-blue-500/10 border border-blue-500/20">
          <div className="p-6">
            <h2 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-6">
              Renew Medicare Plans
            </h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="renewal-date" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  Renewal Date *
                </label>
                <div className="date-input-wrapper">
                  <input
                    type="date"
                    id="renewal-date"
                    value={newRenewal.renewal_date}
                    onChange={(e) => setNewRenewal({ ...newRenewal, renewal_date: e.target.value })}
                    className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                    required
                  />
                  <div className="calendar-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                  </div>
                </div>
              </div>
              <div>
                <label htmlFor="plans-to-renew" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  Medicare Plans to Renew *
                </label>
                <div className="relative" ref={renewalPlansDropdownRef}>
                  {/* Dropdown Button */}
                  <button
                    type="button"
                    onClick={() => setRenewalPlansDropdownOpen(!renewalPlansDropdownOpen)}
                    className="glass-input-enhanced w-full px-4 py-3 rounded-xl text-left flex items-center justify-between"
                  >
                    <span className={newRenewal.selected_plan_ids.length === 0 ? 'text-[var(--glass-gray-medium)]' : 'text-[var(--glass-black-dark)]'}>
                      {newRenewal.selected_plan_ids.length === 0 
                        ? 'Select Medicare plans to renew' 
                        : `${newRenewal.selected_plan_ids.length} plan(s) selected`
                      }
                    </span>
                    <span className="text-[var(--glass-gray-medium)]">
                      {renewalPlansDropdownOpen ? '▲' : '▼'}
                    </span>
                  </button>

                  {/* Dropdown Menu */}
                  {renewalPlansDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white/95 backdrop-blur-md border border-white/30 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      {plans.length === 0 ? (
                        <div className="px-4 py-3 text-[var(--glass-gray-medium)] text-sm">
                          No Medicare plans available
                        </div>
                      ) : (
                        plans.map((plan) => {
                          const isSelected = newRenewal.selected_plan_ids.includes(plan.id);
                          return (
                            <div
                              key={plan.id}
                              onClick={() => toggleRenewalPlan(plan.id)}
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
                              <div className="flex-1">
                                <span className={isSelected ? 'text-[var(--glass-secondary)] font-semibold' : 'text-[var(--glass-black-dark)]'}>
                                  {plan.plan_name}
                                </span>
                                <div className="text-xs text-[var(--glass-gray-medium)] mt-1">
                                  {plan.provider_name && <span>Provider: {plan.provider_name}</span>}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
                <p className="text-sm text-[var(--glass-gray-medium)] mt-2 italic">
                  Upon saving, all active participants enrolled in the selected plans will be connected to the rates matching the renewal date.
                </p>
              </div>
              <div className="bg-red-500/20 border border-red-500/40 rounded-xl p-3">
                <p className="text-sm font-semibold text-red-500 text-center">
                  MAKE SURE ALL PLANS AND RATES ARE ACCURATE BEFORE SAVE
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleAddRenewal}
                  disabled={isSubmitting}
                  className="px-4 py-3 rounded-full font-semibold bg-green-500 text-white hover:bg-green-600 shadow-lg hover:shadow-xl transition-all duration-300 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Saving...' : 'Save Renewal'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelRenewal}
                  disabled={isSubmitting}
                  className="px-4 py-3 rounded-full font-semibold bg-[#C6282B] text-white hover:bg-[#A01F22] shadow-lg hover:shadow-xl transition-all duration-300 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {loading && (
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            Loading Medicare plans...
          </p>
        </GlassCard>
      )}

      {error && (
        <GlassCard>
          <p className="text-red-500 text-center py-8">
            Error: {error}
          </p>
        </GlassCard>
      )}

      {!loading && !error && plans.length === 0 && (
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            No Medicare plans found. Create your first Medicare plan to get started.
          </p>
        </GlassCard>
      )}

      {!loading && !error && plans.length > 0 && filteredPlans.length === 0 && (
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            No Medicare plans match your search criteria. Try adjusting your filters.
          </p>
        </GlassCard>
      )}

      {!loading && !error && plans.length > 0 && (
        <>
          <SearchFilter
            data={plans}
            onFilteredDataChange={setFilteredPlans}
            searchFields={['plan_name', 'provider_name']}
            placeholder="Search Medicare plans by name or provider..."
          />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredPlans.map((plan) => (
              <GlassCard 
                key={plan.id} 
                className="hover:scale-105 transition-transform cursor-pointer"
                onClick={() => router.push(`/medicare-plans/${plan.id}`)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-xl font-bold text-[var(--glass-black-dark)] flex-1">
                      {plan.plan_name}
                    </h3>
                    {isPlanActive(plan) ? (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-700 ml-2">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-500/20 text-gray-700 ml-2">
                        Terminated
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-[var(--glass-gray-medium)]">Provider: </span>
                      <span className="text-[var(--glass-black-dark)] font-medium">
                        {plan.provider_name || 'N/A'}
                      </span>
                    </div>
                    {plan.plan_type && (
                      <div>
                        <span className="text-[var(--glass-gray-medium)]">Plan Type: </span>
                        <span className="text-[var(--glass-black-dark)] font-medium">
                          {plan.plan_type}
                        </span>
                      </div>
                    )}
                    {plan.effective_date && (
                      <div>
                        <span className="text-[var(--glass-gray-medium)]">Effective: </span>
                        <span className="text-[var(--glass-black-dark)] font-medium">
                          {formatDate(plan.effective_date)}
                        </span>
                      </div>
                    )}
                    {plan.termination_date && (
                      <div>
                        <span className="text-[var(--glass-gray-medium)]">Terminated: </span>
                        <span className="text-[var(--glass-black-dark)] font-medium">
                          {formatDate(plan.termination_date)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </>
      )}
    </div>
  );
}


