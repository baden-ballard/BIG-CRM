'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import GlassCard from '../../../../../components/GlassCard';
import GlassButton from '../../../../../components/GlassButton';
import { supabase } from '../../../../../lib/supabase';

interface ParticipantPlan {
  id: string;
  participant_id: string;
  group_plan_id: string;
  group_plan_option_id: string | null;
  group_option_rate_id: string | null;
  rate_override: number | null;
  dependent_id: string | null;
  total_employee_responsible_amount: number | null;
  total_all_plans_employee_responsible_amount: number | null;
  created_at: string;
  updated_at: string;
  participant: {
    id: string;
    client_name: string;
  };
  group_plan: {
    id: string;
    group_id: string | null;
    plan_name: string;
    effective_date: string | null;
    termination_date: string | null;
    plan_type: string | null;
    employer_contribution_type: string | null;
    employer_contribution_value: number | null;
    employer_spouse_contribution_value: number | null;
    employer_child_contribution_value: number | null;
    group: {
      id: string;
      name: string;
    } | null;
    program: {
      id: string;
      name: string;
    } | null;
    provider: {
      id: string;
      name: string;
    } | null;
  };
  group_plan_option?: {
    id: string;
    option: string;
  } | null;
  group_option_rate?: {
    id: string;
    rate: number;
    start_date: string | null;
    end_date: string | null;
  } | null;
  dependent?: {
    id: string;
    name: string;
    relationship: string;
    dob: string | null;
  } | null;
}

interface RateHistoryRecord {
  id: string;
  created_at: string;
  participant_group_plan_id: string;
  dependent_id: string | null;
  dependent_name: string | null;
  dependent_relationship: string | null;
  group_option_rate: {
    id: string;
    rate: number;
    start_date: string | null;
    end_date: string | null;
  } | null;
  rate_override: number | null;
}

export default function ParticipantPlanDetailPage() {
  const router = useRouter();
  // Extract params values immediately - access properties directly to avoid enumeration
  const _params = useParams();
  // Extract values using bracket notation to avoid property access enumeration
  const participantId = String(_params['id'] || '');
  const planId = String(_params['planId'] || '');

  const [currentPlan, setCurrentPlan] = useState<ParticipantPlan | null>(null);
  const [allPlans, setAllPlans] = useState<ParticipantPlan[]>([]);
  const [rateHistory, setRateHistory] = useState<RateHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [rateToDelete, setRateToDelete] = useState<RateHistoryRecord | null>(null);
  const [isDeletingRate, setIsDeletingRate] = useState(false);
  const [selectedRateRecord, setSelectedRateRecord] = useState<RateHistoryRecord | null>(null);
  const [planToDelete, setPlanToDelete] = useState<ParticipantPlan | null>(null);
  const [isDeletingPlan, setIsDeletingPlan] = useState(false);

  useEffect(() => {
    if (participantId && planId) {
      fetchParticipantPlan();
    }
  }, [participantId, planId]);

  const fetchParticipantPlan = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch the main plan record
      const { data, error: fetchError } = await supabase
        .from('participant_group_plans')
        .select(`
          *,
          participant:participants (
            id,
            client_name
          ),
          group_plan:group_plans (
            id,
            group_id,
            plan_name,
            effective_date,
            termination_date,
            plan_type,
            employer_contribution_type,
            employer_contribution_value,
            employer_spouse_contribution_value,
            employer_child_contribution_value,
            group:groups (
              id,
              name
            ),
            program:programs (
              id,
              name
            ),
            provider:providers (
              id,
              name
            )
          ),
          group_plan_option:group_plan_options (
            id,
            option
          ),
          group_option_rate:group_option_rates (
            id,
            rate,
            start_date,
            end_date
          ),
          dependent:dependents (
            id,
            name,
            relationship,
            dob
          )
        `)
        .eq('id', planId)
        .eq('participant_id', participantId)
        .single();

      // Also fetch all related plans (including dependent plans) for this participant and group_plan
      if (data) {
        const { data: allPlansData, error: allPlansError } = await supabase
          .from('participant_group_plans')
          .select(`
            *,
            participant:participants (
              id,
              client_name
            ),
            group_plan:group_plans (
              id,
              group_id,
              plan_name,
              effective_date,
              termination_date,
              plan_type,
              employer_contribution_type,
              employer_contribution_value,
              employer_spouse_contribution_value,
              employer_child_contribution_value,
              group:groups (
                id,
                name
              ),
              program:programs (
                id,
                name
              ),
              provider:providers (
                id,
                name
              )
            ),
            group_plan_option:group_plan_options (
              id,
              option
            ),
            group_option_rate:group_option_rates (
              id,
              rate,
              start_date,
              end_date
            ),
            dependent:dependents (
              id,
              name,
              relationship,
              dob
            )
          `)
          .eq('participant_id', participantId)
          .eq('group_plan_id', data.group_plan_id);

        if (!allPlansError && allPlansData) {
          setAllPlans(allPlansData as ParticipantPlan[]);
          
          // If Age Banded plan and total not stored, calculate and store it
          if (data.group_plan?.plan_type === 'Age Banded') {
            const employeePlan = allPlansData.find((p: any) => !p.dependent_id);
            if (employeePlan && (!employeePlan.total_employee_responsible_amount || employeePlan.total_employee_responsible_amount === null)) {
              // Will calculate and store after rateHistory is loaded
            }
          }
        }
      }

      if (fetchError) {
        throw fetchError;
      }

      if (!data) {
        throw new Error('Participant plan not found');
      }

      setCurrentPlan(data as ParticipantPlan);
    } catch (err: any) {
      console.error('Error fetching participant plan:', err);
      setError(err.message || 'Failed to load participant plan');
    } finally {
      setLoading(false);
    }
  };

  const fetchRateHistory = async (groupPlanId: string, groupPlanOptionId: string | null) => {
    try {
      // For Age Banded plans, fetch ALL participant_group_plans records (employee, spouse, children)
      // For other plans, fetch just the one record
      let participantPlansQuery = supabase
        .from('participant_group_plans')
        .select(`
          id,
          rate_override,
          dependent_id,
          dependent:dependents (
            id,
            name,
            relationship
          )
        `)
        .eq('participant_id', participantId)
        .eq('group_plan_id', groupPlanId);

      // For non-Age Banded plans, filter by option if it exists
      if (groupPlanOptionId && currentPlan?.group_plan?.plan_type !== 'Age Banded') {
        participantPlansQuery = participantPlansQuery.eq('group_plan_option_id', groupPlanOptionId);
      }

      const { data: participantPlansData, error: participantPlansError } = await participantPlansQuery;

      if (participantPlansError || !participantPlansData || participantPlansData.length === 0) {
        setRateHistory([]);
        return;
      }

      // Fetch all junction records for all participant_group_plans records
      const participantPlanIds = participantPlansData.map((p: any) => p.id);
      
      const { data: junctionData, error: fetchError } = await supabase
        .from('participant_group_plan_rates')
        .select(`
          id,
          created_at,
          participant_group_plan_id,
          group_option_rate:group_option_rates (
            id,
            rate,
            start_date,
            end_date
          )
        `)
        .in('participant_group_plan_id', participantPlanIds)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      // If no junction records exist, but we have participant plans and options,
      // we need to retroactively connect to rates within the plan's effective window
      // (This is mainly for backward compatibility with old records)
      if ((!junctionData || junctionData.length === 0) && currentPlan?.group_plan) {
        const planEffectiveDate = currentPlan.group_plan.effective_date ? new Date(currentPlan.group_plan.effective_date) : null;
        const planTerminationDate = currentPlan.group_plan.termination_date ? new Date(currentPlan.group_plan.termination_date) : null;

        // For each participant plan, try to find matching rates
        const junctionRecordsToCreate: any[] = [];
        
        for (const plan of participantPlansData) {
          if (!plan.group_plan_option_id) continue;
          
          const { data: allRates } = await supabase
            .from('group_option_rates')
            .select('id, rate, start_date, end_date, created_at')
            .eq('group_plan_option_id', plan.group_plan_option_id)
            .order('created_at', { ascending: false });

          if (allRates && allRates.length > 0) {
            const isRateEffectiveInPlanWindow = (rate: any): boolean => {
              const rateStartDate = rate.start_date ? new Date(rate.start_date) : null;
              const rateEndDate = rate.end_date ? new Date(rate.end_date) : null;
              if (planTerminationDate && rateStartDate && rateStartDate > planTerminationDate) return false;
              if (planEffectiveDate && rateEndDate && rateEndDate < planEffectiveDate) return false;
              return true;
            };

            const effectiveRates = allRates.filter(isRateEffectiveInPlanWindow);
            effectiveRates.forEach((rate: any) => {
              junctionRecordsToCreate.push({
                participant_group_plan_id: plan.id,
                group_option_rate_id: rate.id,
              });
            });
          }
        }

        if (junctionRecordsToCreate.length > 0) {
          const { error: connectError } = await supabase
            .from('participant_group_plan_rates')
            .insert(junctionRecordsToCreate);

          if (!connectError) {
            // Re-fetch after creating retroactive connections
            const { data: newJunctionData } = await supabase
              .from('participant_group_plan_rates')
              .select(`
                id,
                created_at,
                participant_group_plan_id,
                group_option_rate:group_option_rates (
                  id,
                  rate,
                  start_date,
                  end_date
                )
              `)
              .in('participant_group_plan_id', participantPlanIds)
              .order('created_at', { ascending: false });

            if (newJunctionData) {
              const planMap = new Map(participantPlansData.map((p: any) => [
                p.id,
                {
                  rate_override: p.rate_override,
                  dependent_id: p.dependent_id,
                  dependent_name: p.dependent?.name || null,
                  dependent_relationship: p.dependent?.relationship || null,
                }
              ]));

              const rateHistory = newJunctionData.map((record: any) => {
                const planInfo = planMap.get(record.participant_group_plan_id);
                return {
                  id: record.id,
                  created_at: record.created_at,
                  participant_group_plan_id: record.participant_group_plan_id,
                  dependent_id: planInfo?.dependent_id || null,
                  dependent_name: planInfo?.dependent_name || null,
                  dependent_relationship: planInfo?.dependent_relationship || null,
                  rate_override: planInfo?.rate_override || null,
                  group_option_rate: record.group_option_rate,
                };
              });

              setRateHistory(rateHistory as RateHistoryRecord[]);
              return;
            }
          }
        }
      }

      // Create a map of participant_group_plans records for quick lookup
      const planMap = new Map(participantPlansData.map((p: any) => [
        p.id,
        {
          rate_override: p.rate_override,
          dependent_id: p.dependent_id,
          dependent_name: p.dependent?.name || null,
          dependent_relationship: p.dependent?.relationship || null,
        }
      ]));

      // Map the junction data to include plan and dependent information
      const rateHistory = (junctionData || []).map((record: any) => {
        const planInfo = planMap.get(record.participant_group_plan_id);
        return {
          id: record.id,
          created_at: record.created_at,
          participant_group_plan_id: record.participant_group_plan_id,
          dependent_id: planInfo?.dependent_id || null,
          dependent_name: planInfo?.dependent_name || null,
          dependent_relationship: planInfo?.dependent_relationship || null,
          rate_override: planInfo?.rate_override || null,
          group_option_rate: record.group_option_rate,
        };
      });

      setRateHistory(rateHistory as RateHistoryRecord[]);
    } catch (err: any) {
      console.error('Error fetching rate history:', err);
      setRateHistory([]);
    }
  };

  useEffect(() => {
    if (currentPlan) {
      fetchRateHistory(currentPlan.group_plan_id, currentPlan.group_plan_option_id);
    }
  }, [currentPlan]);

  // Update stored total_employee_responsible_amount for each plan record when rates change
  // This must be before any early returns to follow Rules of Hooks
  useEffect(() => {
    if (currentPlan && allPlans.length > 0 && rateHistory.length > 0 && currentPlan.group_plan?.plan_type === 'Age Banded') {
      // Get current rates from rateHistory
      const currentRatesByPlanId = new Map<string, RateHistoryRecord>();
      rateHistory.forEach((record) => {
        if (record.group_option_rate && !record.group_option_rate.end_date) {
          const planId = record.participant_group_plan_id;
          const existing = currentRatesByPlanId.get(planId);
          if (!existing || new Date(record.created_at) > new Date(existing.created_at)) {
            currentRatesByPlanId.set(planId, record);
          }
        }
      });

      // Update each plan record with its individual employee responsible amount
      allPlans.forEach((plan) => {
        const currentRateRecord = currentRatesByPlanId.get(plan.id);
        const planRate = currentRateRecord 
          ? (currentRateRecord.rate_override !== null 
              ? currentRateRecord.rate_override 
              : currentRateRecord.group_option_rate?.rate || null)
          : (plan.rate_override !== null 
              ? plan.rate_override 
              : plan.group_option_rate?.rate || null);
        
        if (planRate !== null) {
          // Calculate employee amount for this specific plan
          let amountPaidByEmployer = 0;
          let contributionValue: number | null = null;
          const contributionType = plan.group_plan?.employer_contribution_type;

          if (plan.group_plan?.plan_type === 'Age Banded') {
            if (!plan.dependent_id) {
              contributionValue = plan.group_plan.employer_contribution_value;
            } else if (plan.dependent?.relationship === 'Spouse') {
              contributionValue = plan.group_plan.employer_spouse_contribution_value;
            } else if (plan.dependent?.relationship === 'Child') {
              contributionValue = plan.group_plan.employer_child_contribution_value;
            }
          } else {
            contributionValue = plan.group_plan?.employer_contribution_value;
          }

          if (contributionType && contributionValue !== null) {
            if (contributionType === 'Percentage') {
              amountPaidByEmployer = planRate * (contributionValue / 100);
            } else if (contributionType === 'Dollar Amount') {
              amountPaidByEmployer = contributionValue;
            }
          }

          const employeeAmount = Math.max(0, planRate - amountPaidByEmployer);
          
          // Update if the stored value differs
          if (Math.abs((plan.total_employee_responsible_amount || 0) - employeeAmount) > 0.01) {
            supabase
              .from('participant_group_plans')
              .update({ total_employee_responsible_amount: employeeAmount })
              .eq('id', plan.id)
              .then(({ error }) => {
                if (!error) {
                  setAllPlans(prev => prev.map(p => 
                    p.id === plan.id 
                      ? { ...p, total_employee_responsible_amount: employeeAmount }
                      : p
                  ));
                  if (currentPlan.id === plan.id) {
                    setCurrentPlan({ ...currentPlan, total_employee_responsible_amount: employeeAmount });
                  }
                }
              });
          }
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rateHistory.length, allPlans.length, currentPlan?.id]);

  // Update stored total_all_plans_employee_responsible_amount on employee plan record
  useEffect(() => {
    if (currentPlan && allPlans.length > 0 && rateHistory.length > 0 && currentPlan.group_plan?.plan_type === 'Age Banded') {
      const totalAmount = calculateTotalEmployeeResponsibleAmount();
      
      if (totalAmount !== null && totalAmount > 0) {
        // Find the employee plan record (the one without dependent_id)
        const employeePlan = allPlans.find(p => !p.dependent_id);
        
        if (employeePlan) {
          // Only update if the value has changed
          const currentStoredValue = employeePlan.total_all_plans_employee_responsible_amount || 0;
          if (Math.abs(currentStoredValue - totalAmount) > 0.01) {
            supabase
              .from('participant_group_plans')
              .update({ total_all_plans_employee_responsible_amount: totalAmount })
              .eq('id', employeePlan.id)
              .then(({ error }) => {
                if (!error) {
                  // Update local state
                  setAllPlans(prev => prev.map(p => 
                    p.id === employeePlan.id 
                      ? { ...p, total_all_plans_employee_responsible_amount: totalAmount }
                      : p
                  ));
                  if (currentPlan.id === employeePlan.id) {
                    setCurrentPlan({ ...currentPlan, total_all_plans_employee_responsible_amount: totalAmount });
                  }
                } else {
                  // Check if error is due to missing column
                  const isColumnMissing = error.code === '42703' || 
                                          error.message?.includes('column') || 
                                          error.message?.includes('does not exist');
                  
                  if (isColumnMissing) {
                    console.warn('Column total_all_plans_employee_responsible_amount does not exist yet. Please run the migration: sql/add-total-all-plans-employee-responsible-amount.sql');
                  } else {
                    console.error('Error updating total_all_plans_employee_responsible_amount:', error);
                  }
                }
              });
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rateHistory.length, allPlans.length, currentPlan?.id]);

  const formatDisplayDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const calculateEmployeeResponsibleAmount = (rate: number | null, plan: ParticipantPlan | null) => {
    if (rate === null || !plan) return null;

    let amountPaidByEmployer = 0;
    let contributionValue: number | null = null;
    const contributionType = plan.group_plan?.employer_contribution_type;

    // For Age Banded plans, use the appropriate contribution value based on dependent type
    if (plan.group_plan?.plan_type === 'Age Banded') {
      if (!plan.dependent_id) {
        // Employee
        contributionValue = plan.group_plan.employer_contribution_value;
      } else if (plan.dependent?.relationship === 'Spouse') {
        // Spouse
        contributionValue = plan.group_plan.employer_spouse_contribution_value;
      } else if (plan.dependent?.relationship === 'Child') {
        // Child
        contributionValue = plan.group_plan.employer_child_contribution_value;
      }
    } else {
      // For non-Age Banded plans, use the standard contribution value
      contributionValue = plan.group_plan?.employer_contribution_value;
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

  const handleDeleteRate = async () => {
    if (!rateToDelete || !currentPlan) return;

    try {
      setIsDeletingRate(true);

      const { error: deleteError } = await supabase
        .from('participant_group_plan_rates')
        .delete()
        .eq('id', rateToDelete.id);

      if (deleteError) {
        throw deleteError;
      }

      // Refresh rate history
      await fetchRateHistory(currentPlan.group_plan_id, currentPlan.group_plan_option_id);

      // Close dialog
      setRateToDelete(null);

      alert('Rate deleted successfully!');
    } catch (err: any) {
      console.error('Error deleting rate:', err);
      alert('Failed to delete rate. Please try again.');
    } finally {
      setIsDeletingRate(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!planToDelete || isDeletingPlan) return;

    // Store the plan ID to prevent issues if state changes
    const planIdToDelete = planToDelete.id;
    setIsDeletingPlan(true);

    try {
      // First, delete all related junction table records (participant_group_plan_rates)
      const { error: junctionDeleteError } = await supabase
        .from('participant_group_plan_rates')
        .delete()
        .eq('participant_group_plan_id', planIdToDelete);

      if (junctionDeleteError) {
        console.error('Error deleting junction records:', junctionDeleteError);
        // Continue anyway - might not have junction records
      }

      // Then delete the main plan record
      const { error: deleteError } = await supabase
        .from('participant_group_plans')
        .delete()
        .eq('id', planIdToDelete);

      if (deleteError) {
        throw deleteError;
      }

      // Close dialog and navigate back to participant page
      setPlanToDelete(null);
      setIsDeletingPlan(false);
      
      // Small delay to ensure UI updates before navigation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      router.push(`/participants/${participantId}`);
    } catch (err: any) {
      console.error('Error deleting plan:', err);
      setIsDeletingPlan(false);
      alert(`Failed to delete participant plan: ${err.message || 'Please try again.'}`);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            Loading participant plan...
          </p>
        </GlassCard>
      </div>
    );
  }

  if (error || !currentPlan) {
    return (
      <div className="max-w-4xl mx-auto">
        <GlassCard>
          <p className="text-red-500 text-center py-8">
            {error || 'Participant plan not found'}
          </p>
          <div className="flex justify-center mt-4">
            <GlassButton variant="primary" onClick={() => router.push(`/participants/${participantId}`)}>
              Back to Participant
            </GlassButton>
          </div>
        </GlassCard>
      </div>
    );
  }

  // Find the active rate record from rateHistory based on today's date
  // A rate is "active" if today falls between start_date and end_date (or no end_date)
  const getActiveRateRecord = (): RateHistoryRecord | null => {
    if (!currentPlan || rateHistory.length === 0) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison

    // Filter rateHistory for records matching the current plan
    const planRateRecords = rateHistory.filter(
      record => record.participant_group_plan_id === currentPlan.id
    );

    // Find active rates (where today falls within the rate period)
    const activeRates = planRateRecords.filter(record => {
      if (!record.group_option_rate) return false;

      const startDate = record.group_option_rate.start_date 
        ? new Date(record.group_option_rate.start_date) 
        : null;
      const endDate = record.group_option_rate.end_date 
        ? new Date(record.group_option_rate.end_date) 
        : null;
      
      // Set time to start of day for accurate comparison
      if (startDate) startDate.setHours(0, 0, 0, 0);
      if (endDate) endDate.setHours(0, 0, 0, 0);
      
      const isStartValid = !startDate || today >= startDate;
      const isEndValid = !endDate || today <= endDate;
      return isStartValid && isEndValid;
    });

    // Get the most recent active rate (by created_at)
    if (activeRates.length > 0) {
      return activeRates.reduce((latest, current) => {
        return new Date(current.created_at) > new Date(latest.created_at) ? current : latest;
      });
    }

    return null;
  };

  // Get the active rate value (from rateHistory or fallback to currentPlan)
  const activeRateRecord = getActiveRateRecord();
  const currentRate = activeRateRecord
    ? (activeRateRecord.rate_override !== null
        ? activeRateRecord.rate_override
        : activeRateRecord.group_option_rate?.rate || null)
    : (currentPlan.rate_override !== null 
        ? currentPlan.rate_override 
        : currentPlan.group_option_rate?.rate || null);

  // Check if the current rate is a custom override
  const isCustomRateOverride = activeRateRecord
    ? activeRateRecord.rate_override !== null
    : currentPlan.rate_override !== null;
  
  // Calculate total rate for Age Banded plans (sum of all rates: employee + dependents)
  const calculateTotalRate = () => {
    if (currentPlan.group_plan?.plan_type !== 'Age Banded') {
      return currentRate;
    }

    let total = 0;

    // Use rateHistory if available, otherwise fall back to allPlans
    if (rateHistory.length > 0) {
      // Get the most recent rate for each plan (employee + all dependents)
      const latestRates = new Map<string, RateHistoryRecord>();
      
      rateHistory.forEach(record => {
        if (!record.group_option_rate) return;
        
        const planId = record.participant_group_plan_id;
        const existing = latestRates.get(planId);
        // Keep the most recent rate for each plan (by created_at timestamp)
        if (!existing || new Date(record.created_at) > new Date(existing.created_at)) {
          latestRates.set(planId, record);
        }
      });

      // Sum all rates (employee + all dependents)
      latestRates.forEach((record) => {
        const rate = record.rate_override !== null
          ? record.rate_override
          : record.group_option_rate?.rate || 0;
        
        if (rate > 0) {
          total += rate;
        }
      });
    } else if (allPlans.length > 0) {
      // Fallback: use allPlans if rateHistory isn't loaded yet
      // Sum all rates for all plans (employee + all dependents)
      allPlans.forEach(plan => {
        const planRate = plan.rate_override !== null
          ? plan.rate_override
          : plan.group_option_rate?.rate || 0;
        
        if (planRate > 0) {
          total += planRate;
        }
      });
    }

    return total > 0 ? total : null;
  };

  // For Age Banded plans, show total rate (sum of all rates)
  // For other plans, show the single plan's rate
  const displayRate = currentPlan.group_plan?.plan_type === 'Age Banded' 
    ? calculateTotalRate() 
    : currentRate;
  
  const currentEmployeeAmount = calculateEmployeeResponsibleAmount(currentRate, currentPlan);

  // Group plans by type (Employee, Spouse, Child)
  const employeePlans = allPlans.filter(p => !p.dependent_id);
  const spousePlans = allPlans.filter(p => p.dependent?.relationship === 'Spouse');
  const childPlans = allPlans.filter(p => p.dependent?.relationship === 'Child');

  // Calculate total Employee Responsible Amount for Age Banded plans
  // Sum of employee responsible amounts for all active plans (participant + dependents)
  // All plans use employee responsible amount to avoid double-counting
  const calculateTotalEmployeeResponsibleAmount = () => {
    if (currentPlan.group_plan?.plan_type !== 'Age Banded') {
      return currentEmployeeAmount;
    }

    let total = 0;

    // Use rateHistory if available, otherwise fall back to allPlans
    if (rateHistory.length > 0) {
      // For Age Banded plans, get the most recent rate for each plan (employee + all dependents)
      // Include ALL rates regardless of start_date - we want to show the total for all plans
      const latestRates = new Map<string, RateHistoryRecord>();
      
      rateHistory.forEach(record => {
        if (!record.group_option_rate) return;
        
        const planId = record.participant_group_plan_id;
        const existing = latestRates.get(planId);
        // Keep the most recent rate for each plan (by created_at timestamp)
        if (!existing || new Date(record.created_at) > new Date(existing.created_at)) {
          latestRates.set(planId, record);
        }
      });

      // Process each rate - IMPORTANT: This includes ALL plans (employee + all dependents)
      // For Age Banded plans, we sum employee responsible amounts for:
      // - Employee plan (participant with no dependent_id)
      // - Spouse plan(s) (participant with dependent_id where relationship = 'Spouse')
      // - Child plan(s) (participant with dependent_id where relationship = 'Child')
      latestRates.forEach((record, planId) => {
        // Get the rate
        const rate = record.rate_override !== null
          ? record.rate_override
          : record.group_option_rate?.rate || 0;

        if (rate === 0) return;

        // Find the plan to get contribution info
        const plan = allPlans.find(p => p.id === planId) || currentPlan;

        // Calculate employee responsible amount for this plan (employee, spouse, or child)
        // Each plan's employee amount is calculated separately and then summed
        const employeeAmount = calculateEmployeeResponsibleAmount(rate, plan);
        if (employeeAmount !== null) {
          total += employeeAmount;
        }
      });
    } else if (allPlans.length > 0) {
      // Fallback: use allPlans if rateHistory isn't loaded yet
      // IMPORTANT: For Age Banded plans, sum employee responsible amounts for ALL plans
      // This includes: employee plan + all spouse plans + all child plans
      allPlans.forEach(plan => {
        const planRate = plan.rate_override !== null
          ? plan.rate_override
          : plan.group_option_rate?.rate || 0;
        
        if (planRate > 0) {
          const employeeAmount = calculateEmployeeResponsibleAmount(planRate, plan);
          if (employeeAmount !== null) {
            total += employeeAmount;
          }
        }
      });
    }

    // Debug: Log what we're calculating
    if (typeof window !== 'undefined') {
      console.log('CALCULATION DEBUG (Age Banded Total):', {
        total,
        rateHistoryLength: rateHistory.length,
        allPlansLength: allPlans.length,
        employeePlan: allPlans.find(p => !p.dependent_id),
        dependents: allPlans.filter(p => p.dependent_id !== null).map(p => ({
          id: p.id,
          dependent_id: p.dependent_id,
          relationship: p.dependent?.relationship,
          rate: p.rate_override || p.group_option_rate?.rate,
          employeeAmount: calculateEmployeeResponsibleAmount(
            p.rate_override || p.group_option_rate?.rate || 0,
            p
          )
        })),
        breakdown: allPlans.map(p => ({
          type: p.dependent_id ? (p.dependent?.relationship || 'Unknown') : 'Employee',
          rate: p.rate_override || p.group_option_rate?.rate || 0,
          employeeAmount: calculateEmployeeResponsibleAmount(
            p.rate_override || p.group_option_rate?.rate || 0,
            p
          )
        }))
      });
    }

    return total > 0 ? total : null;
  };

  // Function to calculate and store total Employee Responsible Amount
  const updateStoredTotalEmployeeResponsibleAmount = async (calculatedTotal: number | null) => {
    if (!currentPlan || currentPlan.group_plan?.plan_type !== 'Age Banded' || calculatedTotal === null) {
      return;
    }

    // Find the employee plan record (the one without dependent_id)
    const employeePlan = allPlans.find(p => !p.dependent_id);
    if (!employeePlan) return;

    // Only update if the value has changed
    if (Math.abs((employeePlan.total_employee_responsible_amount || 0) - calculatedTotal) > 0.01) {
      try {
        const { error, data } = await supabase
          .from('participant_group_plans')
          .update({ total_employee_responsible_amount: calculatedTotal })
          .eq('id', employeePlan.id)
          .select();

      if (error) {
        // Check if error is due to missing column (code 42703 or message about column)
        const isColumnMissing = error.code === '42703' || 
                                error.message?.includes('column') || 
                                error.message?.includes('does not exist');
        
        if (isColumnMissing) {
          console.warn('Column total_employee_responsible_amount does not exist yet. Please run the migration: sql/add-total-employee-responsible-amount.sql');
        } else {
          console.error('Error updating total_employee_responsible_amount:', {
            error,
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            employeePlanId: employeePlan.id,
            calculatedTotal
          });
        }
        // Don't throw - just log the error, the calculation will still work
      } else {
          // Update local state
          setAllPlans(prev => prev.map(p => 
            p.id === employeePlan.id 
              ? { ...p, total_employee_responsible_amount: calculatedTotal }
              : p
          ));
          if (currentPlan.id === employeePlan.id) {
            setCurrentPlan({ ...currentPlan, total_employee_responsible_amount: calculatedTotal });
          }
        }
      } catch (err: any) {
        console.error('Exception updating total_employee_responsible_amount:', err);
      }
    }
  };

  // Calculate and display the total directly - don't use any stored values
  const totalEmployeeResponsibleAmount = calculateTotalEmployeeResponsibleAmount();

  // Helper function to render rate section
  const renderRateSection = (title: string, plans: ParticipantPlan[], contributionValue: number | null, contributionType: string | null) => {
    if (plans.length === 0) return null;

    // Calculate total Employee Responsible Amount for this section if Age Banded
    // Use the same calculation method as the main total indicator
    const isAgeBanded = currentPlan.group_plan?.plan_type === 'Age Banded' || currentPlan.group_plan?.employer_contribution_type === 'Age Banded';
    let sectionTotal = null;
    if (isAgeBanded) {
      // Use the same calculation logic as calculateTotalEmployeeResponsibleAmount
      // Get current rates from rateHistory (rates without end_date) for these plans
      if (rateHistory.length > 0) {
        const currentRatesByPlanId = new Map<string, RateHistoryRecord>();
        
        rateHistory.forEach((record) => {
          // Only consider current rates (no end_date)
          if (record.group_option_rate && !record.group_option_rate.end_date) {
            const planId = record.participant_group_plan_id;
            const existing = currentRatesByPlanId.get(planId);
            
            // Keep the most recent current rate for each plan
            if (!existing || new Date(record.created_at) > new Date(existing.created_at)) {
              currentRatesByPlanId.set(planId, record);
            }
          }
        });

        let calculatedTotal = 0;
        plans.forEach((plan) => {
          // Get the current rate from rateHistory first, then fall back to plan rate
          const currentRateRecord = currentRatesByPlanId.get(plan.id);
          const planRate = currentRateRecord 
            ? (currentRateRecord.rate_override !== null 
                ? currentRateRecord.rate_override 
                : currentRateRecord.group_option_rate?.rate || null)
            : (plan.rate_override !== null 
                ? plan.rate_override 
                : plan.group_option_rate?.rate || null);
          
          if (planRate !== null && planRate > 0) {
            // Use employee responsible amount for all plans (same as main calculation)
            const employeeAmount = calculateEmployeeResponsibleAmount(planRate, plan);
            if (employeeAmount !== null) {
              calculatedTotal += employeeAmount;
            }
          }
        });
        sectionTotal = calculatedTotal > 0 ? calculatedTotal : null;
      } else {
        // Fallback: use allPlans if rateHistory isn't loaded yet
        let calculatedTotal = 0;
        plans.forEach((plan) => {
          const planRate = plan.rate_override !== null
            ? plan.rate_override
            : plan.group_option_rate?.rate || 0;
          
          if (planRate > 0) {
            // Use employee responsible amount for all plans (same as main calculation)
            const employeeAmount = calculateEmployeeResponsibleAmount(planRate, plan);
            if (employeeAmount !== null) {
              calculatedTotal += employeeAmount;
            }
          }
        });
        sectionTotal = calculatedTotal > 0 ? calculatedTotal : null;
      }
    }

    return (
      <div className="pt-6 border-t border-white/20">
        <h2 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-6">
          {title} Rates
        </h2>
        {isAgeBanded && totalEmployeeResponsibleAmount !== null && (
          <div className="glass-card rounded-xl p-4 bg-blue-500/10 border border-blue-500/20 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--glass-gray-medium)] mb-1">Total {title} Employee Responsible Amount</p>
                <p className="text-xs text-[var(--glass-gray-medium)]">
                  Summary of all active Participants Group plan rates
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-[var(--glass-black-dark)]">
                  ${totalEmployeeResponsibleAmount.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="space-y-4">
          {plans.map((plan) => {
            const planRate = plan.rate_override !== null 
              ? plan.rate_override 
              : plan.group_option_rate?.rate || null;
            
            let amountPaidByEmployer = 0;
            if (contributionType && contributionValue && planRate !== null) {
              if (contributionType === 'Percentage') {
                amountPaidByEmployer = planRate * (contributionValue / 100);
              } else if (contributionType === 'Dollar Amount') {
                amountPaidByEmployer = contributionValue;
              }
            }
            const employeeResponsibleAmount = Math.max(0, (planRate || 0) - amountPaidByEmployer);

            return (
              <div
                key={plan.id}
                className="glass-card rounded-xl p-4 bg-white/5 border border-white/10"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-[var(--glass-black-dark)] mb-2">
                      {plan.dependent ? plan.dependent.name : currentPlan.participant?.client_name}
                    </h3>
                    {plan.dependent && (
                      <p className="text-sm text-[var(--glass-gray-medium)] mb-2">
                        {plan.dependent.relationship} • Age: {plan.group_plan_option?.option || 'N/A'}
                      </p>
                    )}
                    {plan.group_plan_option && (
                      <p className="text-sm text-[var(--glass-gray-medium)]">
                        Option: {plan.group_plan_option.option}
                      </p>
                    )}
                  </div>
                  {isAgeBanded && totalEmployeeResponsibleAmount !== null && (
                    <div className="text-right">
                      <p className="text-xs text-[var(--glass-gray-medium)] mb-1">Total All Plans</p>
                      <p className="text-2xl font-bold text-[var(--glass-black-dark)]">
                        ${totalEmployeeResponsibleAmount.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
                {planRate !== null && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/10">
                    <div>
                      <p className="text-xs text-[var(--glass-gray-medium)] mb-1">Rate</p>
                      <p className="text-xl font-bold text-[var(--glass-black-dark)]">
                        ${planRate.toFixed(2)}
                      </p>
                      {plan.rate_override !== null && (
                        <p className="text-xs text-[var(--glass-gray-medium)] mt-1">Custom override</p>
                      )}
                    </div>
                    {contributionValue !== null && (
                      <>
                        <div>
                          <p className="text-xs text-[var(--glass-gray-medium)] mb-1">Amount Paid By Employer</p>
                          <p className="text-xl font-bold text-[var(--glass-black-dark)]">
                            ${amountPaidByEmployer.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[var(--glass-gray-medium)] mb-1">Employee Responsible</p>
                          <p className="text-xl font-bold text-[var(--glass-black-dark)]">
                            ${employeeResponsibleAmount.toFixed(2)}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <button
          onClick={() => router.push(`/participants/${participantId}`)}
          className="text-[var(--glass-secondary)] hover:text-[var(--glass-secondary-dark)] mb-4 flex items-center gap-2"
        >
          <span>←</span> Back to Participant
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
              {currentPlan.group_plan?.plan_name || 'Plan Details'}
            </h1>
            <p className="text-[var(--glass-gray-medium)]">
              Rate history for {currentPlan.participant?.client_name}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isEditMode && (
              <button
                type="button"
                onClick={() => setPlanToDelete(currentPlan)}
                className="px-6 py-3 rounded-full font-semibold bg-red-500 text-white hover:bg-red-600 shadow-lg hover:shadow-xl transition-all duration-300 whitespace-nowrap"
              >
                Delete
              </button>
            )}
            <GlassButton
              variant={isEditMode ? "secondary" : "primary"}
              onClick={() => setIsEditMode(!isEditMode)}
            >
              {isEditMode ? 'Cancel Edit' : 'Edit'}
            </GlassButton>
          </div>
        </div>
      </div>

      <GlassCard>
        <div className="space-y-6">
          {/* Current Plan Information */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-[var(--glass-black-dark)]">
                Current Plan Information
              </h2>
              {currentPlan.group_plan?.id && (currentPlan.group_plan?.group_id || currentPlan.group_plan?.group?.id) && (
                <button
                  onClick={() => {
                    const groupId = currentPlan.group_plan?.group_id || currentPlan.group_plan?.group?.id;
                    router.push(`/groups/${groupId}/plans/${currentPlan.group_plan.id}`);
                  }}
                  className="text-[var(--glass-secondary)] hover:text-[var(--glass-secondary-dark)] font-medium transition-colors duration-200"
                >
                  View Group Plan
                </button>
              )}
            </div>
            
            <div className="space-y-4">
              <div 
                onClick={() => {
                  const groupId = currentPlan.group_plan?.group_id || currentPlan.group_plan?.group?.id;
                  if (currentPlan.group_plan?.id && groupId) {
                    router.push(`/groups/${groupId}/plans/${currentPlan.group_plan.id}`);
                  }
                }}
                className="glass-card rounded-xl p-4 bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors duration-200"
              >
                <div className="flex flex-wrap items-center justify-center gap-4">
                  {currentPlan.group_plan?.program && (
                    <div>
                      <span className="text-sm text-[var(--glass-gray-medium)]">Program: </span>
                      <span className="text-[var(--glass-black-dark)] font-medium">
                        {currentPlan.group_plan.program.name}
                      </span>
                    </div>
                  )}
                  {currentPlan.group_plan?.provider && (
                    <div>
                      <span className="text-sm text-[var(--glass-gray-medium)]">Provider: </span>
                      <span className="text-[var(--glass-black-dark)] font-medium">
                        {currentPlan.group_plan.provider.name}
                      </span>
                    </div>
                  )}
                  {currentPlan.group_plan?.effective_date && (
                    <div>
                      <span className="text-sm text-[var(--glass-gray-medium)]">Effective Date: </span>
                      <span className="text-[var(--glass-black-dark)] font-medium">
                        {formatDisplayDate(currentPlan.group_plan.effective_date)}
                      </span>
                    </div>
                  )}
                  {currentPlan.group_plan_option && (
                    <div>
                      <span className="text-sm text-[var(--glass-gray-medium)]">Plan Option: </span>
                      <span className="text-[var(--glass-black-dark)] font-medium">
                        {currentPlan.group_plan_option.option}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Current Rate Display */}
              {displayRate !== null && (
                <div className="glass-card rounded-xl p-6 bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[var(--glass-gray-medium)] mb-1">
                        {currentPlan.group_plan?.plan_type === 'Age Banded' ? 'Total Rate (All Plans)' : 'Current Rate'}
                      </p>
                      <p className="text-xs text-[var(--glass-gray-medium)]">
                        {currentPlan.group_plan?.plan_type === 'Age Banded' 
                          ? 'Sum of employee + all dependents' 
                          : isCustomRateOverride 
                            ? 'Custom rate override' 
                            : 'Current plan rate'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-[var(--glass-black-dark)]">
                        ${displayRate.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Employee Responsible Amount Indicator */}
              {totalEmployeeResponsibleAmount !== null && (
                <div className="glass-card rounded-xl p-6 bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[var(--glass-gray-medium)] mb-1">Employee Responsible Amount</p>
                      <p className="text-xs text-[var(--glass-gray-medium)]">
                        Summary of all active Participants Group plan rates
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-[var(--glass-black-dark)]">
                        ${totalEmployeeResponsibleAmount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Employee Rates Section */}
          {currentPlan.group_plan?.employer_contribution_type === 'Age Banded' && renderRateSection(
            'Employee',
            employeePlans,
            currentPlan.group_plan.employer_contribution_value,
            currentPlan.group_plan.employer_contribution_type
          )}

          {/* Spouse Rates Section */}
          {currentPlan.group_plan?.employer_contribution_type === 'Age Banded' && renderRateSection(
            'Spouse',
            spousePlans,
            currentPlan.group_plan.employer_spouse_contribution_value,
            currentPlan.group_plan.employer_contribution_type
          )}

          {/* Child Rates Section */}
          {currentPlan.group_plan?.employer_contribution_type === 'Age Banded' && renderRateSection(
            'Child',
            childPlans,
            currentPlan.group_plan.employer_child_contribution_value,
            currentPlan.group_plan.employer_contribution_type
          )}

          {/* Rate History */}
          <div className="pt-6 border-t border-white/20">
            <h2 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-6">
              Rate History
            </h2>

            {rateHistory.length === 0 ? (
              <p className="text-[var(--glass-gray-medium)] text-center py-4">
                No rate history available
              </p>
            ) : (() => {
              // Group rate history by type (Participant, Spouse, Child)
              const participantRecords = rateHistory.filter(r => !r.dependent_id);
              const spouseRecords = rateHistory.filter(r => r.dependent_relationship === 'Spouse');
              const childRecords = rateHistory.filter(r => r.dependent_relationship === 'Child');
              
              // Group children by name if multiple
              const childrenByName = new Map<string, RateHistoryRecord[]>();
              childRecords.forEach(record => {
                const name = record.dependent_name || 'Unknown';
                if (!childrenByName.has(name)) {
                  childrenByName.set(name, []);
                }
                childrenByName.get(name)!.push(record);
              });

              const renderRateRecord = (record: RateHistoryRecord, isMostRecent: boolean = false) => {
                const recordRate = record.rate_override !== null 
                  ? record.rate_override 
                  : record.group_option_rate?.rate || null;
                
                const employeeAmount = calculateEmployeeResponsibleAmount(recordRate, currentPlan);
                const isCurrent = isMostRecent && (!record.group_option_rate?.end_date);

                return (
                  <div
                    key={record.id}
                    onClick={() => setSelectedRateRecord(record)}
                    className={`glass-card rounded-xl p-4 border cursor-pointer hover:bg-white/10 transition-colors ${
                      isCurrent 
                        ? 'bg-[var(--glass-secondary)]/10 border-[var(--glass-secondary)]/30' 
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {isCurrent && (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[var(--glass-secondary)] text-white">
                              Current
                            </span>
                          )}
                          <span className="text-sm text-[var(--glass-gray-medium)]">
                            {formatDisplayDate(record.created_at)}
                          </span>
                          {record.group_option_rate?.start_date && (
                            <span className="text-sm text-[var(--glass-gray-medium)]">
                              Rate Period: {formatDisplayDate(record.group_option_rate.start_date)}
                              {record.group_option_rate.end_date && ` - ${formatDisplayDate(record.group_option_rate.end_date)}`}
                              {!record.group_option_rate.end_date && ' - Present'}
                            </span>
                          )}
                        </div>
                        {recordRate !== null && (
                          <div className="flex items-center gap-6 mt-2">
                            <div>
                              <p className="text-xs text-[var(--glass-gray-medium)]">Rate</p>
                              <p className="text-xl font-bold text-[var(--glass-black-dark)]">
                                ${recordRate.toFixed(2)}
                              </p>
                              {record.rate_override !== null && (
                                <p className="text-xs text-[var(--glass-gray-medium)] mt-1">Custom override</p>
                              )}
                            </div>
                            {employeeAmount !== null && (
                              <div>
                                <p className="text-xs text-[var(--glass-gray-medium)]">Employee Responsible</p>
                                <p className="text-xl font-bold text-[var(--glass-black-dark)]">
                                  ${employeeAmount.toFixed(2)}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {isEditMode && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRateToDelete(record);
                          }}
                          className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white font-bold text-xl leading-none transition-colors duration-200 flex-shrink-0 shadow-lg hover:shadow-xl"
                          title="Delete rate"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                );
              };

              return (
                <div className="space-y-6">
                  {/* Participant Rates */}
                  {participantRecords.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--glass-black-dark)] mb-3">
                        Participant
                      </h3>
                      <div className="space-y-3">
                        {participantRecords.map((record, index) => 
                          renderRateRecord(record, index === 0)
                        )}
                      </div>
                    </div>
                  )}

                  {/* Spouse Rates */}
                  {spouseRecords.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--glass-black-dark)] mb-3">
                        Spouse
                      </h3>
                      <div className="space-y-3">
                        {spouseRecords.map((record, index) => 
                          renderRateRecord(record, index === 0)
                        )}
                      </div>
                    </div>
                  )}

                  {/* Child Rates - Grouped by name if multiple */}
                  {childrenByName.size > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--glass-black-dark)] mb-3">
                        Children
                      </h3>
                      <div className="space-y-4">
                        {Array.from(childrenByName.entries()).map(([childName, records]) => (
                          <div key={childName}>
                            {childrenByName.size > 1 && (
                              <h4 className="text-md font-medium text-[var(--glass-black-dark)] mb-2 ml-2">
                                {childName}
                              </h4>
                            )}
                            <div className="space-y-3">
                              {records.map((record, index) => 
                                renderRateRecord(record, index === 0)
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </GlassCard>

      {/* Rate Detail Modal */}
      {selectedRateRecord && (() => {
        const recordRate = selectedRateRecord.rate_override !== null 
          ? selectedRateRecord.rate_override 
          : selectedRateRecord.group_option_rate?.rate || null;
        
        const employeeAmount = calculateEmployeeResponsibleAmount(recordRate, currentPlan);

        return (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" 
            onClick={() => setSelectedRateRecord(null)}
          >
            <div 
              className="bg-white rounded-xl p-8 max-w-lg w-full mx-4 shadow-2xl" 
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-6 text-center">
                Rate Details
              </h3>
              
              <div className="space-y-4">
                <div className="glass-card rounded-xl p-4 bg-white/5 border border-white/10">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-[var(--glass-gray-medium)] mb-1">Rate Start Date</p>
                      <p className="text-lg font-semibold text-[var(--glass-black-dark)]">
                        {selectedRateRecord.group_option_rate?.start_date 
                          ? formatDisplayDate(selectedRateRecord.group_option_rate.start_date)
                          : 'N/A'}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-[var(--glass-gray-medium)] mb-1">End Period</p>
                      <p className="text-lg font-semibold text-[var(--glass-black-dark)]">
                        {selectedRateRecord.group_option_rate?.end_date 
                          ? formatDisplayDate(selectedRateRecord.group_option_rate.end_date)
                          : selectedRateRecord.group_option_rate?.start_date 
                            ? 'Present (Ongoing)'
                            : 'N/A'}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-[var(--glass-gray-medium)] mb-1">Rate</p>
                      <p className="text-2xl font-bold text-[var(--glass-black-dark)]">
                        {recordRate !== null ? `$${recordRate.toFixed(2)}` : 'N/A'}
                      </p>
                      {selectedRateRecord.rate_override !== null && (
                        <p className="text-xs text-[var(--glass-gray-medium)] mt-1">Custom override</p>
                      )}
                    </div>
                    
                    <div>
                      <p className="text-sm text-[var(--glass-gray-medium)] mb-1">Employee Responsible</p>
                      <p className="text-2xl font-bold text-[var(--glass-black-dark)]">
                        {employeeAmount !== null ? `$${employeeAmount.toFixed(2)}` : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center mt-6">
                <button
                  type="button"
                  onClick={() => setSelectedRateRecord(null)}
                  className="px-6 py-3 rounded-full font-semibold bg-[var(--glass-secondary)] text-white hover:bg-[var(--glass-secondary-dark)] shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete Rate Confirmation Dialog */}
      {rateToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setRateToDelete(null)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-4 text-center">
              Delete Rate
            </h3>
            <p className="text-[var(--glass-gray-medium)] mb-6 text-center">
              You are deleting a rate from the rate history. This action cannot be undone. Are you sure you want to continue?
            </p>
            <div className="flex gap-4 justify-center">
              <button
                type="button"
                onClick={() => setRateToDelete(null)}
                disabled={isDeletingRate}
                className="px-6 py-3 rounded-full font-semibold bg-gray-500 text-white hover:bg-gray-600 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRate}
                disabled={isDeletingRate}
                className="px-6 py-3 rounded-full font-semibold bg-red-500 text-white hover:bg-red-600 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeletingRate ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Plan Confirmation Dialog */}
      {planToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setPlanToDelete(null)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-4 text-center">
              Delete Plan
            </h3>
            <p className="text-[var(--glass-gray-medium)] mb-6 text-center">
              You are deleting the participant plan "{planToDelete.group_plan?.plan_name || 'this plan'}". This action cannot be undone. Are you sure you want to continue?
            </p>
            <div className="flex gap-4 justify-center">
              <button
                type="button"
                onClick={() => {
                  if (!isDeletingPlan) {
                    setPlanToDelete(null);
                  }
                }}
                disabled={isDeletingPlan}
                className="px-6 py-3 rounded-full font-semibold bg-gray-500 text-white hover:bg-gray-600 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isDeletingPlan) {
                    handleDeletePlan();
                  }
                }}
                disabled={isDeletingPlan}
                className="px-6 py-3 rounded-full font-semibold bg-red-500 text-white hover:bg-red-600 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeletingPlan ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
