'use client';

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    fetchPlans();
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
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isPlanActive = (plan: MedicarePlan) => {
    return !plan.termination_date || new Date(plan.termination_date) > new Date();
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
        <GlassButton variant="primary" href="/medicare-plans/new">
          + New Medicare Plan
        </GlassButton>
      </div>

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
