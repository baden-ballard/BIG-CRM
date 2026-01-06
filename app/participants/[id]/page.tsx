'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import GlassCard from '../../../components/GlassCard';
import GlassButton from '../../../components/GlassButton';
import { supabase } from '../../../lib/supabase';

interface Participant {
  id: string;
  group_id: string | null;
  client_name: string;
  dob: string | null;
  address: string | null;
  phone_number: string | null;
  email_address: string | null;
  id_number: string | null;
  number_of_spouses: number | null;
  number_of_children: number | null;
  class_number: number | null;
  hire_date: string | null;
  termination_date: string | null;
  employment_status: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Group {
  id: string;
  name: string;
  number_of_classes: number | null;
}

interface Dependent {
  id: string;
  participant_id: string;
  name: string;
  relationship: string;
  dob: string | null;
  created_at: string;
}

interface Note {
  id: string;
  date: string;
  notes: string;
}

interface ParticipantPlan {
  id: string;
  participant_id: string;
  group_plan_id: string;
  group_plan_option_id: string | null;
  group_option_rate_id: string | null;
  rate_override: number | null;
  termination_date: string | null;
  created_at: string;
  updated_at: string;
  group_plan: {
    id: string;
    group_id: string | null;
    plan_name: string;
    effective_date: string | null;
    termination_date: string | null;
    plan_type: string | null;
    employer_contribution_type: string | null;
    employer_contribution_value: number | null;
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
  group_option_rate?: {
    id: string;
    rate: number;
    employer_contribution_type?: string | null;
    employer_employee_contribution_value?: number | null;
    employer_spouse_contribution_value?: number | null;
    employer_child_contribution_value?: number | null;
    class_1_contribution_amount?: number | null;
    class_2_contribution_amount?: number | null;
    class_3_contribution_amount?: number | null;
  } | null;
}

interface ParticipantMedicarePlan {
  id: string;
  participant_id: string;
  medicare_plan_id: string;
  medicare_child_rate_id: string | null;
  rate_override: number | null;
  effective_date: string | null;
  created_at: string;
  updated_at: string;
  medicare_plan: {
    id: string;
    plan_name: string;
    provider: {
      id: string;
      name: string;
    } | null;
  };
  medicare_child_rate?: {
    id: string;
    rate: number;
  } | null;
}

interface ParticipantRelationship {
  id: string;
  participant_id_1: string;
  participant_id_2: string;
  relationship: 'Spouses' | 'Parent/Child';
  is_representative: boolean;
  representative_participant_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  related_participant?: {
    id: string;
    client_name: string;
  };
}

export default function ParticipantDetailPage() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const participantId = (params.id ?? '') as string;

  const [participant, setParticipant] = useState<Participant | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [relationships, setRelationships] = useState<ParticipantRelationship[]>([]);
  const [allParticipants, setAllParticipants] = useState<Participant[]>([]);
  const [activePlans, setActivePlans] = useState<ParticipantPlan[]>([]);
  const [terminatedPlans, setTerminatedPlans] = useState<ParticipantPlan[]>([]);
  const [activeMedicarePlans, setActiveMedicarePlans] = useState<ParticipantMedicarePlan[]>([]);
  const [terminatedMedicarePlans, setTerminatedMedicarePlans] = useState<ParticipantMedicarePlan[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showAddPlanForm, setShowAddPlanForm] = useState(false);
  const [showAddDependentForm, setShowAddDependentForm] = useState(false);
  const [showAddRelationshipForm, setShowAddRelationshipForm] = useState(false);
  const [newPlans, setNewPlans] = useState<Array<{
    id: string;
    group_plan_id: string;
    group_plan_option_id: string;
    group_option_rate_id: string;
    rate_override: string;
    include_type: string; // For Age Banded plans: 'Employee', 'Employee and Spouse', 'Employee and Children'
    effective_date: string; // Effective date for the participant plan
    employer_contribution_type: string; // For Composite plans
    class_1_contribution_amount: string;
    class_2_contribution_amount: string;
    class_3_contribution_amount: string;
  }>>([]);
  const [newMedicarePlans, setNewMedicarePlans] = useState<Array<{
    id: string;
    medicare_plan_id: string;
    medicare_child_rate_id: string;
    effective_date: string;
  }>>([]);
  const [showAddMedicarePlanForm, setShowAddMedicarePlanForm] = useState(false);
  const [newDependents, setNewDependents] = useState<Array<{
    id: string;
    name: string;
    relationship: string;
    dob: string;
  }>>([]);
  const [newRelationships, setNewRelationships] = useState<Array<{
    id: string;
    related_participant_id: string;
    related_participant_name: string;
    relationship: 'Spouses' | 'Parent/Child';
    is_representative: boolean;
    representative_participant_id: string;
    notes: string;
  }>>([]);
  const [relationshipSearchOpen, setRelationshipSearchOpen] = useState<Map<string, boolean>>(new Map());
  const [participantNotes, setParticipantNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [showAddNoteForm, setShowAddNoteForm] = useState(false);
  const [newNote, setNewNote] = useState({
    notes: '',
    date: new Date().toISOString().split('T')[0], // Default to today
  });
  const [availableGroupPlans, setAvailableGroupPlans] = useState<any[]>([]);
  const [availableMedicarePlans, setAvailableMedicarePlans] = useState<any[]>([]);
  const [planOptionsMap, setPlanOptionsMap] = useState<Map<string, any[]>>(new Map());
  const [medicarePlanRatesMap, setMedicarePlanRatesMap] = useState<Map<string, { rates: any[], activeRate: any | null }>>(new Map());
  const [loadingGroupPlans, setLoadingGroupPlans] = useState(false);
  const [loadingMedicarePlans, setLoadingMedicarePlans] = useState(false);
  const [formData, setFormData] = useState({
    client_name: '',
    dob: '',
    address: '',
    phone_number: '',
    email_address: '',
    id_number: '',
    group_id: '',
    number_of_spouses: '',
    number_of_children: '',
    class_number: '',
    hire_date: '',
    termination_date: '',
  });
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingDependents, setLoadingDependents] = useState(true);
  const [loadingRelationships, setLoadingRelationships] = useState(true);
  const [loadingParticipants, setLoadingParticipants] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planToDelete, setPlanToDelete] = useState<ParticipantPlan | ParticipantMedicarePlan | null>(null);
  const [isDeletingPlan, setIsDeletingPlan] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    'participant-information': false,
    'group-information': true,
    'group-plan-details': true,
    'medicare-plans': true,
    'dependents': true,
    'persons-of-interest': true,
    'notes': true,
  });

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const navigateToSection = (sectionId: string) => {
    // If section is collapsed, expand it first
    if (collapsedSections[sectionId]) {
      setCollapsedSections(prev => ({
        ...prev,
        [sectionId]: false,
      }));
      // Wait for the expansion animation, then scroll
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else {
      // Section is already expanded, just scroll
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    if (participantId) {
      fetchParticipant();
      fetchGroups();
      fetchDependents();
      fetchRelationships();
      fetchAllParticipants();
      fetchPlans();
      fetchMedicarePlans();
      fetchNotes();
    } else {
      setError('Participant ID is missing');
      setLoading(false);
      setLoadingGroups(false);
      setLoadingDependents(false);
      setLoadingRelationships(false);
      setLoadingParticipants(false);
      setLoadingPlans(false);
    }
  }, [participantId]);

  // Fetch available group plans when participant is loaded, filtered by participant's group
  useEffect(() => {
    if (participant?.group_id) {
      fetchAvailableGroupPlans(participant.group_id);
    } else if (participant && !participant.group_id) {
      // Participant has no group, so no plans should be shown
      setAvailableGroupPlans([]);
    }
  }, [participant]);

  // Handle hash-based scrolling to specific Medicare plan records
  useEffect(() => {
    if (activeMedicarePlans.length > 0 || terminatedMedicarePlans.length > 0) {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#medicare-plan-')) {
        const planId = hash.replace('#medicare-plan-', '');
        setTimeout(() => {
          const element = document.getElementById(`medicare-plan-${planId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Add a highlight effect
            element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
            setTimeout(() => {
              element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
            }, 2000);
          }
        }, 300);
      }
    }
  }, [activeMedicarePlans, terminatedMedicarePlans]);

  const fetchParticipant = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!participantId) {
        throw new Error('Participant ID is required');
      }

      const { data, error: fetchError } = await supabase
        .from('participants')
        .select('*')
        .eq('id', participantId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      if (!data) {
        throw new Error('Participant not found');
      }

      setParticipant(data);
      // Handle DATE type from Supabase - ensure we get the exact date string from database
      // Never use Date object methods as they can cause timezone shifts
      const formatDateValue = (dateValue: any): string => {
        if (!dateValue) return '';
        if (dateValue instanceof Date) {
          // If Supabase returns a Date object, use UTC methods to get the exact date from database
          // This ensures we get the date as stored, not shifted by timezone
          const year = dateValue.getUTCFullYear();
          const month = String(dateValue.getUTCMonth() + 1).padStart(2, '0');
          const day = String(dateValue.getUTCDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        } else if (typeof dateValue === 'string') {
          // If it's a string, extract just the date part (YYYY-MM-DD)
          return dateValue.split('T')[0];
        } else {
          // Fallback: convert to string and extract date part
          return String(dateValue).split('T')[0];
        }
      };
      
      let dobValue = formatDateValue(data.dob);
      let hireDateValue = formatDateValue(data.hire_date);
      let terminationDateValue = formatDateValue(data.termination_date);
      
      setFormData({
        client_name: data.client_name || '',
        dob: dobValue || '',
        address: data.address || '',
        phone_number: data.phone_number || '',
        email_address: data.email_address || '',
        id_number: data.id_number || '',
        group_id: data.group_id || '',
        number_of_spouses: data.number_of_spouses != null ? String(data.number_of_spouses) : '',
        number_of_children: data.number_of_children != null ? String(data.number_of_children) : '',
        class_number: data.class_number != null ? String(data.class_number) : '',
        hire_date: hireDateValue || '',
        termination_date: terminationDateValue || '',
      });
      
      // Fetch notes will be done separately
      fetchNotes();
      
      // Fetch group details if group_id exists
      if (data.group_id) {
        fetchGroupDetails(data.group_id);
      } else {
        setSelectedGroup(null);
      }
    } catch (err: any) {
      console.error('Error fetching participant:', err);
      setError(err.message || 'Failed to load participant');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      setLoadingGroups(true);

      const { data, error: fetchError } = await supabase
        .from('groups')
        .select('*')
        .order('name', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setGroups(data || []);
    } catch (err: any) {
      console.error('Error fetching groups:', err);
    } finally {
      setLoadingGroups(false);
    }
  };

  const fetchGroupDetails = async (groupId: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('groups')
        .select('id, name, number_of_classes')
        .eq('id', groupId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      setSelectedGroup(data);
    } catch (err: any) {
      console.error('Error fetching group details:', err);
      setSelectedGroup(null);
    }
  };

  const fetchNotes = async () => {
    try {
      setLoadingNotes(true);

      if (!participantId) {
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('notes')
        .select('*')
        .eq('participant_id', participantId)
        .order('date', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setParticipantNotes(data || []);
    } catch (err: any) {
      console.error('Error fetching notes:', err);
    } finally {
      setLoadingNotes(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.notes.trim() || !newNote.date) {
      alert('Please enter both note content and date');
      return;
    }

    setIsSubmitting(true);

    try {
      if (!participantId) {
        throw new Error('Participant ID is required');
      }

      const { data, error: insertError } = await supabase
        .from('notes')
        .insert([{
          participant_id: participantId,
          notes: newNote.notes.trim(),
          date: newNote.date,
        }])
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Refresh notes list
      await fetchNotes();

      // Reset form
      setNewNote({
        notes: '',
        date: new Date().toISOString().split('T')[0],
      });
      setShowAddNoteForm(false);

      alert('Note added successfully!');
    } catch (err: any) {
      console.error('Error adding note:', err);
      alert('Failed to add note. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelAddNote = () => {
    setNewNote({
      notes: '',
      date: new Date().toISOString().split('T')[0],
    });
    setShowAddNoteForm(false);
  };

  const fetchDependents = async () => {
    try {
      setLoadingDependents(true);

      if (!participantId) {
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('dependents')
        .select('*')
        .eq('participant_id', participantId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setDependents(data || []);
    } catch (err: any) {
      console.error('Error fetching dependents:', err);
    } finally {
      setLoadingDependents(false);
    }
  };

  const fetchRelationships = async () => {
    try {
      setLoadingRelationships(true);

      if (!participantId) {
        return;
      }

      // Fetch relationships where this participant is either participant_id_1 or participant_id_2
      const { data, error: fetchError } = await supabase
        .from('participant_relationships')
        .select('*')
        .or(`participant_id_1.eq.${participantId},participant_id_2.eq.${participantId}`)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      // Fetch related participant details for each relationship
      const relationshipsWithDetails = await Promise.all((data || []).map(async (rel) => {
        const relatedParticipantId = rel.participant_id_1 === participantId 
          ? rel.participant_id_2 
          : rel.participant_id_1;
        
        const { data: participantData } = await supabase
          .from('participants')
          .select('id, client_name')
          .eq('id', relatedParticipantId)
          .single();

        return {
          ...rel,
          related_participant: participantData || undefined
        };
      }));

      setRelationships(relationshipsWithDetails);
    } catch (err: any) {
      // Check if error is due to missing table
      if (err?.code === 'PGRST205' || err?.message?.includes('Could not find the table')) {
        // Table doesn't exist yet - set empty array and log info instead of error
        console.warn('participant_relationships table does not exist yet. Relationships feature unavailable.');
        setRelationships([]);
      } else {
        // Log other errors with full details
        console.error('Error fetching relationships:', {
          message: err?.message || 'Unknown error',
          code: err?.code || null,
          details: err?.details || null,
          hint: err?.hint || null,
          error: err
        });
        setRelationships([]);
      }
    } finally {
      setLoadingRelationships(false);
    }
  };

  const fetchAllParticipants = async () => {
    try {
      setLoadingParticipants(true);

      const { data, error: fetchError } = await supabase
        .from('participants')
        .select('id, client_name')
        .neq('id', participantId)
        .order('client_name', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setAllParticipants((data || []) as unknown as Participant[]);
    } catch (err: any) {
      console.error('Error fetching participants:', err);
    } finally {
      setLoadingParticipants(false);
    }
  };

  const fetchPlans = async () => {
    try {
      setLoadingPlans(true);

      if (!participantId) {
        setActivePlans([]);
        setTerminatedPlans([]);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('participant_group_plans')
        .select(`
          *,
          group_plan:group_plans (
            id,
            group_id,
            plan_name,
            effective_date,
            termination_date,
            plan_type,
            employer_contribution_type,
            employer_contribution_value,
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
          )
        `)
        .eq('participant_id', participantId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      const plans = (data || []) as ParticipantPlan[];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Deduplicate: Only keep one record for each unique combination of
      // participant_id, group_plan_id, and group_plan_option_id
      // This handles any existing duplicates (there should only be one per combination)
      const uniquePlansMap = new Map<string, ParticipantPlan>();
      plans.forEach((plan) => {
        // Create a unique key from participant_id, group_plan_id, and group_plan_option_id
        const uniqueKey = `${plan.participant_id}-${plan.group_plan_id}-${plan.group_plan_option_id || 'null'}`;
        
        // Only keep the first (most recent) record for this combination
        if (!uniquePlansMap.has(uniqueKey)) {
          uniquePlansMap.set(uniqueKey, plan);
        }
      });

      // Convert map values back to array
      const uniquePlans = Array.from(uniquePlansMap.values());

      // Fetch the most recent active rate from the junction table for each plan
      const todayStr = today.toISOString().split('T')[0];

      const plansWithRates = await Promise.all(uniquePlans.map(async (plan) => {
        // Find active rates: start_date <= today AND (end_date is null OR end_date >= today)
        // Then get the most recent one
        const { data: allRateData, error: rateError } = await supabase
          .from('participant_group_plan_rates')
          .select(`
            id,
            start_date,
            end_date,
            employer_contribution_type,
            employer_contribution_amount,
            group_option_rate:group_option_rates (
              id,
              rate,
              employer_contribution_type,
              employer_employee_contribution_value,
              employer_spouse_contribution_value,
              employer_child_contribution_value,
              class_1_contribution_amount,
              class_2_contribution_amount,
              class_3_contribution_amount
            )
          `)
          .eq('participant_group_plan_id', plan.id)
          .lte('start_date', todayStr)
          .or(`end_date.is.null,end_date.gte.${todayStr}`)
          .order('start_date', { ascending: false })
          .order('created_at', { ascending: false });

        if (!rateError && allRateData && allRateData.length > 0) {
          // Get the most recent active rate
          const rateData = allRateData[0];
          const groupOptionRate = Array.isArray(rateData.group_option_rate) 
            ? rateData.group_option_rate[0] 
            : rateData.group_option_rate;
          plan.group_option_rate = groupOptionRate as any;
          // Store contribution info if needed
          (plan as any).contribution_type = rateData.employer_contribution_type;
          (plan as any).contribution_amount = rateData.employer_contribution_amount;
        } else if (plan.group_option_rate_id) {
          // Fallback: If no rate history, fetch directly from group_option_rates using the plan's group_option_rate_id
          const { data: rateData, error: directRateError } = await supabase
            .from('group_option_rates')
            .select(`
              id,
              rate,
              employer_contribution_type,
              employer_employee_contribution_value,
              employer_spouse_contribution_value,
              employer_child_contribution_value,
              class_1_contribution_amount,
              class_2_contribution_amount,
              class_3_contribution_amount
            `)
            .eq('id', plan.group_option_rate_id)
            .single();
          
          if (!directRateError && rateData) {
            plan.group_option_rate = rateData as any;
          }
        }

        return plan;
      }));

      const active: ParticipantPlan[] = [];
      const terminated: ParticipantPlan[] = [];

      plansWithRates.forEach((plan) => {
        // Check both participant plan termination date and group plan termination date
        const participantTerminationDate = plan.termination_date 
          ? new Date(plan.termination_date)
          : null;
        const groupPlanTerminationDate = plan.group_plan?.termination_date 
          ? new Date(plan.group_plan.termination_date)
          : null;
        
        // Plan is terminated if either the participant's enrollment ended or the group plan ended
        const isTerminated = (participantTerminationDate && participantTerminationDate < today) ||
                           (groupPlanTerminationDate && groupPlanTerminationDate < today);
        
        if (isTerminated) {
          terminated.push(plan);
        } else {
          active.push(plan);
        }
      });

      setActivePlans(active);
      setTerminatedPlans(terminated);
    } catch (err: any) {
      console.error('Error fetching plans:', err);
      setActivePlans([]);
      setTerminatedPlans([]);
    } finally {
      setLoadingPlans(false);
    }
  };

  const fetchMedicarePlans = async () => {
    try {
      if (!participantId) {
        setActiveMedicarePlans([]);
        setTerminatedMedicarePlans([]);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('participant_medicare_plans')
        .select(`
          *,
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
            rate
          )
        `)
        .eq('participant_id', participantId)
        .order('created_at', { ascending: false });

      // Fetch all rates for each plan to determine the active rate
      if (data) {
        const planIds = [...new Set(data.map((p: any) => p.medicare_plan_id))];
        const ratesByPlanId = new Map<string, any[]>();
        
        for (const planId of planIds) {
          const { data: ratesData } = await supabase
            .from('medicare_child_rates')
            .select('*')
            .eq('medicare_plan_id', planId)
            .order('start_date', { ascending: false });
          
          if (ratesData) {
            ratesByPlanId.set(planId, ratesData);
          }
        }

        // Add current rate to each plan using priority logic:
        // 1. Current rate (status "Active")
        // 2. Next pending rate (status "Pending", earliest start_date)
        // 3. Last rate (most recent by start_date)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];
        
        const calculateRateStatus = (startDate: string | null, endDate: string | null): 'Pending' | 'Active' | 'Ended' => {
          if (!startDate) return 'Ended';
          
          const start = new Date(startDate).toISOString().split('T')[0];
          
          // If start date is in the future, it's Pending
          if (start > todayStr) {
            return 'Pending';
          }
          
          // If end date is null or in the future, it's Active
          if (!endDate || endDate >= todayStr) {
            return 'Active';
          }
          
          // Otherwise, it's Ended
          return 'Ended';
        };
        
        data.forEach((plan: any) => {
          const rates = ratesByPlanId.get(plan.medicare_plan_id) || [];
          
          // Categorize rates by status
          const activeRates: any[] = [];
          const pendingRates: any[] = [];
          const endedRates: any[] = [];
          
          rates.forEach((rate: any) => {
            const status = calculateRateStatus(rate.start_date, rate.end_date);
            if (status === 'Active') {
              activeRates.push(rate);
            } else if (status === 'Pending') {
              pendingRates.push(rate);
            } else {
              endedRates.push(rate);
            }
          });
          
          let activeRate: any = null;
          
          // Priority 1: Most recent active rate
          if (activeRates.length > 0) {
            activeRate = activeRates.reduce((latest, current) => {
              const currentStart = current.start_date ? new Date(current.start_date).getTime() : 0;
              const latestStart = latest.start_date ? new Date(latest.start_date).getTime() : 0;
              return currentStart > latestStart ? current : latest;
            });
          }
          // Priority 2: Next pending rate (earliest start_date)
          else if (pendingRates.length > 0) {
            activeRate = pendingRates.reduce((earliest, current) => {
              const currentStart = current.start_date 
                ? new Date(current.start_date).getTime() 
                : Infinity;
              const earliestStart = earliest.start_date 
                ? new Date(earliest.start_date).getTime() 
                : Infinity;
              return currentStart < earliestStart ? current : earliest;
            });
          }
          // Priority 3: Last rate (most recent by start_date)
          else if (endedRates.length > 0) {
            activeRate = endedRates.reduce((latest, current) => {
              const currentStart = current.start_date ? new Date(current.start_date).getTime() : 0;
              const latestStart = latest.start_date ? new Date(latest.start_date).getTime() : 0;
              return currentStart > latestStart ? current : latest;
            });
          }
          
          plan.active_rate = activeRate || null;
        });
      }

      if (fetchError) {
        throw fetchError;
      }

      const plans = (data || []) as ParticipantMedicarePlan[];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Deduplicate similar to group plans
      const uniquePlansMap = new Map<string, ParticipantMedicarePlan>();
      plans.forEach((plan) => {
        const uniqueKey = `${plan.participant_id}-${plan.medicare_plan_id}-${plan.medicare_child_rate_id || 'null'}`;
        if (!uniquePlansMap.has(uniqueKey)) {
          uniquePlansMap.set(uniqueKey, plan);
        }
      });

      const uniquePlans = Array.from(uniquePlansMap.values());

      const active: ParticipantMedicarePlan[] = [];
      const terminated: ParticipantMedicarePlan[] = [];

      uniquePlans.forEach((plan) => {
        // Medicare plans don't have termination dates, so treat all as active
        active.push(plan);
      });

      setActiveMedicarePlans(active);
      setTerminatedMedicarePlans(terminated);
    } catch (err: any) {
      console.error('Error fetching Medicare plans:', err);
      setActiveMedicarePlans([]);
      setTerminatedMedicarePlans([]);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    // Parse date string as local date to avoid timezone issues
    // Handle formats like "1993-04-29" or "1993-04-29T00:00:00Z"
    const dateOnly = dateString.split('T')[0]; // Get just the date part if there's a time component
    const parts = dateOnly.split('-');
    if (parts.length === 3) {
      // Return the date string as-is to avoid timezone conversion
      return dateOnly;
    }
    // Fallback: try to extract date from ISO string
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  const formatDisplayDate = (dateValue: string | Date | null) => {
    if (!dateValue) return 'N/A';
    
    // Handle Date objects - use UTC methods to get exact date from database without timezone shift
    if (dateValue instanceof Date) {
      // Use UTC methods to get the exact date as stored in database
      const year = dateValue.getUTCFullYear();
      const month = dateValue.getUTCMonth() + 1; // getUTCMonth() returns 0-11, we need 1-12
      const day = dateValue.getUTCDate();
      
      console.log('formatDisplayDate - Date object:', { 
        dateObject: dateValue, 
        utcYear: year, 
        utcMonth: month, 
        utcDay: day,
        localYear: dateValue.getFullYear(),
        localMonth: dateValue.getMonth() + 1,
        localDay: dateValue.getDate()
      });
      
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[month - 1]} ${day}, ${year}`;
    }
    
    // Handle string values - parse directly without Date objects
    const dateString = String(dateValue);
    const dateOnly = dateString.split('T')[0]; // Get just the date part if there's a time component
    const parts = dateOnly.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10); // 1-12, not 0-indexed
      const day = parseInt(parts[2], 10);
      
      // Debug logging for date formatting
      if (dateString.includes('1993') || dateString.includes('1994') || dateString.includes('1992')) {
        console.log('formatDisplayDate - String:', { original: dateString, dateOnly, year, month, day });
      }
      
      // Format directly without Date object to avoid any timezone conversion
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthName = monthNames[month - 1]; // Convert to 0-indexed for array access
      
      return `${monthName} ${day}, ${year}`;
    }
    
    // Fallback: return the original value as string
    return String(dateValue);
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

  const findActiveRateForDate = (rates: any[], effectiveDate: string): any | null => {
    if (!effectiveDate || rates.length === 0) {
      return null;
    }

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

    // Return the most recent active rate (by start_date)
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
  const findMatchingAgeOption = (age: number, options: any[]): any | null => {
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
      .filter((item): item is { option: any; age: number } => item !== null)
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

  const calculateAge = (dateOfBirth: string | null): number | null => {
    if (!dateOfBirth) return null;
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Calculate total rate for an include_type option for Age Banded plans
  const calculateIncludeTypeRate = (
    includeType: string,
    planOptions: any[],
    effectiveDate: string,
    participantDob: string | null,
    dependents: any[]
  ): number | null => {
    if (!effectiveDate || planOptions.length === 0) return null;

    let totalRate = 0;
    const includeEmployee = true; // Always include employee
    const includeSpouse = includeType === 'Employee and Spouse' || includeType === 'Employee, Spouse, and Children';
    const includeChildren = includeType === 'Employee and Children' || includeType === 'Employee, Spouse, and Children';

    // Calculate employee rate
    if (includeEmployee && participantDob) {
      const employeeAge = calculateAge(participantDob);
      if (employeeAge !== null) {
        const matchingOption = findMatchingAgeOption(employeeAge, planOptions);
        if (matchingOption) {
          const activeRate = findActiveRateForDate(matchingOption.rates || [], effectiveDate);
          if (activeRate) {
            totalRate += activeRate.rate || 0;
          }
        }
      }
    }

    // Calculate spouse rates
    if (includeSpouse) {
      const spouseDependents = dependents.filter(dep => dep.relationship === 'Spouse' && dep.dob);
      for (const spouse of spouseDependents) {
        const spouseAge = calculateAge(spouse.dob);
        if (spouseAge !== null) {
          const matchingOption = findMatchingAgeOption(spouseAge, planOptions);
          if (matchingOption) {
            const activeRate = findActiveRateForDate(matchingOption.rates || [], effectiveDate);
            if (activeRate) {
              totalRate += activeRate.rate || 0;
            }
          }
        }
      }
    }

    // Calculate child rates
    if (includeChildren) {
      const childDependents = dependents.filter(dep => dep.relationship === 'Child' && dep.dob);
      for (const child of childDependents) {
        const childAge = calculateAge(child.dob);
        if (childAge !== null) {
          const matchingOption = findMatchingAgeOption(childAge, planOptions);
          if (matchingOption) {
            const activeRate = findActiveRateForDate(matchingOption.rates || [], effectiveDate);
            if (activeRate) {
              totalRate += activeRate.rate || 0;
            }
          }
        }
      }
    }

    return totalRate > 0 ? totalRate : null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // If group_id changes, fetch group details
    if (name === 'group_id') {
      if (value) {
        fetchGroupDetails(value);
      } else {
        setSelectedGroup(null);
        // Clear class_number when group is cleared
        setFormData(prev => ({
          ...prev,
          [name]: value,
          class_number: '',
        }));
        return;
      }
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEditClick = () => {
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    // Reset form data to original participant data
    if (participant) {
      // Helper function to format date values
      const formatDateValue = (dateValue: any): string => {
        if (!dateValue) return '';
        if (dateValue instanceof Date) {
          // Use UTC methods to get the exact date from database, not shifted by timezone
          const year = dateValue.getUTCFullYear();
          const month = String(dateValue.getUTCMonth() + 1).padStart(2, '0');
          const day = String(dateValue.getUTCDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        } else if (typeof dateValue === 'string') {
          // Extract just the date part (YYYY-MM-DD)
          return dateValue.split('T')[0];
        }
        return String(dateValue).split('T')[0];
      };
      
      setFormData({
        client_name: participant.client_name || '',
        dob: formatDateValue(participant.dob),
        address: participant.address || '',
        phone_number: participant.phone_number || '',
        email_address: participant.email_address || '',
        id_number: participant.id_number || '',
        group_id: participant.group_id || '',
        number_of_spouses: participant.number_of_spouses != null ? String(participant.number_of_spouses) : '',
        number_of_children: participant.number_of_children != null ? String(participant.number_of_children) : '',
        class_number: participant.class_number != null ? String(participant.class_number) : '',
        hire_date: formatDateValue(participant.hire_date),
        termination_date: formatDateValue(participant.termination_date),
      });
      
      // Reset selected group
      if (participant.group_id) {
        fetchGroupDetails(participant.group_id);
      } else {
        setSelectedGroup(null);
      }
    }
  };

  const handleDeleteClick = () => {
    // Show confirmation dialog
    setShowDeleteDialog(true);
  };

  const handleDeleteParticipant = async () => {
    if (!participantId) return;

    try {
      setIsDeleting(true);

      // First, get all participant_group_plan IDs to delete their rate history
      const { data: participantGroupPlans } = await supabase
        .from('participant_group_plans')
        .select('id')
        .eq('participant_id', participantId);

      const participantGroupPlanIds = participantGroupPlans?.map(p => p.id) || [];

      // Delete participant_group_plan_rates (rate history for participant group plans)
      if (participantGroupPlanIds.length > 0) {
        const { error: deleteGroupPlanRatesError } = await supabase
          .from('participant_group_plan_rates')
          .delete()
          .in('participant_group_plan_id', participantGroupPlanIds);

        if (deleteGroupPlanRatesError) {
          console.error('Error deleting participant group plan rates:', deleteGroupPlanRatesError);
          // Continue with deletion even if this fails
        }
      }

      // Delete participant_group_plans (all records for this participant)
      const { error: deleteGroupPlansError } = await supabase
        .from('participant_group_plans')
        .delete()
        .eq('participant_id', participantId);

      if (deleteGroupPlansError) {
        console.error('Error deleting participant group plans:', deleteGroupPlansError);
        // Continue with deletion even if this fails
      }

      // Delete participant_medicare_plans (all records for this participant)
      const { error: deleteMedicarePlansError } = await supabase
        .from('participant_medicare_plans')
        .delete()
        .eq('participant_id', participantId);

      if (deleteMedicarePlansError) {
        console.error('Error deleting participant medicare plans:', deleteMedicarePlansError);
        // Continue with deletion even if this fails
      }

      // Delete dependents (all records for this participant)
      const { error: deleteDependentsError } = await supabase
        .from('dependents')
        .delete()
        .eq('participant_id', participantId);

      if (deleteDependentsError) {
        console.error('Error deleting dependents:', deleteDependentsError);
        // Continue with deletion even if this fails
      }

      // Delete participant_change_logs (all records for this participant)
      const { error: deleteChangeLogsError } = await supabase
        .from('participant_change_logs')
        .delete()
        .eq('participant_id', participantId);

      if (deleteChangeLogsError) {
        console.error('Error deleting participant change logs:', deleteChangeLogsError);
        // Continue with deletion even if this fails
      }

      // Delete participant_programs (all records for this participant)
      const { error: deleteParticipantProgramsError } = await supabase
        .from('participant_programs')
        .delete()
        .eq('participant_id', participantId);

      if (deleteParticipantProgramsError) {
        console.error('Error deleting participant programs:', deleteParticipantProgramsError);
        // Continue with deletion even if this fails
      }

      // Delete notes (all records where participant_id matches)
      const { error: deleteNotesError } = await supabase
        .from('notes')
        .delete()
        .eq('participant_id', participantId);

      if (deleteNotesError) {
        console.error('Error deleting notes:', deleteNotesError);
        // Continue with deletion even if this fails
      }

      // Delete documents (all records where entity_type is 'Participant' and entity_id matches)
      const { error: deleteDocumentsError } = await supabase
        .from('documents')
        .delete()
        .eq('entity_type', 'Participant')
        .eq('entity_id', participantId);

      if (deleteDocumentsError) {
        console.error('Error deleting documents:', deleteDocumentsError);
        // Continue with deletion even if this fails
      }

      // Delete participant_relationships (where participant_id_1 or participant_id_2 matches)
      const { error: deleteRelationshipsError1 } = await supabase
        .from('participant_relationships')
        .delete()
        .eq('participant_id_1', participantId);

      if (deleteRelationshipsError1) {
        // Check if error is due to missing table - this is fine, just skip silently
        if (deleteRelationshipsError1.code === 'PGRST205' || deleteRelationshipsError1.message?.includes('Could not find the table')) {
          // Table doesn't exist yet - this is fine, just continue
        } else {
          // Log other errors with meaningful content
          console.error('Error deleting participant relationships (id_1):', {
            message: deleteRelationshipsError1.message || 'Unknown error',
            code: deleteRelationshipsError1.code || null,
            details: deleteRelationshipsError1
          });
        }
        // Continue with deletion even if this fails
      }

      const { error: deleteRelationshipsError2 } = await supabase
        .from('participant_relationships')
        .delete()
        .eq('participant_id_2', participantId);

      if (deleteRelationshipsError2) {
        // Check if error is due to missing table - this is fine, just skip silently
        if (deleteRelationshipsError2.code === 'PGRST205' || deleteRelationshipsError2.message?.includes('Could not find the table')) {
          // Table doesn't exist yet - this is fine, just continue
        } else {
          // Log other errors with meaningful content
          console.error('Error deleting participant relationships (id_2):', {
            message: deleteRelationshipsError2.message || 'Unknown error',
            code: deleteRelationshipsError2.code || null,
            details: deleteRelationshipsError2
          });
        }
        // Continue with deletion even if this fails
      }

      // Finally, delete the participant itself
      const { error: deleteParticipantError } = await supabase
        .from('participants')
        .delete()
        .eq('id', participantId);

      if (deleteParticipantError) {
        throw deleteParticipantError;
      }

      // Redirect to participants page
      router.push('/participants');
    } catch (err: any) {
      console.error('Error deleting participant:', err);
      alert('Failed to delete participant. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const fetchAvailableGroupPlans = async (groupId?: string | null) => {
    try {
      setLoadingGroupPlans(true);
      
      // Fetch active group plans (not terminated)
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

      setAvailableGroupPlans(data || []);
    } catch (err: any) {
      console.error('Error fetching group plans:', err);
    } finally {
      setLoadingGroupPlans(false);
    }
  };

  const fetchPlanOptionsForPlan = async (groupPlanId: string) => {
    try {
      // Fetch plan options
      const { data: optionsData, error: optionsError } = await supabase
        .from('group_plan_options')
        .select('*')
        .eq('group_plan_id', groupPlanId)
        .order('option', { ascending: true });

      if (optionsError) {
        throw optionsError;
      }

      if (!optionsData || optionsData.length === 0) {
        setPlanOptionsMap(prev => {
          const newMap = new Map(prev);
          newMap.set(groupPlanId, []);
          return newMap;
        });
        return;
      }

      // Fetch rates for each option
      const optionsWithRates = await Promise.all(
        optionsData.map(async (option: any) => {
          const { data: ratesData, error: ratesError } = await supabase
            .from('group_option_rates')
            .select('*')
            .eq('group_plan_option_id', option.id)
            .order('start_date', { ascending: false });

          if (ratesError) {
            console.error('Error fetching rates:', ratesError);
            return {
              ...option,
              rates: [],
              activeRate: null,
            };
          }


          // Find active rate (no end_date or end_date in future)
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const activeRate = (ratesData || []).find((rate: any) => {
            if (!rate.end_date) return true;
            const endDate = new Date(rate.end_date);
            endDate.setHours(0, 0, 0, 0);
            return endDate >= today;
          }) || null;

          return {
            ...option,
            rates: ratesData || [],
            activeRate,
          };
        })
      );

      setPlanOptionsMap(prev => {
        const newMap = new Map(prev);
        newMap.set(groupPlanId, optionsWithRates);
        return newMap;
      });
    } catch (err: any) {
      console.error('Error fetching plan options:', err);
    }
  };

  const fetchAvailableMedicarePlans = async () => {
    try {
      setLoadingMedicarePlans(true);
      
      const { data, error } = await supabase
        .from('medicare_plans')
        .select(`
          id,
          plan_name,
          provider:providers (
            id,
            name
          )
        `)
        .order('plan_name', { ascending: true });

      if (error) {
        throw error;
      }

      setAvailableMedicarePlans(data || []);
    } catch (err: any) {
      console.error('Error fetching Medicare plans:', err);
    } finally {
      setLoadingMedicarePlans(false);
    }
  };

  const fetchMedicarePlanRatesForPlan = async (medicarePlanId: string) => {
    try {
      const { data: ratesData, error: ratesError } = await supabase
        .from('medicare_child_rates')
        .select('*')
        .eq('medicare_plan_id', medicarePlanId)
        .order('start_date', { ascending: false });

      if (ratesError) {
        throw ratesError;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const calculateRateStatus = (startDate: string | null, endDate: string | null): 'Pending' | 'Active' | 'Ended' => {
        if (!startDate) return 'Ended';
        
        const todayStr = today.toISOString().split('T')[0];
        const start = new Date(startDate).toISOString().split('T')[0];
        
        // If start date is in the future, it's Pending
        if (start > todayStr) {
          return 'Pending';
        }
        
        // If end date is null or in the future, it's Active
        if (!endDate || endDate >= todayStr) {
          return 'Active';
        }
        
        // Otherwise, it's Ended
        return 'Ended';
      };
      
      const rates = (ratesData || []).map((rate: any) => {
        const status = calculateRateStatus(rate.start_date, rate.end_date);
        return {
          ...rate,
          status,
          isActive: status === 'Active',
        };
      });

      // Find current rate with priority:
      // 1. Current rate (status "Active")
      // 2. Next pending rate (status "Pending", earliest start_date)
      // 3. Last rate (most recent by start_date)
      let activeRate: any = null;
      
      const activeRates = rates.filter((r: any) => r.status === 'Active');
      const pendingRates = rates.filter((r: any) => r.status === 'Pending');
      const endedRates = rates.filter((r: any) => r.status === 'Ended');
      
      // Priority 1: Most recent active rate
      if (activeRates.length > 0) {
        activeRate = activeRates.reduce((latest: any, current: any) => {
          const currentStart = current.start_date ? new Date(current.start_date).getTime() : 0;
          const latestStart = latest.start_date ? new Date(latest.start_date).getTime() : 0;
          return currentStart > latestStart ? current : latest;
        });
      }
      // Priority 2: Next pending rate (earliest start_date)
      else if (pendingRates.length > 0) {
        activeRate = pendingRates.reduce((earliest: any, current: any) => {
          const currentStart = current.start_date 
            ? new Date(current.start_date).getTime() 
            : Infinity;
          const earliestStart = earliest.start_date 
            ? new Date(earliest.start_date).getTime() 
            : Infinity;
          return currentStart < earliestStart ? current : earliest;
        });
      }
      // Priority 3: Last rate (most recent by start_date)
      else if (endedRates.length > 0) {
        activeRate = endedRates.reduce((latest: any, current: any) => {
          const currentStart = current.start_date ? new Date(current.start_date).getTime() : 0;
          const latestStart = latest.start_date ? new Date(latest.start_date).getTime() : 0;
          return currentStart > latestStart ? current : latest;
        });
      }

      const ratesDataObj = {
        rates,
        activeRate,
      };

      setMedicarePlanRatesMap(prev => {
        const newMap = new Map(prev);
        newMap.set(medicarePlanId, ratesDataObj);
        return newMap;
      });

      return ratesDataObj;
    } catch (err: any) {
      console.error('Error fetching Medicare plan rates:', err);
      const emptyData = {
        rates: [],
        activeRate: null,
      };
      setMedicarePlanRatesMap(prev => {
        const newMap = new Map(prev);
        newMap.set(medicarePlanId, emptyData);
        return newMap;
      });
      return emptyData;
    }
  };

  const handleAddPlan = () => {
    if (!showAddPlanForm && availableGroupPlans.length === 0) {
      fetchAvailableGroupPlans(participant?.group_id);
    }
    const newId = `temp-${Date.now()}-${Math.random()}`;
    setNewPlans([...newPlans, {
      id: newId,
      group_plan_id: '',
      group_plan_option_id: '',
      group_option_rate_id: '',
      rate_override: '',
      include_type: '',
      effective_date: '',
      employer_contribution_type: '',
      class_1_contribution_amount: '',
      class_2_contribution_amount: '',
      class_3_contribution_amount: '',
    }]);
    setShowAddPlanForm(true);
  };

  const handleAddMedicarePlan = () => {
    if (!showAddMedicarePlanForm && availableMedicarePlans.length === 0) {
      fetchAvailableMedicarePlans();
    }
    const newId = `temp-${Date.now()}-${Math.random()}`;
    const today = new Date().toISOString().split('T')[0];
    setNewMedicarePlans([...newMedicarePlans, {
      id: newId,
      medicare_plan_id: '',
      medicare_child_rate_id: '',
      effective_date: today,
    }]);
    setShowAddMedicarePlanForm(true);
  };

  const handleRemoveMedicarePlan = (id: string) => {
    const updatedPlans = newMedicarePlans.filter(p => p.id !== id);
    setNewMedicarePlans(updatedPlans);
    if (updatedPlans.length === 0) {
      setShowAddMedicarePlanForm(false);
    }
  };

  const handleMedicarePlanChange = async (id: string, field: string, value: string) => {
    if (field === 'medicare_plan_id' && value) {
      // Fetch rates first, then update the plan with auto-selected active rate
      const planRates = await fetchMedicarePlanRatesForPlan(value);
      setNewMedicarePlans(newMedicarePlans.map(plan => {
        if (plan.id === id) {
          const today = new Date().toISOString().split('T')[0];
          const updated = { 
            ...plan, 
            [field]: value, 
            medicare_child_rate_id: '',
            effective_date: plan.effective_date || today
          };
          // Auto-select the active rate if available
          if (planRates?.activeRate?.id) {
            updated.medicare_child_rate_id = planRates.activeRate.id;
          }
          return updated;
        }
        return plan;
      }));
    } else {
      setNewMedicarePlans(newMedicarePlans.map(plan => {
        if (plan.id === id) {
          return { ...plan, [field]: value };
        }
        return plan;
      }));
    }
  };

  const handleSaveMedicarePlans = async () => {
    setIsSubmitting(true);

    try {
      if (!participantId) {
        throw new Error('Participant ID is required');
      }

      const plansToInsert = newMedicarePlans
        .filter(p => p.medicare_plan_id.trim() !== '')
        .map(p => {
          const insertData: any = {
            participant_id: participantId,
            medicare_plan_id: p.medicare_plan_id,
          };

          if (p.medicare_child_rate_id) {
            insertData.medicare_child_rate_id = p.medicare_child_rate_id;
          }
          if (p.effective_date) {
            insertData.effective_date = p.effective_date;
          }

          return insertData;
        });

      if (plansToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('participant_medicare_plans')
          .insert(plansToInsert);

        if (insertError) {
          throw insertError;
        }
      }

      await fetchMedicarePlans();

      setNewMedicarePlans([]);
      setShowAddMedicarePlanForm(false);

      alert('Medicare plan(s) added successfully!');
    } catch (err: any) {
      console.error('Error saving Medicare plans:', err);
      alert('Failed to add Medicare plan(s). Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemovePlan = (id: string) => {
    const updatedPlans = newPlans.filter(p => p.id !== id);
    setNewPlans(updatedPlans);
    if (updatedPlans.length === 0) {
      setShowAddPlanForm(false);
    }
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

  const handlePlanChange = (id: string, field: string, value: string) => {
    setNewPlans(newPlans.map(plan => {
      if (plan.id === id) {
        const updated = { ...plan, [field]: value };
        // If plan changed, reset option, rate, include_type, and set default effective_date
        if (field === 'group_plan_id') {
          updated.group_plan_option_id = '';
          updated.group_option_rate_id = '';
          updated.include_type = '';
          
          // Set default effective_date based on plan's effective_date or next first of month
          if (value) {
            const selectedPlan = availableGroupPlans.find(p => p.id === value);
            updated.effective_date = calculateDefaultEffectiveDate(selectedPlan?.effective_date || null);
          } else {
            updated.effective_date = '';
          }
          
          // Fetch options for the new plan
          if (value) {
            fetchPlanOptionsForPlan(value);
          }
        }
        // If option changed, automatically set the active rate ID
        if (field === 'group_plan_option_id') {
          updated.group_option_rate_id = '';
          // Find the active rate for this option
          const planOptions = planOptionsMap.get(updated.group_plan_id) || [];
          const selectedOption = planOptions.find((o: any) => o.id === value);
          if (selectedOption?.activeRate?.id) {
            updated.group_option_rate_id = selectedOption.activeRate.id;
          }
        }
        return updated;
      }
      return plan;
    }));
  };

  const handleSavePlans = async () => {
    setIsSubmitting(true);

    try {
      if (!participantId) {
        throw new Error('Participant ID is required');
      }

      // Process each plan
      const allRecordsToInsert: any[] = [];

      for (const newPlan of newPlans.filter(p => p.group_plan_id.trim() !== '')) {
        const selectedPlan = availableGroupPlans.find(p => p.id === newPlan.group_plan_id);
        const planOptions = planOptionsMap.get(newPlan.group_plan_id) || [];

        // Validation: Require effective_date
        if (!newPlan.effective_date) {
          throw new Error(`Effective date is required for plan "${selectedPlan?.plan_name || 'selected plan'}"`);
        }

        // Handle Age Banded plans
        if (selectedPlan?.plan_type === 'Age Banded') {
          // Validation: Require include_type selection
          if (!newPlan.include_type) {
            throw new Error(`Please select a plan option for plan "${selectedPlan.plan_name}"`);
          }

          // Validation: Check DOB requirements
          const spouseDependents = dependents.filter(dep => dep.relationship === 'Spouse');
          const childDependents = dependents.filter(dep => dep.relationship === 'Child');
          
          if (newPlan.include_type === 'Employee and Spouse' || newPlan.include_type === 'Employee, Spouse, and Children') {
            if (spouseDependents.length === 0) {
              throw new Error(`Please add a spouse dependent before selecting an option that includes spouse for plan "${selectedPlan.plan_name}"`);
            }
            const spousesWithoutDOB = spouseDependents.filter(dep => !dep.dob);
            if (spousesWithoutDOB.length > 0) {
              throw new Error(`All spouse dependents must have a date of birth for plan "${selectedPlan.plan_name}"`);
            }
          }
          
          if (newPlan.include_type === 'Employee and Children' || newPlan.include_type === 'Employee, Spouse, and Children') {
            if (childDependents.length === 0) {
              throw new Error(`Please add child dependents before selecting an option that includes children for plan "${selectedPlan.plan_name}"`);
            }
            const childrenWithoutDOB = childDependents.filter(dep => !dep.dob);
            if (childrenWithoutDOB.length > 0) {
              throw new Error(`All child dependents must have a date of birth for plan "${selectedPlan.plan_name}"`);
            }
          }

          // Validation: Participant must have DOB
          if (!participant?.dob) {
            throw new Error(`Participant must have a date of birth for Age Banded plan "${selectedPlan.plan_name}"`);
          }

          // For Age Banded plans, create ONE participant_group_plans record per person (employee, spouse, each child)
          // Each record will have the appropriate dependent_id set
          const planRecordsToCreate: Array<{
            participant_id: string;
            group_plan_id: string;
            dependent_id: string | null;
            group_option_rate_id: string;
          }> = [];
          
          // Determine who to include
          const includeEmployee = true;
          const includeSpouse = newPlan.include_type === 'Employee and Spouse' || newPlan.include_type === 'Employee, Spouse, and Children';
          const includeChildren = newPlan.include_type === 'Employee and Children' || newPlan.include_type === 'Employee, Spouse, and Children';

          // Process Employee
          if (includeEmployee && participant.dob) {
            const employeeAge = calculateAge(participant.dob);
            if (employeeAge !== null) {
              const matchingOption = findMatchingAgeOption(employeeAge, planOptions);
              if (matchingOption) {
                // Find active rate for the effective_date
                const activeRate = findActiveRateForDate(matchingOption.rates || [], newPlan.effective_date);
                if (activeRate) {
                  planRecordsToCreate.push({
                    participant_id: participantId,
                    group_plan_id: newPlan.group_plan_id,
                    dependent_id: null, // Employee has no dependent_id
                    group_option_rate_id: activeRate.id,
                  });
                } else {
                  throw new Error(`No active rate found for employee age option "${matchingOption.option}" on effective date ${newPlan.effective_date} for plan "${selectedPlan.plan_name}"`);
                }
              }
            }
          }

          // Process Spouse Dependents
          if (includeSpouse) {
            const spouseDependents = dependents.filter(dep => dep.relationship === 'Spouse' && dep.dob);
            for (const spouse of spouseDependents) {
              const spouseAge = calculateAge(spouse.dob);
              if (spouseAge !== null) {
                const matchingOption = findMatchingAgeOption(spouseAge, planOptions);
                if (matchingOption) {
                  // Find active rate for the effective_date
                  const activeRate = findActiveRateForDate(matchingOption.rates || [], newPlan.effective_date);
                  if (activeRate) {
                    planRecordsToCreate.push({
                      participant_id: participantId,
                      group_plan_id: newPlan.group_plan_id,
                      dependent_id: spouse.id, // Link to spouse dependent
                      group_option_rate_id: activeRate.id,
                    });
                  } else {
                    throw new Error(`No active rate found for spouse "${spouse.name}" age option "${matchingOption.option}" on effective date ${newPlan.effective_date} for plan "${selectedPlan.plan_name}"`);
                  }
                }
              }
            }
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
                  const activeRate = findActiveRateForDate(matchingOption.rates || [], newPlan.effective_date);
                  if (activeRate) {
                    planRecordsToCreate.push({
                      participant_id: participantId,
                      group_plan_id: newPlan.group_plan_id,
                      dependent_id: child.id, // Link to child dependent
                      group_option_rate_id: activeRate.id,
                    });
                  } else {
                    throw new Error(`No active rate found for child "${child.name}" age option "${matchingOption.option}" on effective date ${newPlan.effective_date} for plan "${selectedPlan.plan_name}"`);
                  }
                }
              }
            }
          }

          if (planRecordsToCreate.length === 0) {
            throw new Error(`No matching age options found for plan "${selectedPlan.plan_name}". Please check that age rates are configured.`);
          }

          // Create participant_group_plans records (one per person)
          const { data: insertedPlans, error: insertError } = await supabase
            .from('participant_group_plans')
            .insert(planRecordsToCreate.map(record => ({
              participant_id: record.participant_id,
              group_plan_id: record.group_plan_id,
              dependent_id: record.dependent_id,
              effective_date: newPlan.effective_date,
              // Don't set group_plan_option_id - that's tracked via junction table
            })))
            .select();

          if (insertError) {
            throw insertError;
          }

          // Fetch group plan to get contribution values
          const { data: groupPlanData } = await supabase
            .from('group_plans')
            .select('employer_contribution_type, employer_contribution_value, employer_spouse_contribution_value, employer_child_contribution_value')
            .eq('id', newPlan.group_plan_id)
            .single();

          // Create junction table records, linking each participant_group_plans record to its rate
          const junctionRecordsToInsert = insertedPlans.map((insertedPlan, index) => {
            const planRecord = planRecordsToCreate[index];
            // Determine which contribution applies based on dependent_id
            let contributionAmount: number | null = null;
            if (!planRecord.dependent_id) {
              // Employee
              contributionAmount = groupPlanData?.employer_contribution_value || null;
            } else {
              // Find dependent to determine relationship
              const dependent = dependents.find(d => d.id === planRecord.dependent_id);
              if (dependent) {
                if (dependent.relationship === 'Spouse') {
                  contributionAmount = groupPlanData?.employer_spouse_contribution_value || null;
                } else if (dependent.relationship === 'Child') {
                  contributionAmount = groupPlanData?.employer_child_contribution_value || null;
                }
              }
            }

            return {
              participant_group_plan_id: insertedPlan.id,
              group_option_rate_id: planRecord.group_option_rate_id,
              employer_contribution_type: groupPlanData?.employer_contribution_type || null,
              employer_contribution_amount: contributionAmount,
              start_date: newPlan.effective_date,
              end_date: null,
            };
          });

          const { error: junctionError } = await supabase
            .from('participant_group_plan_rates')
            .insert(junctionRecordsToInsert);

          if (junctionError) {
            console.error('Error creating junction records:', junctionError);
            alert(`Plan records created for "${selectedPlan.plan_name}", but failed to link rates. Please check rate connections.`);
          }
        } else {
          // Handle non-Age Banded plans (Composite, etc.)
          
          // Validation: For Composite plans, require plan option
          if (selectedPlan?.plan_type === 'Composite') {
            if (!newPlan.group_plan_option_id) {
              throw new Error(`Plan option is required for Composite plan "${selectedPlan.plan_name}"`);
            }
            // Verify that an active rate exists for the effective_date
            const selectedOption = planOptions.find((o: any) => o.id === newPlan.group_plan_option_id);
            if (selectedOption) {
              const activeRate = findActiveRateForDate(selectedOption.rates || [], newPlan.effective_date);
              if (!activeRate) {
                throw new Error(`No active rate found for plan option "${selectedOption.option}" on effective date ${newPlan.effective_date} for plan "${selectedPlan.plan_name}"`);
              }
            }
          }

          const insertData: any = {
            participant_id: participantId,
            group_plan_id: newPlan.group_plan_id,
            effective_date: newPlan.effective_date,
          };

          if (newPlan.group_plan_option_id) {
            insertData.group_plan_option_id = newPlan.group_plan_option_id;
          }
          if (newPlan.group_option_rate_id) {
            insertData.group_option_rate_id = newPlan.group_option_rate_id;
          }
          if (newPlan.rate_override) {
            insertData.rate_override = parseFloat(newPlan.rate_override);
          }

          // Add Composite plan fields if plan type is Composite
          if (selectedPlan?.plan_type === 'Composite') {
            if (newPlan.employer_contribution_type) {
              insertData.employer_contribution_type = newPlan.employer_contribution_type;
            }
            if (newPlan.class_1_contribution_amount) {
              insertData.class_1_contribution_amount = parseFloat(newPlan.class_1_contribution_amount);
            }
            if (newPlan.class_2_contribution_amount) {
              insertData.class_2_contribution_amount = parseFloat(newPlan.class_2_contribution_amount);
            }
            if (newPlan.class_3_contribution_amount) {
              insertData.class_3_contribution_amount = parseFloat(newPlan.class_3_contribution_amount);
            }
          }

          allRecordsToInsert.push(insertData);
        }
      }

      // Insert all records
      if (allRecordsToInsert.length > 0) {
        const { data: insertedPlans, error: insertError } = await supabase
          .from('participant_group_plans')
          .insert(allRecordsToInsert)
          .select();

        if (insertError) {
          throw insertError;
        }

        // For Composite plans, create participant_group_plan_rates junction records
        if (insertedPlans) {
          const junctionRecordsToInsert: any[] = [];
          
          for (let i = 0; i < insertedPlans.length; i++) {
            const insertedPlan = insertedPlans[i];
            const newPlan = newPlans.find(p => p.group_plan_id === insertedPlan.group_plan_id);
            const selectedPlan = availableGroupPlans.find(p => p.id === insertedPlan.group_plan_id);
            
            if (newPlan && selectedPlan?.plan_type === 'Composite' && newPlan.group_plan_option_id) {
              // Fetch group plan to get contribution values
              const { data: groupPlanData } = await supabase
                .from('group_plans')
                .select('employer_contribution_type, employer_contribution_value')
                .eq('id', insertedPlan.group_plan_id)
                .single();

              const planOptions = planOptionsMap.get(newPlan.group_plan_id) || [];
              const selectedOption = planOptions.find((o: any) => o.id === newPlan.group_plan_option_id);
              
              if (selectedOption) {
                const activeRate = findActiveRateForDate(selectedOption.rates || [], newPlan.effective_date);
                if (activeRate) {
                  junctionRecordsToInsert.push({
                    participant_group_plan_id: insertedPlan.id,
                    group_option_rate_id: activeRate.id,
                    employer_contribution_type: groupPlanData?.employer_contribution_type || null,
                    employer_contribution_amount: groupPlanData?.employer_contribution_value || null,
                    start_date: newPlan.effective_date,
                    end_date: null,
                  });
                }
              }
            }
          }

          if (junctionRecordsToInsert.length > 0) {
            const { error: junctionError } = await supabase
              .from('participant_group_plan_rates')
              .insert(junctionRecordsToInsert);

            if (junctionError) {
              console.error('Error creating junction records:', junctionError);
              // Don't throw - plan records were created successfully
              alert('Plan records created, but failed to link rates. Please check rate connections.');
            }
          }
        }
      }

      // Refresh plans
      await fetchPlans();

      // Clear new plans and hide form
      setNewPlans([]);
      setShowAddPlanForm(false);
      setPlanOptionsMap(new Map());

      alert('Plan(s) added successfully!');
    } catch (err: any) {
      console.error('Error saving plans:', err);
      alert(err.message || 'Failed to add plan(s). Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!planToDelete) return;

    try {
      setIsDeletingPlan(true);

      // Check if it's a Medicare plan or group plan
      const isMedicarePlan = 'medicare_plan_id' in planToDelete;
      const tableName = isMedicarePlan ? 'participant_medicare_plans' : 'participant_group_plans';

      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .eq('id', planToDelete.id);

      if (deleteError) {
        throw deleteError;
      }

      // Refresh the appropriate plans
      if (isMedicarePlan) {
        await fetchMedicarePlans();
      } else {
        await fetchPlans();
      }

      // Close dialog
      setPlanToDelete(null);

      alert('Participant plan deleted successfully!');
    } catch (err: any) {
      console.error('Error deleting plan:', err);
      alert('Failed to delete participant plan. Please try again.');
    } finally {
      setIsDeletingPlan(false);
    }
  };

  const handleAddDependent = () => {
    const newId = `temp-${Date.now()}-${Math.random()}`;
    setNewDependents([...newDependents, {
      id: newId,
      name: '',
      relationship: '',
      dob: '',
    }]);
    setShowAddDependentForm(true);
  };

  const handleRemoveDependent = (id: string) => {
    const updatedDependents = newDependents.filter(d => d.id !== id);
    setNewDependents(updatedDependents);
    if (updatedDependents.length === 0) {
      setShowAddDependentForm(false);
    }
  };

  const handleDependentChange = (id: string, field: string, value: string) => {
    setNewDependents(newDependents.map(dep => 
      dep.id === id ? { ...dep, [field]: value } : dep
    ));
  };

  const handleSaveDependents = async () => {
    setIsSubmitting(true);

    try {
      if (!participantId) {
        throw new Error('Participant ID is required');
      }

      // Save new dependents
      const dependentsToInsert = newDependents
        .filter(d => d.name.trim() !== '' && d.relationship.trim() !== '')
        .map(d => {
          const insertData: any = {
            participant_id: participantId,
            name: d.name.trim(),
            relationship: d.relationship.trim(),
          };

          if (d.dob) {
            insertData.dob = d.dob;
          }

          return insertData;
        });

      if (dependentsToInsert.length > 0) {
        const { data: insertedDependents, error: insertError } = await supabase
          .from('dependents')
          .insert(dependentsToInsert)
          .select();

        if (insertError) {
          throw insertError;
        }

        // Automatically add dependents to existing Age Banded and Composite plans
        if (insertedDependents && insertedDependents.length > 0) {
          await addDependentsToExistingPlans(insertedDependents);
        }
      }

      // Refresh dependents and plans
      await fetchDependents();
      await fetchPlans();

      // Clear new dependents and hide form
      setNewDependents([]);
      setShowAddDependentForm(false);

      alert('Dependent(s) added successfully!');
    } catch (err: any) {
      console.error('Error saving dependents:', err);
      alert('Failed to add dependent(s). Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddRelationship = () => {
    const newId = `temp-${Date.now()}-${Math.random()}`;
    setNewRelationships([...newRelationships, {
      id: newId,
      related_participant_id: '',
      related_participant_name: '',
      relationship: 'Spouses' as 'Spouses' | 'Parent/Child',
      is_representative: false,
      representative_participant_id: '',
      notes: '',
    }]);
    setShowAddRelationshipForm(true);
  };

  const handleRemoveRelationship = (id: string) => {
    const updatedRelationships = newRelationships.filter(r => r.id !== id);
    setNewRelationships(updatedRelationships);
    if (updatedRelationships.length === 0) {
      setShowAddRelationshipForm(false);
    }
  };

  const handleRelationshipChange = (id: string, field: string, value: any) => {
    setNewRelationships(newRelationships.map(rel => 
      rel.id === id ? { ...rel, [field]: value } : rel
    ));
  };

  const handleSaveRelationships = async () => {
    setIsSubmitting(true);

    try {
      if (!participantId) {
        throw new Error('Participant ID is required');
      }

      // Save new relationships
      const relationshipsToInsert = newRelationships
        .filter(r => r.related_participant_id.trim() !== '' && r.relationship)
        .map(r => {
          // If we have a name but no ID, try to find the participant by name
          let relatedParticipantId = r.related_participant_id;
          if (!relatedParticipantId && r.related_participant_name.trim()) {
            const foundParticipant = allParticipants.find(
              p => p.client_name.toLowerCase() === r.related_participant_name.toLowerCase()
            );
            if (foundParticipant) {
              relatedParticipantId = foundParticipant.id;
            } else {
              throw new Error(`Participant "${r.related_participant_name}" not found. Please select from the dropdown.`);
            }
          }
          // Ensure participant_id_1 < participant_id_2
          const participant1 = participantId < relatedParticipantId 
            ? participantId 
            : relatedParticipantId;
          const participant2 = participantId < relatedParticipantId 
            ? relatedParticipantId 
            : participantId;

          const insertData: any = {
            participant_id_1: participant1,
            participant_id_2: participant2,
            relationship: r.relationship,
            is_representative: r.is_representative,
            notes: r.notes.trim() || null,
          };

          if (r.is_representative && r.representative_participant_id) {
            insertData.representative_participant_id = r.representative_participant_id;
          } else {
            insertData.representative_participant_id = null;
          }

          return insertData;
        });

      if (relationshipsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('participant_relationships')
          .insert(relationshipsToInsert);

        if (insertError) {
          throw insertError;
        }
      }

      // Refresh relationships
      await fetchRelationships();

      // Clear new relationships and hide form
      setNewRelationships([]);
      setShowAddRelationshipForm(false);

      alert('Relationship(s) added successfully!');
    } catch (err: any) {
      console.error('Error saving relationships:', err);
      alert(`Failed to add relationship(s): ${err.message || 'Please try again.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRelationship = async (relationshipId: string) => {
    if (!confirm('Are you sure you want to delete this relationship?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('participant_relationships')
        .delete()
        .eq('id', relationshipId);

      if (error) {
        throw error;
      }

      await fetchRelationships();
      alert('Relationship deleted successfully!');
    } catch (err: any) {
      console.error('Error deleting relationship:', err);
      alert('Failed to delete relationship. Please try again.');
    }
  };

  // Automatically add new dependents to existing Age Banded and Composite plans
  const addDependentsToExistingPlans = async (newDependents: any[]) => {
    try {
      // Fetch all existing employee plans (no dependent_id) for this participant
      const { data: existingPlans, error: plansError } = await supabase
        .from('participant_group_plans')
        .select(`
          *,
          group_plan:group_plans (
            id,
            plan_name,
            plan_type,
            effective_date
          )
        `)
        .eq('participant_id', participantId)
        .is('dependent_id', null); // Only get employee plans (no dependent_id)

      if (plansError || !existingPlans || existingPlans.length === 0) {
        return; // No existing plans to add dependents to
      }

      const plansToProcess: any[] = [];

      for (const plan of existingPlans) {
        const groupPlan = plan.group_plan as any;
        if (!groupPlan) continue;

        // Process Age Banded plans
        if (groupPlan.plan_type === 'Age Banded') {
          // Check if this plan should include the new dependents
          // We need to check the plan's include_type by looking at existing dependent plans
          const { data: dependentPlans } = await supabase
            .from('participant_group_plans')
            .select('dependent_id, dependent:dependents(relationship)')
            .eq('participant_id', participantId)
            .eq('group_plan_id', plan.group_plan_id)
            .not('dependent_id', 'is', null);

          // Determine include_type based on existing dependent plans
          const hasSpousePlans = dependentPlans?.some((dp: any) => dp.dependent?.relationship === 'Spouse');
          const hasChildPlans = dependentPlans?.some((dp: any) => dp.dependent?.relationship === 'Child');

          let includeType = 'Employee';
          if (hasSpousePlans && hasChildPlans) {
            includeType = 'Employee, Spouse, and Children';
          } else if (hasSpousePlans) {
            includeType = 'Employee and Spouse';
          } else if (hasChildPlans) {
            includeType = 'Employee and Children';
          }

          // Check if we should add the new dependents based on include_type
          const shouldAddSpouse = includeType === 'Employee and Spouse' || includeType === 'Employee, Spouse, and Children';
          const shouldAddChildren = includeType === 'Employee and Children' || includeType === 'Employee, Spouse, and Children';

          for (const newDep of newDependents) {
            const relationship = newDep.relationship;
            const shouldAdd = (relationship === 'Spouse' && shouldAddSpouse) || (relationship === 'Child' && shouldAddChildren);

            if (shouldAdd && newDep.dob) {
              // Check if plan record already exists for this dependent
              const existingDepPlan = dependentPlans?.find((dp: any) => dp.dependent_id === newDep.id);
              if (!existingDepPlan) {
                plansToProcess.push({
                  plan,
                  dependent: newDep,
                  planType: 'Age Banded',
                });
              }
            }
          }
        }
        // Process Composite plans
        else if (groupPlan.plan_type === 'Composite') {
          // For Composite plans, add all new dependents
          for (const newDep of newDependents) {
            // Check if plan record already exists for this dependent
            const { data: existingDepPlan } = await supabase
              .from('participant_group_plans')
              .select('id')
              .eq('participant_id', participantId)
              .eq('group_plan_id', plan.group_plan_id)
              .eq('dependent_id', newDep.id)
              .single();

            if (!existingDepPlan) {
              plansToProcess.push({
                plan,
                dependent: newDep,
                planType: 'Composite',
              });
            }
          }
        }
      }

      // Process all plans that need dependent records created
      if (plansToProcess.length > 0) {
        const planRecordsToCreate: any[] = [];
        const junctionRecordsToCreate: any[] = [];

        for (const item of plansToProcess) {
          const { plan, dependent, planType } = item;
          const groupPlan = plan.group_plan as any;

          if (planType === 'Age Banded') {
            // Fetch plan options
            const { data: planOptions } = await supabase
              .from('group_plan_options')
              .select('*')
              .eq('group_plan_id', plan.group_plan_id)
              .order('option', { ascending: true });

            if (!planOptions || planOptions.length === 0) continue;

            // Calculate age and find matching option
            const depAge = calculateAge(dependent.dob);
            if (depAge === null) continue;

            const matchingOption = findMatchingAgeOption(depAge, planOptions);
            if (!matchingOption) continue;

            // Fetch rates for the option
            const { data: rates } = await supabase
              .from('group_option_rates')
              .select('*')
              .eq('group_plan_option_id', matchingOption.id)
              .order('start_date', { ascending: false });

            if (!rates || rates.length === 0) continue;

            // Find active rate for the plan's effective_date
            const planEffectiveDate = groupPlan.effective_date || plan.effective_date;
            const activeRate = findActiveRateForDate(rates, planEffectiveDate || new Date().toISOString().split('T')[0]);

            if (activeRate) {
              planRecordsToCreate.push({
                participant_id: participantId,
                group_plan_id: plan.group_plan_id,
                dependent_id: dependent.id,
                effective_date: planEffectiveDate || plan.effective_date,
                group_option_rate_id: activeRate.id,
              });
            }
          } else if (planType === 'Composite') {
            // For Composite plans, use the same option and rate as the employee plan
            const { data: planOptions } = await supabase
              .from('group_plan_options')
              .select('*')
              .eq('group_plan_id', plan.group_plan_id)
              .order('option', { ascending: true });

            if (!planOptions || planOptions.length === 0) continue;

            // Use the same option as the employee plan
            const employeeOptionId = plan.group_plan_option_id;
            if (!employeeOptionId) continue;

            const selectedOption = planOptions.find((o: any) => o.id === employeeOptionId);
            if (!selectedOption) continue;

            // Fetch rates for the option
            const { data: rates } = await supabase
              .from('group_option_rates')
              .select('*')
              .eq('group_plan_option_id', selectedOption.id)
              .order('start_date', { ascending: false });

            if (!rates || rates.length === 0) continue;

            // Find active rate for the plan's effective_date
            const planEffectiveDate = groupPlan.effective_date || plan.effective_date;
            const activeRate = findActiveRateForDate(rates, planEffectiveDate || new Date().toISOString().split('T')[0]);

            if (activeRate) {
              planRecordsToCreate.push({
                participant_id: participantId,
                group_plan_id: plan.group_plan_id,
                dependent_id: dependent.id,
                group_plan_option_id: employeeOptionId,
                effective_date: planEffectiveDate || plan.effective_date,
                group_option_rate_id: activeRate.id,
              });
            }
          }
        }

        // Create participant_group_plans records
        if (planRecordsToCreate.length > 0) {
          const insertData = planRecordsToCreate.map(record => ({
            participant_id: record.participant_id,
            group_plan_id: record.group_plan_id,
            dependent_id: record.dependent_id,
            group_plan_option_id: record.group_plan_option_id || null,
            effective_date: record.effective_date,
          }));

          const { data: insertedPlans, error: insertError } = await supabase
            .from('participant_group_plans')
            .insert(insertData)
            .select();

          if (insertError) {
            console.error('Error creating plan records for dependents:', insertError);
          } else if (insertedPlans) {
            // Fetch group plan data to get contribution values
            const groupPlanIds = [...new Set(planRecordsToCreate.map(r => r.group_plan_id))];
            const groupPlansMap = new Map();
            
            for (const groupPlanId of groupPlanIds) {
              const { data: groupPlanData } = await supabase
                .from('group_plans')
                .select('id, employer_contribution_type, employer_contribution_value, employer_spouse_contribution_value, employer_child_contribution_value')
                .eq('id', groupPlanId)
                .single();
              
              if (groupPlanData) {
                groupPlansMap.set(groupPlanId, groupPlanData);
              }
            }

            // Create junction table records for Age Banded plans
            for (let i = 0; i < insertedPlans.length; i++) {
              const insertedPlan = insertedPlans[i];
              const record = planRecordsToCreate[i];
              const groupPlan = groupPlansMap.get(record.group_plan_id);

              if (record.group_option_rate_id && groupPlan) {
                // Determine which contribution applies based on dependent relationship
                let contributionAmount: number | null = null;
                const dependent = dependents.find(d => d.id === record.dependent_id);
                
                if (!record.dependent_id) {
                  // Employee
                  contributionAmount = groupPlan.employer_contribution_value || null;
                } else if (dependent) {
                  if (dependent.relationship === 'Spouse') {
                    contributionAmount = groupPlan.employer_spouse_contribution_value || null;
                  } else if (dependent.relationship === 'Child') {
                    contributionAmount = groupPlan.employer_child_contribution_value || null;
                  }
                }

                // Get the rate to calculate start_date
                const { data: rateData } = await supabase
                  .from('group_option_rates')
                  .select('start_date')
                  .eq('id', record.group_option_rate_id)
                  .single();

                junctionRecordsToCreate.push({
                  participant_group_plan_id: insertedPlan.id,
                  group_option_rate_id: record.group_option_rate_id,
                  employer_contribution_type: groupPlan.employer_contribution_type || null,
                  employer_contribution_amount: contributionAmount,
                  start_date: rateData?.start_date || record.effective_date || null,
                  end_date: null,
                });
              }
            }

            // Insert junction records
            if (junctionRecordsToCreate.length > 0) {
              const { error: junctionError } = await supabase
                .from('participant_group_plan_rates')
                .insert(junctionRecordsToCreate);

              if (junctionError) {
                console.error('Error creating junction records for dependents:', junctionError);
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Error adding dependents to existing plans:', err);
      // Don't throw - dependents were saved successfully, this is just automation
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!participantId) {
        throw new Error('Participant ID is required');
      }

      // Validate required fields
      if (!formData.client_name || formData.client_name.trim() === '') {
        alert('Please enter a client name. Client Name is required.');
        setIsSubmitting(false);
        return;
      }

      if (!formData.dob || formData.dob.trim() === '') {
        alert('Please enter a date of birth. Date of Birth is required.');
        setIsSubmitting(false);
        return;
      }

      // Hire Date is only required when Group Information section is shown (when participant is in a group)
      if (participant?.group_id && (!formData.hire_date || formData.hire_date.trim() === '')) {
        alert('Please enter a hire date. Hire Date is required.');
        setIsSubmitting(false);
        return;
      }

      // Validate class selection if group has multiple classes
      if (formData.group_id && selectedGroup && selectedGroup.number_of_classes && selectedGroup.number_of_classes > 1) {
        if (!formData.class_number || formData.class_number.trim() === '') {
          alert('Please select a class. Class is required when the group has multiple classes.');
          setIsSubmitting(false);
          return;
        }
      }

      // Prepare data for update
      const updateData: any = {
        client_name: formData.client_name,
      };

      // Add optional fields only if they have values
      // Save dob exactly as entered in the input field (YYYY-MM-DD format)
      // Date input fields always return YYYY-MM-DD format, save it exactly as-is
      if (formData.dob && formData.dob.trim() !== '') {
        // Trim whitespace and save exactly as entered - no Date object conversion
        const dobValue = formData.dob.trim();
        console.log('Saving DOB:', { inputValue: formData.dob, trimmedValue: dobValue });
        updateData.dob = dobValue;
      } else {
        updateData.dob = null;
      }
      // Save hire_date exactly as entered (YYYY-MM-DD format)
      if (formData.hire_date && formData.hire_date.trim() !== '') {
        updateData.hire_date = formData.hire_date.trim();
      } else {
        updateData.hire_date = null;
      }
      // Save termination_date exactly as entered (YYYY-MM-DD format)
      if (formData.termination_date && formData.termination_date.trim() !== '') {
        updateData.termination_date = formData.termination_date.trim();
      } else {
        updateData.termination_date = null;
      }
      if (formData.address) {
        updateData.address = formData.address;
      } else {
        updateData.address = null;
      }
      if (formData.phone_number) {
        updateData.phone_number = formData.phone_number;
      } else {
        updateData.phone_number = null;
      }
      if (formData.email_address) {
        updateData.email_address = formData.email_address;
      } else {
        updateData.email_address = null;
      }
      if (formData.id_number) {
        updateData.id_number = formData.id_number;
      } else {
        updateData.id_number = null;
      }
      if (formData.group_id) {
        updateData.group_id = formData.group_id;
      } else {
        updateData.group_id = null;
      }
      
      // Add class_number field
      if (formData.class_number) {
        updateData.class_number = parseInt(formData.class_number);
      } else {
        updateData.class_number = null;
      }
      
      // Dependent counts are now calculated from actual dependent records, not stored as separate fields

      // Update participant in database
      console.log('Updating participant with data:', updateData, 'DOB value:', updateData.dob);
      let { data, error: updateError } = await supabase
        .from('participants')
        .update(updateData)
        .eq('id', participantId)
        .select()
        .single();
      
      if (data) {
        console.log('Updated participant DOB from database:', data.dob, 'Type:', typeof data.dob);
      }

      // If update fails due to missing columns, retry without problematic fields
      if (updateError && (
        updateError.message?.includes('column') || 
        updateError.message?.includes('does not exist') ||
        updateError.code === '42703'
      )) {
        // Retry with original data (no dependent count fields to remove)
        const updateDataWithoutCounts = updateData;
        const retryResult = await supabase
          .from('participants')
          .update(updateDataWithoutCounts)
          .eq('id', participantId)
          .select()
          .single();
        
        if (retryResult.error) {
          throw retryResult.error;
        }
        
        data = retryResult.data;
        updateError = null;
        
        // Show warning that dependent count fields weren't saved
        console.warn('Dependent count fields not saved - database columns do not exist. Please run: sql/add-participant-dependent-counts.sql');
      }

      if (updateError) {
        throw updateError;
      }

      // Refresh participant data to get updated values (including dependent counts if they were saved)
      await fetchParticipant();

      setIsEditMode(false);
      alert('Participant updated successfully!');
    } catch (err: any) {
      console.error('Error updating participant:', err);
      const errorMessage = err.message || err.toString() || 'Unknown error occurred';
      alert(`Failed to update participant: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            Loading participant...
          </p>
        </GlassCard>
      </div>
    );
  }

  if (error || !participant) {
    return (
      <div className="max-w-4xl mx-auto">
        <GlassCard>
          <p className="text-red-500 text-center py-8">
            {error || 'Participant not found'}
          </p>
          <div className="flex justify-center mt-4">
            <GlassButton variant="primary" onClick={() => router.push('/participants')}>
              Back to Participants
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
          onClick={() => {
            if (participant.group_id) {
              router.push(`/groups/${participant.group_id}`);
            } else {
              router.push('/participants');
            }
          }}
          className="text-[var(--glass-secondary)] hover:text-[var(--glass-secondary-dark)] mb-4 flex items-center gap-2"
        >
          <span>←</span> {participant.group_id ? 'Back to Group' : 'Back to Participants'}
        </button>
        <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
          {participant?.client_name || 'Participant Details'}
        </h1>
        <p className="text-[var(--glass-gray-medium)]">
          View and edit participant information
        </p>
      </div>

      <GlassCard>
        {/* Navigation Banner */}
        <div className="glass-nav-blue rounded-2xl p-4 mb-6">
          <div className={`grid gap-3 ${
            participant?.group_id 
              ? 'grid-cols-3 md:grid-cols-6' 
              : 'grid-cols-2 md:grid-cols-4'
          }`}>
            <button
              type="button"
              onClick={() => navigateToSection('participant-information')}
              className="px-4 py-2 rounded-lg font-medium text-white bg-white/20 hover:bg-white/30 transition-all duration-200 backdrop-blur-sm border border-white/30 w-full"
            >
              Participant Information
            </button>
            {participant?.group_id && (
              <>
                <button
                  type="button"
                  onClick={() => navigateToSection('group-information')}
                  className="px-4 py-2 rounded-lg font-medium text-white bg-white/20 hover:bg-white/30 transition-all duration-200 backdrop-blur-sm border border-white/30 w-full"
                >
                  Group Information
                </button>
                <button
                  type="button"
                  onClick={() => navigateToSection('group-plan-details')}
                  className="px-4 py-2 rounded-lg font-medium text-white bg-white/20 hover:bg-white/30 transition-all duration-200 backdrop-blur-sm border border-white/30 w-full"
                >
                  Group Plan Details
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => navigateToSection('medicare-plans')}
              className="px-4 py-2 rounded-lg font-medium text-white bg-white/20 hover:bg-white/30 transition-all duration-200 backdrop-blur-sm border border-white/30 w-full"
            >
              Medicare Plans
            </button>
            {participant?.group_id && (
              <button
                type="button"
                onClick={() => navigateToSection('dependents')}
                className="px-4 py-2 rounded-lg font-medium text-white bg-white/20 hover:bg-white/30 transition-all duration-200 backdrop-blur-sm border border-white/30 w-full"
              >
                Dependents
              </button>
            )}
            {!participant?.group_id && (
              <button
                type="button"
                onClick={() => navigateToSection('persons-of-interest')}
                className="px-4 py-2 rounded-lg font-medium text-white bg-white/20 hover:bg-white/30 transition-all duration-200 backdrop-blur-sm border border-white/30 w-full"
              >
                Persons of Interest
              </button>
            )}
            <button
              type="button"
              onClick={() => navigateToSection('notes')}
              className="px-4 py-2 rounded-lg font-medium text-white bg-white/20 hover:bg-white/30 transition-all duration-200 backdrop-blur-sm border border-white/30 w-full"
            >
              Notes
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Participant Information Section */}
          <div id="participant-information" className="space-y-6 scroll-mt-4">
            <div className="flex items-center justify-between mb-6 border-b border-black pb-4">
              <button
                type="button"
                onClick={() => toggleSection('participant-information')}
                className="flex items-center gap-2 text-2xl font-bold text-[var(--glass-black-dark)] hover:opacity-80 transition-opacity"
              >
                <span className={`text-lg transform transition-transform ${collapsedSections['participant-information'] ? 'rotate-180' : ''}`}>
                  ▼
                </span>
                <span>Participant Information</span>
              </button>
              {isEditMode ? (
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={handleDeleteClick}
                    className="px-6 py-3 rounded-full font-semibold bg-[#C6282B] text-white hover:bg-[#A01F22] shadow-lg hover:shadow-xl transition-all duration-300 whitespace-nowrap"
                  >
                    Delete
                  </button>
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
                    className={`whitespace-nowrap px-8 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Participant'}
                  </GlassButton>
                </div>
              ) : (
                // Only show Edit button if at least one section is expanded
                Object.values(collapsedSections).some(collapsed => !collapsed) && (
                  <GlassButton
                    variant="primary"
                    onClick={handleEditClick}
                  >
                    Edit
                  </GlassButton>
                )
              )}
            </div>

            {!collapsedSections['participant-information'] && (
              <>
            {/* Row 1: Client Name, Date of Birth, and Age */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Client Name */}
              <div>
                <label htmlFor="client_name" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  Client Name *
                </label>
                <input
                  type="text"
                  id="client_name"
                  name="client_name"
                  required
                  value={formData.client_name}
                  onChange={handleChange}
                  disabled={!isEditMode}
                  className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                />
              </div>

              {/* Date of Birth */}
              <div>
                <label htmlFor="dob" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  Date of Birth *
                </label>
                <div className="date-input-wrapper">
                  <input
                    type="date"
                    id="dob"
                    name="dob"
                    value={formData.dob}
                    onChange={handleChange}
                    disabled={!isEditMode}
                    required={isEditMode}
                    className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
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

              {/* Age */}
              <div>
                <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  Age
                </label>
                <div className="glass-input-enhanced w-full px-4 py-3 rounded-xl opacity-75 cursor-not-allowed">
                  {participant?.dob ? (
                    <span className="text-[var(--glass-black-dark)]">
                      {calculateAge(participant.dob) !== null ? `${calculateAge(participant.dob)} years old` : 'N/A'}
                    </span>
                  ) : (
                    <span className="text-[var(--glass-gray-medium)]">N/A</span>
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: Phone Number and Email Address */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Phone Number */}
              <div>
                <label htmlFor="phone_number" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone_number"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleChange}
                  disabled={!isEditMode}
                  className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                />
              </div>

              {/* Email Address */}
              <div>
                <label htmlFor="email_address" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email_address"
                  name="email_address"
                  value={formData.email_address}
                  onChange={handleChange}
                  disabled={!isEditMode}
                  className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                />
              </div>
            </div>

            {/* Row 3: Address (full width) */}
            <div>
              <label htmlFor="address" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                Address
              </label>
              <textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={3}
                disabled={!isEditMode}
                className={`glass-input-enhanced w-full px-4 py-3 rounded-xl resize-none ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
              />
            </div>
            </>
            )}
          </div>

          {/* Group Information Section - Only show if participant is in a group */}
          {participant?.group_id && (
            <div id="group-information" className="pt-6 border-t border-white/20 scroll-mt-4">
              <div className="mb-6 border-b border-black pb-4">
                <button
                  type="button"
                  onClick={() => toggleSection('group-information')}
                  className="flex items-center gap-2 text-2xl font-bold text-[var(--glass-black-dark)] hover:opacity-80 transition-opacity"
                >
                  <span className={`text-lg transform transition-transform ${collapsedSections['group-information'] ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                  <span>Group Information</span>
                </button>
              </div>

              {!collapsedSections['group-information'] && (
                <div className="space-y-6">
                {/* Group and Class Selection - Side by side when Class is shown */}
                <div className={`grid gap-6 ${selectedGroup && selectedGroup.number_of_classes && selectedGroup.number_of_classes > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                  {/* Group Selection */}
                  <div>
                    <label htmlFor="group_id" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                      Group
                    </label>
                    {loadingGroups ? (
                      <p className="text-[var(--glass-gray-medium)] text-sm py-2">Loading groups...</p>
                    ) : isEditMode ? (
                      <select
                        id="group_id"
                        name="group_id"
                        value={formData.group_id}
                        onChange={handleChange}
                        className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                      >
                        <option value="">No group assigned</option>
                        {groups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                    ) : formData.group_id ? (
                      <div
                        onClick={() => router.push(`/groups/${formData.group_id}`)}
                        className="glass-input-enhanced w-full px-4 py-3 rounded-xl cursor-pointer hover:bg-white/20 transition-colors duration-200 flex items-center justify-between"
                      >
                        <span className="text-[var(--glass-black-dark)]">
                          {groups.find(g => g.id === formData.group_id)?.name || 'Unknown Group'}
                        </span>
                        <span className="text-[var(--glass-secondary)]">→</span>
                      </div>
                    ) : (
                      <div className="glass-input-enhanced w-full px-4 py-3 rounded-xl opacity-75">
                        <span className="text-[var(--glass-gray-medium)]">No group assigned</span>
                      </div>
                    )}
                  </div>

                  {/* Class Selection - Only show if group has multiple classes */}
                  {selectedGroup && selectedGroup.number_of_classes && selectedGroup.number_of_classes > 1 && (
                    <div>
                      <label htmlFor="class_number" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                        Class *
                      </label>
                      <select
                        id="class_number"
                        name="class_number"
                        value={formData.class_number}
                        onChange={handleChange}
                        disabled={!isEditMode}
                        required={!!(isEditMode && selectedGroup && selectedGroup.number_of_classes && selectedGroup.number_of_classes > 1)}
                        className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                      >
                        <option value="">Select a class</option>
                        {Array.from({ length: selectedGroup.number_of_classes }, (_, i) => i + 1).map((classNum) => (
                          <option key={classNum} value={classNum}>
                            Class {classNum}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Hire Date, Termination Date, and Employment Status - Three columns */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Hire Date */}
                  <div>
                    <label htmlFor="hire_date" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                      Hire Date *
                    </label>
                    {isEditMode ? (
                      <div className="date-input-wrapper">
                        <input
                          type="date"
                          id="hire_date"
                          name="hire_date"
                          value={formData.hire_date}
                          onChange={handleChange}
                          required={isEditMode && !!participant?.group_id}
                          className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                        />
                        <div className="calendar-icon">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                          </svg>
                        </div>
                      </div>
                    ) : formData.hire_date ? (
                      <div className="glass-input-enhanced w-full px-4 py-3 rounded-xl opacity-75">
                        <span className="text-[var(--glass-black-dark)]">
                          {(() => {
                            // Parse date string as local date to avoid timezone issues
                            const dateOnly = formData.hire_date.split('T')[0];
                            const parts = dateOnly.split('-');
                            if (parts.length === 3) {
                              const year = parseInt(parts[0], 10);
                              const month = parseInt(parts[1], 10) - 1;
                              const day = parseInt(parts[2], 10);
                              return new Date(year, month, day).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              });
                            }
                            return formData.hire_date;
                          })()}
                        </span>
                      </div>
                    ) : (
                      <div className="glass-input-enhanced w-full px-4 py-3 rounded-xl opacity-75">
                        <span className="text-[var(--glass-gray-medium)]">No hire date set</span>
                      </div>
                    )}
                  </div>

                  {/* Termination Date */}
                  <div>
                    <label htmlFor="termination_date" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                      Termination Date
                    </label>
                    {isEditMode ? (
                      <div className="date-input-wrapper">
                        <input
                          type="date"
                          id="termination_date"
                          name="termination_date"
                          value={formData.termination_date}
                          onChange={handleChange}
                          className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                        />
                        <div className="calendar-icon">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                          </svg>
                        </div>
                      </div>
                    ) : formData.termination_date ? (
                      <div className="glass-input-enhanced w-full px-4 py-3 rounded-xl opacity-75">
                        <span className="text-[var(--glass-black-dark)]">
                          {(() => {
                            // Parse date string as local date to avoid timezone issues
                            const dateOnly = formData.termination_date.split('T')[0];
                            const parts = dateOnly.split('-');
                            if (parts.length === 3) {
                              const year = parseInt(parts[0], 10);
                              const month = parseInt(parts[1], 10) - 1;
                              const day = parseInt(parts[2], 10);
                              return new Date(year, month, day).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              });
                            }
                            return formData.termination_date;
                          })()}
                        </span>
                      </div>
                    ) : (
                      <div className="glass-input-enhanced w-full px-4 py-3 rounded-xl opacity-75">
                        <span className="text-[var(--glass-gray-medium)]">No termination date set</span>
                      </div>
                    )}
                  </div>

                  {/* Employment Status */}
                  <div>
                    <label htmlFor="employment_status" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                      Employment Status
                    </label>
                    <div className="glass-input-enhanced w-full px-4 py-3 rounded-xl opacity-75">
                      <span className="font-semibold text-[var(--glass-black-dark)]">
                        {participant?.employment_status || 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
                </div>
              )}
            </div>
          )}

          {/* Group Plan Details Section - Only show if participant is in a group */}
          {participant?.group_id && (
            <div id="group-plan-details" className="pt-6 border-t border-white/20 scroll-mt-4">
              <div className="mb-6 border-b border-black pb-4">
                <button
                  type="button"
                  onClick={() => toggleSection('group-plan-details')}
                  className="flex items-center gap-2 text-2xl font-bold text-[var(--glass-black-dark)] hover:opacity-80 transition-opacity"
                >
                  <span className={`text-lg transform transition-transform ${collapsedSections['group-plan-details'] ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                  <span>Group Plan Details</span>
                </button>
              </div>

              {!collapsedSections['group-plan-details'] && (
                <>
            {/* Active Plans Subsection */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-[var(--glass-black-dark)]">
                  Active Plans
                </h3>
                <GlassButton
                  variant="primary"
                  type="button"
                  onClick={handleAddPlan}
                >
                  {activePlans.length === 0 && newPlans.length === 0 
                    ? '+ Add Plan' 
                    : '+ Add Another Plan'}
                </GlassButton>
              </div>

              {/* New Plans Form Section */}
              {showAddPlanForm && newPlans.length > 0 && (
                <div className="mb-6 space-y-4">
                  {newPlans.map((newPlan) => {
                    const selectedPlan = availableGroupPlans.find(p => p.id === newPlan.group_plan_id);
                    const planOptions = planOptionsMap.get(newPlan.group_plan_id) || [];
                    const selectedOption = planOptions.find((o: any) => o.id === newPlan.group_plan_option_id);
                    
                    // Calculate display rate: override takes precedence, then active rate
                    let displayRate: number | null = null;
                    let rateSource = '';
                    if (newPlan.rate_override && parseFloat(newPlan.rate_override) > 0) {
                      displayRate = parseFloat(newPlan.rate_override);
                      rateSource = 'override';
                    } else if (selectedOption?.activeRate) {
                      displayRate = selectedOption.activeRate.rate;
                      rateSource = 'active';
                    }

                    // Get plans already selected in other new plan entries (excluding current)
                    const otherSelectedPlanIds = newPlans
                      .filter(p => p.id !== newPlan.id && p.group_plan_id)
                      .map(p => p.group_plan_id);
                    
                    // Get plans already assigned to participant
                    const assignedPlanIds = activePlans.map(p => p.group_plan_id);
                    
                    // Filter available plans to exclude already selected/assigned ones
                    const availablePlansForThisEntry = availableGroupPlans.filter(plan => 
                      plan.id === newPlan.group_plan_id || // Always include currently selected plan
                      (!otherSelectedPlanIds.includes(plan.id) && !assignedPlanIds.includes(plan.id))
                    );

                    return (
                      <div
                        key={newPlan.id}
                        className="glass-card rounded-xl p-4 bg-blue-500/10 border border-blue-500/20"
                      >
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Plan Selection */}
                            <div>
                              <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                                Plan *
                              </label>
                              {loadingGroupPlans ? (
                                <p className="text-[var(--glass-gray-medium)] text-sm py-2">Loading plans...</p>
                              ) : (
                                <select
                                  value={newPlan.group_plan_id}
                                  onChange={(e) => handlePlanChange(newPlan.id, 'group_plan_id', e.target.value)}
                                  className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                                  required
                                >
                                  <option value="">Select a plan</option>
                                  {availablePlansForThisEntry.map((plan) => (
                                    <option key={plan.id} value={plan.id}>
                                      {plan.plan_name}
                                      {plan.group && ` - ${plan.group.name}`}
                                      {plan.program && ` (${plan.program.name})`}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>

                            {/* Remove Button */}
                            <div className="flex items-end">
                              <button
                                type="button"
                                onClick={() => handleRemovePlan(newPlan.id)}
                                className="w-full px-4 py-3 rounded-full font-semibold bg-[#C6282B] text-white hover:bg-[#A01F22] shadow-lg hover:shadow-xl transition-all duration-300"
                              >
                                Remove
                              </button>
                            </div>
                          </div>

                          {/* Plan Option Selection (only show if plan is selected and has options) */}
                          {selectedPlan && planOptions.length > 0 && (
                            <div>
                              {selectedPlan.plan_type === 'Age Banded' ? (
                                // For Age Banded plans, show "Plan Option" dropdown with effective date
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                                      Plan Option *
                                    </label>
                                    <select
                                      value={newPlan.include_type}
                                      onChange={(e) => handlePlanChange(newPlan.id, 'include_type', e.target.value)}
                                      className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                                      required
                                    >
                                      <option value="">Select plan option</option>
                                      {(() => {
                                        const includeTypeOptions = [
                                          'Employee',
                                          'Employee and Spouse',
                                          'Employee and Children',
                                          'Employee, Spouse, and Children'
                                        ];
                                        return includeTypeOptions.map((option) => {
                                          return (
                                            <option key={option} value={option}>
                                              {option}
                                            </option>
                                          );
                                        });
                                      })()}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                                      Effective Date *
                                    </label>
                                    <div className="date-input-wrapper">
                                      <input
                                        type="date"
                                        value={newPlan.effective_date || ''}
                                        onChange={(e) => handlePlanChange(newPlan.id, 'effective_date', e.target.value)}
                                        className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                                        required
                                      />
                                      <div className="calendar-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                                    <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                                      Plan Option {selectedPlan?.plan_type === 'Composite' && '*'}
                                    </label>
                                    <select
                                      value={newPlan.group_plan_option_id}
                                      onChange={(e) => handlePlanChange(newPlan.id, 'group_plan_option_id', e.target.value)}
                                      className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                                      required={selectedPlan?.plan_type === 'Composite'}
                                    >
                                      <option value="">Select an option {selectedPlan?.plan_type === 'Composite' ? '(required)' : '(optional)'}</option>
                                      {planOptions.map((option: any) => (
                                        <option key={option.id} value={option.id}>
                                          {option.option}
                                          {option.activeRate && ` - $${option.activeRate.rate.toFixed(2)}`}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                                      Effective Date *
                                    </label>
                                    <div className="date-input-wrapper">
                                      <input
                                        type="date"
                                        value={newPlan.effective_date || ''}
                                        onChange={(e) => handlePlanChange(newPlan.id, 'effective_date', e.target.value)}
                                        className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                                        required
                                      />
                                      <div className="calendar-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                              )}
                            </div>
                          )}

                          {/* Rate Display (show when rate is available) */}
                          {displayRate !== null && (() => {
                            // Calculate employee responsible amount
                            let amountPaidByEmployer = 0;
                            let employeeResponsibleAmount = displayRate;
                            
                            if (selectedPlan?.employer_contribution_type && selectedPlan?.employer_contribution_value) {
                              if (selectedPlan.employer_contribution_type === 'Percentage') {
                                amountPaidByEmployer = displayRate * (selectedPlan.employer_contribution_value / 100);
                              } else if (selectedPlan.employer_contribution_type === 'Dollar Amount') {
                                amountPaidByEmployer = selectedPlan.employer_contribution_value;
                              }
                              employeeResponsibleAmount = Math.max(0, displayRate - amountPaidByEmployer);
                            }

                            return (
                              <div className="p-4 bg-white/10 rounded-xl border border-white/20">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm text-[var(--glass-gray-medium)] mb-1">Rate for this Employee</p>
                                    <p className="text-2xl font-bold text-[var(--glass-black-dark)]">
                                      ${displayRate.toFixed(2)}
                                    </p>
                                    {rateSource === 'override' && (
                                      <p className="text-xs text-[var(--glass-gray-medium)] mt-1">Custom rate override</p>
                                    )}
                                    {rateSource === 'active' && (
                                      <p className="text-xs text-[var(--glass-gray-medium)] mt-1">Active plan rate</p>
                                    )}
                                  </div>
                                  {selectedPlan?.employer_contribution_type && (
                                    <div className="text-right">
                                      <p className="text-sm text-[var(--glass-gray-medium)] mb-1">Employee Responsible Amount</p>
                                      <p className="text-2xl font-bold text-[var(--glass-black-dark)]">
                                        ${employeeResponsibleAmount.toFixed(2)}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Composite Plan Fields - Show when plan type is Composite and option is selected */}
                          {selectedPlan?.plan_type === 'Composite' && newPlan.group_plan_option_id && (
                            <div className="space-y-4 pt-4 border-t border-white/20">
                              <h3 className="text-lg font-semibold text-[var(--glass-black-dark)] mb-4">
                                Composite Plan Contribution Information
                              </h3>
                              
                              {/* Employer Contribution Type */}
                              <div>
                                <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                                  Employer Contribution Type
                                </label>
                                <select
                                  value={newPlan.employer_contribution_type}
                                  onChange={(e) => handlePlanChange(newPlan.id, 'employer_contribution_type', e.target.value)}
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
                                  <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                                    Class 1 Contribution Amount
                                  </label>
                                  <input
                                    type="number"
                                    value={newPlan.class_1_contribution_amount}
                                    onChange={(e) => handlePlanChange(newPlan.id, 'class_1_contribution_amount', e.target.value)}
                                    step="0.01"
                                    min="0"
                                    className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                                    placeholder="Enter amount"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                                    Class 2 Contribution Amount
                                  </label>
                                  <input
                                    type="number"
                                    value={newPlan.class_2_contribution_amount}
                                    onChange={(e) => handlePlanChange(newPlan.id, 'class_2_contribution_amount', e.target.value)}
                                    step="0.01"
                                    min="0"
                                    className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                                    placeholder="Enter amount"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                                    Class 3 Contribution Amount
                                  </label>
                                  <input
                                    type="number"
                                    value={newPlan.class_3_contribution_amount}
                                    onChange={(e) => handlePlanChange(newPlan.id, 'class_3_contribution_amount', e.target.value)}
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
                            <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                              Rate Override (optional)
                            </label>
                            <input
                              type="number"
                              value={newPlan.rate_override}
                              onChange={(e) => handlePlanChange(newPlan.id, 'rate_override', e.target.value)}
                              step="0.01"
                              min="0"
                              className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                              placeholder="Enter custom rate if different from plan rate"
                            />
                            <p className="text-xs text-[var(--glass-gray-medium)] mt-1">
                              Leave empty to use the plan's default rate
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Save Button */}
                  <div className="flex justify-end gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setNewPlans([]);
                        setShowAddPlanForm(false);
                        setPlanOptionsMap(new Map());
                      }}
                      className="px-6 py-3 rounded-full font-semibold bg-[#C6282B] text-white hover:bg-[#A01F22] shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      Cancel
                    </button>
                    <GlassButton
                      variant="primary"
                      type="button"
                      onClick={handleSavePlans}
                      disabled={isSubmitting || newPlans.every(p => !p.group_plan_id)}
                      className={isSubmitting || newPlans.every(p => !p.group_plan_id) ? 'opacity-50 cursor-not-allowed' : ''}
                    >
                      {isSubmitting ? 'Saving...' : 'Save Plan(s)'}
                    </GlassButton>
                  </div>
                </div>
              )}

              {loadingPlans ? (
                <p className="text-[var(--glass-gray-medium)] text-center py-4">
                  Loading plans...
                </p>
              ) : activePlans.length === 0 && newPlans.length === 0 ? (
                <p className="text-[var(--glass-gray-medium)] text-center py-4">
                  No active group plans
                </p>
              ) : (
                <div className="space-y-3">
                  {activePlans.map((plan) => {
                    // Calculate rate: rate_override takes precedence, otherwise use group_option_rate
                    const rate = plan.rate_override !== null 
                      ? plan.rate_override 
                      : plan.group_option_rate?.rate || null;

                    // Calculate amount paid by employer
                    // For Composite plans, use class_1_contribution_amount from group_option_rate
                    // For other plans, use employer_contribution_value from group_plan
                    let amountPaidByEmployer = 0;
                    const planType = plan.group_plan?.plan_type;
                    
                    // #region agent log
                    const calcLogStart = {
                      planId: plan.id,
                      planType,
                      rate,
                      hasGroupOptionRate: !!plan.group_option_rate,
                      groupOptionRateContributionType: plan.group_option_rate?.employer_contribution_type,
                      class1Contribution: plan.group_option_rate?.class_1_contribution_amount,
                      groupPlanContributionType: plan.group_plan?.employer_contribution_type,
                      groupPlanContributionValue: plan.group_plan?.employer_contribution_value,
                    };
                    console.log('[DEBUG] participant page - calculating employee amount:', calcLogStart);
                    fetch('http://127.0.0.1:7242/ingest/3a6a5ac4-a463-4d1c-82bb-202cb212287a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'participants/[id]/page.tsx:3800',message:'calculating employee amount start',data:calcLogStart,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K,L,M'})}).catch(()=>{});
                    // #endregion
                    
                    if (rate !== null) {
                      if (planType === 'Composite' && plan.group_option_rate?.employer_contribution_type && plan.group_option_rate?.class_1_contribution_amount != null) {
                        // Composite plan: use class_1_contribution_amount from group_option_rate
                        const contributionType = plan.group_option_rate.employer_contribution_type;
                        const contributionValue = plan.group_option_rate.class_1_contribution_amount;
                        if (contributionType === 'Percentage' && contributionValue != null) {
                          amountPaidByEmployer = rate * (contributionValue / 100);
                        } else if ((contributionType === 'Dollar Amount' || contributionType === 'Dollar') && contributionValue != null) {
                          amountPaidByEmployer = contributionValue;
                        }
                        // #region agent log
                        console.log('[DEBUG] participant page - Composite calculation:', {contributionType, contributionValue, amountPaidByEmployer});
                        fetch('http://127.0.0.1:7242/ingest/3a6a5ac4-a463-4d1c-82bb-202cb212287a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'participants/[id]/page.tsx:3815',message:'Composite calculation',data:{contributionType, contributionValue, amountPaidByEmployer},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K'})}).catch(()=>{});
                        // #endregion
                      } else if (plan.group_plan?.employer_contribution_type && plan.group_plan?.employer_contribution_value) {
                        // Other plans: use employer_contribution_value from group_plan
                        if (plan.group_plan.employer_contribution_type === 'Percentage') {
                          amountPaidByEmployer = rate * (plan.group_plan.employer_contribution_value / 100);
                        } else if (plan.group_plan.employer_contribution_type === 'Dollar Amount') {
                          amountPaidByEmployer = plan.group_plan.employer_contribution_value;
                        }
                        // #region agent log
                        console.log('[DEBUG] participant page - non-Composite calculation:', {contributionType: plan.group_plan.employer_contribution_type, contributionValue: plan.group_plan.employer_contribution_value, amountPaidByEmployer});
                        fetch('http://127.0.0.1:7242/ingest/3a6a5ac4-a463-4d1c-82bb-202cb212287a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'participants/[id]/page.tsx:3825',message:'non-Composite calculation',data:{contributionType: plan.group_plan.employer_contribution_type, contributionValue: plan.group_plan.employer_contribution_value, amountPaidByEmployer},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'L'})}).catch(()=>{});
                        // #endregion
                      }
                    }

                    // Calculate employee responsible amount
                    const employeeResponsibleAmount = rate !== null ? Math.max(0, rate - amountPaidByEmployer) : null;
                    
                    // #region agent log
                    const calcLogEnd = {
                      employeeResponsibleAmount,
                      amountPaidByEmployer,
                      rate,
                      willRender: employeeResponsibleAmount !== null,
                    };
                    console.log('[DEBUG] participant page - final calculation result:', calcLogEnd);
                    fetch('http://127.0.0.1:7242/ingest/3a6a5ac4-a463-4d1c-82bb-202cb212287a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'participants/[id]/page.tsx:3830',message:'final calculation result',data:calcLogEnd,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K,L,M'})}).catch(()=>{});
                    // #endregion

                    const handlePlanClick = () => {
                      // Only navigate if not in edit mode
                      if (!isEditMode) {
                        router.push(`/participants/${participantId}/plans/${plan.id}`);
                      }
                    };

                    const handleDeleteClick = (e: React.MouseEvent) => {
                      e.stopPropagation(); // Prevent plan click navigation
                      setPlanToDelete(plan);
                    };

                    return (
                      <div
                        key={plan.id}
                        onClick={handlePlanClick}
                        className={`glass-card rounded-xl p-4 bg-white/5 border border-white/10 transition-colors duration-200 ${isEditMode ? '' : 'cursor-pointer hover:bg-white/10'}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="font-semibold text-[var(--glass-black-dark)] text-lg">
                              {plan.group_plan?.plan_name || 'Unnamed Plan'}
                            </h4>
                          </div>
                          <div className="flex items-center gap-3">
                            {/* #region agent log */}
                            {(() => {
                              const conditionResult = employeeResponsibleAmount !== null;
                              const renderLog = {employeeResponsibleAmount, conditionResult, willRender: conditionResult};
                              console.log('[DEBUG] participant page - rendering condition:', renderLog);
                              fetch('http://127.0.0.1:7242/ingest/3a6a5ac4-a463-4d1c-82bb-202cb212287a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'participants/[id]/page.tsx:3894',message:'rendering condition',data:renderLog,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'M'})}).catch(()=>{});
                              return null;
                            })()}
                            {/* #endregion */}
                            {employeeResponsibleAmount !== null && (
                              <div className="text-right flex-shrink-0">
                                {/* #region agent log */}
                                {(() => {
                                  console.log('[DEBUG] participant page - actually rendering employee responsible div', {employeeResponsibleAmount});
                                  fetch('http://127.0.0.1:7242/ingest/3a6a5ac4-a463-4d1c-82bb-202cb212287a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'participants/[id]/page.tsx:3932',message:'rendering div',data:{employeeResponsibleAmount},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'M'})}).catch(()=>{});
                                  return null;
                                })()}
                                {/* #endregion */}
                                <p className="text-xs text-[var(--glass-gray-medium)] mb-1">Employee Responsible</p>
                                <p className="text-2xl font-bold text-[var(--glass-black-dark)]">
                                  ${employeeResponsibleAmount.toFixed(2)}
                                </p>
                              </div>
                            )}
                            {isEditMode && (
                              <button
                                type="button"
                                onClick={handleDeleteClick}
                                className="flex items-center justify-center w-8 h-8 rounded-full bg-[#C6282B] hover:bg-[#A01F22] text-white font-bold text-xl leading-none transition-colors duration-200 flex-shrink-0 shadow-lg hover:shadow-xl"
                                title="Delete plan"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          {plan.group_plan?.program && (
                            <div>
                              <span className="text-[var(--glass-gray-medium)]">Program: </span>
                              <span className="text-[var(--glass-black-dark)] font-medium">
                                {plan.group_plan.program.name}
                              </span>
                            </div>
                          )}
                          {plan.group_plan?.provider && (
                            <div>
                              <span className="text-[var(--glass-gray-medium)]">Provider: </span>
                              <span className="text-[var(--glass-black-dark)] font-medium">
                                {plan.group_plan.provider.name}
                              </span>
                            </div>
                          )}
                          {plan.group_plan?.effective_date && (
                            <div>
                              <span className="text-[var(--glass-gray-medium)]">Effective Date: </span>
                              <span className="text-[var(--glass-black-dark)] font-medium">
                                {formatDisplayDate(plan.group_plan.effective_date)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Terminated Plans Subsection */}
            {terminatedPlans.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold text-[var(--glass-black-dark)] mb-4">
                  Terminated Plans
                </h3>
                <div className="space-y-3">
                  {terminatedPlans.map((plan) => {
                    // Calculate rate: rate_override takes precedence, otherwise use group_option_rate
                    const rate = plan.rate_override !== null 
                      ? plan.rate_override 
                      : plan.group_option_rate?.rate || null;

                    // Calculate amount paid by employer
                    // For Composite plans, use class_1_contribution_amount from group_option_rate
                    // For other plans, use employer_contribution_value from group_plan
                    let amountPaidByEmployer = 0;
                    const planType = plan.group_plan?.plan_type;
                    
                    if (rate !== null) {
                      if (planType === 'Composite' && plan.group_option_rate?.employer_contribution_type && plan.group_option_rate?.class_1_contribution_amount != null) {
                        // Composite plan: use class_1_contribution_amount from group_option_rate
                        const contributionType = plan.group_option_rate.employer_contribution_type;
                        const contributionValue = plan.group_option_rate.class_1_contribution_amount;
                        if (contributionType === 'Percentage' && contributionValue != null) {
                          amountPaidByEmployer = rate * (contributionValue / 100);
                        } else if ((contributionType === 'Dollar Amount' || contributionType === 'Dollar') && contributionValue != null) {
                          amountPaidByEmployer = contributionValue;
                        }
                      } else if (plan.group_plan?.employer_contribution_type && plan.group_plan?.employer_contribution_value) {
                        // Other plans: use employer_contribution_value from group_plan
                        if (plan.group_plan.employer_contribution_type === 'Percentage') {
                          amountPaidByEmployer = rate * (plan.group_plan.employer_contribution_value / 100);
                        } else if (plan.group_plan.employer_contribution_type === 'Dollar Amount') {
                          amountPaidByEmployer = plan.group_plan.employer_contribution_value;
                        }
                      }
                    }

                    // Calculate employee responsible amount
                    const employeeResponsibleAmount = rate !== null ? Math.max(0, rate - amountPaidByEmployer) : null;

                    const handlePlanClick = () => {
                      // Only navigate if not in edit mode
                      if (!isEditMode) {
                        router.push(`/participants/${participantId}/plans/${plan.id}`);
                      }
                    };

                    const handleDeleteClick = (e: React.MouseEvent) => {
                      e.stopPropagation(); // Prevent plan click navigation
                      setPlanToDelete(plan);
                    };

                    return (
                      <div
                        key={plan.id}
                        onClick={handlePlanClick}
                        className={`glass-card rounded-xl p-4 bg-white/5 border border-white/10 opacity-75 transition-colors duration-200 ${isEditMode ? '' : 'cursor-pointer hover:bg-white/10'}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-4 flex-wrap">
                              <h4 className="font-semibold text-[var(--glass-black-dark)] text-lg">
                                {plan.group_plan?.plan_name || 'Unnamed Plan'}
                              </h4>
                              {plan.termination_date && (
                                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-[#C6282B] text-white">
                                  Enrollment Ended: {formatDisplayDate(plan.termination_date)}
                                </span>
                              )}
                              {plan.group_plan?.termination_date && (
                                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-orange-500 text-white">
                                  Plan Terminated: {formatDisplayDate(plan.group_plan.termination_date)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {employeeResponsibleAmount !== null && (
                              <div className="text-right">
                                <p className="text-xs text-[var(--glass-gray-medium)] mb-1">Employee Responsible Amount</p>
                                <p className="text-2xl font-bold text-[var(--glass-black-dark)]">
                                  ${employeeResponsibleAmount.toFixed(2)}
                                </p>
                              </div>
                            )}
                            {isEditMode && (
                              <button
                                type="button"
                                onClick={handleDeleteClick}
                                className="flex items-center justify-center w-8 h-8 rounded-full bg-[#C6282B] hover:bg-[#A01F22] text-white font-bold text-xl leading-none transition-colors duration-200 flex-shrink-0 shadow-lg hover:shadow-xl"
                                title="Delete plan"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          {plan.group_plan?.program && (
                            <div>
                              <span className="text-[var(--glass-gray-medium)]">Program: </span>
                              <span className="text-[var(--glass-black-dark)] font-medium">
                                {plan.group_plan.program.name}
                              </span>
                            </div>
                          )}
                          {plan.group_plan?.provider && (
                            <div>
                              <span className="text-[var(--glass-gray-medium)]">Provider: </span>
                              <span className="text-[var(--glass-black-dark)] font-medium">
                                {plan.group_plan.provider.name}
                              </span>
                            </div>
                          )}
                          {plan.group_plan?.effective_date && (
                            <div>
                              <span className="text-[var(--glass-gray-medium)]">Effective Date: </span>
                              <span className="text-[var(--glass-black-dark)] font-medium">
                                {formatDisplayDate(plan.group_plan.effective_date)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
                </>
              )}
            </div>
          )}

          {/* Medicare Plans Section */}
          <div id="medicare-plans" className="pt-6 border-t border-white/20 scroll-mt-4">
            <div className="mb-6 border-b border-black pb-4">
              <button
                type="button"
                onClick={() => toggleSection('medicare-plans')}
                className="flex items-center gap-2 text-2xl font-bold text-[var(--glass-black-dark)] hover:opacity-80 transition-opacity"
              >
                <span className={`text-lg transform transition-transform ${collapsedSections['medicare-plans'] ? 'rotate-180' : ''}`}>
                  ▼
                </span>
                <span>Medicare Plans</span>
              </button>
            </div>

            {!collapsedSections['medicare-plans'] && (
              <>
            {/* Participant Info - ID Number Field */}
            <div className="mb-6">
              <div>
                <label htmlFor="id_number" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  ID Number
                </label>
                <input
                  type="text"
                  id="id_number"
                  name="id_number"
                  value={formData.id_number}
                  onChange={handleChange}
                  disabled={!isEditMode}
                  className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                />
              </div>
            </div>

            {/* Active Medicare Plans Subsection */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-[var(--glass-black-dark)]">
                  Active Medicare Plans
                </h3>
                <GlassButton
                  variant="primary"
                  type="button"
                  onClick={handleAddMedicarePlan}
                >
                  {activeMedicarePlans.length === 0 && newMedicarePlans.length === 0 
                    ? '+ Add Medicare Plan' 
                    : '+ Add Another Medicare Plan'}
                </GlassButton>
              </div>

              {/* New Medicare Plans Form Section */}
              {showAddMedicarePlanForm && newMedicarePlans.length > 0 && (
                <div className="mb-6 space-y-4">
                  {newMedicarePlans.map((newPlan) => {
                    const selectedPlan = availableMedicarePlans.find(p => p.id === newPlan.medicare_plan_id);
                    const planRatesData = medicarePlanRatesMap.get(newPlan.medicare_plan_id);
                    const planRates = planRatesData?.rates || [];
                    const selectedRate = planRates.find((r: any) => r.id === newPlan.medicare_child_rate_id);
                    const activeRate = planRatesData?.activeRate;

                    return (
                      <div
                        key={newPlan.id}
                        className="glass-card rounded-xl p-4 bg-blue-500/10 border border-blue-500/20"
                      >
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Medicare Plan Selection */}
                            <div>
                              <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                                Medicare Plan *
                              </label>
                              {loadingMedicarePlans ? (
                                <p className="text-[var(--glass-gray-medium)] text-sm py-2">Loading Medicare plans...</p>
                              ) : (
                                <select
                                  value={newPlan.medicare_plan_id}
                                  onChange={(e) => handleMedicarePlanChange(newPlan.id, 'medicare_plan_id', e.target.value)}
                                  className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                                >
                                  <option value="">Select a Medicare plan</option>
                                  {availableMedicarePlans.map((plan: any) => (
                                    <option key={plan.id} value={plan.id}>
                                      {plan.plan_name}
                                      {plan.provider && ` - ${plan.provider.name}`}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>

                            {/* Remove Button */}
                            <div className="flex items-end">
                              <button
                                type="button"
                                onClick={() => handleRemoveMedicarePlan(newPlan.id)}
                                className="w-full px-4 py-3 rounded-full font-semibold bg-[#C6282B] text-white hover:bg-[#A01F22] shadow-lg hover:shadow-xl transition-all duration-300"
                              >
                                Remove
                              </button>
                            </div>
                          </div>

                          {/* Active Rate and Effective Date */}
                          {selectedPlan && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Active Rate Display */}
                              <div>
                                <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                                  Active Rate
                                </label>
                                {activeRate ? (
                                  <div className="py-2">
                                    <span className="text-[var(--glass-black-dark)] font-medium text-lg">
                                      ${activeRate.rate.toFixed(2)}
                                    </span>
                                    {activeRate.start_date && (
                                      <span className="text-sm text-[var(--glass-gray-medium)] ml-2">
                                        (Started {formatDisplayDate(activeRate.start_date)})
                                      </span>
                                    )}
                                  </div>
                                ) : planRates.length > 0 ? (
                                  <div className="py-2">
                                    <span className="text-[var(--glass-gray-medium)]">
                                      No active rate available
                                    </span>
                                  </div>
                                ) : (
                                  <div className="py-2">
                                    <span className="text-[var(--glass-gray-medium)]">
                                      Loading rates...
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Effective Date */}
                              <div>
                                <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                                  Effective Date *
                                </label>
                                <div className="date-input-wrapper">
                                  <input
                                    type="date"
                                    value={newPlan.effective_date || ''}
                                    onChange={(e) => handleMedicarePlanChange(newPlan.id, 'effective_date', e.target.value)}
                                    className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                                    required
                                  />
                                  <div className="calendar-icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                      <line x1="16" y1="2" x2="16" y2="6"></line>
                                      <line x1="8" y1="2" x2="8" y2="6"></line>
                                      <line x1="3" y1="10" x2="21" y2="10"></line>
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Save Button */}
                  <div className="flex justify-end gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setNewMedicarePlans([]);
                        setShowAddMedicarePlanForm(false);
                        setMedicarePlanRatesMap(new Map());
                      }}
                      className="px-6 py-3 rounded-full font-semibold bg-[#C6282B] text-white hover:bg-[#A01F22] shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      Cancel
                    </button>
                    <GlassButton
                      variant="primary"
                      type="button"
                      onClick={handleSaveMedicarePlans}
                      disabled={isSubmitting || newMedicarePlans.every(p => !p.medicare_plan_id || !p.medicare_child_rate_id || !p.effective_date)}
                      className={isSubmitting || newMedicarePlans.every(p => !p.medicare_plan_id || !p.medicare_child_rate_id || !p.effective_date) ? 'opacity-50 cursor-not-allowed' : ''}
                    >
                      {isSubmitting ? 'Saving...' : 'Save Medicare Plan(s)'}
                    </GlassButton>
                  </div>
                </div>
              )}

              {loadingPlans ? (
                <p className="text-[var(--glass-gray-medium)] text-center py-4">
                  Loading Medicare plans...
                </p>
              ) : activeMedicarePlans.length === 0 && newMedicarePlans.length === 0 ? (
                <p className="text-[var(--glass-gray-medium)] text-center py-4">
                  No active Medicare plans
                </p>
              ) : (
                <div className="space-y-3">
                  {activeMedicarePlans.map((plan) => {
                    // Get rate with priority: rate_override > active_rate from medicarePlanRatesMap > linked medicare_child_rate
                    let rate: number | null = null;
                    
                    // First check for rate_override
                    if (plan.rate_override !== null) {
                      rate = plan.rate_override;
                    } else {
                      // Try to get from medicarePlanRatesMap (uses priority logic)
                      const planRatesData = medicarePlanRatesMap.get(plan.medicare_plan_id);
                      if (planRatesData?.activeRate) {
                        rate = planRatesData.activeRate.rate;
                      } else {
                        // Fall back to linked rate (use ?? instead of || to preserve 0 values)
                        rate = plan.medicare_child_rate?.rate ?? null;
                      }
                    }

                    const handlePlanClick = (e: React.MouseEvent) => {
                      e.preventDefault();
                      e.stopPropagation();
                      
                      // Navigate to the participant Medicare plan detail page
                      router.push(`/participants/${participantId}/medicare-plans/${plan.id}`);
                    };

                    const handleDeleteClick = (e: React.MouseEvent) => {
                      e.stopPropagation();
                      setPlanToDelete(plan);
                    };

                    return (
                      <div
                        key={plan.id}
                        id={`medicare-plan-${plan.id}`}
                        onClick={handlePlanClick}
                        className="glass-card rounded-xl p-4 bg-white/5 border border-white/10 transition-colors duration-200 cursor-pointer hover:bg-white/10"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="font-semibold text-[var(--glass-black-dark)] text-lg">
                              {plan.medicare_plan?.plan_name || 'Unnamed Medicare Plan'}
                            </h4>
                          </div>
                          <div className="flex items-center gap-3">
                            {rate !== null && (
                              <div className="text-right">
                                <p className="text-xs text-[var(--glass-gray-medium)] mb-1">Rate</p>
                                <p className="text-2xl font-bold text-[var(--glass-black-dark)]">
                                  ${rate.toFixed(2)}
                                </p>
                              </div>
                            )}
                            {isEditMode && (
                              <button
                                type="button"
                                onClick={handleDeleteClick}
                                className="flex items-center justify-center w-8 h-8 rounded-full bg-[#C6282B] hover:bg-[#A01F22] text-white font-bold text-xl leading-none transition-colors duration-200 flex-shrink-0 shadow-lg hover:shadow-xl"
                                title="Delete plan"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          {plan.medicare_plan?.provider && (
                            <div>
                              <span className="text-[var(--glass-gray-medium)]">Provider: </span>
                              <span className="text-[var(--glass-black-dark)] font-medium">
                                {plan.medicare_plan.provider.name}
                              </span>
                            </div>
                          )}
                          {plan.effective_date && (
                            <div>
                              <span className="text-[var(--glass-gray-medium)]">Effective Date: </span>
                              <span className="text-[var(--glass-black-dark)] font-medium">
                                {formatDisplayDate(plan.effective_date)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Terminated Medicare Plans Subsection */}
            {terminatedMedicarePlans.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold text-[var(--glass-black-dark)] mb-4">
                  Terminated Medicare Plans
                </h3>
                <div className="space-y-3">
                  {terminatedMedicarePlans.map((plan) => {
                    // Use active_rate if available, otherwise fall back to linked rate (use ?? instead of || to preserve 0 values)
                    const rate = (plan as any).active_rate?.rate ?? plan.medicare_child_rate?.rate ?? null;

                    const handlePlanClick = (e: React.MouseEvent) => {
                      e.preventDefault();
                      e.stopPropagation();
                      
                      // Navigate to the participant Medicare plan detail page
                      router.push(`/participants/${participantId}/medicare-plans/${plan.id}`);
                    };

                    const handleDeleteClick = (e: React.MouseEvent) => {
                      e.stopPropagation();
                      setPlanToDelete(plan);
                    };

                    return (
                      <div
                        key={plan.id}
                        id={`medicare-plan-${plan.id}`}
                        onClick={handlePlanClick}
                        className="glass-card rounded-xl p-4 bg-white/5 border border-white/10 opacity-75 transition-colors duration-200 cursor-pointer hover:bg-white/10"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-4 flex-wrap">
                              <h4 className="font-semibold text-[var(--glass-black-dark)] text-lg">
                                {plan.medicare_plan?.plan_name || 'Unnamed Medicare Plan'}
                              </h4>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {rate !== null && (
                              <div className="text-right">
                                <p className="text-xs text-[var(--glass-gray-medium)] mb-1">Rate</p>
                                <p className="text-2xl font-bold text-[var(--glass-black-dark)]">
                                  ${rate.toFixed(2)}
                                </p>
                              </div>
                            )}
                            {isEditMode && (
                              <button
                                type="button"
                                onClick={handleDeleteClick}
                                className="flex items-center justify-center w-8 h-8 rounded-full bg-[#C6282B] hover:bg-[#A01F22] text-white font-bold text-xl leading-none transition-colors duration-200 flex-shrink-0 shadow-lg hover:shadow-xl"
                                title="Delete plan"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          {plan.medicare_plan?.provider && (
                            <div>
                              <span className="text-[var(--glass-gray-medium)]">Provider: </span>
                              <span className="text-[var(--glass-black-dark)] font-medium">
                                {plan.medicare_plan.provider.name}
                              </span>
                            </div>
                          )}
                          {plan.effective_date && (
                            <div>
                              <span className="text-[var(--glass-gray-medium)]">Effective Date: </span>
                              <span className="text-[var(--glass-black-dark)] font-medium">
                                {formatDisplayDate(plan.effective_date)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
              </>
            )}
          </div>

          {/* Dependents Section - Only show if participant is in a group */}
          {participant?.group_id && (
            <div id="dependents" className="pt-6 border-t border-white/20 scroll-mt-4">
              <div className="mb-6 border-b border-black pb-4">
                <button
                  type="button"
                  onClick={() => toggleSection('dependents')}
                  className="flex items-center gap-2 text-2xl font-bold text-[var(--glass-black-dark)] hover:opacity-80 transition-opacity"
                >
                  <span className={`text-lg transform transition-transform ${collapsedSections['dependents'] ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                  <span>Dependents</span>
                </button>
              </div>

              {!collapsedSections['dependents'] && (
                <>
              <div className="flex items-center justify-end mb-4">
                <GlassButton
                  variant="primary"
                  type="button"
                  onClick={handleAddDependent}
                >
                  {dependents.length === 0 && newDependents.length === 0 
                    ? '+ Add Dependent' 
                    : '+ Add Another Dependent'}
                </GlassButton>
              </div>
            {/* New Dependents Form Section */}
            {showAddDependentForm && newDependents.length > 0 && (
              <div className="mb-6 space-y-4">
                {newDependents.map((newDependent) => (
                  <div
                    key={newDependent.id}
                    className="glass-card rounded-xl p-4 bg-blue-500/10 border border-blue-500/20"
                  >
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Name */}
                        <div>
                          <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                            Name *
                          </label>
                          <input
                            type="text"
                            value={newDependent.name}
                            onChange={(e) => handleDependentChange(newDependent.id, 'name', e.target.value)}
                            className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                            placeholder="Enter dependent name"
                            required
                          />
                        </div>

                        {/* Relationship */}
                        <div>
                          <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                            Relationship *
                          </label>
                          <select
                            value={newDependent.relationship}
                            onChange={(e) => handleDependentChange(newDependent.id, 'relationship', e.target.value)}
                            className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                            required
                          >
                            <option value="">Select relationship</option>
                            <option value="Spouse">Spouse</option>
                            <option value="Child">Child</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Date of Birth */}
                        <div>
                          <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                            Date of Birth
                          </label>
                          <div className="date-input-wrapper">
                            <input
                              type="date"
                              value={newDependent.dob}
                              onChange={(e) => handleDependentChange(newDependent.id, 'dob', e.target.value)}
                              className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                            />
                            <div className="calendar-icon">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                              </svg>
                            </div>
                          </div>
                        </div>

                        {/* Remove Button */}
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveDependent(newDependent.id)}
                            className="w-full px-4 py-3 rounded-full font-semibold bg-[#C6282B] text-white hover:bg-[#A01F22] shadow-lg hover:shadow-xl transition-all duration-300"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Save Button */}
                <div className="flex justify-end gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setNewDependents([]);
                      setShowAddDependentForm(false);
                    }}
                    className="px-6 py-3 rounded-full font-semibold bg-[#C6282B] text-white hover:bg-[#A01F22] shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    Cancel
                  </button>
                  <GlassButton
                    variant="primary"
                    type="button"
                    onClick={handleSaveDependents}
                    disabled={isSubmitting || newDependents.some(d => !d.name.trim() || !d.relationship.trim())}
                    className={isSubmitting || newDependents.some(d => !d.name.trim() || !d.relationship.trim()) ? 'opacity-50 cursor-not-allowed' : ''}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Dependent(s)'}
                  </GlassButton>
                </div>
              </div>
            )}

            {loadingDependents ? (
              <p className="text-[var(--glass-gray-medium)] text-center py-4">
                Loading dependents...
              </p>
            ) : (
              <div className="space-y-3">
                {[...dependents].sort((a, b) => {
                  // Sort by DOB: oldest first
                  // Dependents without DOB go to the end
                  if (!a.dob && !b.dob) return 0;
                  if (!a.dob) return 1; // a goes after b
                  if (!b.dob) return -1; // b goes after a
                  
                  // Compare dates (older dates come first)
                  const dateA = new Date(a.dob);
                  const dateB = new Date(b.dob);
                  return dateA.getTime() - dateB.getTime();
                }).map((dependent) => (
                  <div
                    key={dependent.id}
                    className="glass-card rounded-xl p-4 bg-white/5 border border-white/10"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4">
                          <h3 className="font-semibold text-[var(--glass-black-dark)]">
                            {dependent.name}
                          </h3>
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            dependent.relationship === 'Spouse' 
                              ? 'bg-blue-500/20 text-blue-700' 
                              : 'bg-[var(--glass-secondary)] text-white'
                          }`}>
                            {dependent.relationship}
                          </span>
                          {dependent.dob && (
                            <span className="text-sm text-[var(--glass-gray-medium)]">
                              DOB: {formatDisplayDate(dependent.dob)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Dependent Summary Section */}
            <div className="mt-6 pt-6 border-t border-white/20">
              <h3 className="text-xl font-semibold text-[var(--glass-black-dark)] mb-4">
                Dependent Summary
              </h3>
              
              {(() => {
                // Calculate summary values from actual dependent records
                const spouseRecordsCount = dependents.filter(d => d.relationship === 'Spouse').length;
                const childRecordsCount = dependents.filter(d => d.relationship === 'Child').length;
                
                // Display values: Always use actual record counts
                const spouseDisplayValue = spouseRecordsCount;
                const childDisplayValue = childRecordsCount;
                const totalDependents = spouseDisplayValue + childDisplayValue;
                
                return (
                  <div className="space-y-6">
                    {/* Total Dependents */}
                    <div>
                      <h4 className="text-lg font-semibold text-[var(--glass-black-dark)] mb-4">Total</h4>
                      <div>
                        <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                          Total Number of Dependents
                        </label>
                        <div className="glass-input-enhanced w-full px-4 py-3 rounded-xl opacity-75 cursor-not-allowed bg-green-500/10 border border-green-500/20">
                          <span className="font-bold text-lg text-[var(--glass-black-dark)]">{totalDependents}</span>
                        </div>
                      </div>
                    </div>

                    {/* Spouses and Children Section */}
                    <div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                        {/* Spouses Header */}
                        <div>
                          <h4 className="text-lg font-semibold text-[var(--glass-black-dark)]">Spouses</h4>
                        </div>
                        {/* Children Header */}
                        <div>
                          <h4 className="text-lg font-semibold text-[var(--glass-black-dark)]">Children</h4>
                        </div>
                      </div>

                      {/* Display Fields Row */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                        {/* Number of Spouses - Display (formula field) */}
                        <div>
                          <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                            Number of Spouses
                          </label>
                          <div className="glass-input-enhanced w-full px-4 py-3 rounded-xl opacity-75 cursor-not-allowed bg-blue-500/10 border border-blue-500/20">
                            <span className="font-semibold text-[var(--glass-black-dark)]">{spouseDisplayValue}</span>
                          </div>
                        </div>

                        {/* Number of Children - Display (formula field) */}
                        <div>
                          <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                            Number of Children
                          </label>
                          <div className="glass-input-enhanced w-full px-4 py-3 rounded-xl opacity-75 cursor-not-allowed bg-blue-500/10 border border-blue-500/20">
                            <span className="font-semibold text-[var(--glass-black-dark)]">{childDisplayValue}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* No Dependents Message - Show below summary if no dependents */}
            {!loadingDependents && dependents.length === 0 && newDependents.length === 0 && (
              <div className="mt-6 pt-6 border-t border-white/20">
                <p className="text-[var(--glass-gray-medium)] text-center py-4">
                  No dependents
                </p>
              </div>
            )}
                </>
              )}
            </div>
          )}

          {/* Persons of Interest Section - Only show if participant is NOT in a group */}
          {!participant?.group_id && (
            <div id="persons-of-interest" className="pt-6 border-t border-white/20 scroll-mt-4">
              <div className="mb-6 border-b border-black pb-4">
                <button
                  type="button"
                  onClick={() => toggleSection('persons-of-interest')}
                  className="flex items-center gap-2 text-2xl font-bold text-[var(--glass-black-dark)] hover:opacity-80 transition-opacity"
                >
                  <span className={`text-lg transform transition-transform ${collapsedSections['persons-of-interest'] ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                  <span>Persons of Interest</span>
                </button>
              </div>

              {!collapsedSections['persons-of-interest'] && (
                <>
              <div className="flex items-center justify-end mb-4">
                <GlassButton
                  variant="primary"
                  type="button"
                  onClick={handleAddRelationship}
                >
                  {relationships.length === 0 && newRelationships.length === 0 
                    ? '+ Add Relationship' 
                    : '+ Add Another Relationship'}
                </GlassButton>
              </div>
              {/* New Relationships Form Section */}
              {showAddRelationshipForm && newRelationships.length > 0 && (
                <div className="mb-6 space-y-4">
                  {newRelationships.map((newRelationship) => (
                    <div
                      key={newRelationship.id}
                      className="glass-card rounded-xl p-4 bg-blue-500/10 border border-blue-500/20"
                    >
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Related Participant */}
                          <div className="relative">
                            <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                              Related Participant *
                            </label>
                            {loadingParticipants ? (
                              <p className="text-[var(--glass-gray-medium)] text-sm py-2">Loading participants...</p>
                            ) : (
                              <>
                                <input
                                  type="text"
                                  value={newRelationship.related_participant_name}
                                  onChange={(e) => {
                                    handleRelationshipChange(newRelationship.id, 'related_participant_name', e.target.value);
                                    setRelationshipSearchOpen(new Map(relationshipSearchOpen.set(newRelationship.id, true)));
                                  }}
                                  onFocus={() => {
                                    setRelationshipSearchOpen(new Map(relationshipSearchOpen.set(newRelationship.id, true)));
                                  }}
                                  onBlur={() => {
                                    // Delay closing to allow click on dropdown item
                                    setTimeout(() => {
                                      setRelationshipSearchOpen(new Map(relationshipSearchOpen.set(newRelationship.id, false)));
                                    }, 200);
                                  }}
                                  className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                                  placeholder="Type to search participants..."
                                  required
                                />
                                {relationshipSearchOpen.get(newRelationship.id) && (
                                  <div className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-lg border border-white/20 max-h-60 overflow-y-auto">
                                    {allParticipants
                                      .filter(p => 
                                        p.client_name.toLowerCase().includes(newRelationship.related_participant_name.toLowerCase())
                                      )
                                      .slice(0, 10)
                                      .map((p) => (
                                        <div
                                          key={p.id}
                                          onClick={() => {
                                            // Update both fields atomically
                                            setNewRelationships(newRelationships.map(rel => 
                                              rel.id === newRelationship.id 
                                                ? { ...rel, related_participant_id: p.id, related_participant_name: p.client_name }
                                                : rel
                                            ));
                                            setRelationshipSearchOpen(new Map(relationshipSearchOpen.set(newRelationship.id, false)));
                                          }}
                                          className="px-4 py-3 hover:bg-blue-500/10 cursor-pointer border-b border-white/10 last:border-b-0"
                                        >
                                          <span className="text-[var(--glass-black-dark)]">{p.client_name}</span>
                                        </div>
                                      ))}
                                    {allParticipants.filter(p => 
                                      p.client_name.toLowerCase().includes(newRelationship.related_participant_name.toLowerCase())
                                    ).length === 0 && (
                                      <div className="px-4 py-3 text-[var(--glass-gray-medium)]">
                                        No participants found
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          {/* Relationship Type */}
                          <div>
                            <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                              Relationship *
                            </label>
                            <select
                              value={newRelationship.relationship}
                              onChange={(e) => handleRelationshipChange(newRelationship.id, 'relationship', e.target.value as 'Spouses' | 'Parent/Child')}
                              className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                              required
                            >
                              <option value="Spouses">Spouses</option>
                              <option value="Parent/Child">Parent/Child</option>
                            </select>
                          </div>
                        </div>

                        {/* Representative Checkbox */}
                        <div>
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newRelationship.is_representative}
                              onChange={(e) => {
                                const isChecked = e.target.checked;
                                // Update both fields in a single state change
                                setNewRelationships(newRelationships.map(rel => 
                                  rel.id === newRelationship.id 
                                    ? { 
                                        ...rel, 
                                        is_representative: isChecked,
                                        representative_participant_id: isChecked ? rel.representative_participant_id : ''
                                      } 
                                    : rel
                                ));
                              }}
                              className="w-5 h-5 rounded border-gray-300 text-[var(--glass-primary)] focus:ring-[var(--glass-primary)]"
                            />
                            <span className="text-sm font-semibold text-[var(--glass-black-dark)]">
                              Representative?
                            </span>
                          </label>
                        </div>

                        {/* Representative Assignment - Only show if checkbox is checked */}
                        {newRelationship.is_representative && (() => {
                          // Find the related participant - check by ID first, then by name if ID not set
                          const relatedParticipant = newRelationship.related_participant_id 
                            ? allParticipants.find(p => p.id === newRelationship.related_participant_id)
                            : newRelationship.related_participant_name
                              ? allParticipants.find(p => p.client_name.toLowerCase() === newRelationship.related_participant_name.toLowerCase())
                              : null;

                          return (
                            <div>
                              <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                                Representative Participant *
                              </label>
                              {loadingParticipants ? (
                                <p className="text-[var(--glass-gray-medium)] text-sm py-2">Loading participants...</p>
                              ) : (
                                <select
                                  value={newRelationship.representative_participant_id}
                                  onChange={(e) => handleRelationshipChange(newRelationship.id, 'representative_participant_id', e.target.value)}
                                  className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                                  required={newRelationship.is_representative}
                                >
                                  <option value="">Select representative</option>
                                  {/* Show current participant */}
                                  {participant && (
                                    <option key={participant.id} value={participant.id}>
                                      {participant.client_name} (Current)
                                    </option>
                                  )}
                                  {/* Show related participant if available */}
                                  {relatedParticipant && (
                                    <option key={relatedParticipant.id} value={relatedParticipant.id}>
                                      {relatedParticipant.client_name}
                                    </option>
                                  )}
                                </select>
                              )}
                            </div>
                          );
                        })()}

                        {/* Notes */}
                        <div>
                          <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                            Notes
                          </label>
                          <textarea
                            value={newRelationship.notes}
                            onChange={(e) => handleRelationshipChange(newRelationship.id, 'notes', e.target.value)}
                            className="glass-input-enhanced w-full px-4 py-3 rounded-xl resize-none"
                            rows={3}
                            placeholder="Enter notes about this relationship"
                          />
                        </div>

                        {/* Remove Button */}
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveRelationship(newRelationship.id)}
                            className="px-6 py-3 rounded-full font-semibold bg-[#C6282B] text-white hover:bg-[#A01F22] shadow-lg hover:shadow-xl transition-all duration-300"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Save Button */}
                  <div className="flex justify-end gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setNewRelationships([]);
                        setShowAddRelationshipForm(false);
                      }}
                      className="px-6 py-3 rounded-full font-semibold bg-[#C6282B] text-white hover:bg-[#A01F22] shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      Cancel
                    </button>
                    <GlassButton
                      variant="primary"
                      type="button"
                      onClick={handleSaveRelationships}
                      disabled={isSubmitting || newRelationships.some(r => (!r.related_participant_id.trim() && !r.related_participant_name.trim()) || !r.relationship)}
                      className={isSubmitting || newRelationships.some(r => (!r.related_participant_id.trim() && !r.related_participant_name.trim()) || !r.relationship) ? 'opacity-50 cursor-not-allowed' : ''}
                    >
                      {isSubmitting ? 'Saving...' : 'Save Relationship(s)'}
                    </GlassButton>
                  </div>
                </div>
              )}

              {/* Existing Relationships */}
              {loadingRelationships ? (
                <p className="text-[var(--glass-gray-medium)] text-center py-4">
                  Loading relationships...
                </p>
              ) : (
                <div className="space-y-3">
                  {relationships.map((relationship) => {
                    const relatedParticipant = relationship.related_participant;
                    return (
                      <div
                        key={relationship.id}
                        className="glass-card rounded-xl p-4 bg-white/5 border border-white/10"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-4 flex-wrap">
                              <h3 className="font-semibold text-[var(--glass-black-dark)]">
                                {relatedParticipant?.client_name || 'Unknown Participant'}
                              </h3>
                              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                relationship.relationship === 'Spouses' 
                                  ? 'bg-blue-500/20 text-blue-700' 
                                  : 'bg-green-500/20 text-green-700'
                              }`}>
                                {relationship.relationship}
                              </span>
                              {relationship.is_representative && (
                                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-purple-500/20 text-purple-700">
                                  Representative
                                </span>
                              )}
                              {relationship.notes && (
                                <span className="text-sm text-[var(--glass-gray-medium)]">
                                  {relationship.notes}
                                </span>
                              )}
                            </div>
                          </div>
                          {isEditMode && (
                            <button
                              type="button"
                              onClick={() => handleDeleteRelationship(relationship.id)}
                              className="px-4 py-2 rounded-full font-semibold bg-[#C6282B] text-white hover:bg-[#A01F22] shadow-lg hover:shadow-xl transition-all duration-300 text-sm"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {!loadingRelationships && relationships.length === 0 && newRelationships.length === 0 && (
                    <p className="text-[var(--glass-gray-medium)] text-center py-4">
                      No relationships
                    </p>
                  )}
                </div>
              )}
                </>
              )}
            </div>
          )}

          {/* Notes Section */}
          <div id="notes" className="pt-6 border-t border-white/20 mt-6 scroll-mt-4">
            <div className="mb-6 border-b border-black pb-4">
              <button
                type="button"
                onClick={() => toggleSection('notes')}
                className="flex items-center gap-2 text-2xl font-bold text-[var(--glass-black-dark)] hover:opacity-80 transition-opacity"
              >
                <span className={`text-lg transform transition-transform ${collapsedSections['notes'] ? 'rotate-180' : ''}`}>
                  ▼
                </span>
                <span>Notes</span>
              </button>
            </div>

            {!collapsedSections['notes'] && (
              <>
            <div className="flex items-center justify-end mb-4">
              <GlassButton
                variant="primary"
                type="button"
                onClick={() => setShowAddNoteForm(true)}
              >
                + Add Note
              </GlassButton>
            </div>
            {/* Add Note Form */}
            {showAddNoteForm && (
              <div className="mb-6 glass-card rounded-xl p-4 bg-blue-500/10 border border-blue-500/20">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="note-date" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                      Date *
                    </label>
                    <div className="date-input-wrapper">
                      <input
                        type="date"
                        id="note-date"
                        value={newNote.date}
                        onChange={(e) => setNewNote({ ...newNote, date: e.target.value })}
                        className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                        required
                      />
                      <div className="calendar-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                          <line x1="16" y1="2" x2="16" y2="6"></line>
                          <line x1="8" y1="2" x2="8" y2="6"></line>
                          <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="note-content" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                      Note *
                    </label>
                    <textarea
                      id="note-content"
                      value={newNote.notes}
                      onChange={(e) => setNewNote({ ...newNote, notes: e.target.value })}
                      rows={4}
                      className="glass-input-enhanced w-full px-4 py-3 rounded-xl resize-none"
                      placeholder="Enter your note here..."
                      required
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleAddNote}
                      disabled={isSubmitting}
                      className="px-4 py-3 rounded-full font-semibold bg-green-500 text-white hover:bg-green-600 shadow-lg hover:shadow-xl transition-all duration-300 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Saving...' : 'Save Note'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelAddNote}
                      disabled={isSubmitting}
                      className="px-4 py-3 rounded-full font-semibold bg-[#C6282B] text-white hover:bg-[#A01F22] shadow-lg hover:shadow-xl transition-all duration-300 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Notes List */}
            {loadingNotes ? (
              <p className="text-[var(--glass-gray-medium)] text-center py-4">
                Loading notes...
              </p>
            ) : participantNotes.length === 0 ? (
              <p className="text-[var(--glass-gray-medium)] text-center py-4">
                No notes yet. Click "Add Note" to create one.
              </p>
            ) : (
              <div className="space-y-3">
                {participantNotes.map((note) => (
                  <div
                    key={note.id}
                    className="glass-card rounded-xl p-4 bg-white/5 border border-white/10"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm font-semibold text-[var(--glass-gray-medium)]">
                            {(() => {
                              const dateOnlyMatch = String(note.date).match(/^(\d{4})-(\d{2})-(\d{2})/);
                              return dateOnlyMatch 
                                ? new Date(parseInt(dateOnlyMatch[1]), parseInt(dateOnlyMatch[2]) - 1, parseInt(dateOnlyMatch[3])).toLocaleDateString()
                                : new Date(note.date).toLocaleDateString();
                            })()}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--glass-black-dark)] whitespace-pre-wrap">
                          {note.notes}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
              </>
            )}
          </div>

        </form>
      </GlassCard>

      {/* Delete Plan Confirmation Dialog */}
      {planToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setPlanToDelete(null)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-4 text-center">
              Delete Participant Plan
            </h3>
            <p className="text-[var(--glass-gray-medium)] mb-6 text-center">
              You are deleting a Participant Plan. This will delete all the Participant Plan history and cannot be undone. Are you sure you want to continue?
            </p>
            <div className="flex gap-4 justify-center">
              <button
                type="button"
                onClick={() => setPlanToDelete(null)}
                disabled={isDeletingPlan}
                className="px-6 py-3 rounded-full font-semibold bg-[#C6282B] text-white hover:bg-[#A01F22] shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePlan}
                disabled={isDeletingPlan}
                className="px-6 py-3 rounded-full font-semibold bg-[#C6282B] text-white hover:bg-[#A01F22] shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeletingPlan ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Participant Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeleteDialog(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-4 text-center">
              Delete Participant
            </h3>
            <p className="text-[var(--glass-gray-medium)] mb-6 text-center">
              You are deleting a Participant. This will delete all participant information including group plans, Medicare plans, dependents, notes, and related records. Rate history will be preserved. This action cannot be undone. Are you sure you want to continue?
            </p>
            <div className="flex gap-4 justify-center">
              <button
                type="button"
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
                className="px-6 py-3 rounded-full font-semibold bg-[#C6282B] text-white hover:bg-[#A01F22] shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteParticipant}
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
