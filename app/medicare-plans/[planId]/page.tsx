'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import GlassCard from '../../../components/GlassCard';
import GlassButton from '../../../components/GlassButton';
import { supabase } from '../../../lib/supabase';

interface MedicarePlan {
  id: string;
  provider_id: string;
  plan_name: string;
  created_at: string;
  updated_at: string;
  provider_name?: string;
}

interface MedicareChildRate {
  id: string;
  medicare_plan_id: string;
  rate: number;
  start_date: string;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

interface Provider {
  id: string;
  name: string;
}

interface PlanParticipant {
  id: string;
  participant_id: string;
  medicare_plan_id: string;
  participant: {
    id: string;
    client_name: string;
    dob: string | null;
    phone_number: string | null;
    email_address: string | null;
  };
}

export default function ViewMedicarePlanPage() {
  const router = useRouter();
  const params = useParams();
  const planId = (params?.planId ?? '') as string;

  const [plan, setPlan] = useState<MedicarePlan | null>(null);
  const [childRates, setChildRates] = useState<MedicareChildRate[]>([]);
  const [editingRate, setEditingRate] = useState<{ rate: string; start_date: string } | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    plan_name: '',
    provider_id: '',
  });
  const [loading, setLoading] = useState(true);
  const [loadingRates, setLoadingRates] = useState(true);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [participants, setParticipants] = useState<PlanParticipant[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateToDelete, setRateToDelete] = useState<MedicareChildRate | null>(null);
  const [isDeletingRate, setIsDeletingRate] = useState(false);

  useEffect(() => {
    if (planId) {
      fetchPlan();
      fetchChildRates();
      fetchProviders();
      fetchParticipants();
    } else {
      setError('Plan ID is missing');
      setLoading(false);
      setLoadingRates(false);
    }
  }, [planId]);

  // Prevent navigation when there are unsaved rate changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (editingRate) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [editingRate]);

  const fetchPlan = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!planId) {
        throw new Error('Plan ID is required');
      }

      // Fetch plan
      const { data: planData, error: planError } = await supabase
        .from('medicare_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (planError) {
        throw planError;
      }

      if (!planData) {
        throw new Error('Plan not found');
      }

      // Fetch provider name
      const providerMap = new Map<string, string>();

      if (planData.provider_id) {
        const { data: providerData } = await supabase
          .from('providers')
          .select('id, name')
          .eq('id', planData.provider_id)
          .single();
        
        if (providerData) {
          providerMap.set(providerData.id, providerData.name);
        }
      }

      // Transform plan with provider name
      const transformedPlan: MedicarePlan = {
        ...planData,
        provider_name: planData.provider_id ? providerMap.get(planData.provider_id) : undefined,
      };

      setPlan(transformedPlan);
      
      // Initialize form data
      setFormData({
        plan_name: planData.plan_name || '',
        provider_id: planData.provider_id || '',
      });
    } catch (err: any) {
      console.error('Error fetching plan:', {
        message: err?.message || 'Unknown error',
        details: err,
        code: err?.code,
        hint: err?.hint,
        details_full: JSON.stringify(err, Object.getOwnPropertyNames(err))
      });
      const errorMessage = err?.message || err?.hint || 'Failed to load plan';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchChildRates = async () => {
    try {
      setLoadingRates(true);

      if (!planId) {
        return;
      }

      // Fetch child rates for this plan
      const { data: ratesData, error: ratesError } = await supabase
        .from('medicare_child_rates')
        .select('*')
        .eq('medicare_plan_id', planId)
        .order('start_date', { ascending: false });

      if (ratesError) {
        throw ratesError;
      }

      setChildRates(ratesData || []);
    } catch (err: any) {
      console.error('Error fetching child rates:', err);
    } finally {
      setLoadingRates(false);
    }
  };

  const fetchParticipants = async () => {
    try {
      setLoadingParticipants(true);

      if (!planId) {
        return;
      }

      const { data, error } = await supabase
        .from('participant_medicare_plans')
        .select(`
          id,
          participant_id,
          medicare_plan_id,
          participant:participants (
            id,
            client_name,
            dob,
            phone_number,
            email_address
          )
        `)
        .eq('medicare_plan_id', planId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Deduplicate: Only keep one record per participant (most recent)
      const uniqueParticipantsMap = new Map<string, PlanParticipant>();
      (data || []).forEach((planParticipant: any) => {
        if (!uniqueParticipantsMap.has(planParticipant.participant_id)) {
          uniqueParticipantsMap.set(planParticipant.participant_id, planParticipant);
        }
      });

      setParticipants(Array.from(uniqueParticipantsMap.values()) as PlanParticipant[]);
    } catch (err: any) {
      console.error('Error fetching participants:', err);
    } finally {
      setLoadingParticipants(false);
    }
  };

  const fetchProviders = async () => {
    try {
      setLoadingProviders(true);
      const { data, error } = await supabase
        .from('providers')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      setProviders(data || []);
    } catch (error) {
      console.error('Error fetching providers:', error);
    } finally {
      setLoadingProviders(false);
    }
  };

  const formatDateForInput = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
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

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  // Helper function to calculate rate status based on dates
  const calculateRateStatus = (startDate: string, endDate: string | null): 'Pending' | 'Active' | 'Ended' => {
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
    
    // Otherwise it's Ended
    return 'Ended';
  };

  const isPlanActive = () => {
    // Plan is always considered active (no termination date field)
    return true;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
      if (!planId) {
        throw new Error('Plan ID is required');
      }

      // Prepare data for update
      const updateData: any = {
        plan_name: formData.plan_name,
        provider_id: formData.provider_id || null,
      };

      // Update plan in database (only if in edit mode)
      if (isEditMode) {
        const { data, error: updateError } = await supabase
          .from('medicare_plans')
          .update(updateData)
          .eq('id', planId)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }
      }


      // Refresh plan data
      await fetchPlan();

      if (isEditMode) {
        setIsEditMode(false);
      }
      alert('Plan saved successfully!');
    } catch (err: any) {
      console.error('Error saving plan:', err);
      alert('Failed to save plan. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleEditClick = () => {
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    if (hasUnsavedRateChanges()) {
      if (!confirm('You have unsaved rate changes. Are you sure you want to cancel?')) {
        return;
      }
    }
    setIsEditMode(false);
    // Reset form data to original values
    if (plan) {
      setFormData({
        plan_name: plan.plan_name || '',
        provider_id: plan.provider_id || '',
      });
    }
    // Clear editing rate
    setEditingRate(null);
  };

  const handleDeleteRate = async () => {
    if (!rateToDelete) return;

    try {
      setIsDeletingRate(true);

      // Check if any participants are using this rate
      const { data: participantPlans, error: checkError } = await supabase
        .from('participant_medicare_plans')
        .select('id')
        .eq('medicare_child_rate_id', rateToDelete.id)
        .limit(1);

      if (checkError) {
        throw checkError;
      }

      if (participantPlans && participantPlans.length > 0) {
        alert('Cannot delete this rate because it is currently assigned to one or more participants. Please remove the rate from all participants first.');
        setRateToDelete(null);
        return;
      }

      const { error: deleteError } = await supabase
        .from('medicare_child_rates')
        .delete()
        .eq('id', rateToDelete.id);

      if (deleteError) {
        throw deleteError;
      }

      // Refresh child rates
      await fetchChildRates();

      // Close dialog
      setRateToDelete(null);

      alert('Rate deleted successfully!');
    } catch (err: any) {
      console.error('Error deleting rate:', {
        message: err?.message || 'Unknown error',
        details: err,
        code: err?.code,
        hint: err?.hint,
        details_full: JSON.stringify(err, Object.getOwnPropertyNames(err))
      });
      const errorMessage = err?.message || err?.hint || 'Failed to delete rate. Please try again.';
      alert(`Failed to delete rate: ${errorMessage}`);
    } finally {
      setIsDeletingRate(false);
    }
  };

  const handleAddRate = () => {
    const today = new Date().toISOString().split('T')[0];
    setEditingRate({ rate: '', start_date: today });
  };

  const handleRateEdit = (rate: MedicareChildRate) => {
    setEditingRate({ 
      rate: rate.rate.toString(), 
      start_date: formatDateForInput(rate.start_date) 
    });
  };

  const handleRateChange = (field: 'rate' | 'start_date', value: string) => {
    if (editingRate) {
      setEditingRate({ ...editingRate, [field]: value });
    }
  };

  const handleRateSave = async () => {
    if (!editingRate || !editingRate.rate || isNaN(parseFloat(editingRate.rate))) {
      alert('Please enter a valid rate');
      return;
    }

    if (!editingRate.start_date) {
      alert('Please enter a start date');
      return;
    }

    setIsSubmitting(true);

    try {
      if (!planId) {
        throw new Error('Plan ID is required');
      }

      const newRate = parseFloat(editingRate.rate);
      const newStartDate = editingRate.start_date;

      // Get the current active rate (no end_date)
      const activeRate = childRates.find(rate => !rate.end_date);

      // If there's an active rate, set its end_date to the day before the new start_date
      if (activeRate) {
        const newStartDateObj = new Date(newStartDate);
        const dayBefore = new Date(newStartDateObj);
        dayBefore.setDate(dayBefore.getDate() - 1);
        const dayBeforeStr = dayBefore.toISOString().split('T')[0];

        const { error: updateError } = await supabase
          .from('medicare_child_rates')
          .update({ end_date: dayBeforeStr })
          .eq('id', activeRate.id);

        if (updateError) {
          throw updateError;
        }
      }

      // Create new rate record
      const { data: newRateData, error: insertError } = await supabase
        .from('medicare_child_rates')
        .insert([{
          medicare_plan_id: planId,
          rate: newRate,
          start_date: newStartDate,
          end_date: null,
        }])
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Note: Participant connections to new rates are now handled through the renewal automation
      // This automation was disabled to allow manual control through renewals

      // Clear editing state and refresh rates
      setEditingRate(null);
      await fetchChildRates();
    } catch (err: any) {
      console.error('Error saving rate:', {
        message: err?.message || 'Unknown error',
        details: err,
        code: err?.code,
        hint: err?.hint,
        details_full: JSON.stringify(err, Object.getOwnPropertyNames(err))
      });
      const errorMessage = err?.message || err?.hint || 'Failed to save rate. Please try again.';
      alert(`Failed to save rate: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasUnsavedRateChanges = () => {
    return editingRate !== null;
  };

  const handleBackClick = () => {
    if (hasUnsavedRateChanges()) {
      if (!confirm('You have unsaved rate changes. Are you sure you want to leave?')) {
        return;
      }
    }
    router.push('/medicare-plans');
  };

  const handleRateCancel = () => {
    setEditingRate(null);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            Loading plan...
          </p>
        </GlassCard>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="max-w-4xl mx-auto">
        <GlassCard>
          <p className="text-red-500 text-center py-8">
            {error || 'Plan not found'}
          </p>
          <div className="flex justify-center mt-4">
            <GlassButton variant="primary" onClick={() => router.push('/medicare-plans')}>
              Back to Medicare Plans
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
          onClick={handleBackClick}
          className="text-[var(--glass-secondary)] hover:text-[var(--glass-secondary-dark)] mb-4 flex items-center gap-2"
        >
          <span>←</span> Back to Medicare Plans
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
              {plan.plan_name}
            </h1>
            <p className="text-[var(--glass-gray-medium)]">
              View and edit Medicare plan details
            </p>
          </div>
          <span className="px-4 py-2 rounded-full text-sm font-semibold bg-green-500/20 text-green-700">
            Active
          </span>
        </div>
      </div>

      <GlassCard>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Plan Information Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-[var(--glass-black-dark)]">
                Plan Information
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
                    type="submit"
                    variant="primary"
                    disabled={isSubmitting}
                    className={isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Plan'}
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

            {/* Row 1: Plan Name and Provider */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="plan_name" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  Plan Name *
                </label>
                <input
                  type="text"
                  id="plan_name"
                  name="plan_name"
                  required
                  value={formData.plan_name}
                  onChange={handleChange}
                  disabled={!isEditMode}
                  className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                />
              </div>

              <div>
                <label htmlFor="provider_id" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  Provider
                </label>
                {loadingProviders ? (
                  <p className="text-[var(--glass-gray-medium)] text-sm py-2">Loading providers...</p>
                ) : (
                  <select
                    id="provider_id"
                    name="provider_id"
                    value={formData.provider_id}
                    onChange={handleChange}
                    disabled={!isEditMode || loadingProviders}
                    className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                  >
                    <option value="">Select provider</option>
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

          </div>

          {/* Rates Section */}
          <div className="pt-6 border-t border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-[var(--glass-black-dark)]">
                Rates
              </h2>
              <GlassButton
                variant="primary"
                type="button"
                onClick={handleAddRate}
                disabled={editingRate !== null}
              >
                + Add Rate
              </GlassButton>
            </div>

            {/* Add/Edit Rate Form */}
            {editingRate && (
              <div className="mb-6 glass-card rounded-xl p-4 bg-blue-500/10 border border-blue-500/20">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                        Rate *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingRate.rate}
                        onChange={(e) => handleRateChange('rate', e.target.value)}
                        className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                        placeholder="Enter rate"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                        Start Date *
                      </label>
                      <input
                        type="date"
                        value={editingRate.start_date}
                        onChange={(e) => handleRateChange('start_date', e.target.value)}
                        className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleRateSave}
                      disabled={isSubmitting}
                      className="px-4 py-3 rounded-full font-semibold bg-green-500 text-white hover:bg-green-600 shadow-lg hover:shadow-xl transition-all duration-300 whitespace-nowrap"
                    >
                      {isSubmitting ? 'Saving...' : 'Save Rate'}
                    </button>
                    <button
                      type="button"
                      onClick={handleRateCancel}
                      disabled={isSubmitting}
                      className="px-4 py-3 rounded-full font-semibold bg-[#C6282B] text-white hover:bg-[#A01F22] shadow-lg hover:shadow-xl transition-all duration-300 whitespace-nowrap"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loadingRates ? (
              <p className="text-[var(--glass-gray-medium)] text-center py-4">
                Loading rates...
              </p>
            ) : childRates.length === 0 ? (
              <p className="text-[var(--glass-gray-medium)] text-center py-4">
                No rates configured for this plan
              </p>
            ) : (() => {
              // Group rates by status
              const pendingRates = childRates.filter(rate => {
                const status = calculateRateStatus(rate.start_date, rate.end_date);
                return status === 'Pending';
              });
              
              const activeRates = childRates.filter(rate => {
                const status = calculateRateStatus(rate.start_date, rate.end_date);
                return status === 'Active';
              });
              
              const endedRates = childRates.filter(rate => {
                const status = calculateRateStatus(rate.start_date, rate.end_date);
                return status === 'Ended';
              });
              
              // Sort each group by start_date descending (newest first)
              const sortedPendingRates = [...pendingRates].sort((a, b) => 
                new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
              );
              
              const sortedActiveRates = [...activeRates].sort((a, b) => 
                new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
              );
              
              const sortedEndedRates = [...endedRates].sort((a, b) => 
                new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
              );
              
              const statusColors: Record<'Pending' | 'Active' | 'Ended', string> = {
                Pending: 'bg-blue-500/10 border-blue-500/20',
                Active: 'bg-green-500/10 border-green-500/20',
                Ended: 'bg-gray-500/10 border-gray-500/20'
              };
              
              const statusBadgeColors: Record<'Pending' | 'Active' | 'Ended', string> = {
                Pending: 'bg-blue-500/20 text-blue-700',
                Active: 'bg-green-500/20 text-green-700',
                Ended: 'bg-gray-500/20 text-gray-700'
              };
              
              const renderRateCard = (rate: MedicareChildRate, status: 'Pending' | 'Active' | 'Ended') => (
                <div
                  key={rate.id}
                  className={`glass-card rounded-xl p-4 border ${statusColors[status]}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-[var(--glass-black-dark)] text-lg">
                        {formatCurrency(rate.rate)}
                      </span>
                      <span className="text-sm text-[var(--glass-gray-medium)]">
                        {formatDate(rate.start_date)} - {rate.end_date ? formatDate(rate.end_date) : 'Ongoing'}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusBadgeColors[status]}`}>
                        {status}
                      </span>
                    </div>
                    {isEditMode && (
                      <div className="flex items-center gap-2">
                        {status === 'Active' && (
                          <button
                            type="button"
                            onClick={() => handleRateEdit(rate)}
                            className="px-4 py-2 rounded-full font-semibold bg-[var(--glass-secondary)] text-white hover:bg-[var(--glass-secondary-dark)] shadow-lg hover:shadow-xl transition-all duration-300 whitespace-nowrap"
                          >
                            Edit Rate
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setRateToDelete(rate)}
                          className="text-red-500 hover:text-red-600 transition-colors duration-200 flex-shrink-0"
                          title="Delete rate"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
              
              return (
                <div className="space-y-4">
                  {/* Pending Rates Section */}
                  {sortedPendingRates.length > 0 && (
                    <div>
                      <h5 className="text-xs font-semibold text-[var(--glass-gray-medium)] mb-2 uppercase tracking-wide">
                        Pending
                      </h5>
                      <div className="space-y-3">
                        {sortedPendingRates.map(rate => renderRateCard(rate, 'Pending'))}
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
                        {sortedActiveRates.map(rate => renderRateCard(rate, 'Active'))}
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
                        {sortedEndedRates.map(rate => renderRateCard(rate, 'Ended'))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </form>

        {/* Participants Section */}
        <div className="pt-6 border-t border-white/20 mt-6">
          <h2 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-6">
            Participants on this Plan
          </h2>

          {loadingParticipants ? (
            <p className="text-[var(--glass-gray-medium)] text-center py-4">
              Loading participants...
            </p>
          ) : participants.length === 0 ? (
            <p className="text-[var(--glass-gray-medium)] text-center py-4">
              No participants assigned to this plan
            </p>
          ) : (
            <div className="space-y-3">
              {participants.map((planParticipant) => (
                <div
                  key={planParticipant.id}
                  onClick={() => router.push(`/participants/${planParticipant.participant_id}`)}
                  className="glass-card rounded-xl p-4 bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-[var(--glass-black-dark)] text-lg mb-2">
                        {planParticipant.participant?.client_name || 'Unknown Participant'}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {planParticipant.participant?.dob && (
                          <div>
                            <span className="text-[var(--glass-gray-medium)]">Date of Birth: </span>
                            <span className="text-[var(--glass-black-dark)] font-medium">
                              {formatDate(planParticipant.participant.dob)}
                            </span>
                          </div>
                        )}
                        {planParticipant.participant?.phone_number && (
                          <div>
                            <span className="text-[var(--glass-gray-medium)]">Phone: </span>
                            <span className="text-[var(--glass-black-dark)] font-medium">
                              {planParticipant.participant.phone_number}
                            </span>
                          </div>
                        )}
                        {planParticipant.participant?.email_address && (
                          <div>
                            <span className="text-[var(--glass-gray-medium)]">Email: </span>
                            <span className="text-[var(--glass-black-dark)] font-medium">
                              {planParticipant.participant.email_address}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </GlassCard>

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
                className="px-6 py-3 rounded-full font-semibold bg-[#C6282B] text-white hover:bg-[#A01F22] shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRate}
                disabled={isDeletingRate}
                className="px-6 py-3 rounded-full font-semibold bg-[#C6282B] text-white hover:bg-[#A01F22] shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeletingRate ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


