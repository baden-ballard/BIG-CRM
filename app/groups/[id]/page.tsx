'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import GlassCard from '../../../components/GlassCard';
import GlassButton from '../../../components/GlassButton';
import { supabase } from '../../../lib/supabase';

interface Group {
  id: string;
  name: string;
  initial_contact_date: string | null;
  lead_source: string | null;
  from_who: string | null;
  pipeline_status: string | null;
  status_change_notes: string | null;
  eligibility_period: string | null;
  number_of_classes: number | null;
  eligibility_period_class_2: string | null;
  eligibility_period_class_3: string | null;
  created_at: string;
  updated_at: string;
}

interface Program {
  id: string;
  name: string;
}

interface Participant {
  id: string;
  group_id: string | null;
  client_name: string;
  dob: string | null;
  address: string | null;
  phone_number: string | null;
  email_address: string | null;
  created_at: string;
  updated_at: string;
}

interface GroupPlan {
  id: string;
  group_id: string;
  program_id: string | null;
  provider_id: string | null;
  plan_name: string;
  effective_date: string | null;
  termination_date: string | null;
  plan_type: string | null;
  program_name?: string;
  provider_name?: string;
}

interface StatusChangeLog {
  id: string;
  group_id: string;
  date: string;
  option: string;
  notes: string | null;
  origin: string;
  created_at: string;
}

interface Note {
  id: string;
  group_id: string | null;
  participant_id: string | null;
  date: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

interface Renewal {
  id: string;
  group_id: string;
  renewal_date: string;
  created_at: string;
  updated_at: string;
  plans?: GroupPlan[];
}

export default function GroupDetailPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = (params?.id ?? '') as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [plans, setPlans] = useState<GroupPlan[]>([]);
  const [activePlans, setActivePlans] = useState<GroupPlan[]>([]);
  const [terminatedPlans, setTerminatedPlans] = useState<GroupPlan[]>([]);
  const [statusHistory, setStatusHistory] = useState<StatusChangeLog[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [originalPipelineStatus, setOriginalPipelineStatus] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    initial_contact_date: '',
    lead_source: '',
    from_who: '',
    pipeline_status: '',
    status_change_notes: '',
    eligibility_period: '',
    number_of_classes: 1,
    eligibility_period_class_2: '',
    eligibility_period_class_3: '',
  });
  const [loading, setLoading] = useState(true);
  const [loadingParticipants, setLoadingParticipants] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingStatusHistory, setLoadingStatusHistory] = useState(true);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [programsDropdownOpen, setProgramsDropdownOpen] = useState(false);
  const programsDropdownRef = useRef<HTMLDivElement>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [showAddNoteForm, setShowAddNoteForm] = useState(false);
  const [newNote, setNewNote] = useState({
    notes: '',
    date: new Date().toISOString().split('T')[0], // Default to today
  });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [loadingRenewals, setLoadingRenewals] = useState(true);
  const [showAddRenewalForm, setShowAddRenewalForm] = useState(false);
  const [newRenewal, setNewRenewal] = useState({
    renewal_date: new Date().toISOString().split('T')[0],
    selected_plan_ids: [] as string[],
  });
  const [renewalPlansDropdownOpen, setRenewalPlansDropdownOpen] = useState(false);
  const renewalPlansDropdownRef = useRef<HTMLDivElement>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    'group-information': true,
    'plans': true,
    'participants': true,
    'renewal': true,
    'sales-status': true,
    'notes': true,
  });

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  useEffect(() => {
    if (groupId) {
      fetchGroup();
      fetchParticipants();
      fetchPlans();
      fetchStatusHistory();
      fetchPrograms();
      fetchGroupPrograms();
      fetchNotes();
      fetchRenewals();
    } else {
      setError('Group ID is missing');
      setLoading(false);
      setLoadingParticipants(false);
      setLoadingPlans(false);
      setLoadingStatusHistory(false);
      setLoadingPrograms(false);
      setLoadingNotes(false);
      setLoadingRenewals(false);
    }
  }, [groupId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (programsDropdownRef.current && !programsDropdownRef.current.contains(event.target as Node)) {
        setProgramsDropdownOpen(false);
      }
      if (renewalPlansDropdownRef.current && !renewalPlansDropdownRef.current.contains(event.target as Node)) {
        setRenewalPlansDropdownOpen(false);
      }
    };

    if (programsDropdownOpen || renewalPlansDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [programsDropdownOpen, renewalPlansDropdownOpen]);

  const toggleProgram = (programId: string) => {
    setSelectedPrograms(prev => {
      if (prev.includes(programId)) {
        return prev.filter(id => id !== programId);
      } else {
        return [...prev, programId];
      }
    });
  };

  const fetchGroup = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!groupId) {
        throw new Error('Group ID is required');
      }

      const { data, error: fetchError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      if (!data) {
        throw new Error('Group not found');
      }

      setGroup(data);
      setOriginalPipelineStatus(data.pipeline_status);
      setFormData({
        name: data.name || '',
        initial_contact_date: formatDate(data.initial_contact_date),
        lead_source: data.lead_source || '',
        from_who: data.from_who || '',
        pipeline_status: data.pipeline_status || '',
        status_change_notes: '',
        eligibility_period: data.eligibility_period || '',
        number_of_classes: data.number_of_classes || 1,
        eligibility_period_class_2: data.eligibility_period_class_2 || '',
        eligibility_period_class_3: data.eligibility_period_class_3 || '',
      });
    } catch (err: any) {
      console.error('Error fetching group:', err);
      setError(err.message || 'Failed to load group');
    } finally {
      setLoading(false);
    }
  };

  const fetchParticipants = async () => {
    try {
      setLoadingParticipants(true);

      if (!groupId) {
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('participants')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setParticipants(data || []);
    } catch (err: any) {
      console.error('Error fetching participants:', err);
    } finally {
      setLoadingParticipants(false);
    }
  };

  const fetchPlans = async () => {
    try {
      setLoadingPlans(true);

      if (!groupId) {
        return;
      }

      // Fetch plans for this group
      const { data: plansData, error: plansError } = await supabase
        .from('group_plans')
        .select('*')
        .eq('group_id', groupId)
        .order('effective_date', { ascending: false });

      if (plansError) {
        throw plansError;
      }

      if (!plansData || plansData.length === 0) {
        setPlans([]);
        return;
      }

      // Fetch program and provider names
      const programIds = [...new Set(plansData.map((p: any) => p.program_id).filter(Boolean))];
      const providerIds = [...new Set(plansData.map((p: any) => p.provider_id).filter(Boolean))];

      const programMap = new Map<string, string>();
      const providerMap = new Map<string, string>();

      if (programIds.length > 0) {
        const { data: programsData } = await supabase
          .from('programs')
          .select('id, name')
          .in('id', programIds);
        
        if (programsData) {
          programsData.forEach((p: any) => programMap.set(p.id, p.name));
        }
      }

      if (providerIds.length > 0) {
        const { data: providersData } = await supabase
          .from('providers')
          .select('id, name')
          .in('id', providerIds);
        
        if (providersData) {
          providersData.forEach((p: any) => providerMap.set(p.id, p.name));
        }
      }

      // Transform plans with program and provider names
      const transformedPlans: GroupPlan[] = plansData.map((plan: any) => ({
        ...plan,
        program_name: plan.program_id ? programMap.get(plan.program_id) : undefined,
        provider_name: plan.provider_id ? providerMap.get(plan.provider_id) : undefined,
      }));

      // Separate active and terminated plans
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const active: GroupPlan[] = [];
      const terminated: GroupPlan[] = [];

      transformedPlans.forEach((plan) => {
        const terminationDate = plan.termination_date 
          ? new Date(plan.termination_date)
          : null;
        
        if (terminationDate && terminationDate < today) {
          terminated.push(plan);
        } else {
          active.push(plan);
        }
      });

      setPlans(transformedPlans);
      setActivePlans(active);
      setTerminatedPlans(terminated);
    } catch (err: any) {
      console.error('Error fetching plans:', err);
    } finally {
      setLoadingPlans(false);
    }
  };

  const fetchStatusHistory = async () => {
    try {
      setLoadingStatusHistory(true);

      if (!groupId) {
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('group_change_logs')
        .select('*')
        .eq('group_id', groupId)
        .eq('origin', 'Status Change')
        .order('date', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setStatusHistory(data || []);
    } catch (err: any) {
      console.error('Error fetching status history:', err);
    } finally {
      setLoadingStatusHistory(false);
    }
  };

  const fetchPrograms = async () => {
    try {
      setLoadingPrograms(true);

      const { data, error: fetchError } = await supabase
        .from('programs')
        .select('*')
        .order('name', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setPrograms(data || []);
    } catch (err: any) {
      console.error('Error fetching programs:', err);
    } finally {
      setLoadingPrograms(false);
    }
  };

  const fetchGroupPrograms = async () => {
    try {
      if (!groupId) {
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('group_programs')
        .select('program_id')
        .eq('group_id', groupId);

      if (fetchError) {
        throw fetchError;
      }

      setSelectedPrograms((data || []).map((gp: any) => gp.program_id));
    } catch (err: any) {
      console.error('Error fetching group programs:', err);
    }
  };

  const fetchNotes = async () => {
    try {
      setLoadingNotes(true);

      if (!groupId) {
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('notes')
        .select('*')
        .eq('group_id', groupId)
        .order('date', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setNotes(data || []);
    } catch (err: any) {
      console.error('Error fetching notes:', err);
    } finally {
      setLoadingNotes(false);
    }
  };

  const fetchRenewals = async () => {
    try {
      setLoadingRenewals(true);

      if (!groupId) {
        return;
      }

      // Fetch renewals with their associated plans
      const { data: renewalsData, error: renewalsError } = await supabase
        .from('renewals')
        .select('*')
        .eq('group_id', groupId)
        .order('renewal_date', { ascending: false });

      if (renewalsError) {
        throw renewalsError;
      }

      if (!renewalsData || renewalsData.length === 0) {
        setRenewals([]);
        return;
      }

      // Fetch associated plans for each renewal
      const renewalsWithPlans = await Promise.all(
        renewalsData.map(async (renewal) => {
          const { data: renewalPlansData, error: plansError } = await supabase
            .from('renewal_group_plans')
            .select('group_plan_id')
            .eq('renewal_id', renewal.id);

          if (plansError) {
            console.error('Error fetching renewal plans:', plansError);
            return { ...renewal, plans: [] };
          }

          const planIds = renewalPlansData?.map((rp: any) => rp.group_plan_id) || [];
          
          if (planIds.length === 0) {
            return { ...renewal, plans: [] };
          }

          // Fetch plan details
          const { data: plansData, error: plansDetailsError } = await supabase
            .from('group_plans')
            .select('*')
            .in('id', planIds);

          if (plansDetailsError) {
            console.error('Error fetching plan details:', plansDetailsError);
            return { ...renewal, plans: [] };
          }

          // Fetch program and provider names
          const programIds = [...new Set(plansData?.map((p: any) => p.program_id).filter(Boolean) || [])];
          const providerIds = [...new Set(plansData?.map((p: any) => p.provider_id).filter(Boolean) || [])];

          const programMap = new Map<string, string>();
          const providerMap = new Map<string, string>();

          if (programIds.length > 0) {
            const { data: programsData } = await supabase
              .from('programs')
              .select('id, name')
              .in('id', programIds);
            
            if (programsData) {
              programsData.forEach((p: any) => programMap.set(p.id, p.name));
            }
          }

          if (providerIds.length > 0) {
            const { data: providersData } = await supabase
              .from('providers')
              .select('id, name')
              .in('id', providerIds);
            
            if (providersData) {
              providersData.forEach((p: any) => providerMap.set(p.id, p.name));
            }
          }

          const plansWithNames = plansData?.map((plan: any) => ({
            ...plan,
            program_name: plan.program_id ? programMap.get(plan.program_id) : undefined,
            provider_name: plan.provider_id ? providerMap.get(plan.provider_id) : undefined,
          })) || [];

          return { ...renewal, plans: plansWithNames };
        })
      );

      setRenewals(renewalsWithPlans);
    } catch (err: any) {
      console.error('Error fetching renewals:', err);
    } finally {
      setLoadingRenewals(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.notes.trim() || !newNote.date) {
      alert('Please enter both note content and date');
      return;
    }

    setIsSubmitting(true);

    try {
      if (!groupId) {
        throw new Error('Group ID is required');
      }

      const { data, error: insertError } = await supabase
        .from('notes')
        .insert([{
          group_id: groupId,
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

  const toggleRenewalPlan = (planId: string) => {
    setNewRenewal(prev => {
      if (prev.selected_plan_ids.includes(planId)) {
        return {
          ...prev,
          selected_plan_ids: prev.selected_plan_ids.filter(id => id !== planId),
        };
      } else {
        return {
          ...prev,
          selected_plan_ids: [...prev.selected_plan_ids, planId],
        };
      }
    });
  };

  const handleAddRenewal = async () => {
    if (!newRenewal.renewal_date) {
      alert('Please select a renewal date');
      return;
    }

    if (newRenewal.selected_plan_ids.length === 0) {
      alert('Please select at least one plan to renew');
      return;
    }

    setIsSubmitting(true);

    try {
      if (!groupId) {
        throw new Error('Group ID is required');
      }

      // Create the renewal
      const { data: renewalData, error: renewalError } = await supabase
        .from('renewals')
        .insert([{
          group_id: groupId,
          renewal_date: newRenewal.renewal_date,
        }])
        .select()
        .single();

      if (renewalError) {
        throw renewalError;
      }

      // Link the selected plans to the renewal
      const renewalPlanLinks = newRenewal.selected_plan_ids.map(planId => ({
        renewal_id: renewalData.id,
        group_plan_id: planId,
      }));

      const { error: linksError } = await supabase
        .from('renewal_group_plans')
        .insert(renewalPlanLinks);

      if (linksError) {
        throw linksError;
      }

      // Refresh renewals list
      await fetchRenewals();

      // Reset form
      setNewRenewal({
        renewal_date: new Date().toISOString().split('T')[0],
        selected_plan_ids: [],
      });
      setShowAddRenewalForm(false);

      alert('Renewal added successfully!');
    } catch (err: any) {
      console.error('Error adding renewal:', err);
      alert('Failed to add renewal. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelAddRenewal = () => {
    setNewRenewal({
      renewal_date: new Date().toISOString().split('T')[0],
      selected_plan_ids: [],
    });
    setShowAddRenewalForm(false);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0]; // Format as YYYY-MM-DD for date inputs
  };

  const formatDisplayDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    // Parse date-only strings (YYYY-MM-DD) as local dates to avoid timezone shifts
    const dateOnlyMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      // Create date using local time (month is 0-indexed in Date constructor)
      const localDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return localDate.toLocaleDateString();
    }
    // For datetime strings, use the original behavior
    return new Date(dateString).toLocaleDateString();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: name === 'number_of_classes' ? parseInt(value) : value,
      };
      // Clear status_change_notes if pipeline_status is cleared or set back to original
      if (name === 'pipeline_status') {
        if (!value || value === originalPipelineStatus) {
          updated.status_change_notes = '';
        }
      }
      // Clear eligibility period fields when number_of_classes is reduced
      if (name === 'number_of_classes') {
        const numClasses = parseInt(value);
        if (numClasses < 2) {
          updated.eligibility_period_class_2 = '';
        }
        if (numClasses < 3) {
          updated.eligibility_period_class_3 = '';
        }
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!groupId) {
        throw new Error('Group ID is required');
      }

      // Validate that at least one visible eligibility period is filled
      const numClasses = formData.number_of_classes || 1;
      const hasEligibilityPeriod = !!(formData.eligibility_period && formData.eligibility_period.trim() !== '');
      const hasEligibilityPeriodClass2 = !!(formData.eligibility_period_class_2 && formData.eligibility_period_class_2.trim() !== '');
      const hasEligibilityPeriodClass3 = !!(formData.eligibility_period_class_3 && formData.eligibility_period_class_3.trim() !== '');

      let hasAtLeastOneEligibilityPeriod = false;
      if (numClasses === 1) {
        hasAtLeastOneEligibilityPeriod = hasEligibilityPeriod;
      } else if (numClasses === 2) {
        hasAtLeastOneEligibilityPeriod = hasEligibilityPeriod || hasEligibilityPeriodClass2;
      } else if (numClasses === 3) {
        hasAtLeastOneEligibilityPeriod = hasEligibilityPeriod || hasEligibilityPeriodClass2 || hasEligibilityPeriodClass3;
      }

      if (!hasAtLeastOneEligibilityPeriod) {
        alert('Please select at least one eligibility period for the visible class(es).');
        setIsSubmitting(false);
        return;
      }

      // Prepare data for update
      const updateData: any = {
        name: formData.name,
      };

      // Add optional fields only if they have values
      if (formData.initial_contact_date) {
        updateData.initial_contact_date = formData.initial_contact_date;
      } else {
        updateData.initial_contact_date = null;
      }
      if (formData.lead_source) {
        updateData.lead_source = formData.lead_source;
      } else {
        updateData.lead_source = null;
      }
      if (formData.from_who) {
        updateData.from_who = formData.from_who;
      } else {
        updateData.from_who = null;
      }
      if (formData.pipeline_status) {
        updateData.pipeline_status = formData.pipeline_status;
      } else {
        updateData.pipeline_status = null;
      }
      // Always include eligibility period fields (convert empty strings to null)
      updateData.eligibility_period = formData.eligibility_period && formData.eligibility_period.trim() !== '' ? formData.eligibility_period : null;
      updateData.number_of_classes = typeof formData.number_of_classes === 'number' ? formData.number_of_classes : parseInt(String(formData.number_of_classes)) || 1;
      updateData.eligibility_period_class_2 = formData.eligibility_period_class_2 && formData.eligibility_period_class_2.trim() !== '' ? formData.eligibility_period_class_2 : null;
      updateData.eligibility_period_class_3 = formData.eligibility_period_class_3 && formData.eligibility_period_class_3.trim() !== '' ? formData.eligibility_period_class_3 : null;
      
      // Only include status_change_notes if pipeline status was changed
      const pipelineStatusChanged = formData.pipeline_status !== originalPipelineStatus;
      if (pipelineStatusChanged && formData.status_change_notes) {
        updateData.status_change_notes = formData.status_change_notes;
      } else if (pipelineStatusChanged) {
        updateData.status_change_notes = null;
      }

      // Log update data for debugging
      console.log('Updating group with data:', updateData);

      // Update group in database
      const { data, error: updateError } = await supabase
        .from('groups')
        .update(updateData)
        .eq('id', groupId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Update group programs
      if (groupId) {
        // Delete existing group_programs
        const { error: deleteError } = await supabase
          .from('group_programs')
          .delete()
          .eq('group_id', groupId);

        if (deleteError) {
          throw deleteError;
        }

        // Insert new group_programs
        if (selectedPrograms.length > 0) {
          const groupProgramsToInsert = selectedPrograms.map(programId => ({
            group_id: groupId,
            program_id: programId,
          }));

          const { error: insertError } = await supabase
            .from('group_programs')
            .insert(groupProgramsToInsert);

          if (insertError) {
            throw insertError;
          }
        }
      }

      // Update local state
      setGroup(data);
      setOriginalPipelineStatus(data.pipeline_status);
      setFormData(prev => ({
        ...prev,
        status_change_notes: '', // Clear after successful save
      }));

      // Refresh participants list and status history
      fetchParticipants();
      fetchStatusHistory();

      setIsEditMode(false);
      alert('Group updated successfully!');
    } catch (err: any) {
      // Better error handling for Supabase errors
      let errorMessage = 'Unknown error occurred';
      
      if (err) {
        if (typeof err === 'string') {
          errorMessage = err;
        } else if (err.message) {
          errorMessage = err.message;
        } else if (err.details) {
          errorMessage = err.details;
        } else if (err.hint) {
          errorMessage = err.hint;
        } else {
          try {
            errorMessage = JSON.stringify(err, null, 2);
          } catch (e) {
            errorMessage = String(err);
          }
        }
      }
      
      console.error('Error updating group:', {
        error: err,
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code
      });
      
      alert(`Failed to update group: ${errorMessage}\n\nIf you see a column error, please run the SQL migration: sql/add-number-of-classes-and-eligibility-periods.sql`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = () => {
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    // Reset form data to original values
    if (group) {
      setFormData({
        name: group.name || '',
        initial_contact_date: formatDate(group.initial_contact_date),
        lead_source: group.lead_source || '',
        from_who: group.from_who || '',
        pipeline_status: group.pipeline_status || '',
        status_change_notes: '',
        eligibility_period: group.eligibility_period || '',
        number_of_classes: group.number_of_classes || 1,
        eligibility_period_class_2: group.eligibility_period_class_2 || '',
        eligibility_period_class_3: group.eligibility_period_class_3 || '',
      });
      setOriginalPipelineStatus(group.pipeline_status);
    }
    fetchGroupPrograms(); // Reset selected programs
  };

  // Check if pipeline status is being changed
  const isPipelineStatusChanging = formData.pipeline_status !== originalPipelineStatus && 
                                    formData.pipeline_status !== '';

  const handleDeleteClick = () => {
    // Check if group has participants
    if (participants.length > 0) {
      alert('This group has participants and cannot be deleted');
      return;
    }
    // Show confirmation dialog
    setShowDeleteDialog(true);
  };

  const handleDeleteGroup = async () => {
    if (!groupId) return;

    try {
      setIsDeleting(true);

      // Double-check participants before deleting
      const { data: participantsCheck, error: checkError } = await supabase
        .from('participants')
        .select('id')
        .eq('group_id', groupId)
        .limit(1);

      if (checkError) {
        throw checkError;
      }

      if (participantsCheck && participantsCheck.length > 0) {
        alert('This group has participants and cannot be deleted');
        setShowDeleteDialog(false);
        return;
      }

      // Delete group programs first (if any)
      const { error: deleteProgramsError } = await supabase
        .from('group_programs')
        .delete()
        .eq('group_id', groupId);

      if (deleteProgramsError) {
        console.error('Error deleting group programs:', deleteProgramsError);
        // Continue with group deletion even if this fails
      }

      // Delete the group
      const { error: deleteError } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId);

      if (deleteError) {
        throw deleteError;
      }

      // Redirect to groups page
      router.push('/groups');
    } catch (err: any) {
      console.error('Error deleting group:', err);
      alert('Failed to delete group. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            Loading group...
          </p>
        </GlassCard>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="max-w-4xl mx-auto">
        <GlassCard>
          <p className="text-red-500 text-center py-8">
            {error || 'Group not found'}
          </p>
          <div className="flex justify-center mt-4">
            <GlassButton variant="primary" onClick={() => router.push('/groups')}>
              Back to Groups
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
          onClick={() => router.push('/groups')}
          className="text-[var(--glass-secondary)] hover:text-[var(--glass-secondary-dark)] mb-4 flex items-center gap-2"
        >
          <span>←</span> Back to Groups
        </button>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
            {group?.name || 'Group Details'}
          </h1>
          {isEditMode && (
            <button
              type="button"
              onClick={handleDeleteClick}
              className="px-6 py-3 rounded-full font-semibold bg-[#C6282B] text-white hover:bg-[#A01F22] shadow-lg hover:shadow-xl transition-all duration-300 whitespace-nowrap"
            >
              Delete
            </button>
          )}
        </div>
        <p className="text-[var(--glass-gray-medium)]">
          View and edit group information
        </p>
      </div>

      <GlassCard>
        {/* Navigation Banner */}
        <div className="glass-nav-blue rounded-2xl p-4 mb-6">
          <div className="grid grid-cols-6 gap-3">
            <button
              type="button"
              onClick={() => {
                const sectionId = 'group-information';
                if (collapsedSections[sectionId]) {
                  toggleSection(sectionId);
                  // Wait for section to expand before scrolling
                  setTimeout(() => {
                    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                } else {
                  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="px-4 py-2 rounded-lg font-medium text-white bg-white/20 hover:bg-white/30 transition-all duration-200 backdrop-blur-sm border border-white/30 w-full"
            >
              Group Information
            </button>
            <button
              type="button"
              onClick={() => {
                const sectionId = 'plans';
                if (collapsedSections[sectionId]) {
                  toggleSection(sectionId);
                  // Wait for section to expand before scrolling
                  setTimeout(() => {
                    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                } else {
                  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="px-4 py-2 rounded-lg font-medium text-white bg-white/20 hover:bg-white/30 transition-all duration-200 backdrop-blur-sm border border-white/30 w-full"
            >
              Plans
            </button>
            <button
              type="button"
              onClick={() => {
                const sectionId = 'participants';
                if (collapsedSections[sectionId]) {
                  toggleSection(sectionId);
                  // Wait for section to expand before scrolling
                  setTimeout(() => {
                    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                } else {
                  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="px-4 py-2 rounded-lg font-medium text-white bg-white/20 hover:bg-white/30 transition-all duration-200 backdrop-blur-sm border border-white/30 w-full"
            >
              Participants
            </button>
            <button
              type="button"
              onClick={() => {
                const sectionId = 'renewal';
                if (collapsedSections[sectionId]) {
                  toggleSection(sectionId);
                  // Wait for section to expand before scrolling
                  setTimeout(() => {
                    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                } else {
                  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="px-4 py-2 rounded-lg font-medium text-white bg-white/20 hover:bg-white/30 transition-all duration-200 backdrop-blur-sm border border-white/30 w-full"
            >
              Renewal
            </button>
            <button
              type="button"
              onClick={() => {
                const sectionId = 'sales-status';
                if (collapsedSections[sectionId]) {
                  toggleSection(sectionId);
                  // Wait for section to expand before scrolling
                  setTimeout(() => {
                    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                } else {
                  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="px-4 py-2 rounded-lg font-medium text-white bg-white/20 hover:bg-white/30 transition-all duration-200 backdrop-blur-sm border border-white/30 w-full"
            >
              Sales Status
            </button>
            <button
              type="button"
              onClick={() => {
                const sectionId = 'notes';
                if (collapsedSections[sectionId]) {
                  toggleSection(sectionId);
                  // Wait for section to expand before scrolling
                  setTimeout(() => {
                    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                } else {
                  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="px-4 py-2 rounded-lg font-medium text-white bg-white/20 hover:bg-white/30 transition-all duration-200 backdrop-blur-sm border border-white/30 w-full"
            >
              Notes
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Group Information Section */}
          <div id="group-information" className="space-y-6 scroll-mt-4">
            <div className="flex items-center justify-between mb-6 border-b border-black pb-4">
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
                    {isSubmitting ? 'Saving...' : 'Save Group'}
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

            {!collapsedSections['group-information'] && (
              <>
            {/* Row 1: Group Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                Group Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                disabled={!isEditMode}
                className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
              />
            </div>

            {/* Row 2: Programs and Number Of Classes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Programs */}
              <div>
                <label htmlFor="programs" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  Programs
                </label>
              {loadingPrograms ? (
                <p className="text-[var(--glass-gray-medium)] text-sm py-2">Loading programs...</p>
              ) : (
                <div className="relative" ref={programsDropdownRef}>
                  {/* Dropdown Button */}
                  <button
                    type="button"
                    onClick={() => isEditMode && setProgramsDropdownOpen(!programsDropdownOpen)}
                    disabled={!isEditMode}
                    className={`glass-input-enhanced w-full px-4 py-3 rounded-xl text-left flex items-center justify-between ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                  >
                    <span className={selectedPrograms.length === 0 ? 'text-[var(--glass-gray-medium)]' : 'text-[var(--glass-black-dark)]'}>
                      {selectedPrograms.length === 0 
                        ? 'Select programs' 
                        : selectedPrograms.map(programId => {
                            const program = programs.find(p => p.id === programId);
                            return program?.name;
                          }).filter(Boolean).join(', ')
                      }
                    </span>
                    <span className="text-[var(--glass-gray-medium)]">
                      {programsDropdownOpen ? '▲' : '▼'}
                    </span>
                  </button>

                  {/* Dropdown Menu */}
                  {programsDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white/95 backdrop-blur-md border border-white/30 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      {programs.map((program) => {
                        const isSelected = selectedPrograms.includes(program.id);
                        return (
                          <div
                            key={program.id}
                            onClick={() => toggleProgram(program.id)}
                            className={`px-4 py-3 cursor-pointer hover:bg-white/50 transition-colors flex items-center gap-2 ${
                              isSelected ? 'bg-[var(--glass-secondary)]/20' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-4 h-4 text-[var(--glass-secondary)] rounded border-gray-300 focus:ring-[var(--glass-secondary)]"
                            />
                            <span className={isSelected ? 'text-[var(--glass-secondary)] font-semibold' : 'text-[var(--glass-black-dark)]'}>
                              {program.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
              )}
              </div>

              {/* Number Of Classes */}
              <div>
                <label htmlFor="number_of_classes" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  Number Of Classes
                </label>
                <select
                  id="number_of_classes"
                  name="number_of_classes"
                  value={formData.number_of_classes}
                  onChange={handleChange}
                  disabled={!isEditMode}
                  className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
              </div>
            </div>

            {/* Row 3: Eligibility Period Fields - All in one row */}
            <div className={`grid grid-cols-1 gap-6 ${
              formData.number_of_classes === 1 ? 'md:grid-cols-1' :
              formData.number_of_classes === 2 ? 'md:grid-cols-2' :
              'md:grid-cols-3'
            }`}>
              {/* Eligibility Period - Class 1 */}
              <div>
                <label htmlFor="eligibility_period" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  {formData.number_of_classes >= 2 ? 'Eligibility Period - Class 1' : 'Eligibility Period'}
                </label>
                <select
                  id="eligibility_period"
                  name="eligibility_period"
                  value={formData.eligibility_period}
                  onChange={handleChange}
                  disabled={!isEditMode}
                  className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                >
                  <option value="">Select eligibility period</option>
                  <option value="First of Month Following Date of Hire">First of Month Following Date of Hire</option>
                  <option value="First of Month Following 30 Days">First of Month Following 30 Days</option>
                  <option value="First of the Month Following 60 Days">First of the Month Following 60 Days</option>
                </select>
              </div>

              {/* Eligibility Period - Class 2 */}
              {formData.number_of_classes >= 2 && (
                <div>
                  <label htmlFor="eligibility_period_class_2" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                    Eligibility Period - Class 2
                  </label>
                  <select
                    id="eligibility_period_class_2"
                    name="eligibility_period_class_2"
                    value={formData.eligibility_period_class_2}
                    onChange={handleChange}
                    disabled={!isEditMode}
                    className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                  >
                    <option value="">Select eligibility period</option>
                    <option value="First of Month Following Date of Hire">First of Month Following Date of Hire</option>
                    <option value="First of Month Following 30 Days">First of Month Following 30 Days</option>
                    <option value="First of the Month Following 60 Days">First of the Month Following 60 Days</option>
                  </select>
                </div>
              )}

              {/* Eligibility Period - Class 3 */}
              {formData.number_of_classes === 3 && (
                <div>
                  <label htmlFor="eligibility_period_class_3" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                    Eligibility Period - Class 3
                  </label>
                  <select
                    id="eligibility_period_class_3"
                    name="eligibility_period_class_3"
                    value={formData.eligibility_period_class_3}
                    onChange={handleChange}
                    disabled={!isEditMode}
                    className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                  >
                    <option value="">Select eligibility period</option>
                    <option value="First of Month Following Date of Hire">First of Month Following Date of Hire</option>
                    <option value="First of Month Following 30 Days">First of Month Following 30 Days</option>
                    <option value="First of the Month Following 60 Days">First of the Month Following 60 Days</option>
                  </select>
                </div>
              )}
            </div>
              </>
            )}
          </div>

          {/* Plans Section */}
          <div id="plans" className="pt-6 border-t border-white/20 scroll-mt-4">
            <div className="flex items-center justify-between mb-6 border-b border-black pb-4">
              <button
                type="button"
                onClick={() => toggleSection('plans')}
                className="flex items-center gap-2 text-2xl font-bold text-[var(--glass-black-dark)] hover:opacity-80 transition-opacity"
              >
                <span className={`text-lg transform transition-transform ${collapsedSections['plans'] ? 'rotate-180' : ''}`}>
                  ▼
                </span>
                <span>Plans</span>
              </button>
              {!collapsedSections['plans'] && (
                <GlassButton
                  variant="primary"
                  type="button"
                  onClick={() => router.push(`/groups/${groupId}/plans/new`)}
                >
                  + Add Plan
                </GlassButton>
              )}
            </div>

            {!collapsedSections['plans'] && (
            <>
            {loadingPlans ? (
              <p className="text-[var(--glass-gray-medium)] text-center py-4">
                Loading plans...
              </p>
            ) : (
              <>
                {/* Active Plans Subsection */}
                <div className="mb-8">
                  <h3 className="text-xl font-semibold text-[var(--glass-black-dark)] mb-4">
                    Active Plans
                  </h3>
                  {activePlans.length === 0 ? (
                    <p className="text-[var(--glass-gray-medium)] text-center py-4">
                      No active plans
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {activePlans.map((plan) => (
                        <div
                          key={plan.id}
                          className="glass-card rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer"
                          onClick={() => router.push(`/groups/${groupId}/plans/${plan.id}?view=true`)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold text-[var(--glass-black-dark)]">
                                  {plan.plan_name}
                                </h3>
                                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-700">
                                  Active
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-4 text-sm text-[var(--glass-gray-medium)]">
                                {plan.program_name && (
                                  <span>
                                    <span className="font-semibold">Program:</span> {plan.program_name}
                                  </span>
                                )}
                                {plan.provider_name && (
                                  <span>
                                    <span className="font-semibold">Provider:</span> {plan.provider_name}
                                  </span>
                                )}
                                {plan.effective_date && (
                                  <span>
                                    <span className="font-semibold">Effective:</span> {formatDisplayDate(plan.effective_date)}
                                  </span>
                                )}
                                {plan.plan_type && (
                                  <span>
                                    <span className="font-semibold">Type:</span> {plan.plan_type}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
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
                      {terminatedPlans.map((plan) => (
                        <div
                          key={plan.id}
                          className="glass-card rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer opacity-75"
                          onClick={() => router.push(`/groups/${groupId}/plans/${plan.id}?view=true`)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold text-[var(--glass-black-dark)]">
                                  {plan.plan_name}
                                </h3>
                                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-500/20 text-gray-700">
                                  Terminated
                                </span>
                                {plan.termination_date && (
                                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-700">
                                    Terminated: {formatDisplayDate(plan.termination_date)}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-4 text-sm text-[var(--glass-gray-medium)]">
                                {plan.program_name && (
                                  <span>
                                    <span className="font-semibold">Program:</span> {plan.program_name}
                                  </span>
                                )}
                                {plan.provider_name && (
                                  <span>
                                    <span className="font-semibold">Provider:</span> {plan.provider_name}
                                  </span>
                                )}
                                {plan.effective_date && (
                                  <span>
                                    <span className="font-semibold">Effective:</span> {formatDisplayDate(plan.effective_date)}
                                  </span>
                                )}
                                {plan.plan_type && (
                                  <span>
                                    <span className="font-semibold">Type:</span> {plan.plan_type}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            </>
            )}
          </div>

          {/* Participants Section */}
          <div id="participants" className="pt-6 border-t border-white/20 scroll-mt-4">
            <div className="flex items-center justify-between mb-6 border-b border-black pb-4">
              <button
                type="button"
                onClick={() => toggleSection('participants')}
                className="flex items-center gap-2 text-2xl font-bold text-[var(--glass-black-dark)] hover:opacity-80 transition-opacity"
              >
                <span className={`text-lg transform transition-transform ${collapsedSections['participants'] ? 'rotate-180' : ''}`}>
                  ▼
                </span>
                <span>Participants</span>
              </button>
              {!collapsedSections['participants'] && (
                <GlassButton
                  variant="primary"
                  type="button"
                  onClick={() => router.push(`/participants/new?group_id=${groupId}`)}
                >
                  + Add Participant
                </GlassButton>
              )}
            </div>

            {!collapsedSections['participants'] && (
            <>
            {loadingParticipants ? (
              <p className="text-[var(--glass-gray-medium)] text-center py-4">
                Loading participants...
              </p>
            ) : participants.length === 0 ? (
              <p className="text-[var(--glass-gray-medium)] text-center py-4">
                No Participants
              </p>
            ) : (
              <div className="space-y-3">
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="glass-card rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer"
                    onClick={() => router.push(`/participants/${participant.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-[var(--glass-black-dark)] mb-1">
                          {participant.client_name}
                        </h3>
                        <div className="flex flex-wrap gap-4 text-sm text-[var(--glass-gray-medium)]">
                          {participant.email_address && (
                            <span>{participant.email_address}</span>
                          )}
                          {participant.phone_number && (
                            <span>{participant.phone_number}</span>
                          )}
                          {participant.dob && (
                            <span>DOB: {formatDisplayDate(participant.dob)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </>
            )}
          </div>

          {/* Renewal Section */}
          <div id="renewal" className="pt-6 border-t border-white/20 scroll-mt-4">
            <div className="flex items-center justify-between mb-6 border-b border-black pb-4">
              <button
                type="button"
                onClick={() => toggleSection('renewal')}
                className="flex items-center gap-2 text-2xl font-bold text-[var(--glass-black-dark)] hover:opacity-80 transition-opacity"
              >
                <span className={`text-lg transform transition-transform ${collapsedSections['renewal'] ? 'rotate-180' : ''}`}>
                  ▼
                </span>
                <span>Renewal</span>
              </button>
              {!collapsedSections['renewal'] && (
                <GlassButton
                  variant="primary"
                  type="button"
                  onClick={() => setShowAddRenewalForm(true)}
                >
                  + Add Renewal
                </GlassButton>
              )}
            </div>

            {!collapsedSections['renewal'] && (
              <>
                {/* Add Renewal Form */}
                {showAddRenewalForm && (
                  <div className="mb-6 glass-card rounded-xl p-4 bg-blue-500/10 border border-blue-500/20">
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="renewal-date" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                          Renewal Date *
                        </label>
                        <div className="date-input-wrapper">
                          <input
                            type="date"
                            id="renewal-date"
                            value={newRenewal.renewal_date}
                            onChange={(e) => setNewRenewal({ ...newRenewal, renewal_date: e.target.value })}
                            className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                            required
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
                      <div>
                        <label htmlFor="plans-to-renew" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                          Plans To Be Renewed *
                        </label>
                        <div className="relative" ref={renewalPlansDropdownRef}>
                          {/* Dropdown Button */}
                          <button
                            type="button"
                            onClick={() => setRenewalPlansDropdownOpen(!renewalPlansDropdownOpen)}
                            className="glass-input-enhanced w-full px-4 py-3 rounded-xl text-left flex items-center justify-between"
                          >
                            <span className={newRenewal.selected_plan_ids.length === 0 ? 'text-[var(--glass-gray-medium)]' : 'text-[var(--glass-black-dark)]'}>
                              {newRenewal.selected_plan_ids.length === 0 
                                ? 'Select plans to renew' 
                                : `${newRenewal.selected_plan_ids.length} plan(s) selected`
                              }
                            </span>
                            <span className="text-[var(--glass-gray-medium)]">
                              {renewalPlansDropdownOpen ? '▲' : '▼'}
                            </span>
                          </button>

                          {/* Dropdown Menu */}
                          {renewalPlansDropdownOpen && (
                            <div className="absolute z-50 w-full mt-1 bg-white/95 backdrop-blur-md border border-white/30 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                              {plans.length === 0 ? (
                                <div className="px-4 py-3 text-[var(--glass-gray-medium)] text-sm">
                                  No plans available
                                </div>
                              ) : (
                                plans.map((plan) => {
                                  const isSelected = newRenewal.selected_plan_ids.includes(plan.id);
                                  return (
                                    <div
                                      key={plan.id}
                                      onClick={() => toggleRenewalPlan(plan.id)}
                                      className={`px-4 py-3 cursor-pointer hover:bg-white/50 transition-colors flex items-center gap-2 ${
                                        isSelected ? 'bg-[var(--glass-secondary)]/20' : ''
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => {}}
                                        className="w-4 h-4 text-[var(--glass-secondary)] rounded border-gray-300 focus:ring-[var(--glass-secondary)]"
                                      />
                                      <div className="flex-1">
                                        <span className={isSelected ? 'text-[var(--glass-secondary)] font-semibold' : 'text-[var(--glass-black-dark)]'}>
                                          {plan.plan_name}
                                        </span>
                                        <div className="text-xs text-[var(--glass-gray-medium)] mt-1">
                                          {plan.program_name && <span>Program: {plan.program_name}</span>}
                                          {plan.provider_name && <span className="ml-2">Provider: {plan.provider_name}</span>}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-[var(--glass-gray-medium)] mt-2 italic">
                          Upon saving the record, All Participants rates will updates
                        </p>
                      </div>
                      <div className="bg-red-500/20 border border-red-500/40 rounded-xl p-3">
                        <p className="text-sm font-semibold text-red-500 text-center">
                          MAKE SURE ALL PLANS, RATES, AND EMPLOYEE ELECTIONS ARE ACCURATE BEFORE SAVE
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleAddRenewal}
                          disabled={isSubmitting}
                          className="px-4 py-3 rounded-full font-semibold bg-green-500 text-white hover:bg-green-600 shadow-lg hover:shadow-xl transition-all duration-300 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSubmitting ? 'Saving...' : 'Save Renewal'}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelAddRenewal}
                          disabled={isSubmitting}
                          className="px-4 py-3 rounded-full font-semibold bg-[#C6282B] text-white hover:bg-[#A01F22] shadow-lg hover:shadow-xl transition-all duration-300 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Renewals List */}
                {loadingRenewals ? (
                  <p className="text-[var(--glass-gray-medium)] text-center py-4">
                    Loading renewals...
                  </p>
                ) : renewals.length === 0 ? (
                  <p className="text-[var(--glass-gray-medium)] text-center py-4">
                    No renewals yet. Click "Add Renewal" to create one.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {renewals.map((renewal) => (
                      <div
                        key={renewal.id}
                        className="glass-card rounded-xl p-4 bg-white/5 border border-white/10"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-lg font-semibold text-[var(--glass-black-dark)]">
                                Renewal Date: {formatDisplayDate(renewal.renewal_date)}
                              </span>
                            </div>
                            {renewal.plans && renewal.plans.length > 0 ? (
                              <div className="mt-3">
                                <p className="text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                                  Plans to be Renewed ({renewal.plans.length}):
                                </p>
                                <div className="space-y-2">
                                  {renewal.plans.map((plan) => (
                                    <div
                                      key={plan.id}
                                      className="glass-card rounded-lg p-3 bg-white/5 border border-white/10"
                                    >
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-semibold text-[var(--glass-black-dark)]">
                                          {plan.plan_name}
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap gap-3 text-xs text-[var(--glass-gray-medium)]">
                                        {plan.program_name && (
                                          <span>Program: {plan.program_name}</span>
                                        )}
                                        {plan.provider_name && (
                                          <span>Provider: {plan.provider_name}</span>
                                        )}
                                        {plan.plan_type && (
                                          <span>Type: {plan.plan_type}</span>
                                        )}
                                        {plan.effective_date && (
                                          <span>Effective: {formatDisplayDate(plan.effective_date)}</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-[var(--glass-gray-medium)] mt-2">
                                No plans associated with this renewal
                              </p>
                            )}
                            <div className="mt-3 text-xs text-[var(--glass-gray-medium)]">
                              Created: {new Date(renewal.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sales Status Section */}
          <div id="sales-status" className="pt-6 border-t border-white/20 scroll-mt-4">
            <div className="flex items-center justify-between mb-6 border-b border-black pb-4">
              <button
                type="button"
                onClick={() => toggleSection('sales-status')}
                className="flex items-center gap-2 text-2xl font-bold text-[var(--glass-black-dark)] hover:opacity-80 transition-opacity"
              >
                <span className={`text-lg transform transition-transform ${collapsedSections['sales-status'] ? 'rotate-180' : ''}`}>
                  ▼
                </span>
                <span>Sales Status</span>
              </button>
            </div>
            
            {!collapsedSections['sales-status'] && (
            <div className="space-y-6">
              {/* Pipeline Status and Initial Contact Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Pipeline Status */}
                <div>
                  <label htmlFor="pipeline_status" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                    Pipeline Status
                  </label>
                  <select
                    id="pipeline_status"
                    name="pipeline_status"
                    value={formData.pipeline_status}
                    onChange={handleChange}
                    disabled={!isEditMode}
                    className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                  >
                    <option value="">Select pipeline status</option>
                    <option value="Meeting Set">Meeting Set</option>
                    <option value="Waiting On Decision">Waiting On Decision</option>
                    <option value="Won">Won</option>
                    <option value="Lost">Lost</option>
                  </select>
                </div>

                {/* Initial Contact Date */}
                <div>
                  <label htmlFor="initial_contact_date" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                    Initial Contact Date
                  </label>
                  <div className="date-input-wrapper">
                    <input
                      type="date"
                      id="initial_contact_date"
                      name="initial_contact_date"
                      value={formData.initial_contact_date}
                      onChange={handleChange}
                      disabled={!isEditMode}
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
              </div>

              {/* Lead Source and From Who */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Lead Source */}
                <div>
                  <label htmlFor="lead_source" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                    Lead Source
                  </label>
                  <select
                    id="lead_source"
                    name="lead_source"
                    value={formData.lead_source}
                    onChange={handleChange}
                    disabled={!isEditMode}
                    className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                  >
                    <option value="">Select lead source</option>
                    <option value="Prospecting">Prospecting</option>
                    <option value="Walk In">Walk In</option>
                    <option value="Referral">Referral</option>
                  </select>
                </div>

                {/* From Who */}
                <div>
                  <label htmlFor="from_who" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                    From Who
                  </label>
                  <input
                    type="text"
                    id="from_who"
                    name="from_who"
                    value={formData.from_who}
                    onChange={handleChange}
                    disabled={!isEditMode}
                    className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                    placeholder="Person who prospected/referred"
                  />
                </div>
              </div>

              {/* Status Change Notes - Only show when pipeline status is being changed */}
              {isPipelineStatusChanging && (
                <div>
                  <label htmlFor="status_change_notes" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                    Status Change Notes
                  </label>
                  <textarea
                    id="status_change_notes"
                    name="status_change_notes"
                    value={formData.status_change_notes}
                    onChange={handleChange}
                    rows={4}
                    disabled={!isEditMode}
                    className={`glass-input-enhanced w-full px-4 py-3 rounded-xl resize-none ${!isEditMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                    placeholder="Add any notes about this status change..."
                  />
                </div>
              )}

              {/* Status History Report */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-[var(--glass-black-dark)] mb-4">
                  Status History Report
                </h3>
                {loadingStatusHistory ? (
                  <p className="text-[var(--glass-gray-medium)] text-center py-4">
                    Loading status history...
                  </p>
                ) : statusHistory.length === 0 ? (
                  <p className="text-[var(--glass-gray-medium)] text-center py-4">
                    No status history available
                  </p>
                ) : (
                  <div className="space-y-3">
                    {statusHistory.map((log) => (
                      <div
                        key={log.id}
                        className="glass-card rounded-xl p-4 bg-white/5 border border-white/10"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-[var(--glass-secondary)] text-white">
                                {log.option}
                              </span>
                              <span className="text-sm text-[var(--glass-gray-medium)]">
                                Date Changed : {new Date(log.date).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            {log.notes && (
                              <p className="text-sm text-[var(--glass-black-dark)] mt-2">
                                {log.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            )}
          </div>

        </form>

        {/* Notes Section */}
        <div id="notes" className="pt-6 border-t border-white/20 mt-6 scroll-mt-4">
          <div className="flex items-center justify-between mb-6 border-b border-black pb-4">
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
            {!collapsedSections['notes'] && (
              <GlassButton
                variant="primary"
                type="button"
                onClick={() => setShowAddNoteForm(true)}
              >
                + Add Note
              </GlassButton>
            )}
          </div>

          {!collapsedSections['notes'] && (
          <>
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
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
          ) : notes.length === 0 ? (
            <p className="text-[var(--glass-gray-medium)] text-center py-4">
              No notes yet. Click "Add Note" to create one.
            </p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="glass-card rounded-xl p-4 bg-white/5 border border-white/10"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-semibold text-[var(--glass-gray-medium)]">
                          {formatDisplayDate(note.date)}
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
      </GlassCard>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeleteDialog(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-4 text-center">
              Delete Group
            </h3>
            <p className="text-[var(--glass-gray-medium)] mb-6 text-center">
              You are deleting a Group. This will delete all the Group information and cannot be undone. Are you sure you want to continue?
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
                onClick={handleDeleteGroup}
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

