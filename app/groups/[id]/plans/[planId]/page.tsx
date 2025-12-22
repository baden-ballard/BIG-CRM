'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import * as XLSX from 'xlsx';
import GlassCard from '../../../../../components/GlassCard';
import GlassButton from '../../../../../components/GlassButton';
import { supabase } from '../../../../../lib/supabase';

interface GroupPlan {
  id: string;
  group_id: string;
  program_id: string | null;
  provider_id: string | null;
  plan_name: string;
  effective_date: string | null;
  termination_date: string | null;
  plan_type: string | null;
  employer_contribution_type: string | null;
  employer_contribution_value: number | null;
  employer_spouse_contribution_value: number | null;
  employer_child_contribution_value: number | null;
  created_at: string;
  updated_at: string;
  program_name?: string;
  provider_name?: string;
  group_name?: string;
  number_of_classes?: number;
}

interface GroupPlanOption {
  id: string;
  group_plan_id: string;
  option: string;
  created_at: string;
  updated_at: string;
}

interface GroupOptionRate {
  id: string;
  group_plan_option_id: string;
  rate: number;
  start_date: string;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  option_name?: string;
  amount_paid_by_employer?: number;
  employee_responsible_amount?: number;
}

interface PlanOptionWithRates extends GroupPlanOption {
  rates: GroupOptionRate[];
  activeRate: GroupOptionRate | null;
}

interface Program {
  id: string;
  name: string;
}

interface Provider {
  id: string;
  name: string;
}

interface PlanParticipant {
  id: string;
  participant_id: string;
  group_plan_id: string;
  participant: {
    id: string;
    client_name: string;
    dob: string | null;
    phone_number: string | null;
    email_address: string | null;
  };
}

export default function ViewGroupPlanPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = (params?.id ?? '') as string;
  const planId = (params?.planId ?? '') as string;

  const [plan, setPlan] = useState<GroupPlan | null>(null);
  const [planOptions, setPlanOptions] = useState<PlanOptionWithRates[]>([]);
  const [newOptions, setNewOptions] = useState<Array<{ id: string; option: string; rate: string; class_1_contribution_amount: string; class_2_contribution_amount: string; class_3_contribution_amount: string; }>>([]);
  const [editingRates, setEditingRates] = useState<Map<string, { rate: string; start_date: string }>>(new Map());
  const [showAddOptionForm, setShowAddOptionForm] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [filteredProviders, setFilteredProviders] = useState<Provider[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    plan_name: '',
    program_id: '',
    provider_id: '',
    effective_date: '',
    termination_date: '',
    plan_type: '',
    employer_contribution_type: '',
    employer_contribution_value: '',
    employer_spouse_contribution_value: '',
    employer_child_contribution_value: '',
  });
  const [contributionChangeDate, setContributionChangeDate] = useState('');
  const [originalContributionValues, setOriginalContributionValues] = useState({
    employer_contribution_type: '',
    employer_contribution_value: '',
    employer_spouse_contribution_value: '',
    employer_child_contribution_value: '',
  });
  const [loading, setLoading] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [participants, setParticipants] = useState<PlanParticipant[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateToDelete, setRateToDelete] = useState<GroupOptionRate | null>(null);
  const [isDeletingRate, setIsDeletingRate] = useState(false);
  const [showCsvUploadModal, setShowCsvUploadModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvRateStartDate, setCsvRateStartDate] = useState('');
  const [csvRateEndDate, setCsvRateEndDate] = useState('');
  const [isUploadingRates, setIsUploadingRates] = useState(false);
  const [showAgeRateHistories, setShowAgeRateHistories] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    'participants': true,
  });

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  useEffect(() => {
    if (planId && groupId) {
      fetchPlan();
      fetchPlanOptions();
      fetchPrograms();
      fetchProviders();
      fetchParticipants();
    } else {
      setError('Plan ID or Group ID is missing');
      setLoading(false);
      setLoadingOptions(false);
    }
  }, [planId, groupId]);

  // Prevent navigation when there are unsaved rate changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (editingRates.size > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [editingRates]);

  useEffect(() => {
    // Filter providers based on selected program
    if (formData.program_id && providers.length > 0) {
      filterProvidersByProgram(formData.program_id);
    } else {
      setFilteredProviders([]);
    }
  }, [formData.program_id, providers]);

  const fetchPlan = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!planId) {
        throw new Error('Plan ID is required');
      }

      // Fetch plan
      const { data: planData, error: planError } = await supabase
        .from('group_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (planError) {
        throw planError;
      }

      if (!planData) {
        throw new Error('Plan not found');
      }

      // Fetch related names
      const programMap = new Map<string, string>();
      const providerMap = new Map<string, string>();
      const groupMap = new Map<string, string>();

      if (planData.program_id) {
        const { data: programData } = await supabase
          .from('programs')
          .select('id, name')
          .eq('id', planData.program_id)
          .single();
        if (programData) {
          programMap.set(programData.id, programData.name);
        }
      }

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

      let numberOfClasses: number | undefined;
      if (planData.group_id) {
        const { data: groupData } = await supabase
          .from('groups')
          .select('id, name, number_of_classes')
          .eq('id', planData.group_id)
          .single();
        if (groupData) {
          groupMap.set(groupData.id, groupData.name);
          numberOfClasses = groupData.number_of_classes;
        }
      }

      // Transform plan with names
      const transformedPlan: GroupPlan = {
        ...planData,
        program_name: planData.program_id ? programMap.get(planData.program_id) : undefined,
        provider_name: planData.provider_id ? providerMap.get(planData.provider_id) : undefined,
        provider_name: planData.provider_id ? providerMap.get(planData.provider_id) : undefined,
        group_name: planData.group_id ? groupMap.get(planData.group_id) : undefined,
        number_of_classes: numberOfClasses,
      };

      setPlan(transformedPlan);
      // Initialize form data
      const initialFormData = {
        plan_name: planData.plan_name || '',
        program_id: planData.program_id || '',
        provider_id: planData.provider_id || '',
        effective_date: formatDateForInput(planData.effective_date),
        termination_date: formatDateForInput(planData.termination_date),
        plan_type: planData.plan_type || '',
        employer_contribution_type: planData.employer_contribution_type || '',
        employer_contribution_value: planData.employer_contribution_value?.toString() || '',
        employer_spouse_contribution_value: planData.employer_spouse_contribution_value?.toString() || '',
        employer_child_contribution_value: planData.employer_child_contribution_value?.toString() || '',
      };
      setFormData(initialFormData);
      // Store original contribution values for change detection
      setOriginalContributionValues({
        employer_contribution_type: planData.employer_contribution_type || '',
        employer_contribution_value: planData.employer_contribution_value?.toString() || '',
        employer_spouse_contribution_value: planData.employer_spouse_contribution_value?.toString() || '',
        employer_child_contribution_value: planData.employer_child_contribution_value?.toString() || '',
      });
    } catch (err: any) {
      console.error('Error fetching plan:', err);
      setError(err.message || 'Failed to load plan');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlanOptions = async () => {
    try {
      setLoadingOptions(true);

      if (!planId) {
        return;
      }

      // Fetch plan options
      const { data: optionsData, error: optionsError } = await supabase
        .from('group_plan_options')
        .select('*')
        .eq('group_plan_id', planId)
        .order('created_at', { ascending: true });

      if (optionsError) {
        throw optionsError;
      }

      if (!optionsData || optionsData.length === 0) {
        setPlanOptions([]);
        return;
      }

      // Fetch rates for each option
      const optionIds = optionsData.map((opt: any) => opt.id);
      const { data: ratesData, error: ratesError } = await supabase
        .from('group_option_rates')
        .select('*')
        .in('group_plan_option_id', optionIds)
        .order('start_date', { ascending: false });

      if (ratesError) {
        throw ratesError;
      }

      // Group rates by option and find active rates
      const now = new Date();
      const optionsWithRates: PlanOptionWithRates[] = optionsData.map((option: GroupPlanOption) => {
        const optionRates = (ratesData || []).filter(
          (rate: GroupOptionRate) => rate.group_plan_option_id === option.id
        );

        // Find active rate (no end_date - this is the current active rate)
        // Rates with end_date are historical rates, only rates without end_date are active
        const activeRate = optionRates.find(
          (rate: GroupOptionRate) => !rate.end_date
        ) || null;

        return {
          ...option,
          rates: optionRates,
          activeRate,
        };
      });

      setPlanOptions(optionsWithRates);
    } catch (err: any) {
      console.error('Error fetching plan options:', err);
    } finally {
      setLoadingOptions(false);
    }
  };

  const fetchParticipants = async () => {
    try {
      setLoadingParticipants(true);

      if (!planId) {
        return;
      }

      const { data, error } = await supabase
        .from('participant_group_plans')
        .select(`
          id,
          participant_id,
          group_plan_id,
          participant:participants (
            id,
            client_name,
            dob,
            phone_number,
            email_address
          )
        `)
        .eq('group_plan_id', planId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Deduplicate: Only keep one record per participant (most recent)
      // This handles any duplicate participant_group_plans records
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

  const fetchPrograms = async () => {
    try {
      setLoadingPrograms(true);
      if (!groupId) {
        setPrograms([]);
        return;
      }

      // First, get all group_programs entries for this group
      const { data: groupPrograms, error: junctionError } = await supabase
        .from('group_programs')
        .select('program_id')
        .eq('group_id', groupId);

      if (junctionError) {
        throw junctionError;
      }

      if (!groupPrograms || groupPrograms.length === 0) {
        setPrograms([]);
        return;
      }

      // Extract program IDs
      const programIds = groupPrograms.map((gp: any) => gp.program_id);

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
    } catch (error) {
      console.error('Error fetching programs:', error);
      setPrograms([]);
    } finally {
      setLoadingPrograms(false);
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

  const filterProvidersByProgram = async (programId: string) => {
    try {
      // Get providers associated with this program
      const { data: programProviders, error } = await supabase
        .from('program_providers')
        .select('provider_id')
        .eq('program_id', programId);

      if (error) {
        throw error;
      }

      if (!programProviders || programProviders.length === 0) {
        setFilteredProviders([]);
        return;
      }

      const providerIds = programProviders.map((pp: any) => pp.provider_id);
      const filtered = providers.filter(p => providerIds.includes(p.id));
      setFilteredProviders(filtered);
    } catch (error) {
      console.error('Error filtering providers:', error);
      setFilteredProviders([]);
    }
  };

  const formatDateForInput = (dateString: string | null) => {
    if (!dateString) return '';
    // If the date string is already in YYYY-MM-DD format, return it directly
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    // Otherwise, parse it carefully to avoid timezone shifts
    // Parse as local date to avoid UTC conversion issues
    const [year, month, day] = dateString.split('T')[0].split('-');
    if (year && month && day) {
      // Create date in local timezone to avoid shifts
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      const localYear = date.getFullYear();
      const localMonth = String(date.getMonth() + 1).padStart(2, '0');
      const localDay = String(date.getDate()).padStart(2, '0');
      return `${localYear}-${localMonth}-${localDay}`;
    }
    return dateString.split('T')[0]; // Fallback to ISO string without time
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    // Parse date string as local date to avoid timezone shifts
    // If it's in YYYY-MM-DD format, parse it as local date
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
    // Fallback for other formats
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
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

  const formatPercentage = (value: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    return `${value}%`;
  };

  const isPlanActive = () => {
    if (!plan) return false;
    return !plan.termination_date || new Date(plan.termination_date) > new Date();
  };

  // Handle contribution changes - create new participant_group_plan_rates records
  const handleContributionChange = async (
    groupPlanId: string,
    changeDate: string,
    changedTypes: string[]
  ) => {
    try {
      if (!plan) {
        throw new Error('Plan data is required');
      }

      // Calculate day before change date
      const [year, month, day] = changeDate.split('-');
      const changeDateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      const dayBefore = new Date(changeDateObj);
      dayBefore.setDate(dayBefore.getDate() - 1);
      const dayBeforeStr = `${dayBefore.getFullYear()}-${String(dayBefore.getMonth() + 1).padStart(2, '0')}-${String(dayBefore.getDate()).padStart(2, '0')}`;

      // Fetch all active participant_group_plans for this plan
      const { data: participantPlans, error: plansError } = await supabase
        .from('participant_group_plans')
        .select(`
          id,
          participant_id,
          dependent_id,
          dependents:dependent_id (
            id,
            relationship
          )
        `)
        .eq('group_plan_id', groupPlanId);

      if (plansError) {
        throw plansError;
      }

      if (!participantPlans || participantPlans.length === 0) {
        console.log('No participant plans found for this group plan');
        return;
      }

      // Process each participant plan
      for (const participantPlan of participantPlans) {
        // Determine which contribution type applies to this participant plan
        let contributionType: 'employee' | 'spouse' | 'child' | null = null;
        let contributionAmount: number | null = null;

        if (!participantPlan.dependent_id) {
          // Employee
          contributionType = 'employee';
          if (changedTypes.includes('employee')) {
            contributionAmount = formData.employer_contribution_value 
              ? parseFloat(formData.employer_contribution_value) 
              : null;
          }
        } else {
          // Check dependent relationship
          const dependent = (participantPlan as any).dependents;
          if (dependent) {
            if (dependent.relationship === 'Spouse') {
              contributionType = 'spouse';
              if (changedTypes.includes('spouse')) {
                contributionAmount = formData.employer_spouse_contribution_value 
                  ? parseFloat(formData.employer_spouse_contribution_value) 
                  : null;
              }
            } else if (dependent.relationship === 'Child') {
              contributionType = 'child';
              if (changedTypes.includes('child')) {
                contributionAmount = formData.employer_child_contribution_value 
                  ? parseFloat(formData.employer_child_contribution_value) 
                  : null;
              }
            }
          }
        }

        // Only process if this contribution type changed
        if (!contributionType || !changedTypes.includes(contributionType)) {
          continue;
        }

        // Find all participant_group_plan_rates records for this participant plan
        const { data: rateRecords, error: ratesError } = await supabase
          .from('participant_group_plan_rates')
          .select('*')
          .eq('participant_group_plan_id', participantPlan.id)
          .order('start_date', { ascending: false })
          .order('created_at', { ascending: false });

        if (ratesError) {
          console.error(`Error fetching rate records for participant plan ${participantPlan.id}:`, ratesError);
          continue;
        }

        if (!rateRecords || rateRecords.length === 0) {
          console.log(`No rate records found for participant plan ${participantPlan.id}`);
          continue;
        }

        // Find the most recent active record (no end_date or end_date is in the future)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const activeRecords = rateRecords.filter(record => {
          if (!record.end_date) return true;
          const endDate = new Date(record.end_date);
          endDate.setHours(0, 0, 0, 0);
          return endDate >= today;
        });

        // End previous active records
        for (const record of activeRecords) {
          // Only update if it doesn't already have an end_date before the change date
          if (!record.end_date || new Date(record.end_date) >= changeDateObj) {
            const { error: updateError } = await supabase
              .from('participant_group_plan_rates')
              .update({ end_date: dayBeforeStr })
              .eq('id', record.id);

            if (updateError) {
              console.error(`Error ending previous rate record ${record.id}:`, updateError);
            }
          }
        }

        // Create new records for each active rate (one per group_option_rate_id)
        const groupOptionRateIds = new Set(activeRecords.map(r => r.group_option_rate_id));
        for (const rateId of groupOptionRateIds) {
          const { error: insertError } = await supabase
            .from('participant_group_plan_rates')
            .insert({
              participant_group_plan_id: participantPlan.id,
              group_option_rate_id: rateId,
              employer_contribution_type: formData.employer_contribution_type || null,
              employer_contribution_amount: contributionAmount,
              start_date: changeDate,
              end_date: null,
            });

          if (insertError) {
            console.error(`Error creating new rate record for participant plan ${participantPlan.id}:`, insertError);
          }
        }
      }

      console.log(`Successfully updated contribution history for ${participantPlans.length} participant plan(s)`);
    } catch (err: any) {
      console.error('Error handling contribution change:', err);
      throw new Error(`Failed to update contribution history: ${err.message}`);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    // Clear spouse/child values if switching away from Age Banded plan type
    if (name === 'plan_type' && value !== 'Age Banded') {
      setFormData(prev => ({
        ...prev,
        employer_spouse_contribution_value: '',
        employer_child_contribution_value: '',
      }));
    }
  };

  // Check if any contribution fields have changed
  const hasContributionChanges = () => {
    if (!isEditMode) return false;
    return (
      formData.employer_contribution_type !== originalContributionValues.employer_contribution_type ||
      formData.employer_contribution_value !== originalContributionValues.employer_contribution_value ||
      formData.employer_spouse_contribution_value !== originalContributionValues.employer_spouse_contribution_value ||
      formData.employer_child_contribution_value !== originalContributionValues.employer_child_contribution_value
    );
  };

  // Determine which contribution types changed
  const getChangedContributionTypes = () => {
    const changes: string[] = [];
    if (formData.employer_contribution_type !== originalContributionValues.employer_contribution_type ||
        formData.employer_contribution_value !== originalContributionValues.employer_contribution_value) {
      changes.push('employee');
    }
    if (formData.employer_spouse_contribution_value !== originalContributionValues.employer_spouse_contribution_value) {
      changes.push('spouse');
    }
    if (formData.employer_child_contribution_value !== originalContributionValues.employer_child_contribution_value) {
      changes.push('child');
    }
    return changes;
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
      };

      // Add optional fields only if they have values
      if (formData.program_id) {
        updateData.program_id = formData.program_id;
      } else {
        updateData.program_id = null;
      }
      if (formData.provider_id) {
        updateData.provider_id = formData.provider_id;
      } else {
        updateData.provider_id = null;
      }
      if (formData.effective_date) {
        updateData.effective_date = formData.effective_date;
      } else {
        updateData.effective_date = null;
      }
      if (formData.termination_date) {
        updateData.termination_date = formData.termination_date;
      } else {
        updateData.termination_date = null;
      }
      if (formData.plan_type) {
        updateData.plan_type = formData.plan_type;
      } else {
        updateData.plan_type = null;
      }
      if (formData.employer_contribution_type) {
        updateData.employer_contribution_type = formData.employer_contribution_type;
      } else {
        updateData.employer_contribution_type = null;
      }
      if (formData.employer_contribution_value) {
        updateData.employer_contribution_value = parseFloat(formData.employer_contribution_value);
      } else {
        updateData.employer_contribution_value = null;
      }
      if (formData.employer_spouse_contribution_value) {
        updateData.employer_spouse_contribution_value = parseFloat(formData.employer_spouse_contribution_value);
      } else {
        updateData.employer_spouse_contribution_value = null;
      }
      if (formData.employer_child_contribution_value) {
        updateData.employer_child_contribution_value = parseFloat(formData.employer_child_contribution_value);
      } else {
        updateData.employer_child_contribution_value = null;
      }

      // Update plan in database (only if in edit mode)
      if (isEditMode) {
        // Check if contribution amounts changed
        const contributionChanged = hasContributionChanges();
        if (contributionChanged && !contributionChangeDate) {
          throw new Error('Contribution Amount Change Date is required when contribution amounts are changed');
        }

        const { data, error: updateError } = await supabase
          .from('group_plans')
          .update(updateData)
          .eq('id', planId)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        // Handle contribution changes - create new participant_group_plan_rates records
        if (contributionChanged && contributionChangeDate) {
          await handleContributionChange(planId, contributionChangeDate, getChangedContributionTypes());
        }
      }

      // Save new options if any
      if (newOptions.length > 0) {
        const optionsToInsert = newOptions
          .filter(opt => opt.option.trim() !== '')
          .map(opt => {
            return {
              group_plan_id: planId,
              option: opt.option.trim(),
            };
          });
        if (optionsToInsert.length > 0) {
          const { error: optionsError } = await supabase
            .from('group_plan_options')
            .insert(optionsToInsert);

          if (optionsError) {
            throw optionsError;
          }
        }
      }

      // Refresh plan data and options
      await fetchPlan();
      await fetchPlanOptions();

      // Clear new options and hide form
      setNewOptions([]);
      setShowAddOptionForm(false);

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

  const handleSaveOptions = async () => {
    setIsSubmitting(true);

    try {
      if (!planId || !plan) {
        throw new Error('Plan ID is required');
      }

      // Save new options if any
      if (newOptions.length > 0) {
        const validOptions = newOptions.filter(opt => opt.option.trim() !== '');
        if (validOptions.length > 0) {
          // Insert options
          const optionsToInsert = validOptions.map(opt => {
            return {
              option: opt.option.trim(),
            };
          });

          const { data: insertedOptions, error: optionsError } = await supabase
            .from('group_plan_options')
            .insert(optionsToInsert)
            .select();

          if (optionsError) {
            throw optionsError;
          }

          // If plan type is Composite or Age Banded, create rate records
          if ((plan.plan_type === 'Composite' || plan.plan_type === 'Age Banded') && insertedOptions) {
            const effectiveDate = plan.effective_date || new Date().toISOString().split('T')[0];
            const ratesToInsert = insertedOptions
              .map((insertedOpt, index) => {
                const originalOpt = validOptions[index];
                if (originalOpt.rate && !isNaN(parseFloat(originalOpt.rate))) {
                  return {
                    group_plan_option_id: insertedOpt.id,
                    rate: parseFloat(originalOpt.rate),
                    start_date: effectiveDate,
                    end_date: null,
                  };
                }
                return null;
                return null;
              })
              .filter(Boolean);

            if (ratesToInsert.length > 0) {
              const { error: ratesError } = await supabase
                .from('group_option_rates')
                .insert(ratesToInsert);

              if (ratesError) {
                throw ratesError;
              }
            }
          }
        }
      await fetchPlanOptions();
      }

      // Clear new options and hide form
      setNewOptions([]);
      setShowAddOptionForm(false);

      alert('Options saved successfully!');
    } catch (err: any) {
      console.error('Error saving options:', err);
      alert('Failed to save options. Please try again.');
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
      const resetFormData = {
        plan_name: plan.plan_name || '',
        program_id: plan.program_id || '',
        provider_id: plan.provider_id || '',
        effective_date: formatDateForInput(plan.effective_date),
        termination_date: formatDateForInput(plan.termination_date),
        plan_type: plan.plan_type || '',
        employer_contribution_type: plan.employer_contribution_type || '',
        employer_contribution_value: plan.employer_contribution_value?.toString() || '',
        employer_spouse_contribution_value: plan.employer_spouse_contribution_value?.toString() || '',
        employer_child_contribution_value: plan.employer_child_contribution_value?.toString() || '',
      };
      setFormData(resetFormData);
      setContributionChangeDate('');
      setOriginalContributionValues({
        employer_contribution_type: plan.employer_contribution_type || '',
        employer_contribution_value: plan.employer_contribution_value?.toString() || '',
        employer_spouse_contribution_value: plan.employer_spouse_contribution_value?.toString() || '',
        employer_child_contribution_value: plan.employer_child_contribution_value?.toString() || '',
      });
    }
    // Clear new options and hide form
    setNewOptions([]);
    setShowAddOptionForm(false);
    // Clear editing rates
    setEditingRates(new Map());
  };

  const handleDeleteRate = async () => {
    if (!rateToDelete) return;

    try {
      setIsDeletingRate(true);

      // Store the rate ID before deletion for verification
      const rateIdToDelete = rateToDelete.id;

      // Delete from group_option_rates table
      // The database will automatically cascade delete all related records
      // in participant_group_plan_rates junction table due to ON DELETE CASCADE constraint
      const { error: deleteError, data: deleteData } = await supabase
        .from('group_option_rates')
        .delete()
        .eq('id', rateIdToDelete)
        .select();

      if (deleteError) {
        throw deleteError;
      }

      // Verify deletion actually happened
      if (!deleteData || deleteData.length === 0) {
        throw new Error('Rate was not found or could not be deleted');
      }

      // Close dialog first to prevent multiple clicks
      setRateToDelete(null);

      // Small delay to ensure database has processed the deletion
      await new Promise(resolve => setTimeout(resolve, 100));

      // Refresh plan options to update rate history
      await fetchPlanOptions();

      // Double-check: verify the rate is actually gone
      const { data: verifyData } = await supabase
        .from('group_option_rates')
        .select('id')
        .eq('id', rateIdToDelete)
        .single();

      if (verifyData) {
        console.warn('Rate still exists after deletion - forcing refresh');
        // Force another refresh if rate still exists
        await fetchPlanOptions();
      }

      alert('Rate deleted successfully!');
    } catch (err: any) {
      console.error('Error deleting rate:', err);
      const errorMessage = err?.message || err?.details || 'Failed to delete rate. Please try again.';
      alert(`Failed to delete rate: ${errorMessage}`);
      // Don't close dialog on error so user can try again
    } finally {
      setIsDeletingRate(false);
    }
  };

  const handleAddOption = () => {
    const newId = `temp-${Date.now()}-${Math.random()}`;
    setNewOptions([...newOptions, { 
      id: newId, 
      option: '', 
      rate: '',
    }]);
    setShowAddOptionForm(true);
  };

  const handleRemoveOption = (id: string) => {
    const updatedOptions = newOptions.filter(opt => opt.id !== id);
    setNewOptions(updatedOptions);
    // Hide form if no more options
    if (updatedOptions.length === 0) {
      setShowAddOptionForm(false);
    }
  };

  const handleOptionChange = (id: string, field: 'option' | 'rate', value: string) => {
    setNewOptions(newOptions.map(opt => 
      opt.id === id ? { ...opt, [field]: value } : opt
    ));
  };

  const handleRateEdit = (optionId: string, currentRate: string) => {
    const option = planOptions.find(opt => opt.id === optionId);
    const planEffectiveDate = plan?.effective_date ? formatDateForInput(plan.effective_date) : '';
    const today = new Date().toISOString().split('T')[0];
    // Default start_date to today (or plan effective date if no rates exist)
    const defaultStartDate = option?.rates.length === 0 ? planEffectiveDate : today;
    setEditingRates(new Map(editingRates.set(optionId, { 
      rate: currentRate, 
      start_date: defaultStartDate 
    })));
  };

  const handleRateChange = (optionId: string, field: 'rate' | 'start_date', value: string) => {
    const current = editingRates.get(optionId) || { rate: '', start_date: '' };
    setEditingRates(new Map(editingRates.set(optionId, { 
      ...current, 
      [field]: value 
    })));
  };

  const handleRateSave = async (optionId: string) => {
    const editingRate = editingRates.get(optionId);
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
      if (!planId || !plan) {
        throw new Error('Plan ID is required');
      }

      const newRate = parseFloat(editingRate.rate);
      const newStartDate = editingRate.start_date;

      // Get the current active rate for this option
      const option = planOptions.find(opt => opt.id === optionId);
      if (!option) {
        throw new Error('Option not found');
      }

      const activeRate = option.activeRate;

      // If there's an active rate, set its end_date to the day before the new start_date
      if (activeRate && !activeRate.end_date) {
        // Parse the date string as local date to avoid timezone shifts
        const [year, month, day] = newStartDate.split('-');
        const newStartDateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const dayBefore = new Date(newStartDateObj);
        dayBefore.setDate(dayBefore.getDate() - 1);
        // Format as YYYY-MM-DD without timezone conversion
        const dayBeforeYear = dayBefore.getFullYear();
        const dayBeforeMonth = String(dayBefore.getMonth() + 1).padStart(2, '0');
        const dayBeforeDay = String(dayBefore.getDate()).padStart(2, '0');
        const dayBeforeStr = `${dayBeforeYear}-${dayBeforeMonth}-${dayBeforeDay}`;

        const { error: updateError } = await supabase
          .from('group_option_rates')
          .update({ end_date: dayBeforeStr })
          .eq('id', activeRate.id);

        if (updateError) {
          throw updateError;
        }
      }

      // Create new rate record
      const { data: newRateData, error: insertError } = await supabase
        .from('group_option_rates')
        .insert([{
          group_plan_option_id: option.id,
          rate: newRate,
          start_date: newStartDate,
          end_date: null,
        }])
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Automatically connect all active participants on this plan to the new rate
      // Only connect if the rate is within the plan's effective date window
      const planIsActive = !plan.termination_date || new Date(plan.termination_date) > new Date();
      const planEffectiveDate = plan.effective_date ? new Date(plan.effective_date) : null;
      const planTerminationDate = plan.termination_date ? new Date(plan.termination_date) : null;
      const newRateStartDate = new Date(newStartDate);
      // Check if the new rate is within the plan's effective window
      const isRateInPlanWindow = 
        (!planTerminationDate || newRateStartDate <= planTerminationDate) &&
        (!planEffectiveDate || !newRateData.end_date || new Date(newRateData.end_date) >= planEffectiveDate);
      if (planIsActive && isRateInPlanWindow) {
        // Find existing participant_group_plans records for this plan and option
        // Link the new rate to them via the junction table (don't update participant_group_plans)
        const { data: existingParticipantPlans, error: participantPlansError } = await supabase
          .from('participant_group_plans')
          .select(`
            id,
            participant_id,
            group_plan_option_id,
            dependent_id,
            dependents:dependent_id (
              id,
              relationship
            )
          `)
          .eq('group_plan_id', planId)
          .eq('group_plan_option_id', optionId);

        if (participantPlansError) {
          console.error('Error fetching participant plans:', participantPlansError);
          // Don't throw - rate was created successfully, just log the error
        } else if (existingParticipantPlans && existingParticipantPlans.length > 0) {
          // Check if junction records already exist to avoid duplicates
          const { data: existingJunctions, error: junctionCheckError } = await supabase
            .from('participant_group_plan_rates')
            .select('id, participant_group_plan_id, group_option_rate_id')
            .eq('group_option_rate_id', newRateData.id)
            .in('participant_group_plan_id', existingParticipantPlans.map((pp: any) => pp.id));

          const existingJunctionMap = new Set(
            (existingJunctions || []).map((j: any) => `${j.participant_group_plan_id}-${j.group_option_rate_id}`)
          );

          // Only create junction records for participant plans that don't already have this connection
          const junctionRecords = existingParticipantPlans
            .filter((pp: any) => {
              const key = `${pp.id}-${newRateData.id}`;
              return !existingJunctionMap.has(key);
            })
            .map((pp: any) => {
              // Determine which contribution applies based on dependent_id
              let contributionAmount: number | null = null;
              if (!pp.dependent_id) {
                // Employee
                contributionAmount = plan.employer_contribution_value || null;
              } else {
                // Check dependent relationship
                const dependent = pp.dependents;
                if (dependent) {
                  if (dependent.relationship === 'Spouse') {
                    contributionAmount = plan.employer_spouse_contribution_value || null;
                  } else if (dependent.relationship === 'Child') {
                    contributionAmount = plan.employer_child_contribution_value || null;
                  }
                }
              }

              return {
                participant_group_plan_id: pp.id,
                group_option_rate_id: newRateData.id,
                employer_contribution_type: plan.employer_contribution_type || null,
                employer_contribution_amount: contributionAmount,
                start_date: newStartDate,
                end_date: null,
              };
            });

          if (junctionRecords.length > 0) {
            const { error: connectError } = await supabase
              .from('participant_group_plan_rates')
              .insert(junctionRecords);

            if (connectError) {
              console.error('Error connecting participants to new rate:', connectError);
              alert(`Rate created successfully, but failed to connect to ${junctionRecords.length} participant plan(s). Error: ${connectError.message}`);
            } else {
              console.log(`Successfully created ${junctionRecords.length} new participant plan record(s) for rate history`);
            }
          } else {
            console.log('All participant plans already connected to this rate');
          }
        } else {
          // Check if there are any participant plans for this plan (without filtering by option)
          // This helps identify if the issue is with option matching
          const { data: allParticipantPlans } = await supabase
            .from('participant_group_plans')
            .select('id, participant_id, group_plan_option_id')
            .eq('group_plan_id', planId);

          if (allParticipantPlans && allParticipantPlans.length > 0) {
            console.log(`Found ${allParticipantPlans.length} participant plan(s) for this plan, but none match option ${optionId}`);
            console.log('Participant plan option IDs:', allParticipantPlans.map((pp: any) => pp.group_plan_option_id));
          } else {
            console.log('No participant plans found for this plan');
          }
        }
      } else if (!isRateInPlanWindow) {
        console.log('New rate is outside plan effective window, skipping participant connections');
      }

      // Clear editing state and refresh options
      const newEditingRates = new Map(editingRates);
      newEditingRates.delete(optionId);
      setEditingRates(newEditingRates);

      await fetchPlanOptions();
    } catch (err: any) {
      console.error('Error updating rate:', err);
      alert('Failed to update rate. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasUnsavedRateChanges = () => {
    return editingRates.size > 0;
  };

  const handleBackClick = () => {
    if (hasUnsavedRateChanges()) {
      if (!confirm('You have unsaved rate changes. Are you sure you want to leave?')) {
        return;
      }
    }
    router.push(`/groups/${groupId}`);
  };

  const handleRateCancel = (optionId: string) => {
    const newEditingRates = new Map(editingRates);
    newEditingRates.delete(optionId);
    setEditingRates(newEditingRates);
  };

  // Helper function to parse rate values, handling various formats
  const parseRateValue = (value: any): number => {
    if (typeof value === 'number') {
      return value;
    }

    // Convert to string and clean it
    let rateStr = String(value).trim();

    // Handle empty strings
    if (!rateStr || rateStr === '') {
      throw new Error(`Empty rate value`);
    }

    // Handle accounting format where negative numbers are in parentheses: (123.45) = -123.45
    const isNegative = rateStr.startsWith('-') || (rateStr.startsWith('(') && rateStr.endsWith(')'));
    // Remove currency symbols ($, €, £, ¥, etc.), commas, spaces, and other formatting
    // Keep only digits, decimal point, and minus sign
    rateStr = rateStr
      .replace(/[$€£¥,\s]/g, '') // Remove currency symbols, commas, and spaces
      .replace(/[()]/g, ''); // Remove parentheses
    // If it was in parentheses format, make it negative
    if (isNegative && !rateStr.startsWith('-')) {
      rateStr = '-' + rateStr;
    }

    const rate = parseFloat(rateStr);
    if (isNaN(rate)) {
      throw new Error(`Invalid rate value: "${value}"`);
    }

    return rate;
  };

  const parseFile = async (file: File): Promise<Array<{ option: string; rate: number }>> => {
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (isExcel) {
      // Parse Excel file
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      // Get the first sheet
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      // Convert to JSON - use raw: true to get actual numeric values when possible
      // This helps when cells contain numbers formatted as currency
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true }) as any[][];

      if (jsonData.length === 0) {
        throw new Error('Excel file is empty');
      }

      // Parse header row
      const header = (jsonData[0] || []).map((h: any) => String(h).trim().toLowerCase());
      const optionIndex = header.findIndex((h: string) => h === 'age' || h === 'option');
      const rateIndex = header.findIndex((h: string) => h === 'rate' || h === 'price');

      if (optionIndex === -1) {
        throw new Error('Excel file must contain an "Age" or "Option" column');
      }
      if (rateIndex === -1) {
        throw new Error('Excel file must contain a "Rate" or "Price" column');
      }

      // Parse data rows
      const data: Array<{ option: string; rate: number }> = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] || [];
        const option = String(row[optionIndex] || '').trim();
        const rateValue = row[rateIndex];

        if (!option || rateValue === undefined || rateValue === null || rateValue === '') {
          continue; // Skip empty rows
        }

        try {
          const rate = parseRateValue(rateValue);
          data.push({ option, rate });
        } catch (err: any) {
          throw new Error(`Invalid rate value "${rateValue}" in row ${i + 1}: ${err.message}`);
        }
      }

      return data;
    } else {
      // Parse CSV file
      const csvText = await file.text();
      const lines = csvText.split('\n').filter(line => line.trim() !== '');
      if (lines.length === 0) {
        throw new Error('CSV file is empty');
      }

      // Parse header row
      const header = lines[0].split(',').map(h => h.trim().toLowerCase());
      const optionIndex = header.findIndex(h => h === 'age' || h === 'option');
      const rateIndex = header.findIndex(h => h === 'rate' || h === 'price');

      if (optionIndex === -1) {
        throw new Error('CSV must contain an "Age" or "Option" column');
      }
      if (rateIndex === -1) {
        throw new Error('CSV must contain a "Rate" or "Price" column');
      }

      // Parse data rows
      const data: Array<{ option: string; rate: number }> = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const option = values[optionIndex];
        const rateStr = values[rateIndex];

        if (!option || !rateStr) {
          continue; // Skip empty rows
        }

        try {
          const rate = parseRateValue(rateStr);
          data.push({ option, rate });
        } catch (err: any) {
          throw new Error(`Invalid rate value "${rateStr}" in row ${i + 1}: ${err.message}`);
        }
      }

      return data;
    }
  };

  const handleCsvUpload = async () => {
    if (!csvFile || !csvRateStartDate) {
      alert('Please select a file (CSV or Excel) and enter a rate start date');
      return;
    }

    if (!planId || !plan) {
      alert('Plan information is missing');
      return;
    }

    // Validate that end date is after start date if provided
    if (csvRateEndDate && csvRateEndDate <= csvRateStartDate) {
      alert('Rate End Date must be after Rate Start Date');
      return;
    }

    setIsUploadingRates(true);

    try {
      // Parse file (CSV or Excel)
      const csvData = await parseFile(csvFile);

      if (csvData.length === 0) {
        alert('No valid data found in CSV file');
        setIsUploadingRates(false);
        return;
      }

      // Calculate the day before the new start date
      // Parse the date string as local date to avoid timezone shifts
      const [year, month, day] = csvRateStartDate.split('-');
      const newStartDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      const dayBefore = new Date(newStartDate);
      dayBefore.setDate(dayBefore.getDate() - 1);
      // Format as YYYY-MM-DD without timezone conversion
      const dayBeforeYear = dayBefore.getFullYear();
      const dayBeforeMonth = String(dayBefore.getMonth() + 1).padStart(2, '0');
      const dayBeforeDay = String(dayBefore.getDate()).padStart(2, '0');
      const dayBeforeStr = `${dayBeforeYear}-${dayBeforeMonth}-${dayBeforeDay}`;

      // Refresh plan options to get latest data including active rates
      await fetchPlanOptions();
      // Create a local copy of planOptions to track newly created options
      const localPlanOptions = [...planOptions];

      // Process each row in CSV
      for (const row of csvData) {
        // Find or create the option
        let option = localPlanOptions.find(opt => opt.option === row.option);

        // If option doesn't exist, create it
        if (!option) {
          const { data: newOptionData, error: optionError } = await supabase
            .from('group_plan_options')
            .insert([{
              group_plan_id: planId,
              option: row.option,
            }])
            .select()
            .single();

          if (optionError) {
            throw new Error(`Failed to create option "${row.option}": ${optionError.message}`);
          }

          // Fetch rates for the newly created option
          const { data: ratesData } = await supabase
            .from('group_option_rates')
            .select('*')
            .eq('group_plan_option_id', newOptionData.id)
            .order('start_date', { ascending: false });

          const optionRates = ratesData || [];
          const activeRate = optionRates.find((rate: GroupOptionRate) => !rate.end_date) || null;

          // Create option object
          option = {
            id: newOptionData.id,
            group_plan_id: planId,
            option: row.option,
            created_at: newOptionData.created_at,
            updated_at: newOptionData.updated_at,
            rates: optionRates,
            activeRate,
          };

          // Add to local copy for subsequent iterations
          localPlanOptions.push(option);
        }

        // Update existing active rates to end the day before the new start date
        if (option.activeRate && !option.activeRate.end_date) {
          const { error: updateError } = await supabase
            .from('group_option_rates')
            .update({ end_date: dayBeforeStr })
            .eq('id', option.activeRate.id);

          if (updateError) {
            throw new Error(`Failed to update existing rate for "${row.option}": ${updateError.message}`);
          }
        }

        // Create new rate record
        const { data: newRateData, error: rateError } = await supabase
          .from('group_option_rates')
          .insert([{
            group_plan_option_id: option.id,
            rate: row.rate,
            start_date: csvRateStartDate,
            end_date: csvRateEndDate || null,
          }])
          .select()
          .single();

        if (rateError) {
          throw new Error(`Failed to create rate for "${row.option}": ${rateError.message}`);
        }

        // Automatically connect all active participants on this plan to the new rate
        const planIsActive = !plan.termination_date || new Date(plan.termination_date) > new Date();
        const planEffectiveDate = plan.effective_date ? new Date(plan.effective_date) : null;
        const planTerminationDate = plan.termination_date ? new Date(plan.termination_date) : null;
        const newRateStartDate = new Date(csvRateStartDate);

        const isRateInPlanWindow =
          (!planTerminationDate || newRateStartDate <= planTerminationDate) &&
          (!planEffectiveDate || new Date(newRateData.end_date || '') >= planEffectiveDate);

        if (planIsActive && isRateInPlanWindow) {
          const { data: existingParticipantPlans } = await supabase
            .from('participant_group_plans')
            .select(`
              id,
              participant_id,
              group_plan_option_id,
              dependent_id,
              dependents:dependent_id (
                id,
                relationship
              )
            `)
            .eq('group_plan_id', planId)
            .eq('group_plan_option_id', option.id);

          if (existingParticipantPlans && existingParticipantPlans.length > 0) {
            const { data: existingJunctions } = await supabase
              .from('participant_group_plan_rates')
              .select('id, participant_group_plan_id, group_option_rate_id')
              .eq('group_option_rate_id', newRateData.id)
              .in('participant_group_plan_id', existingParticipantPlans.map((pp: any) => pp.id));

            const existingJunctionMap = new Set(
              (existingJunctions || []).map((j: any) => `${j.participant_group_plan_id}-${j.group_option_rate_id}`)
            );

            const junctionRecords = existingParticipantPlans
              .filter((pp: any) => {
                const key = `${pp.id}-${newRateData.id}`;
                return !existingJunctionMap.has(key);
              })
              .map((pp: any) => {
                // Determine which contribution applies based on dependent_id
                let contributionAmount: number | null = null;
                if (!pp.dependent_id) {
                  // Employee
                  contributionAmount = plan.employer_contribution_value || null;
                } else {
                  // Check dependent relationship
                  const dependent = pp.dependents;
                  if (dependent) {
                    if (dependent.relationship === 'Spouse') {
                      contributionAmount = plan.employer_spouse_contribution_value || null;
                    } else if (dependent.relationship === 'Child') {
                      contributionAmount = plan.employer_child_contribution_value || null;
                    }
                  }
                }

                return {
                  participant_group_plan_id: pp.id,
                  group_option_rate_id: newRateData.id,
                  employer_contribution_type: plan.employer_contribution_type || null,
                  employer_contribution_amount: contributionAmount,
                  start_date: csvRateStartDate,
                  end_date: csvRateEndDate || null,
                };
              });

            if (junctionRecords.length > 0) {
              await supabase
                .from('participant_group_plan_rates')
                .insert(junctionRecords);
            }
          }
        }
      }

      // Refresh plan options to show new rates
      await fetchPlanOptions();

      // Close modal and reset state
      setShowCsvUploadModal(false);
      setCsvFile(null);
      setCsvRateStartDate('');
      setCsvRateEndDate('');
      alert(`Successfully uploaded ${csvData.length} rate(s)!`);
    } catch (err: any) {
      console.error('Error uploading CSV rates:', err);
      alert(`Failed to upload rates: ${err.message}`);
    } finally {
      setIsUploadingRates(false);
    }
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
            <GlassButton variant="primary" onClick={() => router.push(`/groups/${groupId}`)}>
              Back to Group
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
          <span>←</span> Back to Group
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
              {plan.plan_name}
            </h1>
            <p className="text-[var(--glass-gray-medium)]">
              View and edit group plan details
            </p>
          </div>
          {isPlanActive() ? (
            <span className="px-4 py-2 rounded-full text-sm font-semibold bg-green-500/20 text-green-700">
              Active
            </span>
          ) : (
            <span className="px-4 py-2 rounded-full text-sm font-semibold bg-gray-500/20 text-gray-700">
              Terminated
            </span>
          )}
        </div>

      <GlassCard>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Plan Information Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6 border-b border-black pb-4">
              <h2 className="text-2xl font-bold text-[var(--glass-black-dark)]">
                Plan Information
              </h2>
              {isEditMode ? (
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
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

            {/* Row 1: Plan Name and Group Name */}
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
                <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  Group Name
                </label>
                <div className="glass-input-enhanced w-full px-4 py-3 rounded-xl opacity-75 cursor-not-allowed">
                  {plan.group_name || 'N/A'}
                </div>
              </div>
            </div>

            {/* Row 2: Program and Provider */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="program_id" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  Program
                </label>
                {loadingPrograms ? (
                  <p className="text-[var(--glass-gray-medium)] text-sm py-2">Loading programs...</p>
                ) : (
                  <select
                    id="program_id"
                    name="program_id"
                    value={formData.program_id}
                    onChange={handleChange}
                    disabled={!isEditMode || loadingPrograms}
                    className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                  >
                    <option value="">Select program</option>
                    {programs.length === 0 ? (
                      <option value="" disabled>No programs associated with this group</option>
                    ) : (
                      programs.map((program) => (
                        <option key={program.id} value={program.id}>
                          {program.name}
                        </option>
                      ))
                    )}
                  </select>
                )}
              </div>

              <div>
                <label htmlFor="provider_id" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  Provider
                </label>
                <select
                  id="provider_id"
                  name="provider_id"
                  value={formData.provider_id}
                  onChange={handleChange}
                  disabled={!isEditMode || loadingProviders || !formData.program_id}
                  className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                >
                  <option value="">Select provider</option>
                  {formData.program_id ? (
                    filteredProviders.length > 0 ? (
                      filteredProviders.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.name}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>No providers available for selected program</option>
                    )
                  ) : (
                    <option value="" disabled>Please select a program first</option>
                  )}
                </select>
              </div>
            </div>

            {/* Row 3: Effective Date and Termination Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="effective_date" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  Effective Date
                </label>
                <input
                  type="date"
                  id="effective_date"
                  name="effective_date"
                  value={formData.effective_date}
                  onChange={handleChange}
                  disabled={!isEditMode}
                  className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                />
              </div>

              <div>
                <label htmlFor="termination_date" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  Termination Date
                </label>
                <input
                  type="date"
                  id="termination_date"
                  name="termination_date"
                  value={formData.termination_date}
                  onChange={handleChange}
                  disabled={!isEditMode}
                  className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                />
              </div>
            </div>

            {/* Row 4: Plan Type */}
            <div>
              <label htmlFor="plan_type" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                Plan Type
              </label>
              <select
                id="plan_type"
                name="plan_type"
                value={formData.plan_type}
                onChange={handleChange}
                disabled={!isEditMode}
                className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
              >
                <option value="">Select plan type</option>
                <option value="Age Banded">Age Banded</option>
                <option value="Composite">Composite</option>
              </select>
            </div>

            {/* Row 5: Employer Contribution */}
            <div className="space-y-6">
              <div>
                <label htmlFor="employer_contribution_type" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  Employer Contribution Type
                </label>
                <select
                  id="employer_contribution_type"
                  name="employer_contribution_type"
                  value={formData.employer_contribution_type}
                  onChange={handleChange}
                  disabled={!isEditMode}
                  className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                >
                  <option value="">Select contribution type</option>
                  <option value="Percentage">Percentage</option>
                  <option value="Dollar Amount">Dollar Amount</option>
                </select>
              </div>

              {/* Contribution Amount Change Date - Show when contribution fields are changed */}
              {isEditMode && hasContributionChanges() && (
                <div>
                  <label htmlFor="contribution_change_date" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                    Contribution Amount Change Date *
                  </label>
                  <input
                    type="date"
                    id="contribution_change_date"
                    name="contribution_change_date"
                    value={contributionChangeDate}
                    onChange={(e) => setContributionChangeDate(e.target.value)}
                    required={hasContributionChanges()}
                    className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                    placeholder="Enter change date"
                  />
                  <p className="text-xs text-[var(--glass-gray-medium)] mt-2">
                    This date determines when the new contribution amounts take effect. Previous contribution rates will end the day before this date.
                  </p>
                </div>
              )}

              {/* Conditional Contribution Fields */}
              {(formData.plan_type === 'Age Banded' || (!isEditMode && plan?.plan_type === 'Age Banded')) ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Employer Employee Contribution Value */}
                  <div>
                    <label htmlFor="employer_contribution_value" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                      Employer Employee Contribution Value
                    </label>
                    <input
                      type="number"
                      id="employer_contribution_value"
                      name="employer_contribution_value"
                      value={formData.employer_contribution_value}
                      onChange={handleChange}
                      step="0.01"
                      disabled={!isEditMode}
                      className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                      placeholder="Enter employee contribution"
                    />
                  </div>

                  {/* Employer Spouse Contribution Value */}
                  <div>
                    <label htmlFor="employer_spouse_contribution_value" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                      Employer Spouse Contribution Value
                    </label>
                    <input
                      type="number"
                      id="employer_spouse_contribution_value"
                      name="employer_spouse_contribution_value"
                      value={formData.employer_spouse_contribution_value}
                      onChange={handleChange}
                      step="0.01"
                      disabled={!isEditMode}
                      className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                      placeholder="Enter spouse contribution"
                    />
                  </div>

                  {/* Employer Child Contribution Value */}
                  <div>
                    <label htmlFor="employer_child_contribution_value" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                      Employer Child Contribution Value
                    </label>
                    <input
                      type="number"
                      id="employer_child_contribution_value"
                      name="employer_child_contribution_value"
                      value={formData.employer_child_contribution_value}
                      onChange={handleChange}
                      step="0.01"
                      disabled={!isEditMode}
                      className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                      placeholder="Enter child contribution"
                    />
                  </div>
                </div>
              ) : formData.employer_contribution_type ? (
                <div>
                  <label htmlFor="employer_contribution_value" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                    Employer Contribution Value
                  </label>
                  <input
                    type="number"
                    id="employer_contribution_value"
                    name="employer_contribution_value"
                    value={formData.employer_contribution_value}
                    onChange={handleChange}
                    step="0.01"
                    disabled={!isEditMode}
                    className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                    placeholder="Enter contribution value"
                  />
                </div>
              ) : null}
            </div>
          </div>

          {/* Plan Options Section */}
          <div className="pt-6 border-t border-white/20">
            <div className="flex items-center justify-between mb-6 border-b border-black pb-4">
              <h2 className="text-2xl font-bold text-[var(--glass-black-dark)]">
                Plan Options
              </h2>
              <div className="flex items-center gap-3">
                {(plan?.plan_type === 'Composite' || plan?.plan_type === 'Age Banded') && (
                  <>
                    <GlassButton
                      variant="primary"
                      type="button"
                      onClick={() => {
                        // Set default start date when opening modal
                        const defaultDate = plan?.effective_date 
                          ? formatDateForInput(plan.effective_date) 
                          : new Date().toISOString().split('T')[0];
                        setCsvRateStartDate(defaultDate);
                        setShowCsvUploadModal(true);
                      }}
                    >
                      Add Rates
                    </GlassButton>
                    {plan?.plan_type === 'Age Banded' && (
                      <GlassButton
                        variant="primary"
                        type="button"
                        onClick={() => setShowAgeRateHistories(!showAgeRateHistories)}
                      >
                        {showAgeRateHistories ? 'Hide Age Rate Histories' : 'View Age Rate Histories'}
                      </GlassButton>
                    )}
                  </>
                )}
                <GlassButton
                  variant="primary"
                  type="button"
                  onClick={handleAddOption}
                >
                  {planOptions.length === 0 && newOptions.length === 0 
                    ? '+ Add Option' 
                    : '+ Add Another Option'}
                </GlassButton>
              </div>
            </div>

            {/* New Options Form Section */}
            {(showAddOptionForm && newOptions.length > 0) ? (
              <div className="mb-6 space-y-4">
                {newOptions.map((newOption) => (
                  <div
                    key={newOption.id}
                    className="glass-card rounded-xl p-4 bg-blue-500/10 border border-blue-500/20"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                            {plan?.plan_type === 'Age Banded' ? 'Age' : 'Plan Option'}
                          </label>
                          <input
                            type="text"
                            value={newOption.option}
                            onChange={(e) => handleOptionChange(newOption.id, 'option', e.target.value)}
                            className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                            placeholder={`Enter ${plan?.plan_type === 'Age Banded' ? 'age' : 'plan option'}`}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                            Rate *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={newOption.rate}
                            onChange={(e) => handleOptionChange(newOption.id, 'rate', e.target.value)}
                            className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                            placeholder="Enter rate"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (planOptions.length === 0 && newOptions.length === 0) ? (
              <p className="text-[var(--glass-gray-medium)] text-center py-4">
                No options configured for this plan
              </p>
            ) : (
              <>
                {/* Compact Table View for Age Banded Plans (when not showing histories) */}
                {(plan?.plan_type === 'Age Banded' && !showAgeRateHistories) ? (
                  <div className="glass-card rounded-xl p-6 bg-white/5 border border-white/10 overflow-x-auto">
                    {planOptions.length === 0 ? (
                      <p className="text-[var(--glass-gray-medium)] text-center py-4">
                        No options configured for this plan
                      </p>
                    ) : (
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/20">
                            <th className="text-left py-3 px-4 font-semibold text-[var(--glass-black-dark)]">Age</th>
                            <th className="text-left py-3 px-4 font-semibold text-[var(--glass-black-dark)]">Rate</th>
                            <th className="text-left py-3 px-4 font-semibold text-[var(--glass-black-dark)]">Amount Paid By Employer</th>
                            <th className="text-left py-3 px-4 font-semibold text-[var(--glass-black-dark)]">Employee Responsible Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...planOptions].sort((a, b) => {
                            // Sort Age Banded options by numeric age (lowest to highest)
                            const ageA = parseFloat(a.option) || 0;
                            const ageB = parseFloat(b.option) || 0;
                            return ageA - ageB;
                          }).map((option) => {
                          // Calculate amount paid by employer
                          let amountPaidByEmployer = 0;
                          if (plan?.employer_contribution_type && plan?.employer_contribution_value && option.activeRate) {
                            if (plan.employer_contribution_type === 'Percentage') {
                              amountPaidByEmployer = option.activeRate.rate * (plan.employer_contribution_value / 100);
                            } else if (plan.employer_contribution_type === 'Dollar Amount') {
                              amountPaidByEmployer = plan.employer_contribution_value;
                            }
                          }
                          // Calculate employee responsible amount
                          const employeeResponsibleAmount = Math.max(0, (option.activeRate?.rate || 0) - amountPaidByEmployer);
                          return (
                            <tr key={option.id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                              <td className="py-3 px-4 font-semibold text-[var(--glass-black-dark)]">{option.option}</td>
                              <td className="py-3 px-4 text-[var(--glass-black-dark)]">
                                {option.activeRate ? formatCurrency(option.activeRate.rate) : 'No rate set'}
                              </td>
                              <td className="py-3 px-4 text-[var(--glass-black-dark)]">
                                {formatCurrency(amountPaidByEmployer)}
                              </td>
                              <td className="py-3 px-4 text-[var(--glass-black-dark)]">
                                {formatCurrency(employeeResponsibleAmount)}
                              </td>
                            </tr>
                          );
                        })}
                        </tbody>
                      </table>
                    )}
                  </div>
                ) : (
                  /* Detailed View for Composite Plans or Age Banded Plans with histories shown */
                  <div className="space-y-4">
                    {(plan?.plan_type === 'Age Banded' 
                      ? [...planOptions].sort((a, b) => {
                          // Sort Age Banded options by numeric age (lowest to highest)
                          const ageA = parseFloat(a.option) || 0;
                          const ageB = parseFloat(b.option) || 0;
                          return ageA - ageB;
                        })
                      : planOptions
                    ).map((option) => (
                  <div
                    key={option.id}
                    className="glass-card rounded-xl p-4 bg-white/5 border border-white/10"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-[var(--glass-black-dark)]">
                            {option.option}
                          </h3>
                        </div>
                        {/* Inline Rate Editing for Composite and Age Banded Plans in Edit Mode */}
                        {isEditMode && (plan?.plan_type === 'Composite' || plan?.plan_type === 'Age Banded') && (
                          <div className="mt-3">
                            {editingRates.has(option.id) ? (
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                                      Rate
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={editingRates.get(option.id)?.rate || ''}
                                      onChange={(e) => handleRateChange(option.id, 'rate', e.target.value)}
                                      className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                                      placeholder="Enter new rate"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                                      Start Date *
                                    </label>
                                    <input
                                      type="date"
                                      value={editingRates.get(option.id)?.start_date || ''}
                                      onChange={(e) => handleRateChange(option.id, 'start_date', e.target.value)}
                                      className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                                      required
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => handleRateSave(option.id)}
                                    disabled={isSubmitting}
                                    className="px-4 py-3 rounded-full font-semibold bg-green-500 text-white hover:bg-green-600 shadow-lg hover:shadow-xl transition-all duration-300 whitespace-nowrap"
                                  >
                                    Save Rate
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRateCancel(option.id)}
                                    disabled={isSubmitting}
                                    className="px-4 py-3 rounded-full font-semibold bg-gray-500 text-white hover:bg-gray-600 shadow-lg hover:shadow-xl transition-all duration-300 whitespace-nowrap"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <div className="flex-1">
                                  <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                                    Current Rate
                                  </label>
                                  <div className="glass-input-enhanced w-full px-4 py-3 rounded-xl opacity-75 cursor-not-allowed">
                                    {option.activeRate ? formatCurrency(option.activeRate.rate) : 'No rate set'}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRateEdit(option.id, option.activeRate?.rate.toString() || '')}
                                  className="px-4 py-3 rounded-full font-semibold bg-[var(--glass-secondary)] text-white hover:bg-[var(--glass-secondary-dark)] shadow-lg hover:shadow-xl transition-all duration-300 whitespace-nowrap self-end"
                                >
                                  Edit Rate
                                </button>
                              </div>
                                                                            )}
                          </div>
                        )}

                        {option.activeRate && (
                          <div className="text-sm text-[var(--glass-gray-medium)] mb-3">
                            <span>Effective: {formatDate(option.activeRate.start_date)}</span>
                            {option.activeRate.end_date && (
                              <span className="ml-4">Until: {formatDate(option.activeRate.end_date)}</span>
                            )}
                            {!option.activeRate.end_date && (
                              <span className="ml-4">Ending Unplanned</span>
                            )}
                          </div>
                        )}

                    {/* Rate Information Badges - Above Rate History */}
                    {option.activeRate && (
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <div className="flex items-center gap-3 mb-4 flex-wrap">
                          <span className="px-3 py-1 rounded-full text-sm font-semibold bg-green-500/20 text-green-700">
                            Active Rate: {formatCurrency(option.activeRate.rate)}
                          </span>
                          {(() => {
                            // Calculate amount paid by employer
                            let amountPaidByEmployer = 0;
                            if (plan?.employer_contribution_type && plan?.employer_contribution_value && option.activeRate) {
                              if (plan.employer_contribution_type === 'Percentage') {
                                amountPaidByEmployer = option.activeRate.rate * (plan.employer_contribution_value / 100);
                              } else if (plan.employer_contribution_type === 'Dollar Amount') {
                                amountPaidByEmployer = plan.employer_contribution_value;
                              }
                            }
                            // Calculate employee responsible amount
                            const employeeResponsibleAmount = Math.max(0, option.activeRate.rate - amountPaidByEmployer);
                            return (
                              <>
                                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-red-500/20 text-red-700">
                                  Amount Paid By Employer: {formatCurrency(amountPaidByEmployer)}
                                </span>
                                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-blue-500/20 text-blue-700">
                                  Employee Responsible Amount: {formatCurrency(employeeResponsibleAmount)}
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Rate History */}
                    {option.rates.length > 0 && (
                      <div className={`mt-4 pt-4 border-t border-white/10 ${option.activeRate ? '' : 'mt-0 pt-0 border-t-0'}`}>
                        <h4 className="text-sm font-semibold text-[var(--glass-black-dark)] mb-3">
                          Rate History
                        </h4>
                        <div className="space-y-2">
                          {option.rates.map((rate) => {
                            // Parse dates as local dates to avoid timezone shifts
                            const [startYear, startMonth, startDay] = rate.start_date.split('-');
                            const startDate = new Date(parseInt(startYear), parseInt(startMonth) - 1, parseInt(startDay));
                            const endDate = rate.end_date ? (() => {
                              const [endYear, endMonth, endDay] = rate.end_date.split('-');
                              return new Date(parseInt(endYear), parseInt(endMonth) - 1, parseInt(endDay));
                            })() : null;
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            startDate.setHours(0, 0, 0, 0);
                            if (endDate) {
                              endDate.setHours(0, 0, 0, 0);
                            }
                            // Check if rate is currently active (today is between start and end, or no end_date)
                            const isCurrent = startDate <= today && (!endDate || endDate >= today);
                            // Check if rate is planned (start date is in the future)
                            const isPlanned = startDate > today;
                            return (
                              <div
                                key={rate.id}
                                className={`p-3 rounded-lg ${
                                  isCurrent
                                    ? 'bg-green-500/10 border border-green-500/20'
                                    : isPlanned
                                    ? 'bg-blue-500/10 border border-blue-500/20'
                                    : 'bg-white/5 border border-white/10'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-4">
                                    <span className="font-semibold text-[var(--glass-black-dark)]">
                                      {formatCurrency(rate.rate)}
                                    </span>
                                    <span className="text-sm text-[var(--glass-gray-medium)]">
                                      {formatDate(rate.start_date)} - {rate.end_date ? formatDate(rate.end_date) : 'Ending Unplanned'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {isCurrent && (
                                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-700">
                                        Current
                                      </span>
                                    )}
                                    {isPlanned && (
                                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-700">
                                        Planned
                                      </span>
                                    )}
                                    {isEditMode && (
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
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    </div>
                  </div>
                  </div>
                ))}
              </div>
            )}
              </>
            )}

          {/* Save Plan Button at Bottom - Show when adding options */}
          {newOptions.length > 0 && (
            <div className="pt-6 border-t border-white/20 flex justify-center">
              <GlassButton
                type="button"
                variant="primary"
                onClick={handleSaveOptions}
                disabled={isSubmitting}
                className={isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
              >
                {isSubmitting ? 'Saving...' : 'Save Plan'}
              </GlassButton>
            </div>
          )}
        </form>

        {/* Participants Section */}
        <div className="pt-6 border-t border-white/20 mt-6">
          <div className="flex items-center justify-between mb-6 border-b border-black pb-4">
            <button
              type="button"
              onClick={() => toggleSection('participants')}
              className="flex items-center gap-2 text-2xl font-bold text-[var(--glass-black-dark)] hover:opacity-80 transition-opacity"
            >
              <span className={`transform transition-transform ${collapsedSections['participants'] ? 'rotate-180' : ''}`}>
                ▼
              </span>
              <span>Participants on this Plan</span>
            </button>
          </div>

          {!collapsedSections['participants'] && (
            <>
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
                                               </div>
                    )}
                        {planParticipant.participant?.phone_number && (
                          <div>
                            <span className="text-[var(--glass-gray-medium)]">Phone: </span>
                            <span className="text-[var(--glass-black-dark)] font-medium">
                              {planParticipant.participant.phone_number}
                            </span>
                          </div>
                                               </div>
                    )}
                        {planParticipant.participant?.email_address && (
                          <div>
                            <span className="text-[var(--glass-gray-medium)]">Email: </span>
                            <span className="text-[var(--glass-black-dark)] font-medium">
                              {planParticipant.participant.email_address}
                            </span>
                          </div>
                                </div>
                                </div>
                  </div>
                </div>
              ))}
            </div>
          )}
            </>
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
                                 )}

      {/* CSV Upload Rates Modal */}
      {showCsvUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => !isUploadingRates && setShowCsvUploadModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-4 text-center">
              Upload Rates from File
            </h3>
            <p className="text-[var(--glass-gray-medium)] mb-6 text-sm text-center">
              Upload a CSV or Excel file (.xlsx, .xls) with {plan?.plan_type === 'Age Banded' ? 'Ages' : 'Options'} and Rates. 
              Existing active rates will be automatically ended the day before the new start date.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  File (CSV or Excel) *
                </label>
                <p className="text-xs text-[var(--glass-gray-medium)] mb-2">
                  Format: {plan?.plan_type === 'Age Banded' ? 'Age' : 'Option'}, Rate (or Price)
                </p>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  disabled={isUploadingRates}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--glass-secondary)] disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {csvFile && (
                  <p className="text-sm text-green-600 mt-2">
                    Selected: {csvFile.name}
                  </p>
                                </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                    Rate Start Date *
                  </label>
                  <input
                    type="date"
                    value={csvRateStartDate || (plan?.effective_date ? formatDateForInput(plan.effective_date) : new Date().toISOString().split('T')[0])}
                    onChange={(e) => setCsvRateStartDate(e.target.value)}
                    disabled={isUploadingRates}
                    className="glass-input-enhanced w-full px-4 py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    required
                  />
                  <p className="text-xs text-[var(--glass-gray-medium)] mt-2">
                    Existing active rates will end the day before this date
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                    Rate End Date
                  </label>
                  <input
                    type="date"
                    value={csvRateEndDate}
                    onChange={(e) => setCsvRateEndDate(e.target.value)}
                    disabled={isUploadingRates}
                    className="glass-input-enhanced w-full px-4 py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <p className="text-xs text-[var(--glass-gray-medium)] mt-2">
                    Optional: Leave blank for rates with no end date
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-4 justify-center mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowCsvUploadModal(false);
                  setCsvFile(null);
                  setCsvRateStartDate('');
                  setCsvRateEndDate('');
                }}
                disabled={isUploadingRates}
                className="px-6 py-3 rounded-full font-semibold bg-gray-500 text-white hover:bg-gray-600 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCsvUpload}
                disabled={isUploadingRates || !csvFile || !csvRateStartDate}
                className="px-6 py-3 rounded-full font-semibold bg-[var(--glass-secondary)] text-white hover:bg-[var(--glass-secondary-dark)] shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploadingRates ? 'Uploading...' : 'Upload Rates'}
              </button>
            </div>
          </div>
        </div>
                                </div>
  );
}

