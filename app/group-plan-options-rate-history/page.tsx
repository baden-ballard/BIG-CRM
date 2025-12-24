'use client';

import { useEffect, useState, useMemo } from 'react';
import GlassCard from '../../components/GlassCard';
import { supabase } from '../../lib/supabase';

interface RateHistory {
  id: string;
  group_plan_option_id: string;
  rate: number;
  start_date: string | null;
  end_date: string | null;
  employer_contribution_type: string | null;
  class_1_contribution_amount: number | null;
  class_2_contribution_amount: number | null;
  class_3_contribution_amount: number | null;
  created_at: string;
  updated_at: string;
  group_plan_option: {
    id: string;
    option: string;
    group_plan_id: string;
    group_plan: {
      id: string;
      plan_name: string;
      employer_contribution_type: string | null;
    } | null;
  } | null;
}

interface GroupedRateHistory {
  option: string;
  planName: string;
  contributionType: string | null;
  rates: RateHistory[];
}

export default function GroupPlanOptionsRateHistoryPage() {
  const [rateHistories, setRateHistories] = useState<RateHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRateHistories();
  }, []);

  const fetchRateHistories = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('group_option_rates')
        .select(`
          id,
          group_plan_option_id,
          rate,
          start_date,
          end_date,
          employer_contribution_type,
          class_1_contribution_amount,
          class_2_contribution_amount,
          class_3_contribution_amount,
          created_at,
          updated_at,
          group_plan_option:group_plan_options (
            id,
            option,
            group_plan_id,
            group_plan:group_plans (
              id,
              plan_name,
              employer_contribution_type
            )
          )
        `)
        .order('start_date', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setRateHistories((data as unknown as RateHistory[]) || []);
    } catch (err: any) {
      console.error('Error fetching rate histories:', err);
      setError(err.message || 'Failed to load rate histories');
    } finally {
      setLoading(false);
    }
  };

  // Group rates by option
  const groupedRates = useMemo(() => {
    const grouped: { [key: string]: GroupedRateHistory } = {};

    rateHistories.forEach((rate) => {
      const option = rate.group_plan_option?.option || 'Unknown Option';
      const planName = rate.group_plan_option?.group_plan?.plan_name || 'Unknown Plan';
      const contributionType = rate.employer_contribution_type || rate.group_plan_option?.group_plan?.employer_contribution_type || null;
      
      // Group by option only (as requested)
      const key = option;
      
      if (!grouped[key]) {
        grouped[key] = {
          option,
          planName: planName, // Will show the first plan name encountered, but individual rows will show their own plan names
          contributionType,
          rates: [],
        };
      }
      
      grouped[key].rates.push(rate);
    });

    // Sort rates within each group by start_date (most recent first)
    Object.values(grouped).forEach((group) => {
      group.rates.sort((a, b) => {
        const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
        const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
        return dateB - dateA;
      });
    });

    // Sort groups by option name
    return Object.values(grouped).sort((a, b) => {
      return a.option.localeCompare(b.option);
    });
  }, [rateHistories]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const dateOnlyMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      const localDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return localDate.toLocaleDateString();
    }
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return 'N/A';
    return `$${amount.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            Loading rate histories...
          </p>
        </GlassCard>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <GlassCard>
          <p className="text-red-500 text-center py-8">
            Error: {error}
          </p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
          Group Plan Options Rate History
        </h1>
        <p className="text-[var(--glass-gray-medium)]">
          Rate histories for different plan options, grouped by option
        </p>
      </div>

      {groupedRates.length === 0 ? (
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            No rate histories found.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-8">
          {groupedRates.map((group, groupIndex) => (
            <GlassCard key={`${group.option}-${groupIndex}`}>
              <div className="mb-4 pb-4 border-b border-white/20">
                <h2 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-1">
                  {group.option}
                </h2>
                <p className="text-sm text-[var(--glass-gray-medium)]">
                  {group.contributionType && (
                    <>Contribution Type: <span className="font-semibold text-[var(--glass-black-dark)]">{group.contributionType}</span></>
                  )}
                </p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                        Record ID
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                        Plan Name
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                        Option
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                        Contribution Type
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                        Class 1 Contribution Amount
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                        Class 2 Contribution Amount
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                        Class 3 Contribution Amount
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                        Rate
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                        Start Date
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                        End Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rates.map((rate) => (
                      <tr
                        key={rate.id}
                        className="border-b border-white/10 hover:bg-white/5 transition-colors"
                      >
                        <td className="py-3 px-4 text-sm text-[var(--glass-black-dark)] font-mono text-xs">
                          {rate.id}
                        </td>
                        <td className="py-3 px-4 text-sm text-[var(--glass-black-dark)]">
                          {rate.group_plan_option?.group_plan?.plan_name || 'Unknown Plan'}
                        </td>
                        <td className="py-3 px-4 text-sm text-[var(--glass-black-dark)]">
                          {group.option}
                        </td>
                        <td className="py-3 px-4 text-sm text-[var(--glass-black-dark)]">
                          {rate.employer_contribution_type || group.contributionType || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-sm text-[var(--glass-black-dark)]">
                          {formatCurrency(rate.class_1_contribution_amount)}
                        </td>
                        <td className="py-3 px-4 text-sm text-[var(--glass-black-dark)]">
                          {formatCurrency(rate.class_2_contribution_amount)}
                        </td>
                        <td className="py-3 px-4 text-sm text-[var(--glass-black-dark)]">
                          {formatCurrency(rate.class_3_contribution_amount)}
                        </td>
                        <td className="py-3 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                          {formatCurrency(rate.rate)}
                        </td>
                        <td className="py-3 px-4 text-sm text-[var(--glass-black-dark)]">
                          {formatDate(rate.start_date)}
                        </td>
                        <td className="py-3 px-4 text-sm text-[var(--glass-black-dark)]">
                          {formatDate(rate.end_date)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}

