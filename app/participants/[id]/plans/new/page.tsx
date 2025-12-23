'use client';

import { useState, useEffect, use } from 'react';
import { useRouter, useParams } from 'next/navigation';
import GlassCard from '../../../../../components/GlassCard';
import GlassButton from '../../../../../components/GlassButton';
import { supabase } from '../../../../../lib/supabase';

interface GroupPlan {
  id: string;
  plan_name: string;
  effective_date: string | null;
  termination_date: string | null;
  plan_type: string | null;
  employer_contribution_type: string | null;
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
}

interface Dependent {
  id: string;
  participant_id: string;
  relationship: string;
  name: string;
  dob: string | null;
}

interface MedicarePlan {
  id: string;
  plan_name: string;
  effective_date: string | null;
  termination_date: string | null;
  plan_type: string | null;
  provider: {
    id: string;
    name: string;
  } | null;
}

interface PlanOption {
  id: string;
  option: string;
}

interface OptionRate {
  id: string;
  rate: number;
  start_date: string;
  end_date: string | null;
}

interface PlanOptionWithRates extends PlanOption {
  rates: OptionRate[];
  activeRate: OptionRate | null;
}

export default function NewParticipantPlanPage() {
  const router = useRouter();
  const params = use(useParams());
  const participantId = (params.id ?? '') as string;

  const [participant, setParticipant] = useState<any>(null);
  const [planType, setPlanType] = useState<'group' | 'medicare'>('group');
  const [groupPlans, setGroupPlans] = useState<GroupPlan[]>([]);
  const [medicarePlans, setMedicarePlans] = useState<MedicarePlan[]>([]);
  const [planOptions, setPlanOptions] = useState<PlanOptionWithRates[]>([]);
  const [formData, setFormData] = useState({
    plan_id: '',
    plan_option_id: '',
    option_rate_id: '',
    rate_override: '',
    include_type: '', // For Age Banded plans: 'Employee', 'Employee and Spouse', 'Employee and Children'
    effective_date: '', // Effective date for the participant plan
    employer_contribution_type: '', // For Composite plans
    class_1_contribution_amount: '',
    class_2_contribution_amount: '',
    class_3_contribution_amount: '',
  });
  const [loadingParticipant, setLoadingParticipant] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loadingDependents, setLoadingDependents] = useState(false);
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (participantId) {
      fetchParticipant();
      fetchMedicarePlans();
      fetchDependents();
    }
  }, [participantId]);

  useEffect(() => {
    // Fetch group plans after participant is loaded, filtered by participant's group
    if (participant?.group_id) {
      fetchGroupPlans(participant.group_id);
    } else if (participant && !participant.group_id) {
      // Participant has no group, so no plans should be shown
      setGroupPlans([]);
    }
  }, [participant]);

  useEffect(() => {
    // Reset form when plan type changes
    setFormData({
      plan_id: '',
      plan_option_id: '',
      option_rate_id: '',
      rate_override: '',
      include_type: '',
      effective_date: '',
      employer_contribution_type: '',
      class_1_contribution_amount: '',
      class_2_contribution_amount: '',
      class_3_contribution_amount: '',
    });
    setPlanOptions([]);
  }, [planType]);

  useEffect(() => {
    if (formData.plan_id) {
      // Set default effective_date when plan is selected (if not already set)
      const selectedPlan = planType === 'group' 
        ? groupPlans.find(p => p.id === formData.plan_id)
        : medicarePlans.find(p => p.id === formData.plan_id);
      
      if (selectedPlan && !formData.effective_date) {
        const defaultDate = calculateDefaultEffectiveDate(selectedPlan.effective_date);
        setFormData(prev => ({
          ...prev,
          effective_date: defaultDate,
        }));
      }
      
      if (planType === 'group') {
        fetchGroupPlanOptions(formData.plan_id);
      } else {
        fetchMedicarePlanOptions(formData.plan_id);
      }
    } else {
      setPlanOptions([]);
      setFormData(prev => ({
        ...prev,
        plan_option_id: '',
        option_rate_id: '',
        include_type: '',
      }));
    }
  }, [formData.plan_id, planType]);

  useEffect(() => {
    if (formData.plan_option_id) {
      // Reset rate selection when option changes
      setFormData(prev => ({
        ...prev,
        option_rate_id: '',
      }));
    }
  }, [formData.plan_option_id]);

  const fetchParticipant = async () => {
    try {
      setLoadingParticipant(true);
      if (!participantId) return;

      const { data, error } = await supabase
        .from('participants')
        .select('*')
        .eq('id', participantId)
        .single();

      if (error) {
        throw error;
      }

      setParticipant(data);
    } catch (error: any) {
      console.error('Error fetching participant:', error);
      setError(error.message || 'Failed to load participant');
    } finally {
      setLoadingParticipant(false);
    }
  };

  const fetchGroupPlans = async (groupId?: string) => {
    try {
      setLoadingPlans(true);
      
      const today = new Date().toISOString().split('T')[0];
      
      let query = supabase
        .from('group_plans')
        .select(`
          id,
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
        `)
        .or(`termination_date.is.null,termination_date.gte.${today}`);

      // Filter by group_id if provided
      if (groupId) {
        query = query.eq('group_id', groupId);
      }

      const { data, error } = await query.order('plan_name', { ascending: true });

      if (error) {
        throw error;
      }

      setGroupPlans((data || []) as GroupPlan[]);
    } catch (error: any) {
      console.error('Error fetching group plans:', error);
    } finally {
      setLoadingPlans(false);
    }
  };

  const fetchMedicarePlans = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('medicare_plans')
        .select(`
          id,
          plan_name,
          effective_date,
          termination_date,
          plan_type,
          provider:providers (
            id,
            name
          )
        `)
        .or(`termination_date.is.null,termination_date.gte.${today}`)
        .order('plan_name', { ascending: true });

      if (error) {
        throw error;
      }

      setMedicarePlans((data || []) as MedicarePlan[]);
    } catch (error: any) {
      console.error('Error fetching Medicare plans:', error);
    }
  };

  const fetchDependents = async () => {
    try {
      setLoadingDependents(true);
      if (!participantId) return;

      const { data, error } = await supabase
        .from('dependents')
        .select('*')
        .eq('participant_id', participantId);

      if (error) {
        throw error;
      }

      setDependents((data || []) as Dependent[]);
    } catch (error: any) {
      console.error('Error fetching dependents:', error);
    } finally {
      setLoadingDependents(false);
    }
  };

  // Calculate employer contribution amount based on plan type and dependent relationship
  const getEmployerContributionAmount = (plan: GroupPlan, dependentId: string | null): number | null => {
    if (!plan) return null;
    
    const contributionType = plan.employer_contribution_type;
    if (!contributionType) return null;
    
    // For Age Banded plans, use the appropriate contribution value based on dependent type
    if (plan.plan_type === 'Age Banded') {
      if (!dependentId) {
        // Employee
        return plan.employer_contribution_value ?? null;
      } else {
        // Look up the dependent to determine relationship
        const dependent = dependents.find(dep => dep.id === dependentId);
        if (dependent?.relationship === 'Spouse') {
          return plan.employer_spouse_contribution_value ?? null;
        } else if (dependent?.relationship === 'Child') {
          return plan.employer_child_contribution_value ?? null;
        }
      }
    } else {
      // For non-Age Banded plans, use the standard contribution value
      return plan.employer_contribution_value ?? null;
    }
    
    return null;
  };

  // Calculate default effective date: earlier of plan's effective_date or next first of month (whichever hasn't passed yet)
  const calculateDefaultEffectiveDate = (planEffectiveDate: string | null): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Calculate next first of month
    let nextFirstOfMonth: Date;
    if (today.getDate() === 1) {
      // Today is the first, use today
      nextFirstOfMonth = new Date(today);
    } else {
      // Today is after the first, use first of next month
      nextFirstOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    }
    nextFirstOfMonth.setHours(0, 0, 0, 0);
    
    // Filter out dates that have passed
    const validDates: { date: Date; dateString: string }[] = [];
    
    // Add next first of month if it hasn't passed
    if (nextFirstOfMonth >= today) {
      validDates.push({
        date: nextFirstOfMonth,
        dateString: nextFirstOfMonth.toISOString().split('T')[0]
      });
    }
    
    // Add plan's effective_date if it exists and hasn't passed
    if (planEffectiveDate) {
      const planDate = new Date(planEffectiveDate);
      planDate.setHours(0, 0, 0, 0);
      
      if (planDate >= today) {
        validDates.push({
          date: planDate,
          dateString: planEffectiveDate.split('T')[0]
        });
      }
    }
    
    // Return the earliest valid date, or next first of month as fallback
    if (validDates.length > 0) {
      validDates.sort((a, b) => a.date.getTime() - b.date.getTime());
      return validDates[0].dateString;
    }
    
    // Fallback: use next first of month even if it's today
    return nextFirstOfMonth.toISOString().split('T')[0];
  };

  // Calculate age from DOB
  const calculateAge = (dob: string | null): number | null => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Find active rate for a given effective date
  // A rate is "active" if effective_date falls between start_date and end_date (or no end_date)
  // AND today's date is also between start_date and end_date (to ensure the rate is currently active)
  // Helper function to normalize date string to YYYY-MM-DD format for comparison
  const normalizeDateString = (dateInput: string | Date | null | undefined): string | null => {
    if (!dateInput) return null;
    
    // If already a Date object, convert to YYYY-MM-DD
    if (dateInput instanceof Date) {
      const year = dateInput.getFullYear();
      const month = String(dateInput.getMonth() + 1).padStart(2, '0');
      const day = String(dateInput.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    const dateString = String(dateInput).trim();
    if (!dateString) return null;
    
    try {
      // Handle ISO format with time: YYYY-MM-DDTHH:mm:ss or YYYY-MM-DDTHH:mm:ss.sssZ
      if (dateString.includes('T')) {
        return dateString.split('T')[0];
      }
      
      // Handle MM/DD/YYYY or DD/MM/YYYY format
      if (dateString.includes('/')) {
        const parts = dateString.split('/').map(Number);
        if (parts.length === 3) {
          // Check if first part is > 12, then it's likely DD/MM/YYYY
          if (parts[0] > 12) {
            // DD/MM/YYYY format
            const [day, month, year] = parts;
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          } else {
            // Assume MM/DD/YYYY format (US format)
            const [month, day, year] = parts;
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          }
        }
      }
      
      // Handle YYYY-MM-DD format - return as-is
      if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateString;
      }
      
      // Fallback: try standard Date parsing
      const fallbackDate = new Date(dateString);
      if (!isNaN(fallbackDate.getTime())) {
        const year = fallbackDate.getFullYear();
        const month = String(fallbackDate.getMonth() + 1).padStart(2, '0');
        const day = String(fallbackDate.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      
      return null;
    } catch (err) {
      console.error('Error normalizing date:', dateString, err);
      return null;
    }
  };

  const findActiveRateForDate = (rates: OptionRate[], effectiveDate: string): OptionRate | null => {
    if (!effectiveDate || rates.length === 0) return null;

    const effectiveDateStr = normalizeDateString(effectiveDate);
    if (!effectiveDateStr) {
      console.error('Could not normalize effective date:', effectiveDate);
      return null;
    }

    // Find rates where the effective_date falls within the rate period (between start_date and end_date)
    // Use string comparison for YYYY-MM-DD format which is reliable and avoids timezone issues
    const activeRates = rates.filter(rate => {
      const startDateStr = normalizeDateString(rate.start_date);
      const endDateStr = normalizeDateString(rate.end_date);
      
      // Check if effective_date is within the rate period
      // effective >= startDate (or no startDate means always valid)
      // effective <= endDate (or no endDate means ongoing/always valid)
      const isEffectiveStartValid = !startDateStr || effectiveDateStr >= startDateStr;
      const isEffectiveEndValid = !endDateStr || effectiveDateStr <= endDateStr;
      
      return isEffectiveStartValid && isEffectiveEndValid;
    });

    // Return the most recent active rate (by start_date, or created_at if available)
    if (activeRates.length > 0) {
      return activeRates.reduce((latest, current) => {
        const latestStart = normalizeDateString(latest.start_date) || '';
        const currentStart = normalizeDateString(current.start_date) || '';
        // String comparison works for YYYY-MM-DD format
        return currentStart > latestStart ? current : latest;
      });
    }

    return null;
  };

  // Find matching age option for a given age
  const findMatchingAgeOption = (age: number, options: PlanOptionWithRates[]): PlanOptionWithRates | null => {
    // Try to find exact match first
    const exactMatch = options.find(opt => {
      const optionAge = parseInt(opt.option);
      return !isNaN(optionAge) && optionAge === age;
    });
    if (exactMatch) return exactMatch;

    // Find the closest age option (round down to nearest age band)
    const ageOptions = options
      .map(opt => {
        const optionAge = parseInt(opt.option);
        return isNaN(optionAge) ? null : { option: opt, age: optionAge };
      })
      .filter((item): item is { option: PlanOptionWithRates; age: number } => item !== null)
      .sort((a, b) => b.age - a.age); // Sort descending

    // Find the highest age band that the person fits into
    for (const item of ageOptions) {
      if (age >= item.age) {
        return item.option;
      }
    }

    // If no match found, return the lowest age option
    return ageOptions.length > 0 ? ageOptions[ageOptions.length - 1].option : null;
  };

  const fetchGroupPlanOptions = async (groupPlanId: string) => {
    try {
      setLoadingOptions(true);

      const { data: optionsData, error: optionsError } = await supabase
        .from('group_plan_options')
        .select('*')
        .eq('group_plan_id', groupPlanId)
        .order('option', { ascending: true });

      if (optionsError) {
        throw optionsError;
      }

      if (!optionsData || optionsData.length === 0) {
        setPlanOptions([]);
        return;
      }

      const optionsWithRates: PlanOptionWithRates[] = await Promise.all(
        optionsData.map(async (option: any) => {
          const { data: ratesData, error: ratesError } = await supabase
            .from('group_option_rates')
            .select('*')
            .eq('group_plan_option_id', option.id)
            .order('start_date', { ascending: false });

          if (ratesError) {
            console.error('Error fetching rates:', ratesError);
            return {
              id: option.id,
              option: option.option,
              rates: [],
              activeRate: null,
            };
          }

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const activeRate = (ratesData || []).find((rate: any) => {
            if (!rate.end_date) return true;
            const endDate = new Date(rate.end_date);
            endDate.setHours(0, 0, 0, 0);
            return endDate >= today;
          }) || null;

          return {
            id: option.id,
            option: option.option,
            rates: ratesData || [],
            activeRate,
          };
        })
      );

      setPlanOptions(optionsWithRates);
    } catch (error: any) {
      console.error('Error fetching plan options:', error);
      setError(error.message || 'Failed to load plan options');
    } finally {
      setLoadingOptions(false);
    }
  };

  const fetchMedicarePlanOptions = async (medicarePlanId: string) => {
    try {
      setLoadingOptions(true);

      const { data: optionsData, error: optionsError } = await supabase
        .from('medicare_plan_options')
        .select('*')
        .eq('medicare_plan_id', medicarePlanId)
        .order('option', { ascending: true });

      if (optionsError) {
        throw optionsError;
      }

      if (!optionsData || optionsData.length === 0) {
        setPlanOptions([]);
        return;
      }

      const optionsWithRates: PlanOptionWithRates[] = await Promise.all(
        optionsData.map(async (option: any) => {
          const { data: ratesData, error: ratesError } = await supabase
            .from('medicare_option_rates')
            .select('*')
            .eq('medicare_plan_option_id', option.id)
            .order('start_date', { ascending: false });

          if (ratesError) {
            console.error('Error fetching rates:', ratesError);
            return {
              id: option.id,
              option: option.option,
              rates: [],
              activeRate: null,
            };
          }

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const activeRate = (ratesData || []).find((rate: any) => {
            if (!rate.end_date) return true;
            const endDate = new Date(rate.end_date);
            endDate.setHours(0, 0, 0, 0);
            return endDate >= today;
          }) || null;

          return {
            id: option.id,
            option: option.option,
            rates: ratesData || [],
            activeRate,
          };
        })
      );

      setPlanOptions(optionsWithRates);
    } catch (error: any) {
      console.error('Error fetching plan options:', error);
      setError(error.message || 'Failed to load plan options');
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const updatedFormData = { ...formData, [name]: value };
    
    // If plan_id changed, set default effective_date
    if (name === 'plan_id' && value) {
      const selectedPlan = planType === 'group' 
        ? groupPlans.find(p => p.id === value)
        : medicarePlans.find(p => p.id === value);
      
      if (selectedPlan) {
        updatedFormData.effective_date = calculateDefaultEffectiveDate(selectedPlan.effective_date);
      }
    }
    
    setFormData(updatedFormData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (!participantId) {
        throw new Error('Participant ID is required');
      }

      if (!formData.plan_id) {
        throw new Error('Please select a plan');
      }

      if (planType === 'group') {
        const selectedPlan = groupPlans.find(p => p.id === formData.plan_id);
        
        // Handle Age Banded plans differently
        if (selectedPlan?.plan_type === 'Age Banded') {
          // Validation: Require include_type selection
          if (!formData.include_type) {
            throw new Error('Please select an inclusion type (Employee, Employee and Spouse, or Employee and Children)');
          }

          // Validation: Check DOB requirements based on include_type
          const spouseDependents = dependents.filter(dep => dep.relationship === 'Spouse');
          const childDependents = dependents.filter(dep => dep.relationship === 'Child');
          
          if (formData.include_type === 'Employee and Spouse' || formData.include_type === 'Employee, Spouse, and Children') {
            if (spouseDependents.length === 0) {
              throw new Error('Please add a spouse dependent before selecting an option that includes spouse');
            }
            const spousesWithoutDOB = spouseDependents.filter(dep => !dep.dob);
            if (spousesWithoutDOB.length > 0) {
              throw new Error('All spouse dependents must have a date of birth. Please add DOB for all spouses.');
            }
          }
          
          if (formData.include_type === 'Employee and Children' || formData.include_type === 'Employee, Spouse, and Children') {
            if (childDependents.length === 0) {
              throw new Error('Please add child dependents before selecting an option that includes children');
            }
            const childrenWithoutDOB = childDependents.filter(dep => !dep.dob);
            if (childrenWithoutDOB.length > 0) {
              throw new Error('All child dependents must have a date of birth. Please add DOB for all children.');
            }
          }

          // Validation: Participant must have DOB for Age Banded plans
          if (!participant?.dob) {
            throw new Error('Participant must have a date of birth for Age Banded plans. Please add DOB for the participant.');
          }

          // Validation: Require effective_date
          if (!formData.effective_date) {
            throw new Error('Effective date is required');
          }

          // For Age Banded plans, create ONE participant_group_plans record per person (employee, spouse, each child)
          // Each record will have the appropriate dependent_id set
          const planRecordsToCreate: Array<{
            participant_id: string;
            group_plan_id: string;
            dependent_id: string | null;
            group_option_rate_id: string;
            effective_date: string;
          }> = [];
          
          // Determine who to include based on include_type
          const includeEmployee = true; // Always include employee
          const includeSpouse = formData.include_type === 'Employee and Spouse' || formData.include_type === 'Employee, Spouse, and Children';
          const includeChildren = formData.include_type === 'Employee and Children' || formData.include_type === 'Employee, Spouse, and Children';
          
          console.log('Age Banded plan processing:', {
            include_type: formData.include_type,
            includeEmployee,
            includeSpouse,
            includeChildren,
            dependentsCount: dependents.length,
            spouseCount: dependents.filter(d => d.relationship === 'Spouse').length,
            childCount: dependents.filter(d => d.relationship === 'Child').length,
            planOptionsCount: planOptions.length,
          });
          
          // Warn if spouse exists but won't be included
          const hasSpouse = dependents.some(dep => dep.relationship === 'Spouse' && dep.dob);
          if (hasSpouse && !includeSpouse) {
            console.warn('WARNING: Spouse dependent exists but will not be included based on selection:', formData.include_type);
          }

          // Process Employee
          if (includeEmployee && participant.dob) {
            const employeeAge = calculateAge(participant.dob);
            if (employeeAge !== null) {
              const matchingOption = findMatchingAgeOption(employeeAge, planOptions);
              if (matchingOption) {
                // Find active rate for the effective_date
                const activeRate = findActiveRateForDate(matchingOption.rates, formData.effective_date);
                if (activeRate) {
                  planRecordsToCreate.push({
                    participant_id: participantId,
                    group_plan_id: formData.plan_id,
                    dependent_id: null, // Employee has no dependent_id
                    group_option_rate_id: activeRate.id,
                    effective_date: formData.effective_date,
                  });
                } else {
                  throw new Error(`No active rate found for employee age option "${matchingOption.option}" on effective date ${formData.effective_date}`);
                }
              }
            }
          }

          // Process Spouse Dependents
          if (includeSpouse) {
            const spouseDependents = dependents.filter(dep => dep.relationship === 'Spouse' && dep.dob);
            console.log('Processing spouse dependents:', spouseDependents.length, spouseDependents);
            for (const spouse of spouseDependents) {
              const spouseAge = calculateAge(spouse.dob);
              console.log(`Spouse ${spouse.name}: age=${spouseAge}, dob=${spouse.dob}`);
              if (spouseAge !== null) {
                const matchingOption = findMatchingAgeOption(spouseAge, planOptions);
                console.log(`Spouse ${spouse.name}: matchingOption=`, matchingOption);
                if (matchingOption) {
                  // Find active rate for the effective_date
                  const activeRate = findActiveRateForDate(matchingOption.rates, formData.effective_date);
                  if (activeRate) {
                    console.log(`Spouse ${spouse.name}: Adding rate ${activeRate.id}`);
                    planRecordsToCreate.push({
                      participant_id: participantId,
                      group_plan_id: formData.plan_id,
                      dependent_id: spouse.id, // Link to spouse dependent
                      group_option_rate_id: activeRate.id,
                      effective_date: formData.effective_date,
                    });
                  } else {
                    throw new Error(`No active rate found for spouse "${spouse.name}" age option "${matchingOption.option}" on effective date ${formData.effective_date}`);
                  }
                } else {
                  console.warn(`Spouse ${spouse.name}: No matching option found`);
                }
              } else {
                console.warn(`Spouse ${spouse.name}: Could not calculate age from DOB: ${spouse.dob}`);
              }
            }
          } else {
            console.log('Spouse not included based on include_type:', formData.include_type);
          }

          // Process Child Dependents
          if (includeChildren) {
            const childDependents = dependents.filter(dep => dep.relationship === 'Child' && dep.dob);
            for (const child of childDependents) {
              const childAge = calculateAge(child.dob);
              if (childAge !== null) {
                const matchingOption = findMatchingAgeOption(childAge, planOptions);
                if (matchingOption) {
                  // Find active rate for the effective_date
                  const activeRate = findActiveRateForDate(matchingOption.rates, formData.effective_date);
                  if (activeRate) {
                    planRecordsToCreate.push({
                      participant_id: participantId,
                      group_plan_id: formData.plan_id,
                      dependent_id: child.id, // Link to child dependent
                      group_option_rate_id: activeRate.id,
                      effective_date: formData.effective_date,
                    });
                  } else {
                    throw new Error(`No active rate found for child "${child.name}" age option "${matchingOption.option}" on effective date ${formData.effective_date}`);
                  }
                }
              }
            }
          }

          if (planRecordsToCreate.length === 0) {
            throw new Error('No matching age options found for the included persons. Please check that age rates are configured for this plan.');
          }

          // Create participant_group_plans records (one per person)
          const { data: insertedPlans, error: insertError } = await supabase
            .from('participant_group_plans')
            .insert(planRecordsToCreate.map(record => ({
              participant_id: record.participant_id,
              group_plan_id: record.group_plan_id,
              dependent_id: record.dependent_id,
              effective_date: record.effective_date,
              // Don't set group_plan_option_id - that's tracked via junction table
            })))
            .select();

          if (insertError) {
            throw insertError;
          }

          // Create junction table records, linking each participant_group_plans record to its rate
          const junctionRecordsToInsert = insertedPlans.map((insertedPlan, index) => {
            const planRecord = planRecordsToCreate[index];
            const contributionAmount = getEmployerContributionAmount(selectedPlan!, planRecord.dependent_id);
            return {
              participant_group_plan_id: insertedPlan.id,
              group_option_rate_id: planRecord.group_option_rate_id,
              employer_contribution_type: selectedPlan!.employer_contribution_type,
              employer_contribution_amount: contributionAmount,
            };
          });

          console.log('Creating junction records:', {
            plansCreated: insertedPlans.length,
            junctionRecordsCount: junctionRecordsToInsert.length,
            rates: junctionRecordsToInsert.map(r => r.group_option_rate_id),
          });

          const { error: junctionError } = await supabase
            .from('participant_group_plan_rates')
            .insert(junctionRecordsToInsert);

          if (junctionError) {
            console.error('Error creating junction records:', junctionError);
            // Don't throw - plan records were created successfully
            alert('Plan records created, but failed to link rates. Please check rate connections.');
          } else {
            console.log(`Successfully created ${junctionRecordsToInsert.length} junction record(s) for ${insertedPlans.length} plan record(s)`);
          }
          
          // Set insertedPlan for the auto-connect logic below (use first one for compatibility)
          const insertedPlan = insertedPlans[0];
        } else {
          // Handle non-Age Banded plans (Composite, etc.)
          
          // Validation: Require effective_date
          if (!formData.effective_date) {
            throw new Error('Effective date is required');
          }

          // Validation: For Composite plans, require plan option
          if (selectedPlan?.plan_type === 'Composite') {
            if (!formData.plan_option_id) {
              throw new Error('Plan option is required for Composite plans');
            }
            // Verify that an active rate exists for the effective_date
            const selectedOption = planOptions.find(o => o.id === formData.plan_option_id);
            if (selectedOption) {
              const activeRate = findActiveRateForDate(selectedOption.rates, formData.effective_date);
              if (!activeRate) {
                throw new Error(`No active rate found for plan option "${selectedOption.option}" on effective date ${formData.effective_date}`);
              }
            }
          }

          const insertData: any = {
            participant_id: participantId,
            group_plan_id: formData.plan_id,
            effective_date: formData.effective_date,
          };

          if (formData.plan_option_id) {
            insertData.group_plan_option_id = formData.plan_option_id;
          }
          if (formData.option_rate_id) {
            insertData.group_option_rate_id = formData.option_rate_id;
          }
          if (formData.rate_override) {
            insertData.rate_override = parseFloat(formData.rate_override);
          }

          // Add Composite plan fields if plan type is Composite
          if (selectedPlan?.plan_type === 'Composite') {
            if (formData.employer_contribution_type) {
              insertData.employer_contribution_type = formData.employer_contribution_type;
            }
            if (formData.class_1_contribution_amount) {
              insertData.class_1_contribution_amount = parseFloat(formData.class_1_contribution_amount);
            }
            if (formData.class_2_contribution_amount) {
              insertData.class_2_contribution_amount = parseFloat(formData.class_2_contribution_amount);
            }
            if (formData.class_3_contribution_amount) {
              insertData.class_3_contribution_amount = parseFloat(formData.class_3_contribution_amount);
            }
          }

          const { data: insertedPlan, error: insertError } = await supabase
            .from('participant_group_plans')
            .insert([insertData])
            .select()
            .single();

          if (insertError) {
            throw insertError;
          }

          // For Composite plans, create participant_group_plan_rates junction record
          if (selectedPlan?.plan_type === 'Composite' && formData.plan_option_id && insertedPlan) {
            // Find the active rate for the effective_date
            const selectedOption = planOptions.find(o => o.id === formData.plan_option_id);
            if (selectedOption) {
              const activeRate = findActiveRateForDate(selectedOption.rates, formData.effective_date);
              if (activeRate) {
                const contributionAmount = getEmployerContributionAmount(selectedPlan!, null);
                const { error: junctionError } = await supabase
                  .from('participant_group_plan_rates')
                  .insert([{
                    participant_group_plan_id: insertedPlan.id,
                    group_option_rate_id: activeRate.id,
                    employer_contribution_type: selectedPlan!.employer_contribution_type,
                    employer_contribution_amount: contributionAmount,
                  }]);

                if (junctionError) {
                  console.error('Error creating junction record:', junctionError);
                  // Don't throw - plan record was created successfully
                  alert('Plan record created, but failed to link rate. Please check rate connections.');
                } else {
                  console.log(`Successfully created participant_group_plan_rates junction record for Composite plan with rate ${activeRate.id}`);
                }
              } else {
                throw new Error(`No active rate found for plan option "${selectedOption.option}" on effective date ${formData.effective_date}`);
              }
            }
          }
        }

      } else {
        // Handle Medicare Plan assignment
        const insertData: any = {
          participant_id: participantId,
          medicare_plan_id: formData.plan_id,
        };

        if (formData.plan_option_id) {
          insertData.medicare_plan_option_id = formData.plan_option_id;
        }
        if (formData.option_rate_id) {
          insertData.medicare_option_rate_id = formData.option_rate_id;
        }
        if (formData.rate_override) {
          insertData.rate_override = parseFloat(formData.rate_override);
        }

        const { data: insertedPlan, error: insertError } = await supabase
          .from('participant_medicare_plans')
          .insert([insertData])
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        // Auto-connect to rate if option selected
        if (insertedPlan && formData.plan_option_id && formData.option_rate_id) {
          const selectedPlan = medicarePlans.find(p => p.id === formData.plan_id);
          const planEffectiveDate = selectedPlan?.effective_date ? new Date(selectedPlan.effective_date) : null;
          const planTerminationDate = selectedPlan?.termination_date ? new Date(selectedPlan.termination_date) : null;
          const selectedRate = planOptions.find(o => o.id === formData.plan_option_id)?.rates.find(r => r.id === formData.option_rate_id);
          
          if (selectedRate) {
            const rateStartDate = selectedRate.start_date ? new Date(selectedRate.start_date) : null;
            const rateEndDate = selectedRate.end_date ? new Date(selectedRate.end_date) : null;
            
            const isRateInWindow = 
              (!planTerminationDate || !rateStartDate || rateStartDate <= planTerminationDate) &&
              (!planEffectiveDate || !rateEndDate || rateEndDate >= planEffectiveDate);
            
            if (isRateInWindow) {
              // Update the participant_medicare_plans record with the rate
              await supabase
                .from('participant_medicare_plans')
                .update({ medicare_option_rate_id: formData.option_rate_id })
                .eq('id', insertedPlan.id);
            }
          }
        }
      }

      // Redirect back to participant page
      router.push(`/participants/${participantId}`);
    } catch (error: any) {
      console.error('Error creating participant plan:', error);
      setError(error.message || 'Failed to add plan. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPlan = planType === 'group' 
    ? groupPlans.find(p => p.id === formData.plan_id)
    : medicarePlans.find(p => p.id === formData.plan_id);
  const selectedOption = planOptions.find(o => o.id === formData.plan_option_id);
  const availableRates = selectedOption?.rates || [];
  const currentPlans = planType === 'group' ? groupPlans : medicarePlans;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <button
          onClick={() => router.push(`/participants/${participantId}`)}
          className="text-[var(--glass-secondary)] hover:text-[var(--glass-secondary-dark)] mb-4 flex items-center gap-2"
        >
          <span>←</span> Back to Participant
        </button>
        <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
          Add Plan to Participant
        </h1>
        <p className="text-[var(--glass-gray-medium)]">
          {loadingParticipant ? 'Loading...' : participant ? `Add a plan for ${participant.client_name}` : 'Select a plan to add'}
        </p>
      </div>

      <GlassCard>
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-500 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Plan Type Selection */}
          <div>
            <label htmlFor="plan_type" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
              Plan Type *
            </label>
            <select
              id="plan_type"
              name="plan_type"
              value={planType}
              onChange={(e) => setPlanType(e.target.value as 'group' | 'medicare')}
              required
              className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
            >
              <option value="group">Group Plan</option>
              <option value="medicare">Medicare Plan</option>
            </select>
          </div>

          {/* Plan Selection */}
          <div>
            <label htmlFor="plan_id" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
              Plan *
            </label>
            {loadingPlans ? (
              <p className="text-[var(--glass-gray-medium)] text-sm py-2">Loading plans...</p>
            ) : planType === 'group' && participant && !participant.group_id ? (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                <p className="text-yellow-700 text-sm">
                  This participant is not assigned to a group. Please assign a group to the participant before adding group plans.
                </p>
              </div>
            ) : (
              <select
                id="plan_id"
                name="plan_id"
                value={formData.plan_id}
                onChange={handleChange}
                required
                className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                disabled={planType === 'group' && participant && !participant.group_id}
              >
                <option value="">Select a plan</option>
                {currentPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.plan_name}
                    {planType === 'group' && (plan as GroupPlan).group && ` - ${(plan as GroupPlan).group!.name}`}
                    {planType === 'group' && (plan as GroupPlan).program && ` (${(plan as GroupPlan).program!.name})`}
                    {plan.provider && ` - ${plan.provider.name}`}
                  </option>
                ))}
              </select>
            )}
            {selectedPlan && (
              <div className="mt-3 p-3 bg-white/5 rounded-xl text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {planType === 'group' && (selectedPlan as GroupPlan).group && (
                    <div>
                      <span className="text-[var(--glass-gray-medium)]">Group: </span>
                      <span className="text-[var(--glass-black-dark)] font-medium">{(selectedPlan as GroupPlan).group!.name}</span>
                    </div>
                  )}
                  {planType === 'group' && (selectedPlan as GroupPlan).program && (
                    <div>
                      <span className="text-[var(--glass-gray-medium)]">Program: </span>
                      <span className="text-[var(--glass-black-dark)] font-medium">{(selectedPlan as GroupPlan).program!.name}</span>
                    </div>
                  )}
                  {selectedPlan.provider && (
                    <div>
                      <span className="text-[var(--glass-gray-medium)]">Provider: </span>
                      <span className="text-[var(--glass-black-dark)] font-medium">{selectedPlan.provider.name}</span>
                    </div>
                  )}
                  {selectedPlan.plan_type && (
                    <div>
                      <span className="text-[var(--glass-gray-medium)]">Type: </span>
                      <span className="text-[var(--glass-black-dark)] font-medium">{selectedPlan.plan_type}</span>
                    </div>
                  )}
                  {planType === 'group' && (selectedPlan as GroupPlan).employer_contribution_type === 'Age Banded' && (
                    <div className="col-span-2 mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <p className="text-yellow-700 text-xs font-semibold">
                        ⚠️ Age Banded Plan: All dependents must have a date of birth. Dependents will be automatically connected to rates based on their age.
                      </p>
                      {dependents.length === 0 && (
                        <p className="text-red-600 text-xs mt-1">
                          Please add dependents with dates of birth before adding this plan.
                        </p>
                      )}
                      {dependents.some(dep => !dep.dob) && (
                        <p className="text-red-600 text-xs mt-1">
                          Some dependents are missing dates of birth. Please add DOB for all dependents.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Plan Option Selection (if plan has options) */}
          {selectedPlan && (
            <div className="glass-card rounded-xl p-4 bg-blue-500/10 border border-blue-500/20">
              {planOptions.length > 0 ? (
              planType === 'group' && (selectedPlan as GroupPlan).plan_type === 'Age Banded' ? (
                // For Age Banded plans, show "Include" dropdown with effective date
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="include_type" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                      Include
                    </label>
                    <select
                      id="include_type"
                      name="include_type"
                      value={formData.include_type}
                      onChange={handleChange}
                      className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                    >
                      <option value="">Select inclusion type</option>
                      <option value="Employee">Employee</option>
                      <option value="Employee and Spouse">Employee and Spouse</option>
                      <option value="Employee and Children">Employee and Children</option>
                      <option value="Employee, Spouse, and Children">Employee, Spouse, and Children</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="effective_date" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                      Effective Date *
                    </label>
                    <div className="date-input-wrapper">
                      <input
                        type="date"
                        id="effective_date"
                        name="effective_date"
                        value={formData.effective_date}
                        onChange={handleChange}
                        required
                        className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
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
                    <p className="text-xs text-[var(--glass-gray-medium)] mt-1">
                      When this plan becomes effective
                    </p>
                  </div>
                </div>
              ) : (
                // For other plans, show regular plan option dropdown with effective date
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="plan_option_id" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                      Plan Option {selectedPlan?.plan_type === 'Composite' && '*'}
                    </label>
                    {loadingOptions ? (
                      <p className="text-[var(--glass-gray-medium)] text-sm py-2">Loading options...</p>
                    ) : (
                      <select
                        id="plan_option_id"
                        name="plan_option_id"
                        value={formData.plan_option_id}
                        onChange={handleChange}
                        required={selectedPlan?.plan_type === 'Composite'}
                        className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                      >
                        <option value="">Select an option {selectedPlan?.plan_type === 'Composite' ? '(required)' : '(optional)'}</option>
                        {planOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.option}
                            {option.activeRate && selectedPlan?.plan_type !== 'Age Banded' && ` - $${option.activeRate.rate.toFixed(2)}`}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label htmlFor="effective_date" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                      Effective Date *
                    </label>
                    <input
                      type="date"
                      id="effective_date"
                      name="effective_date"
                      value={formData.effective_date}
                      onChange={handleChange}
                      required
                      className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                    />
                    <p className="text-xs text-[var(--glass-gray-medium)] mt-1">
                      When this plan becomes effective
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-yellow-500">No plan options available. planOptions.length: {planOptions.length}</p>
              )}
            </div>
          )}

          {/* Rate Selection (if option selected and has rates) */}
          {selectedOption && availableRates.length > 0 && (
            <div>
              <label htmlFor="option_rate_id" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                Rate {selectedPlan?.plan_type === 'Composite' && '(will use active rate for effective date)'}
              </label>
              <select
                id="option_rate_id"
                name="option_rate_id"
                value={formData.option_rate_id}
                onChange={handleChange}
                className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
              >
                <option value="">Select a rate (optional - active rate will be used automatically)</option>
                {availableRates.map((rate) => {
                  const isActiveForEffectiveDate = formData.effective_date 
                    ? findActiveRateForDate(availableRates, formData.effective_date)?.id === rate.id
                    : false;
                  return (
                    <option key={rate.id} value={rate.id}>
                      ${rate.rate.toFixed(2)}
                      {rate.start_date && ` (from ${new Date(rate.start_date).toLocaleDateString()})`}
                      {rate.end_date && ` (until ${new Date(rate.end_date).toLocaleDateString()})`}
                      {isActiveForEffectiveDate && formData.effective_date && ' - Active for effective date'}
                    </option>
                  );
                })}
              </select>
              {selectedPlan?.plan_type === 'Composite' && formData.effective_date && (
                <p className="text-xs text-[var(--glass-gray-medium)] mt-1">
                  The active rate for {formData.effective_date} will be automatically linked
                </p>
              )}
            </div>
          )}

          {/* Composite Plan Fields - Show when plan type is Composite and option is selected */}
          {selectedPlan?.plan_type === 'Composite' && formData.plan_option_id && (
            <div className="space-y-4 pt-4 border-t border-white/20">
              <h3 className="text-lg font-semibold text-[var(--glass-black-dark)] mb-4">
                Composite Plan Contribution Information
              </h3>
              
              {/* Employer Contribution Type */}
              <div>
                <label htmlFor="employer_contribution_type" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  Employer Contribution Type
                </label>
                <select
                  id="employer_contribution_type"
                  name="employer_contribution_type"
                  value={formData.employer_contribution_type}
                  onChange={handleChange}
                  className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                >
                  <option value="">Select contribution type</option>
                  <option value="Dollar">Dollar</option>
                  <option value="Percentage">Percentage</option>
                </select>
              </div>

              {/* Class Contribution Amounts */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="class_1_contribution_amount" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                    Class 1 Contribution Amount
                  </label>
                  <input
                    type="number"
                    id="class_1_contribution_amount"
                    name="class_1_contribution_amount"
                    value={formData.class_1_contribution_amount}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                    placeholder="Enter amount"
                  />
                </div>
                <div>
                  <label htmlFor="class_2_contribution_amount" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                    Class 2 Contribution Amount
                  </label>
                  <input
                    type="number"
                    id="class_2_contribution_amount"
                    name="class_2_contribution_amount"
                    value={formData.class_2_contribution_amount}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                    placeholder="Enter amount"
                  />
                </div>
                <div>
                  <label htmlFor="class_3_contribution_amount" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                    Class 3 Contribution Amount
                  </label>
                  <input
                    type="number"
                    id="class_3_contribution_amount"
                    name="class_3_contribution_amount"
                    value={formData.class_3_contribution_amount}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                    placeholder="Enter amount"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Rate Override */}
          <div>
            <label htmlFor="rate_override" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
              Rate Override (optional)
            </label>
            <input
              type="number"
              id="rate_override"
              name="rate_override"
              value={formData.rate_override}
              onChange={handleChange}
              step="0.01"
              min="0"
              className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
              placeholder="Enter custom rate if different from plan rate"
            />
            <p className="text-xs text-[var(--glass-gray-medium)] mt-1">
              Leave empty to use the plan's default rate
            </p>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-white/20">
            <button
              type="button"
              onClick={() => router.push(`/participants/${participantId}`)}
              className="px-6 py-3 rounded-full font-semibold bg-red-500 text-white hover:bg-red-600 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Cancel
            </button>
            <GlassButton
              type="submit"
              variant="primary"
              disabled={isSubmitting || !formData.plan_id}
              className={isSubmitting || !formData.plan_id ? 'opacity-50 cursor-not-allowed' : ''}
            >
              {isSubmitting ? 'Adding...' : 'Add Plan'}
            </GlassButton>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}

