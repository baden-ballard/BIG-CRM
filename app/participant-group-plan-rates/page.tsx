'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import GlassCard from '../../components/GlassCard';
import { supabase } from '../../lib/supabase';

interface ParticipantGroupPlanRate {
  id: string;
  created_at: string;
  participant_group_plan_id: string;
  group_option_rate_id: string | null;
  participant_group_plan: {
    id: string;
    participant_id: string;
    group_plan_id: string;
    participant: {
      id: string;
      client_name: string;
    } | null;
    group_plan: {
      id: string;
      plan_name: string;
      plan_type: string | null;
      employer_contribution_type: string | null;
      employer_contribution_value: number | null;
      employer_spouse_contribution_value: number | null;
      employer_child_contribution_value: number | null;
    } | null;
    dependent: {
      id: string;
      name: string;
      relationship: string;
    } | null;
  } | null;
  group_option_rate: {
    id: string;
    rate: number;
    start_date: string | null;
    end_date: string | null;
  } | null;
}

export default function ParticipantGroupPlanRatesPage() {
  const [rates, setRates] = useState<ParticipantGroupPlanRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rateToDelete, setRateToDelete] = useState<ParticipantGroupPlanRate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('participant_group_plan_rates')
        .select(`
          id,
          created_at,
          participant_group_plan_id,
          group_option_rate_id,
          participant_group_plan:participant_group_plans (
            id,
            participant_id,
            group_plan_id,
            participant:participants (
              id,
              client_name
            ),
            group_plan:group_plans (
              id,
              plan_name,
              plan_type,
              employer_contribution_type,
              employer_contribution_value,
              employer_spouse_contribution_value,
              employer_child_contribution_value
            ),
            dependent:dependents (
              id,
              name,
              relationship
            )
          ),
          group_option_rate:group_option_rates (
            id,
            rate,
            start_date,
            end_date
          )
        `)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setRates(data as ParticipantGroupPlanRate[]);
    } catch (err: any) {
      console.error('Error fetching participant group plan rates:', err);
      setError(err.message || 'Failed to load rates');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getEmployerContributionInfo = (rateRecord: ParticipantGroupPlanRate) => {
    if (!rateRecord.participant_group_plan?.group_plan) {
      return { type: null, amount: null };
    }

    const plan = rateRecord.participant_group_plan.group_plan;
    const dependent = rateRecord.participant_group_plan.dependent;
    const contributionType = plan.employer_contribution_type;
    let contributionValue: number | null = null;

    // For Age Banded plans, use the appropriate contribution value based on dependent type
    if (plan.plan_type === 'Age Banded') {
      if (!dependent) {
        // Employee
        contributionValue = plan.employer_contribution_value;
      } else if (dependent.relationship === 'Spouse') {
        // Spouse
        contributionValue = plan.employer_spouse_contribution_value;
      } else if (dependent.relationship === 'Child') {
        // Child
        contributionValue = plan.employer_child_contribution_value;
      }
    } else {
      // For non-Age Banded plans, use the standard contribution value
      contributionValue = plan.employer_contribution_value;
    }

    return { type: contributionType, amount: contributionValue };
  };

  const calculateEmployeeResponsibleAmount = (rate: number | null, rateRecord: ParticipantGroupPlanRate) => {
    if (rate === null || rate === 0) return null;
    if (!rateRecord.participant_group_plan?.group_plan) return null;

    const plan = rateRecord.participant_group_plan.group_plan;
    const dependent = rateRecord.participant_group_plan.dependent;
    
    let amountPaidByEmployer = 0;
    let contributionValue: number | null = null;
    const contributionType = plan.employer_contribution_type;

    // For Age Banded plans, use the appropriate contribution value based on dependent type
    if (plan.plan_type === 'Age Banded') {
      if (!dependent) {
        // Employee
        contributionValue = plan.employer_contribution_value;
      } else if (dependent.relationship === 'Spouse') {
        // Spouse
        contributionValue = plan.employer_spouse_contribution_value;
      } else if (dependent.relationship === 'Child') {
        // Child
        contributionValue = plan.employer_child_contribution_value;
      }
    } else {
      // For non-Age Banded plans, use the standard contribution value
      contributionValue = plan.employer_contribution_value;
    }

    if (contributionType && contributionValue !== null) {
      if (contributionType === 'Percentage') {
        amountPaidByEmployer = rate * (contributionValue / 100);
      } else if (contributionType === 'Dollar Amount') {
        amountPaidByEmployer = contributionValue;
      }
    }

    return Math.max(0, rate - amountPaidByEmployer);
  };

  const handleDelete = async () => {
    if (!rateToDelete) return;

    try {
      setIsDeleting(true);

      const { error: deleteError } = await supabase
        .from('participant_group_plan_rates')
        .delete()
        .eq('id', rateToDelete.id);

      if (deleteError) {
        throw deleteError;
      }

      // Remove from local state
      setRates(prev => prev.filter(r => r.id !== rateToDelete.id));
      setRateToDelete(null);
    } catch (err: any) {
      console.error('Error deleting rate:', err);
      alert('Failed to delete rate. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            Loading participant group plan rates...
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
            {error}
          </p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
          Participant Group Plan Rates
          <span className="text-xl font-normal text-[var(--glass-gray-medium)] ml-3">
            (participant_group_plan_rates)
          </span>
        </h1>
        <p className="text-[var(--glass-gray-medium)]">
          All rate history records connecting participants to group plan rates
        </p>
      </div>

      <GlassCard>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/20">
                <th className="text-left py-4 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                  Created At
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                  Participant
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                  Dependent
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                  Plan Name
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                  Rate
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                  Employer Contribution Type
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                  Employer Contribution Amount
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                  Employee Responsible
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                  Start Date
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                  End Date
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                  Status
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                  Plan Link
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rates.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-8 text-[var(--glass-gray-medium)]">
                    No participant group plan rates found
                  </td>
                </tr>
              ) : (
                rates.map((rate) => (
                  <tr
                    key={rate.id}
                    className="border-b border-white/10 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-4 px-4 text-sm text-[var(--glass-black-dark)]">
                      {formatDateTime(rate.created_at)}
                    </td>
                    <td className="py-4 px-4 text-sm text-[var(--glass-black-dark)]">
                      {rate.participant_group_plan?.participant?.client_name || 'N/A'}
                    </td>
                    <td className="py-4 px-4 text-sm text-[var(--glass-black-dark)]">
                      {rate.participant_group_plan?.dependent
                        ? `${rate.participant_group_plan.dependent.name} (${rate.participant_group_plan.dependent.relationship})`
                        : 'Participant'}
                    </td>
                    <td className="py-4 px-4 text-sm text-[var(--glass-black-dark)]">
                      {rate.participant_group_plan?.group_plan?.plan_name || 'N/A'}
                    </td>
                    <td className="py-4 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                      {rate.group_option_rate
                        ? `$${rate.group_option_rate.rate.toFixed(2)}`
                        : 'N/A'}
                    </td>
                    <td className="py-4 px-4 text-sm text-[var(--glass-black-dark)]">
                      {(() => {
                        const contributionInfo = getEmployerContributionInfo(rate);
                        return contributionInfo.type || 'N/A';
                      })()}
                    </td>
                    <td className="py-4 px-4 text-sm text-[var(--glass-black-dark)]">
                      {(() => {
                        const contributionInfo = getEmployerContributionInfo(rate);
                        if (contributionInfo.amount === null) return 'N/A';
                        if (contributionInfo.type === 'Percentage') {
                          return `${contributionInfo.amount}%`;
                        } else if (contributionInfo.type === 'Dollar Amount') {
                          return `$${contributionInfo.amount.toFixed(2)}`;
                        }
                        return 'N/A';
                      })()}
                    </td>
                    <td className="py-4 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                      {rate.group_option_rate
                        ? (() => {
                            const employeeAmount = calculateEmployeeResponsibleAmount(rate.group_option_rate.rate, rate);
                            return employeeAmount !== null ? `$${employeeAmount.toFixed(2)}` : 'N/A';
                          })()
                        : 'N/A'}
                    </td>
                    <td className="py-4 px-4 text-sm text-[var(--glass-black-dark)]">
                      {formatDate(rate.group_option_rate?.start_date || null)}
                    </td>
                    <td className="py-4 px-4 text-sm text-[var(--glass-black-dark)]">
                      {formatDate(rate.group_option_rate?.end_date || null)}
                    </td>
                    <td className="py-4 px-4">
                      {rate.group_option_rate?.end_date ? (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-500/20 text-gray-700">
                          Inactive
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-700">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {rate.participant_group_plan?.participant_id && rate.participant_group_plan_id ? (
                        <Link
                          href={`/participants/${rate.participant_group_plan.participant_id}/plans/${rate.participant_group_plan_id}`}
                          className="text-[var(--glass-secondary)] hover:text-[var(--glass-secondary-dark)] font-medium underline transition-colors duration-200"
                        >
                          View Plan
                        </Link>
                      ) : (
                        <span className="text-[var(--glass-gray-medium)]">N/A</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <button
                        onClick={() => setRateToDelete(rate)}
                        className="px-3 py-1.5 rounded-lg bg-[#C6282B] hover:bg-[#A01F22] text-white text-xs font-semibold transition-colors duration-200"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Delete Confirmation Dialog */}
      {rateToDelete && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" 
          onClick={() => setRateToDelete(null)}
        >
          <div 
            className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" 
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-4">
              Delete Rate Record
            </h3>
            <p className="text-[var(--glass-gray-medium)] mb-6">
              Are you sure you want to delete this rate record? This action cannot be undone.
            </p>
            {rateToDelete.participant_group_plan && (
              <div className="mb-6 p-4 bg-gray-100 rounded-lg">
                <p className="text-sm text-[var(--glass-black-dark)]">
                  <strong>Participant:</strong> {rateToDelete.participant_group_plan.participant?.client_name || 'N/A'}
                </p>
                {rateToDelete.participant_group_plan.dependent && (
                  <p className="text-sm text-[var(--glass-black-dark)]">
                    <strong>Dependent:</strong> {rateToDelete.participant_group_plan.dependent.name} ({rateToDelete.participant_group_plan.dependent.relationship})
                  </p>
                )}
                <p className="text-sm text-[var(--glass-black-dark)]">
                  <strong>Rate:</strong> ${rateToDelete.group_option_rate?.rate.toFixed(2) || 'N/A'}
                </p>
              </div>
            )}
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => setRateToDelete(null)}
                disabled={isDeleting}
                className="px-6 py-3 rounded-full font-semibold bg-[#C6282B] text-white hover:bg-[#A01F22] shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-6 py-3 rounded-full font-semibold bg-[#C6282B] text-white hover:bg-[#A01F22] shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


