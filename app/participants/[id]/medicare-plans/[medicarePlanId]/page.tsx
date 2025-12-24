'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import GlassCard from '../../../../../components/GlassCard';
import GlassButton from '../../../../../components/GlassButton';
import { supabase } from '../../../../../lib/supabase';

interface ParticipantMedicarePlan {
  id: string;
  participant_id: string;
  medicare_plan_id: string;
  medicare_rate_id: string | null;
  medicare_child_rate_id: string | null;
  rate_override: number | null;
  effective_date: string | null;
  created_at: string;
  updated_at: string;
  participant: {
    id: string;
    client_name: string;
  };
  medicare_plan: {
    id: string;
    plan_name: string;
    provider: {
      id: string;
      name: string;
    } | null;
  } | null;
  medicare_child_rate: {
    id: string;
    rate: number;
    start_date: string | null;
    end_date: string | null;
  } | null;
}

interface MedicareChildRate {
  id: string;
  rate: number;
  start_date: string | null;
  end_date: string | null;
}

export default function ParticipantMedicarePlanDetailPage() {
  const router = useRouter();
  const _params = useParams();
  const participantId = String(_params['id'] || '');
  const medicarePlanId = String(_params['medicarePlanId'] || '');

  const [currentPlan, setCurrentPlan] = useState<ParticipantMedicarePlan | null>(null);
  const [rateHistory, setRateHistory] = useState<MedicareChildRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDeletingPlan, setIsDeletingPlan] = useState(false);

  useEffect(() => {
    if (participantId && medicarePlanId) {
      fetchParticipantMedicarePlan();
    }
  }, [participantId, medicarePlanId]);

  const fetchParticipantMedicarePlan = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('participant_medicare_plans')
        .select(`
          *,
          participant:participants (
            id,
            client_name
          ),
          medicare_plan:medicare_plans (
            id,
            plan_name,
            provider:providers (
              id,
              name
            )
          ),
          medicare_child_rate:medicare_child_rates (
            id,
            rate,
            start_date,
            end_date
          )
        `)
        .eq('id', medicarePlanId)
        .eq('participant_id', participantId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      if (!data) {
        throw new Error('Participant Medicare plan not found');
      }

      setCurrentPlan(data as ParticipantMedicarePlan);

      // Fetch all rate history for this Medicare plan
      if (data.medicare_plan?.id) {
        const { data: ratesData, error: ratesError } = await supabase
          .from('medicare_child_rates')
          .select('*')
          .eq('medicare_plan_id', data.medicare_plan.id)
          .order('start_date', { ascending: false });

        if (ratesError) {
          console.error('Error fetching rate history:', ratesError);
        } else {
          setRateHistory(ratesData || []);
        }
      }
    } catch (err: any) {
      console.error('Error fetching participant Medicare plan:', err);
      setError(err.message || 'Failed to load participant Medicare plan');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!currentPlan || !confirm('Are you sure you want to delete this Medicare plan enrollment?')) {
      return;
    }

    setIsDeletingPlan(true);
    try {
      const { error: deleteError } = await supabase
        .from('participant_medicare_plans')
        .delete()
        .eq('id', currentPlan.id);

      if (deleteError) {
        throw deleteError;
      }

      router.push(`/participants/${participantId}`);
    } catch (err: any) {
      console.error('Error deleting participant Medicare plan:', err);
      alert('Failed to delete Medicare plan enrollment. Please try again.');
    } finally {
      setIsDeletingPlan(false);
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

  const calculateRateStatus = (startDate: string | null, endDate: string | null): 'Pending' | 'Active' | 'Ended' => {
    if (!startDate) return 'Ended';
    
    const today = new Date().toISOString().split('T')[0];
    const start = new Date(startDate).toISOString().split('T')[0];
    
    // If start date is in the future, it's Pending
    if (start > today) {
      return 'Pending';
    }
    
    // If end date is null or in the future, it's Active
    if (!endDate || endDate >= today) {
      return 'Active';
    }
    
    // Otherwise, it's Ended
    return 'Ended';
  };

  // Find the current rate record from rateHistory with priority:
  // 1. Current rate (status "Active")
  // 2. Next pending rate (status "Pending", earliest start_date)
  // 3. Last rate (most recent by start_date)
  const getCurrentRateRecord = (): MedicareChildRate | null => {
    if (!rateHistory || rateHistory.length === 0) return null;

    // Categorize rates by status
    const activeRates: MedicareChildRate[] = [];
    const pendingRates: MedicareChildRate[] = [];
    const endedRates: MedicareChildRate[] = [];

    rateHistory.forEach(rate => {
      const status = calculateRateStatus(rate.start_date, rate.end_date);

      if (status === 'Active') {
        activeRates.push(rate);
      } else if (status === 'Pending') {
        pendingRates.push(rate);
      } else {
        endedRates.push(rate);
      }
    });

    // Priority 1: Return the most recent active rate (by start_date, then by created_at if available)
    if (activeRates.length > 0) {
      return activeRates.reduce((latest, current) => {
        const currentStart = current.start_date ? new Date(current.start_date).getTime() : 0;
        const latestStart = latest.start_date ? new Date(latest.start_date).getTime() : 0;
        return currentStart > latestStart ? current : latest;
      });
    }

    // Priority 2: Return the next pending rate (earliest start_date)
    if (pendingRates.length > 0) {
      return pendingRates.reduce((earliest, current) => {
        const currentStart = current.start_date 
          ? new Date(current.start_date).getTime() 
          : Infinity;
        const earliestStart = earliest.start_date 
          ? new Date(earliest.start_date).getTime() 
          : Infinity;
        return currentStart < earliestStart ? current : earliest;
      });
    }

    // Priority 3: Return the last rate (most recent by start_date)
    if (endedRates.length > 0) {
      return endedRates.reduce((latest, current) => {
        const currentStart = current.start_date ? new Date(current.start_date).getTime() : 0;
        const latestStart = latest.start_date ? new Date(latest.start_date).getTime() : 0;
        return currentStart > latestStart ? current : latest;
      });
    }

    return null;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            Loading Medicare plan details...
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
            Error: {error || 'Medicare plan not found'}
          </p>
              <div className="flex justify-center mt-4">
            <GlassButton variant="outline" onClick={() => router.push(`/participants/${participantId}`)}>
              Back to Participant
            </GlassButton>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
            Medicare Plan Enrollment
          </h1>
          <p className="text-[var(--glass-gray-medium)]">
            {currentPlan.participant?.client_name} - {currentPlan.medicare_plan?.plan_name || 'Unnamed Plan'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <GlassButton 
            variant="outline" 
            onClick={() => router.push(`/participants/${participantId}`)}
          >
            Back to Participant
          </GlassButton>
          {!isEditMode && (
            <GlassButton 
              variant="primary" 
              onClick={() => setIsEditMode(true)}
            >
              Edit
            </GlassButton>
          )}
        </div>
      </div>

      <GlassCard className="mb-6">
        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-4">
              Plan Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[var(--glass-gray-medium)] mb-1">
                  Participant
                </label>
                <p className="text-[var(--glass-black-dark)] font-medium">
                  {currentPlan.participant?.client_name || 'N/A'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--glass-gray-medium)] mb-1">
                  Medicare Plan
                </label>
                <p className="text-[var(--glass-black-dark)] font-medium">
                  {currentPlan.medicare_plan?.plan_name || 'N/A'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--glass-gray-medium)] mb-1">
                  Provider
                </label>
                <p className="text-[var(--glass-black-dark)] font-medium">
                  {currentPlan.medicare_plan?.provider?.name || 'N/A'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--glass-gray-medium)] mb-1">
                  Effective Date
                </label>
                <p className="text-[var(--glass-black-dark)] font-medium">
                  {formatDate(currentPlan.effective_date)}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-white/20 pt-6">
            <h2 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-4">
              Rate Information
            </h2>
            
            {/* Current Rate Display */}
            {(() => {
              const currentRateRecord = getCurrentRateRecord();
              const currentRate = currentRateRecord?.rate || null;
              const displayRate = currentPlan.rate_override !== null 
                ? currentPlan.rate_override 
                : currentRate;
              
              if (displayRate === null) return null;
              
              return (
                <div className="mb-6 p-4 bg-[var(--glass-primary)]/10 border border-[var(--glass-primary)]/20 rounded-xl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-[var(--glass-gray-medium)] mb-1">
                        Current Rate
                      </label>
                      <p className="text-[var(--glass-black-dark)] font-medium text-lg">
                        ${displayRate.toFixed(2)}
                      </p>
                      {currentPlan.rate_override === null && currentRateRecord && (
                        <p className="text-xs text-[var(--glass-gray-medium)] mt-1">
                          {calculateRateStatus(currentRateRecord.start_date, currentRateRecord.end_date) === 'Active' 
                            ? 'Current rate' 
                            : calculateRateStatus(currentRateRecord.start_date, currentRateRecord.end_date) === 'Pending'
                            ? 'Next pending rate'
                            : 'Last rate'}
                        </p>
                      )}
                    </div>
                    {currentPlan.rate_override !== null && (
                      <div>
                        <label className="block text-sm font-semibold text-[var(--glass-gray-medium)] mb-1">
                          Rate Override
                        </label>
                        <p className="text-[var(--glass-black-dark)] font-medium text-lg">
                          ${currentPlan.rate_override.toFixed(2)}
                        </p>
                        <p className="text-xs text-[var(--glass-gray-medium)] mt-1">Custom override</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Rate History Section - Organized by Pending, Active, Ended */}
            <div className="pt-4">
              <h4 className="text-sm font-semibold text-[var(--glass-black-dark)] mb-3">
                Rate History
              </h4>
              {(() => {
                const allRates = rateHistory || [];
                
                // Group rates by status
                const pendingRates = allRates.filter(rateRecord => {
                  const status = calculateRateStatus(rateRecord.start_date, rateRecord.end_date);
                  return status === 'Pending';
                });
                
                const activeRates = allRates.filter(rateRecord => {
                  const status = calculateRateStatus(rateRecord.start_date, rateRecord.end_date);
                  return status === 'Active';
                });
                
                const endedRates = allRates.filter(rateRecord => {
                  const status = calculateRateStatus(rateRecord.start_date, rateRecord.end_date);
                  return status === 'Ended';
                });
                
                // Sort each group: Pending and Active by start_date descending (newest first), Ended by start_date descending (most recent ended first)
                const sortedPendingRates = [...pendingRates].sort((a, b) => {
                  const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
                  const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
                  return dateB - dateA;
                });
                
                const sortedActiveRates = [...activeRates].sort((a, b) => {
                  const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
                  const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
                  return dateB - dateA;
                });
                
                const sortedEndedRates = [...endedRates].sort((a, b) => {
                  const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
                  const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
                  return dateB - dateA;
                });
                
                const statusColors: Record<'Pending' | 'Active' | 'Ended', string> = {
                  Pending: 'bg-blue-500/10 border-blue-500/20 text-blue-700',
                  Active: 'bg-green-500/10 border-green-500/20 text-green-700',
                  Ended: 'bg-gray-500/10 border-gray-500/20 text-gray-700'
                };
                
                const renderRateCard = (rateRecord: MedicareChildRate, status: 'Pending' | 'Active' | 'Ended') => (
                  <div
                    key={rateRecord.id}
                    className={`glass-card rounded-lg p-3 border ${statusColors[status]} transition-all`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="font-semibold">Status: </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          status === 'Pending' ? 'bg-blue-500/20 text-blue-700' :
                          status === 'Active' ? 'bg-green-500/20 text-green-700' :
                          'bg-gray-500/20 text-gray-700'
                        }`}>
                          {status}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold">Rate Start Date: </span>
                        <span>{rateRecord.start_date ? (() => {
                          const dateOnlyMatch = rateRecord.start_date.match(/^(\d{4})-(\d{2})-(\d{2})/);
                          return dateOnlyMatch 
                            ? new Date(parseInt(dateOnlyMatch[1]), parseInt(dateOnlyMatch[2]) - 1, parseInt(dateOnlyMatch[3])).toLocaleDateString()
                            : new Date(rateRecord.start_date).toLocaleDateString();
                        })() : 'N/A'}</span>
                      </div>
                      <div>
                        <span className="font-semibold">Rate End Date: </span>
                        <span>{rateRecord.end_date ? (() => {
                          const dateOnlyMatch = rateRecord.end_date.match(/^(\d{4})-(\d{2})-(\d{2})/);
                          return dateOnlyMatch 
                            ? new Date(parseInt(dateOnlyMatch[1]), parseInt(dateOnlyMatch[2]) - 1, parseInt(dateOnlyMatch[3])).toLocaleDateString()
                            : new Date(rateRecord.end_date).toLocaleDateString();
                        })() : 'Ongoing'}</span>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-[var(--glass-gray-medium)]">
                      <span className="font-semibold">Rate: </span>
                      <span>${rateRecord.rate.toFixed(2)}</span>
                    </div>
                  </div>
                );
                
                if (allRates.length === 0) {
                  return (
                    <p className="text-sm text-[var(--glass-gray-medium)]">No rate history records found.</p>
                  );
                }
                
                return (
                  <div className="space-y-4">
                    {/* Pending Rates Section */}
                    {sortedPendingRates.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold text-[var(--glass-gray-medium)] mb-2 uppercase tracking-wide">
                          Pending
                        </h5>
                        <div className="space-y-3">
                          {sortedPendingRates.map(rateRecord => renderRateCard(rateRecord, 'Pending'))}
                        </div>
                      </div>
                    )}
                    
                    {/* Active Rates Section */}
                    {sortedActiveRates.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold text-[var(--glass-gray-medium)] mb-2 uppercase tracking-wide">
                          Active
                        </h5>
                        <div className="space-y-3">
                          {sortedActiveRates.map(rateRecord => renderRateCard(rateRecord, 'Active'))}
                        </div>
                      </div>
                    )}
                    
                    {/* Ended Rates Section */}
                    {sortedEndedRates.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold text-[var(--glass-gray-medium)] mb-2 uppercase tracking-wide">
                          Ended
                        </h5>
                        <div className="space-y-3">
                          {sortedEndedRates.map(rateRecord => renderRateCard(rateRecord, 'Ended'))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="border-t border-white/20 pt-6">
            <h2 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-4">
              Record Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[var(--glass-gray-medium)] mb-1">
                  Record ID
                </label>
                <p className="text-[var(--glass-black-dark)] font-mono text-sm">
                  {currentPlan.id}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--glass-gray-medium)] mb-1">
                  Created At
                </label>
                <p className="text-[var(--glass-black-dark)] font-medium">
                  {formatDate(currentPlan.created_at)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--glass-gray-medium)] mb-1">
                  Last Updated
                </label>
                <p className="text-[var(--glass-black-dark)] font-medium">
                  {formatDate(currentPlan.updated_at)}
                </p>
              </div>
            </div>
          </div>

          {isEditMode && (
            <div className="border-t border-white/20 pt-6">
              <div className="bg-yellow-500/20 border border-yellow-500/40 rounded-xl p-4 mb-4">
                <p className="text-sm font-semibold text-yellow-700 text-center">
                  Edit mode coming soon. For now, you can delete and recreate the enrollment.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <GlassButton 
                  variant="outline" 
                  onClick={() => setIsEditMode(false)}
                >
                  Cancel
                </GlassButton>
                <GlassButton 
                  variant="primary" 
                  onClick={handleDelete}
                  disabled={isDeletingPlan}
                >
                  {isDeletingPlan ? 'Deleting...' : 'Delete Enrollment'}
                </GlassButton>
              </div>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

