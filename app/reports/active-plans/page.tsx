'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import GlassCard from '../../../components/GlassCard';
import GlassButton from '../../../components/GlassButton';
import { supabase } from '../../../lib/supabase';

interface ActivePlan {
  id: string;
  plan_name: string;
  group_id: string;
  group_name: string;
  program_id: string | null;
  program_name: string | null;
  provider_id: string | null;
  provider_name: string | null;
  effective_date: string | null;
  termination_date: string | null;
  plan_type: string | null;
  employer_contribution_type: string | null;
  employer_contribution_value: number | null;
}

export default function ActivePlansReportPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<ActivePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchActivePlans();
  }, []);

  const fetchActivePlans = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all group plans
      const { data: plansData, error: plansError } = await supabase
        .from('group_plans')
        .select('*')
        .order('effective_date', { ascending: false });

      if (plansError) {
        throw plansError;
      }

      if (!plansData || plansData.length === 0) {
        setPlans([]);
        return;
      }

      // Filter for active plans (no termination date or termination date is in the future)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const activePlans = plansData.filter((plan: any) => {
        if (!plan.termination_date) {
          return true; // No termination date means active
        }
        const terminationDate = new Date(plan.termination_date);
        terminationDate.setHours(0, 0, 0, 0);
        return terminationDate > today; // Termination date is in the future
      });

      // Get unique group IDs, program IDs, and provider IDs
      const groupIds = [...new Set(activePlans.map((p: any) => p.group_id).filter(Boolean))];
      const programIds = [...new Set(activePlans.map((p: any) => p.program_id).filter(Boolean))];
      const providerIds = [...new Set(activePlans.map((p: any) => p.provider_id).filter(Boolean))];

      const groupMap = new Map<string, string>();
      const programMap = new Map<string, string>();
      const providerMap = new Map<string, string>();

      // Fetch group names
      if (groupIds.length > 0) {
        const { data: groupsData } = await supabase
          .from('groups')
          .select('id, name')
          .in('id', groupIds);
        
        if (groupsData) {
          groupsData.forEach((g: any) => groupMap.set(g.id, g.name));
        }
      }

      // Fetch program names
      if (programIds.length > 0) {
        const { data: programsData } = await supabase
          .from('programs')
          .select('id, name')
          .in('id', programIds);
        
        if (programsData) {
          programsData.forEach((p: any) => programMap.set(p.id, p.name));
        }
      }

      // Fetch provider names
      if (providerIds.length > 0) {
        const { data: providersData } = await supabase
          .from('providers')
          .select('id, name')
          .in('id', providerIds);
        
        if (providersData) {
          providersData.forEach((p: any) => providerMap.set(p.id, p.name));
        }
      }

      // Transform plans with names
      const transformedPlans: ActivePlan[] = activePlans.map((plan: any) => ({
        id: plan.id,
        plan_name: plan.plan_name,
        company_name: plan.company_name || null,
        group_id: plan.group_id,
        group_name: groupMap.get(plan.group_id) || 'Unknown Group',
        program_id: plan.program_id,
        program_name: plan.program_id ? programMap.get(plan.program_id) || null : null,
        provider_id: plan.provider_id,
        provider_name: plan.provider_id ? providerMap.get(plan.provider_id) || null : null,
        effective_date: plan.effective_date,
        termination_date: plan.termination_date,
        plan_type: plan.plan_type,
        employer_contribution_type: plan.employer_contribution_type,
        employer_contribution_value: plan.employer_contribution_value,
      }));

      setPlans(transformedPlans);
    } catch (err: any) {
      console.error('Error fetching active plans:', err);
      setError(err.message || 'Failed to load active plans');
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

  const formatCurrency = (value: number | null, type: string | null) => {
    if (value === null || value === undefined) return 'N/A';
    if (type === 'Percentage') {
      return `${value}%`;
    }
    return `$${value.toFixed(2)}`;
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <button
          onClick={() => router.push('/')}
          className="text-[var(--glass-secondary)] hover:text-[var(--glass-secondary-dark)] mb-4 flex items-center gap-2"
        >
          <span>←</span> Back to Dashboard
        </button>
        <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
          Active Plans Report
        </h1>
        <p className="text-[var(--glass-gray-medium)]">
          View all active plans across all groups
        </p>
      </div>

      <GlassCard>
        {loading ? (
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            Loading active plans...
          </p>
        ) : error ? (
          <p className="text-red-500 text-center py-8">
            {error}
          </p>
        ) : plans.length === 0 ? (
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            No active plans found
          </p>
        ) : (
          <div className="space-y-4">
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-[var(--glass-black-dark)]">
                  Active Plans ({plans.length})
                </h2>
                <button
                  onClick={fetchActivePlans}
                  className="px-4 py-2 rounded-full text-sm font-semibold bg-[var(--glass-secondary)] text-white hover:bg-[var(--glass-secondary-dark)] transition-all"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="glass-card rounded-xl p-6 hover:bg-white/10 transition-all cursor-pointer border border-white/10"
                  onClick={() => router.push(`/groups/${plan.group_id}`)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-xl font-semibold text-[var(--glass-black-dark)]">
                          {plan.plan_name}
                        </h3>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-700">
                          Active
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-semibold text-[var(--glass-black-dark)]">Group:</span>
                          <span className="ml-2 text-[var(--glass-gray-medium)]">{plan.group_name}</span>
                        </div>
                        {plan.program_name && (
                          <div>
                            <span className="font-semibold text-[var(--glass-black-dark)]">Program:</span>
                            <span className="ml-2 text-[var(--glass-gray-medium)]">{plan.program_name}</span>
                          </div>
                        )}
                        {plan.provider_name && (
                          <div>
                            <span className="font-semibold text-[var(--glass-black-dark)]">Provider:</span>
                            <span className="ml-2 text-[var(--glass-gray-medium)]">{plan.provider_name}</span>
                          </div>
                        )}
                        <div>
                          <span className="font-semibold text-[var(--glass-black-dark)]">Effective Date:</span>
                          <span className="ml-2 text-[var(--glass-gray-medium)]">{formatDate(plan.effective_date)}</span>
                        </div>
                        {plan.termination_date && (
                          <div>
                            <span className="font-semibold text-[var(--glass-black-dark)]">Termination Date:</span>
                            <span className="ml-2 text-[var(--glass-gray-medium)]">{formatDate(plan.termination_date)}</span>
                          </div>
                        )}
                        {plan.plan_type && (
                          <div>
                            <span className="font-semibold text-[var(--glass-black-dark)]">Plan Type:</span>
                            <span className="ml-2 text-[var(--glass-gray-medium)]">{plan.plan_type}</span>
                          </div>
                        )}
                        {plan.employer_contribution_type && (
                          <div>
                            <span className="font-semibold text-[var(--glass-black-dark)]">Employer Contribution:</span>
                            <span className="ml-2 text-[var(--glass-gray-medium)]">
                              {formatCurrency(plan.employer_contribution_value, plan.employer_contribution_type)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}


