'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
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
}

interface Program {
  id: string;
  name: string;
}

interface Provider {
  id: string;
  name: string;
}

export default function ViewGroupPlanPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const groupId = (params?.id ?? '') as string;
  const planId = (params?.planId ?? '') as string;
  const isViewMode = searchParams?.get('view') === 'true';

  const [plan, setPlan] = useState<GroupPlan | null>(null);
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

  const [programs, setPrograms] = useState<Program[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [groupName, setGroupName] = useState<string>('');
  const [numberOfClasses, setNumberOfClasses] = useState<number>(1);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [loadingGroup, setLoadingGroup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newOptions, setNewOptions] = useState<Array<{ 
    id: string; 
    option: string; 
    rate: string;
    rate_start_date: string;
    employer_contribution_type: string;
    class_1_contribution_amount: string;
    class_2_contribution_amount: string;
    class_3_contribution_amount: string;
  }>>([]);
  const [existingOptions, setExistingOptions] = useState<Array<{
    id: string;
    option: string;
    employer_contribution_type: string | null;
    class_1_contribution_amount: number | null;
    class_2_contribution_amount: number | null;
    class_3_contribution_amount: number | null;
    activeRate: { id: string; rate: number; start_date: string; end_date: string | null } | null;
    rateHistory: Array<{
      id: string;
      rate: number;
      start_date: string;
      end_date: string | null;
      employer_contribution_type: string | null;
      class_1_contribution_amount: number | null;
      class_2_contribution_amount: number | null;
      class_3_contribution_amount: number | null;
      employer_employee_contribution_value: number | null;
      employer_spouse_contribution_value: number | null;
      employer_child_contribution_value: number | null;
    }>;
  }>>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [showCsvUploadModal, setShowCsvUploadModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvRateStartDate, setCsvRateStartDate] = useState('');
  const [csvRateEndDate, setCsvRateEndDate] = useState('');
  const [isUploadingRates, setIsUploadingRates] = useState(false);
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editedOptionName, setEditedOptionName] = useState('');
  const [editedRate, setEditedRate] = useState('');
  const [editedRateStartDate, setEditedRateStartDate] = useState('');
  const [editedEmployerContributionType, setEditedEmployerContributionType] = useState('');
  const [editedClass1ContributionAmount, setEditedClass1ContributionAmount] = useState('');
  const [editedClass2ContributionAmount, setEditedClass2ContributionAmount] = useState('');
  const [editedClass3ContributionAmount, setEditedClass3ContributionAmount] = useState('');
  const [isSavingRate, setIsSavingRate] = useState(false);
  const [showEditRateModal, setShowEditRateModal] = useState(false);
  const [editingRate, setEditingRate] = useState<{
    id: string;
    optionId: string;
    optionName: string;
    rate: number;
    start_date: string;
    end_date: string | null;
    employer_contribution_type: string | null;
    employer_employee_contribution_value: number | null;
    employer_spouse_contribution_value: number | null;
    employer_child_contribution_value: number | null;
    class_1_contribution_amount: number | null;
    class_2_contribution_amount: number | null;
    class_3_contribution_amount: number | null;
  } | null>(null);
  const [editRateFormData, setEditRateFormData] = useState({
    rate: '',
    start_date: '',
    end_date: '',
    employer_contribution_type: '',
    employer_employee_contribution_value: '',
    employer_spouse_contribution_value: '',
    employer_child_contribution_value: '',
    class_1_contribution_amount: '',
    class_2_contribution_amount: '',
    class_3_contribution_amount: '',
  });
  const [isSavingEditRate, setIsSavingEditRate] = useState(false);

  useEffect(() => {
    if (planId && groupId) {
      fetchPlan();
      fetchGroup();
      fetchPrograms();
      fetchProviders();
    } else {
      setError('Plan ID or Group ID is missing');
      setLoading(false);
    }
  }, [planId, groupId]);


  const formatDateForInput = (dateString: string | null) => {
    if (!dateString) return '';
    // If the date string is already in YYYY-MM-DD format, return it directly
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    // Otherwise, parse it carefully to avoid timezone shifts
    const [year, month, day] = dateString.split('T')[0].split('-');
    if (year && month && day) {
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      const localYear = date.getFullYear();
      const localMonth = String(date.getMonth() + 1).padStart(2, '0');
      const localDay = String(date.getDate()).padStart(2, '0');
      return `${localYear}-${localMonth}-${localDay}`;
    }
    return dateString.split('T')[0];
  };

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

      if (planData.group_id) {
        const { data: groupData } = await supabase
          .from('groups')
          .select('id, name')
          .eq('id', planData.group_id)
          .single();
        if (groupData) {
          groupMap.set(groupData.id, groupData.name);
        }
      }

      // Transform plan with names
      const transformedPlan: GroupPlan = {
        ...planData,
        program_name: planData.program_id ? programMap.get(planData.program_id) : undefined,
        provider_name: planData.provider_id ? providerMap.get(planData.provider_id) : undefined,
        group_name: planData.group_id ? groupMap.get(planData.group_id) : undefined,
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
      
      // Fetch plan options after plan is loaded
      await fetchPlanOptions();
    } catch (err: any) {
      console.error('Error fetching plan:', err);
      setError(err.message || 'Failed to load plan');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroup = async () => {
    try {
      setLoadingGroup(true);
      if (!groupId) return;

      const { data, error } = await supabase
        .from('groups')
        .select('name, number_of_classes')
        .eq('id', groupId)
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setGroupName(data.name);
        // Ensure number_of_classes is a number (it might come as string from DB)
        const numClasses = typeof data.number_of_classes === 'number' 
          ? data.number_of_classes 
          : parseInt(data.number_of_classes, 10) || 1;
        setNumberOfClasses(numClasses);
      }
    } catch (error) {
      console.error('Error fetching group:', error);
    } finally {
      setLoadingGroup(false);
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddOption = () => {
    const newId = `temp-${Date.now()}-${Math.random()}`;
    const defaultStartDate = formData.effective_date || new Date().toISOString().split('T')[0];
    setNewOptions([...newOptions, { 
      id: newId, 
      option: '', 
      rate: '',
      rate_start_date: defaultStartDate,
      employer_contribution_type: '',
      class_1_contribution_amount: '',
      class_2_contribution_amount: '',
      class_3_contribution_amount: '',
    }]);
  };

  const handleRemoveOption = (id: string) => {
    const updatedOptions = newOptions.filter(opt => opt.id !== id);
    setNewOptions(updatedOptions);
  };

  const handleOptionChange = (id: string, field: 'option' | 'rate' | 'rate_start_date' | 'employer_contribution_type' | 'class_1_contribution_amount' | 'class_2_contribution_amount' | 'class_3_contribution_amount', value: string) => {
    setNewOptions(newOptions.map(opt => 
      opt.id === id ? { ...opt, [field]: value } : opt
    ));
  };

  const handleStartEditOption = (optionId: string, optionName: string, rate: number, rateStartDate?: string, employerContributionType?: string | null, class1Amount?: number | null, class2Amount?: number | null, class3Amount?: number | null) => {
    setEditingOptionId(optionId);
    setEditedOptionName(optionName);
    setEditedRate(rate.toString());
    setEditedRateStartDate(rateStartDate || formData.effective_date || new Date().toISOString().split('T')[0]);
    setEditedEmployerContributionType(employerContributionType || '');
    setEditedClass1ContributionAmount(class1Amount?.toString() || '');
    setEditedClass2ContributionAmount(class2Amount?.toString() || '');
    setEditedClass3ContributionAmount(class3Amount?.toString() || '');
  };

  const handleCancelEditOption = () => {
    setEditingOptionId(null);
    setEditedOptionName('');
    setEditedRate('');
    setEditedRateStartDate('');
    setEditedEmployerContributionType('');
    setEditedClass1ContributionAmount('');
    setEditedClass2ContributionAmount('');
    setEditedClass3ContributionAmount('');
  };

  const handleEditRate = useCallback((rateRecord: {
    id: string;
    rate: number;
    start_date: string;
    end_date: string | null;
    employer_contribution_type: string | null;
    employer_employee_contribution_value?: number | null;
    employer_spouse_contribution_value?: number | null;
    employer_child_contribution_value?: number | null;
    class_1_contribution_amount?: number | null;
    class_2_contribution_amount?: number | null;
    class_3_contribution_amount?: number | null;
  }, optionId: string, optionName: string) => {
    setEditingRate({
      id: rateRecord.id,
      optionId,
      optionName,
      rate: rateRecord.rate,
      start_date: rateRecord.start_date,
      end_date: rateRecord.end_date,
      employer_contribution_type: rateRecord.employer_contribution_type,
      employer_employee_contribution_value: rateRecord.employer_employee_contribution_value ?? null,
      employer_spouse_contribution_value: rateRecord.employer_spouse_contribution_value ?? null,
      employer_child_contribution_value: rateRecord.employer_child_contribution_value ?? null,
      class_1_contribution_amount: rateRecord.class_1_contribution_amount ?? null,
      class_2_contribution_amount: rateRecord.class_2_contribution_amount ?? null,
      class_3_contribution_amount: rateRecord.class_3_contribution_amount ?? null,
    });
    setEditRateFormData({
      rate: rateRecord.rate.toString(),
      start_date: formatDateForInput(rateRecord.start_date),
      end_date: rateRecord.end_date ? formatDateForInput(rateRecord.end_date) : '',
      employer_contribution_type: rateRecord.employer_contribution_type || '',
      employer_employee_contribution_value: rateRecord.employer_employee_contribution_value?.toString() || '',
      employer_spouse_contribution_value: rateRecord.employer_spouse_contribution_value?.toString() || '',
      employer_child_contribution_value: rateRecord.employer_child_contribution_value?.toString() || '',
      class_1_contribution_amount: rateRecord.class_1_contribution_amount?.toString() || '',
      class_2_contribution_amount: rateRecord.class_2_contribution_amount?.toString() || '',
      class_3_contribution_amount: rateRecord.class_3_contribution_amount?.toString() || '',
    });
    setShowEditRateModal(true);
  }, []);

  const handleSaveEditRate = async () => {
    if (!editingRate) return;

    if (!editRateFormData.rate.trim() || isNaN(parseFloat(editRateFormData.rate))) {
      alert('Valid rate is required');
      return;
    }

    if (!editRateFormData.start_date.trim()) {
      alert('Rate Start Date is required');
      return;
    }

    setIsSavingEditRate(true);
    try {
      const updateData: any = {
        rate: parseFloat(editRateFormData.rate),
        start_date: editRateFormData.start_date,
        end_date: editRateFormData.end_date.trim() || null,
      };

      if (editRateFormData.employer_contribution_type.trim()) {
        updateData.employer_contribution_type = editRateFormData.employer_contribution_type;
      } else {
        updateData.employer_contribution_type = null;
      }

      // Employer contribution values (for Age Banded plans)
      if (editRateFormData.employer_employee_contribution_value.trim()) {
        const value = parseFloat(editRateFormData.employer_employee_contribution_value);
        if (!isNaN(value)) {
          updateData.employer_employee_contribution_value = value;
        }
      } else {
        updateData.employer_employee_contribution_value = null;
      }

      if (editRateFormData.employer_spouse_contribution_value.trim()) {
        const value = parseFloat(editRateFormData.employer_spouse_contribution_value);
        if (!isNaN(value)) {
          updateData.employer_spouse_contribution_value = value;
        }
      } else {
        updateData.employer_spouse_contribution_value = null;
      }

      if (editRateFormData.employer_child_contribution_value.trim()) {
        const value = parseFloat(editRateFormData.employer_child_contribution_value);
        if (!isNaN(value)) {
          updateData.employer_child_contribution_value = value;
        }
      } else {
        updateData.employer_child_contribution_value = null;
      }

      // Class contribution amounts
      if (editRateFormData.class_1_contribution_amount.trim()) {
        const value = parseFloat(editRateFormData.class_1_contribution_amount);
        if (!isNaN(value)) {
          updateData.class_1_contribution_amount = value;
        }
      } else {
        updateData.class_1_contribution_amount = null;
      }

      if (editRateFormData.class_2_contribution_amount.trim()) {
        const value = parseFloat(editRateFormData.class_2_contribution_amount);
        if (!isNaN(value)) {
          updateData.class_2_contribution_amount = value;
        }
      } else {
        updateData.class_2_contribution_amount = null;
      }

      if (editRateFormData.class_3_contribution_amount.trim()) {
        const value = parseFloat(editRateFormData.class_3_contribution_amount);
        if (!isNaN(value)) {
          updateData.class_3_contribution_amount = value;
        }
      } else {
        updateData.class_3_contribution_amount = null;
      }

      const { error } = await supabase
        .from('group_option_rates')
        .update(updateData)
        .eq('id', editingRate.id);

      if (error) {
        throw error;
      }

      // Refresh options to show updated values
      await fetchPlanOptions();
      
      // Close modal
      setShowEditRateModal(false);
      setEditingRate(null);
      setEditRateFormData({
        rate: '',
        start_date: '',
        end_date: '',
        employer_contribution_type: '',
      });
      
      alert('Rate updated successfully!');
    } catch (error: any) {
      console.error('Error updating rate:', error);
      alert(`Failed to update rate: ${error.message || 'Please try again.'}`);
    } finally {
      setIsSavingEditRate(false);
    }
  };

  const handleSaveRate = async (optionId: string) => {
    if (!editedOptionName.trim()) {
      alert('Option name is required');
      return;
    }

    if (!editedRate.trim() || isNaN(parseFloat(editedRate))) {
      alert('Valid rate is required');
      return;
    }

    // Validate Composite plan fields if plan type is Composite
    if (formData.plan_type === 'Composite') {
      if (!editedEmployerContributionType.trim()) {
        alert('Employer Contribution Type is required for Composite plans');
        return;
      }
      if (!editedClass1ContributionAmount.trim() || isNaN(parseFloat(editedClass1ContributionAmount))) {
        alert('Class 1 Contribution Amount is required');
        return;
      }
      if (numberOfClasses >= 2 && (!editedClass2ContributionAmount.trim() || isNaN(parseFloat(editedClass2ContributionAmount)))) {
        alert('Class 2 Contribution Amount is required');
        return;
      }
      if (numberOfClasses >= 3 && (!editedClass3ContributionAmount.trim() || isNaN(parseFloat(editedClass3ContributionAmount)))) {
        alert('Class 3 Contribution Amount is required');
        return;
      }
    }

    setIsSavingRate(true);
    try {
      const option = existingOptions.find(opt => opt.id === optionId);
      if (!option) {
        throw new Error('Option not found');
      }

      // Prepare option update data
      const optionUpdateData: any = {
        option: editedOptionName.trim(),
      };

      // Add Composite plan fields if plan type is Composite
      if (formData.plan_type === 'Composite') {
        if (editedEmployerContributionType.trim()) {
          optionUpdateData.employer_contribution_type = editedEmployerContributionType;
        }
        if (editedClass1ContributionAmount.trim()) {
          const class1Value = parseFloat(editedClass1ContributionAmount);
          if (!isNaN(class1Value)) {
            optionUpdateData.class_1_contribution_amount = class1Value;
          }
        }
        if (numberOfClasses >= 2 && editedClass2ContributionAmount.trim()) {
          const class2Value = parseFloat(editedClass2ContributionAmount);
          if (!isNaN(class2Value)) {
            optionUpdateData.class_2_contribution_amount = class2Value;
          }
        }
        if (numberOfClasses >= 3 && editedClass3ContributionAmount.trim()) {
          const class3Value = parseFloat(editedClass3ContributionAmount);
          if (!isNaN(class3Value)) {
            optionUpdateData.class_3_contribution_amount = class3Value;
          }
        }
      }

      // Update option
      const { error: optionError } = await supabase
        .from('group_plan_options')
        .update(optionUpdateData)
        .eq('id', optionId);

      if (optionError) {
        throw optionError;
      }

      // Insert new rate record (to trigger rate history automation)
      // The database trigger will automatically close the previous rate
      const rateValue = parseFloat(editedRate);
      const startDate = editedRateStartDate || formData.effective_date || new Date().toISOString().split('T')[0];
      
      const { error: rateError } = await supabase
        .from('group_option_rates')
        .insert({
          group_plan_option_id: optionId,
          rate: rateValue,
          start_date: startDate,
          end_date: null,
        });

      if (rateError) {
        throw rateError;
      }

      // Refresh options to show updated values
      await fetchPlanOptions();
      
      // Reset edit state
      handleCancelEditOption();
      
      alert('Option updated successfully!');
    } catch (error: any) {
      console.error('Error saving option:', error);
      alert(`Failed to save option: ${error.message || 'Please try again.'}`);
    } finally {
      setIsSavingRate(false);
    }
  };

  const fetchPlanOptions = async () => {
    if (!planId) return;
    
    try {
      setLoadingOptions(true);
      const { data: options, error } = await supabase
        .from('group_plan_options')
        .select(`
          id,
          group_plan_id,
          option,
          employer_contribution_type,
          class_1_contribution_amount,
          class_2_contribution_amount,
          class_3_contribution_amount
        `)
        .eq('group_plan_id', planId)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      // Fetch all rate history records for each option
      const optionsWithRates = await Promise.all(
        (options || []).map(async (opt) => {
          const { data: rates } = await supabase
            .from('group_option_rates')
            .select(`
              id, 
              rate, 
              start_date, 
              end_date,
              employer_contribution_type,
              class_1_contribution_amount,
              class_2_contribution_amount,
              class_3_contribution_amount,
              employer_employee_contribution_value,
              employer_spouse_contribution_value,
              employer_child_contribution_value
            `)
            .eq('group_plan_option_id', opt.id)
            .order('start_date', { ascending: false });

          // Find active rate (no end_date or end_date in future)
          const today = new Date().toISOString().split('T')[0];
          const activeRate = rates?.find(rate => 
            !rate.end_date || rate.end_date >= today
          ) || rates?.[0] || null;

          const rateHistoryArray = (rates || []).map(rate => ({
              id: rate.id,
              rate: parseFloat(rate.rate) || 0,
              start_date: rate.start_date,
              end_date: rate.end_date,
              employer_contribution_type: rate.employer_contribution_type,
              class_1_contribution_amount: rate.class_1_contribution_amount ? parseFloat(rate.class_1_contribution_amount) : null,
              class_2_contribution_amount: rate.class_2_contribution_amount ? parseFloat(rate.class_2_contribution_amount) : null,
              class_3_contribution_amount: rate.class_3_contribution_amount ? parseFloat(rate.class_3_contribution_amount) : null,
              employer_employee_contribution_value: rate.employer_employee_contribution_value ? parseFloat(rate.employer_employee_contribution_value) : null,
              employer_spouse_contribution_value: rate.employer_spouse_contribution_value ? parseFloat(rate.employer_spouse_contribution_value) : null,
              employer_child_contribution_value: rate.employer_child_contribution_value ? parseFloat(rate.employer_child_contribution_value) : null,
            }));
          
          return {
            ...opt,
            activeRate: activeRate ? {
              id: activeRate.id,
              rate: activeRate.rate,
              start_date: activeRate.start_date,
              end_date: activeRate.end_date
            } : null,
            rateHistory: rateHistoryArray
          };
        })
      );

      setExistingOptions(optionsWithRates);
      console.log('Fetched options with rate history:', optionsWithRates);
    } catch (err: any) {
      console.error('Error fetching plan options:', err);
    } finally {
      setLoadingOptions(false);
    }
  };

  // Helper function to calculate rate status based on dates
  const calculateRateStatus = (startDate: string, endDate: string | null): 'Planned' | 'Current' | 'Ended' => {
    const today = new Date().toISOString().split('T')[0];
    const start = new Date(startDate).toISOString().split('T')[0];
    
    // If start date is in the future, it's Planned
    if (start > today) {
      return 'Planned';
    }
    
    // If end date is null or in the future, it's Current
    if (!endDate || endDate >= today) {
      return 'Current';
    }
    
    // Otherwise it's Ended
    return 'Ended';
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
    if (!csvFile) {
      alert('Please select a file (CSV or Excel)');
      return;
    }

    setIsUploadingRates(true);

    try {
      // Parse file (CSV or Excel)
      const csvData = await parseFile(csvFile);

      if (csvData.length === 0) {
        alert('No valid data found in file');
        setIsUploadingRates(false);
        return;
      }

      // Add parsed options to newOptions state
      // Merge with existing options, avoiding duplicates
      const existingOptions = new Set(newOptions.map(opt => opt.option.toLowerCase()));
      const defaultStartDate = formData.effective_date || new Date().toISOString().split('T')[0];
      const newOptionsFromFile = csvData
        .filter(row => !existingOptions.has(row.option.toLowerCase()))
        .map(row => ({
          id: `temp-${Date.now()}-${Math.random()}-${row.option}`,
          option: row.option,
          rate: row.rate.toString(),
          rate_start_date: defaultStartDate,
          employer_contribution_type: '',
          class_1_contribution_amount: '',
          class_2_contribution_amount: '',
          class_3_contribution_amount: '',
        }));

      if (newOptionsFromFile.length === 0) {
        alert('All options from the file already exist in the form');
        setIsUploadingRates(false);
        return;
      }

      setNewOptions([...newOptions, ...newOptionsFromFile]);

      // Close modal and reset state
      setShowCsvUploadModal(false);
      setCsvFile(null);
      setCsvRateStartDate('');
      setCsvRateEndDate('');
      alert(`Successfully added ${newOptionsFromFile.length} option(s) from file!`);
    } catch (err: any) {
      console.error('Error uploading CSV rates:', err);
      alert(`Failed to upload rates: ${err.message}`);
    } finally {
      setIsUploadingRates(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) return; // Prevent submission in view mode
    setIsSubmitting(true);

    try {
      
      if (!planId) {
        throw new Error('Plan ID is required');
      }

      // Validate required fields
      if (!formData.program_id) {
        throw new Error('Program is required');
      }
      if (!formData.provider_id) {
        throw new Error('Provider is required');
      }
      if (!formData.effective_date) {
        throw new Error('Effective date is required');
      }
      if (!formData.plan_type) {
        throw new Error('Plan type is required');
      }

      // Prepare data for update
      const updateData: any = {
        plan_name: formData.plan_name,
        program_id: formData.program_id,
        provider_id: formData.provider_id,
        effective_date: formData.effective_date,
        plan_type: formData.plan_type,
      };
      if (formData.termination_date) {
        updateData.termination_date = formData.termination_date;
      } else {
        updateData.termination_date = null;
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

      // Update plan in database
      const { data, error: updateError } = await supabase
        .from('group_plans')
        .update(updateData)
        .eq('id', planId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Save new options if any
      if (newOptions.length > 0) {
        // Validate plan options - both option and rate are required
        const invalidOptions = newOptions.filter(opt => {
          const hasOption = opt.option && opt.option.trim() !== '';
          const hasRate = opt.rate && opt.rate.trim() !== '' && !isNaN(parseFloat(opt.rate));
          
          // For Composite plans, also validate contribution fields
          if (formData.plan_type === 'Composite') {
            const hasContributionType = opt.employer_contribution_type && opt.employer_contribution_type.trim() !== '';
            const hasClass1 = opt.class_1_contribution_amount && opt.class_1_contribution_amount.trim() !== '' && !isNaN(parseFloat(opt.class_1_contribution_amount));
            // Only require Class 2 if numberOfClasses >= 2
            const hasClass2 = numberOfClasses < 2 || (opt.class_2_contribution_amount && opt.class_2_contribution_amount.trim() !== '' && !isNaN(parseFloat(opt.class_2_contribution_amount)));
            // Only require Class 3 if numberOfClasses >= 3
            const hasClass3 = numberOfClasses < 3 || (opt.class_3_contribution_amount && opt.class_3_contribution_amount.trim() !== '' && !isNaN(parseFloat(opt.class_3_contribution_amount)));
            
            const isValid = hasOption && hasRate && hasContributionType && hasClass1 && hasClass2 && hasClass3;
            
            if (!isValid) {
              console.log('Invalid Composite option:', {
                option: opt.option,
                hasOption,
                hasRate,
                hasContributionType,
                hasClass1,
                hasClass2,
                hasClass3,
                numberOfClasses,
                class1Value: opt.class_1_contribution_amount,
                class2Value: opt.class_2_contribution_amount,
                class3Value: opt.class_3_contribution_amount
              });
            }
            
            return !isValid;
          }
          
          return !hasOption || !hasRate;
        });

        if (invalidOptions.length > 0) {
          if (formData.plan_type === 'Composite') {
            throw new Error('All plan options must have Plan Option, Rate, Employer Contribution Type, and all shown Class Contribution Amounts filled in');
          } else {
            throw new Error('All plan options must have both Plan Option and Rate filled in');
          }
        }
        
        const validOptions = newOptions.filter(opt => opt.option && opt.option.trim() !== '');
        if (validOptions.length > 0) {
          // Insert options
          const optionsToInsert = validOptions.map(opt => {
            const optionData: any = {
              group_plan_id: planId,
              option: opt.option.trim(),
            };
            
            // Add Composite plan fields if plan type is Composite
            if (formData.plan_type === 'Composite') {
              // Always include these fields if they exist (even if empty, they'll be null)
              if (opt.employer_contribution_type && opt.employer_contribution_type.trim() !== '') {
                optionData.employer_contribution_type = opt.employer_contribution_type;
              }
              if (opt.class_1_contribution_amount && opt.class_1_contribution_amount.trim() !== '') {
                const class1Value = parseFloat(opt.class_1_contribution_amount);
                if (!isNaN(class1Value)) {
                  optionData.class_1_contribution_amount = class1Value;
                }
              }
              if (numberOfClasses >= 2 && opt.class_2_contribution_amount && opt.class_2_contribution_amount.trim() !== '') {
                const class2Value = parseFloat(opt.class_2_contribution_amount);
                if (!isNaN(class2Value)) {
                  optionData.class_2_contribution_amount = class2Value;
                }
              }
              if (numberOfClasses >= 3 && opt.class_3_contribution_amount && opt.class_3_contribution_amount.trim() !== '') {
                const class3Value = parseFloat(opt.class_3_contribution_amount);
                if (!isNaN(class3Value)) {
                  optionData.class_3_contribution_amount = class3Value;
                }
              }
            }
            
            return optionData;
          });

          const { data: insertedOptions, error: optionsError } = await supabase
            .from('group_plan_options')
            .insert(optionsToInsert)
            .select();

          if (optionsError) {
            console.error('Error inserting options:', optionsError);
            throw optionsError;
          }

          // If plan type is Composite or Age Banded, create rate records
          if ((formData.plan_type === 'Composite' || formData.plan_type === 'Age Banded') && insertedOptions) {
            const ratesToInsert = insertedOptions
              .map((insertedOpt, index) => {
                const originalOpt = validOptions[index];
                if (originalOpt.rate && !isNaN(parseFloat(originalOpt.rate))) {
                  const startDate = originalOpt.rate_start_date || formData.effective_date || new Date().toISOString().split('T')[0];
                  return {
                    group_plan_option_id: insertedOpt.id,
                    rate: parseFloat(originalOpt.rate),
                    start_date: startDate,
                    end_date: null,
                  };
                }
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
      }

      // Refresh plan data
      await fetchPlan();
      
      // Refresh plan options to show newly added ones
      await fetchPlanOptions();
      
      // Clear new options
      setNewOptions([]);
      
      alert('Plan updated successfully!');
    } catch (error: any) {
      console.error('Error updating plan:', error);
      alert(`Failed to update plan: ${error.message || 'Please try again.'}`);
    } finally {
      setIsSubmitting(false);
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
          onClick={() => router.push(`/groups/${groupId}`)}
          className="text-[var(--glass-secondary)] hover:text-[var(--glass-secondary-dark)] mb-4 flex items-center gap-2"
        >
          <span>←</span> Back to Group
        </button>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
              {plan.plan_name}
            </h1>
            <p className="text-[var(--glass-gray-medium)]">
              {isViewMode ? 'View group plan details' : 'View and edit group plan details'}
            </p>
          </div>
          {isViewMode ? (
            <GlassButton
              variant="primary"
              onClick={() => router.push(`/groups/${groupId}/plans/${planId}`)}
            >
              Edit Plan
            </GlassButton>
          ) : (
            <button
              type="button"
              onClick={() => router.push(`/groups/${groupId}/plans/${planId}?view=true`)}
              className="px-6 py-3 rounded-full font-semibold bg-red-500 text-white hover:bg-red-600 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <GlassCard>
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* Row: Plan Name and Group Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Plan Name */}
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
                disabled={isViewMode}
                className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${isViewMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                placeholder="Enter plan name"
              />
            </div>

            {/* Group Name */}
            <div>
              <label htmlFor="group_name" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                Group Name
              </label>
              <input
                type="text"
                id="group_name"
                name="group_name"
                value={loadingGroup ? 'Loading...' : groupName}
                disabled
                className="glass-input-enhanced w-full px-4 py-3 rounded-xl opacity-75 cursor-not-allowed"
                placeholder="Group name"
              />
            </div>
          </div>

          {/* Row 1: Program and Provider */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Program */}
            <div>
              <label htmlFor="program_id" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                Program *
              </label>
              <select
                id="program_id"
                name="program_id"
                value={formData.program_id}
                onChange={handleChange}
                required
                disabled={isViewMode || loadingPrograms}
                className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${isViewMode ? 'opacity-75 cursor-not-allowed' : ''}`}
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
            </div>

            {/* Provider */}
            <div>
              <label htmlFor="provider_id" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                Provider *
              </label>
              <select
                id="provider_id"
                name="provider_id"
                value={formData.provider_id}
                onChange={handleChange}
                required
                disabled={isViewMode || loadingProviders}
                className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${isViewMode ? 'opacity-75 cursor-not-allowed' : ''}`}
              >
                <option value="">Select provider</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Effective Date and Termination Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Effective Date */}
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
                  disabled={isViewMode}
                  className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${isViewMode ? 'opacity-75 cursor-not-allowed' : ''}`}
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

            {/* Termination Date */}
            <div>
              <label htmlFor="termination_date" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                Termination Date
              </label>
              <div className="date-input-wrapper">
                <input
                  type="date"
                  id="termination_date"
                  name="termination_date"
                  value={formData.termination_date}
                  onChange={handleChange}
                  disabled={isViewMode}
                  className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${isViewMode ? 'opacity-75 cursor-not-allowed' : ''}`}
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

          {/* Row 3: Plan Type */}
          <div>
            <label htmlFor="plan_type" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
              Plan Type *
            </label>
            <select
              id="plan_type"
              name="plan_type"
              value={formData.plan_type}
              onChange={handleChange}
              required
              disabled={isViewMode}
              className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${isViewMode ? 'opacity-75 cursor-not-allowed' : ''}`}
            >
              <option value="">Select plan type</option>
              <option value="Age Banded">Age Banded</option>
              <option value="Composite">Composite</option>
            </select>
          </div>

          {/* Row 4: Employer Contribution - Only show if plan type is "Age Banded" */}
          {formData.plan_type === 'Age Banded' && (
          <div className="space-y-6">
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
                disabled={isViewMode}
                className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${isViewMode ? 'opacity-75 cursor-not-allowed' : ''}`}
              >
                <option value="">Select contribution type</option>
                <option value="Percentage">Percentage</option>
                <option value="Dollar Amount">Dollar Amount</option>
              </select>
            </div>

            {/* Employer Contribution Fields - Only show if plan type is "Age Banded" */}
            {formData.plan_type === 'Age Banded' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {/* Employer Employee Contribution Value */}
              <div className="flex flex-col">
                <label htmlFor="employer_contribution_value" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2 min-h-[2.5rem]">
                  Employer Employee Contribution Value
                </label>
                <input
                  type="number"
                  id="employer_contribution_value"
                  name="employer_contribution_value"
                  value={formData.employer_contribution_value}
                  onChange={handleChange}
                  step="0.01"
                  disabled={isViewMode}
                  className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${isViewMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                  placeholder="Enter employee contribution"
                />
              </div>

              {/* Employer Spouse Contribution Value - Only show if plan type is "Age Banded" */}
              {formData.plan_type === 'Age Banded' && (
                <div className="flex flex-col">
                <label htmlFor="employer_spouse_contribution_value" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2 min-h-[2.5rem]">
                  Employer Spouse Contribution Value
                </label>
                <input
                  type="number"
                  id="employer_spouse_contribution_value"
                  name="employer_spouse_contribution_value"
                    value={formData.employer_spouse_contribution_value}
                    onChange={handleChange}
                    step="0.01"
                    disabled={isViewMode}
                    className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${isViewMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                  placeholder="Enter spouse contribution"
                />
              </div>
              )}

              {/* Employer Child Contribution Value - Only show if plan type is "Age Banded" */}
              {formData.plan_type === 'Age Banded' && (
                <div className="flex flex-col">
                <label htmlFor="employer_child_contribution_value" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2 min-h-[2.5rem]">
                  Employer Child Contribution Value
                </label>
                <input
                  type="number"
                  id="employer_child_contribution_value"
                  name="employer_child_contribution_value"
                    value={formData.employer_child_contribution_value}
                    onChange={handleChange}
                    step="0.01"
                    disabled={isViewMode}
                    className={`glass-input-enhanced w-full px-4 py-3 rounded-xl ${isViewMode ? 'opacity-75 cursor-not-allowed' : ''}`}
                  placeholder="Enter child contribution"
                />
              </div>
              )}
            </div>
            )}
          </div>
          )}

          {/* Plan Options Section */}
          <div className="pt-6 border-t border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-[var(--glass-black-dark)]">
                Plan Options
              </h2>
              {!isViewMode && (
                <div className="flex items-center gap-3">
                  <GlassButton
                    variant="primary"
                    type="button"
                    onClick={() => {
                      // Set default start date when opening modal
                      const defaultDate = formData.effective_date || new Date().toISOString().split('T')[0];
                      setCsvRateStartDate(defaultDate);
                      setShowCsvUploadModal(true);
                    }}
                  >
                    Add Rates
                  </GlassButton>
                  <GlassButton
                    variant="primary"
                    type="button"
                    onClick={handleAddOption}
                  >
                    {newOptions.length === 0 
                      ? '+ Add Option' 
                      : '+ Add Another Option'}
                  </GlassButton>
                </div>
              )}
            </div>

            {/* New Options Form Section */}
            {!isViewMode && newOptions.length > 0 && (
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
                            Plan Option
                          </label>
                          <input
                            type="text"
                            value={newOption.option}
                            onChange={(e) => handleOptionChange(newOption.id, 'option', e.target.value)}
                            className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                            placeholder="Enter plan option"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                            Rate
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
                        <div className="flex-1">
                          <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                            Rate Start Date
                          </label>
                          <input
                            type="date"
                            value={newOption.rate_start_date}
                            onChange={(e) => handleOptionChange(newOption.id, 'rate_start_date', e.target.value)}
                            className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(newOption.id)}
                          className="px-4 py-3 rounded-full font-semibold bg-red-500 text-white hover:bg-red-600 shadow-lg hover:shadow-xl transition-all duration-300 whitespace-nowrap self-end"
                        >
                          Remove
                        </button>
                      </div>

                      {/* Composite Plan Fields - Show when plan type is Composite */}
                      {formData.plan_type === 'Composite' && (
                        <div className="pt-4 border-t border-white/20 space-y-4">
                          {/* Employer Contribution Type */}
                          <div>
                            <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                              Employer Contribution Type *
                            </label>
                            <select
                              value={newOption.employer_contribution_type}
                              onChange={(e) => handleOptionChange(newOption.id, 'employer_contribution_type', e.target.value)}
                              className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                              required
                            >
                              <option value="">Select contribution type</option>
                              <option value="Dollar">Dollar</option>
                              <option value="Percentage">Percentage</option>
                            </select>
                          </div>

                          {/* Class Contribution Amounts - Dynamic based on number of classes */}
                          {numberOfClasses > 0 && (
                            <div className={`grid grid-cols-1 gap-4 ${
                              numberOfClasses === 1 ? 'md:grid-cols-1' : 
                              numberOfClasses === 2 ? 'md:grid-cols-2' : 
                              'md:grid-cols-3'
                            }`}>
                              {/* Always show Class 1 if at least 1 class */}
                              <div>
                                <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                                  Class 1 Contribution Amount *
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={newOption.class_1_contribution_amount}
                                  onChange={(e) => handleOptionChange(newOption.id, 'class_1_contribution_amount', e.target.value)}
                                  className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                                  placeholder="Enter amount"
                                  required
                                />
                              </div>
                              
                              {/* Show Class 2 if 2 or more classes */}
                              {numberOfClasses >= 2 && (
                                <div>
                                  <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                                    Class 2 Contribution Amount *
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={newOption.class_2_contribution_amount}
                                    onChange={(e) => handleOptionChange(newOption.id, 'class_2_contribution_amount', e.target.value)}
                                    className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                                    placeholder="Enter amount"
                                    required
                                  />
                                </div>
                              )}
                              
                              {/* Show Class 3 if 3 classes */}
                              {numberOfClasses >= 3 && (
                                <div>
                                  <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                                    Class 3 Contribution Amount *
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={newOption.class_3_contribution_amount}
                                    onChange={(e) => handleOptionChange(newOption.id, 'class_3_contribution_amount', e.target.value)}
                                    className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                                    placeholder="Enter amount"
                                    required
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Display existing options */}
            {existingOptions.length > 0 && (
              <div className="mb-6 space-y-4">
                <h3 className="text-lg font-semibold text-[var(--glass-black-dark)] mb-4">
                  Existing Plan Options ({existingOptions.length})
                </h3>
                {existingOptions.map((opt) => (
                  <div
                    key={opt.id}
                    className="glass-card rounded-xl p-4 bg-green-500/10 border border-green-500/20"
                  >
                    {editingOptionId === opt.id ? (
                      // Edit mode
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                              Plan Option
                            </label>
                            <input
                              type="text"
                              value={editedOptionName}
                              onChange={(e) => setEditedOptionName(e.target.value)}
                              className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                              placeholder="Enter plan option"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                              Rate
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={editedRate}
                              onChange={(e) => setEditedRate(e.target.value)}
                              className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                              placeholder="Enter rate"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                              Rate Start Date
                            </label>
                            <input
                              type="date"
                              value={editedRateStartDate}
                              onChange={(e) => setEditedRateStartDate(e.target.value)}
                              className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleCancelEditOption}
                            disabled={isSavingRate}
                            className="px-4 py-3 rounded-full font-semibold bg-gray-500 text-white hover:bg-gray-600 shadow-lg hover:shadow-xl transition-all duration-300 whitespace-nowrap self-end disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveRate(opt.id)}
                            disabled={isSavingRate}
                            className="px-4 py-3 rounded-full font-semibold bg-[var(--glass-secondary)] text-white hover:bg-[var(--glass-secondary-dark)] shadow-lg hover:shadow-xl transition-all duration-300 whitespace-nowrap self-end disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSavingRate ? 'Saving...' : 'Save Rate'}
                          </button>
                        </div>

                        {/* Composite Plan Fields - Show when plan type is Composite */}
                        {formData.plan_type === 'Composite' && (
                          <div className="pt-4 border-t border-white/20 space-y-4">
                            {/* Employer Contribution Type */}
                            <div>
                              <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                                Employer Contribution Type *
                              </label>
                              <select
                                value={editedEmployerContributionType}
                                onChange={(e) => setEditedEmployerContributionType(e.target.value)}
                                className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                                required
                              >
                                <option value="">Select contribution type</option>
                                <option value="Dollar">Dollar</option>
                                <option value="Percentage">Percentage</option>
                              </select>
                            </div>

                            {/* Class Contribution Amounts - Dynamic based on number of classes */}
                            {numberOfClasses > 0 && (
                              <div className={`grid grid-cols-1 gap-4 ${
                                numberOfClasses === 1 ? 'md:grid-cols-1' : 
                                numberOfClasses === 2 ? 'md:grid-cols-2' : 
                                'md:grid-cols-3'
                              }`}>
                                {/* Always show Class 1 if at least 1 class */}
                                <div>
                                  <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                                    Class 1 Contribution Amount *
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editedClass1ContributionAmount}
                                    onChange={(e) => setEditedClass1ContributionAmount(e.target.value)}
                                    className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                                    placeholder="Enter amount"
                                    required
                                  />
                                </div>
                                
                                {/* Show Class 2 if 2 or more classes */}
                                {numberOfClasses >= 2 && (
                                  <div>
                                    <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                                      Class 2 Contribution Amount *
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={editedClass2ContributionAmount}
                                      onChange={(e) => setEditedClass2ContributionAmount(e.target.value)}
                                      className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                                      placeholder="Enter amount"
                                      required
                                    />
                                  </div>
                                )}
                                
                                {/* Show Class 3 if 3 classes */}
                                {numberOfClasses >= 3 && (
                                  <div>
                                    <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                                      Class 3 Contribution Amount *
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={editedClass3ContributionAmount}
                                      onChange={(e) => setEditedClass3ContributionAmount(e.target.value)}
                                      className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                                      placeholder="Enter amount"
                                      required
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      // View mode
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-[var(--glass-black-dark)]">{opt.option}</p>
                          {!isViewMode && (
                            <button
                              type="button"
                              onClick={() => handleStartEditOption(
                                opt.id, 
                                opt.option, 
                                opt.activeRate?.rate || 0, 
                                opt.activeRate?.start_date,
                                opt.employer_contribution_type,
                                opt.class_1_contribution_amount,
                                opt.class_2_contribution_amount,
                                opt.class_3_contribution_amount
                              )}
                              className="px-4 py-2 rounded-full font-semibold bg-[var(--glass-secondary)] text-white hover:bg-[var(--glass-secondary-dark)] shadow-lg hover:shadow-xl transition-all duration-300 whitespace-nowrap ml-4"
                            >
                              Edit Option
                            </button>
                          )}
                        </div>
                        
                        {/* Rate Section - Current Rate */}
                        <div className="pt-4 border-t border-white/20">
                          <h4 className="text-sm font-semibold text-[var(--glass-black-dark)] mb-3">
                            Rate
                          </h4>
                          {(() => {
                            const currentRates = opt.rateHistory?.filter(rateRecord => {
                              const status = calculateRateStatus(rateRecord.start_date, rateRecord.end_date);
                              return status === 'Current';
                            }) || [];
                            
                            if (currentRates.length > 0) {
                              // Sort by start_date descending to get the most recent current rate first
                              const sortedCurrentRates = [...currentRates].sort((a, b) => 
                                new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
                              );
                              const currentRate = sortedCurrentRates[0];
                              
                              return (
                                <div 
                                  className="glass-card rounded-lg p-3 border bg-green-500/10 border-green-500/20 cursor-pointer hover:bg-green-500/20 transition-all"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleEditRate(currentRate, opt.id, opt.option);
                                  }}
                                  onKeyDown={(e) => {
                                    if (!isViewMode && (e.key === 'Enter' || e.key === ' ')) {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleEditRate(currentRate, opt.id, opt.option);
                                    }
                                  }}
                                  role={!isViewMode ? "button" : undefined}
                                  tabIndex={!isViewMode ? 0 : undefined}
                                  title={!isViewMode ? "Click to edit rate" : ""}
                                >
                                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
                                    <div>
                                      <span className="font-semibold">Status: </span>
                                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-700">
                                        Current
                                      </span>
                                    </div>
                                    <div>
                                      <span className="font-semibold">Rate Date Start: </span>
                                      <span>{new Date(currentRate.start_date).toLocaleDateString()}</span>
                                    </div>
                                    <div>
                                      <span className="font-semibold">Rate End Date: </span>
                                      <span>{currentRate.end_date ? new Date(currentRate.end_date).toLocaleDateString() : 'N/A'}</span>
                                    </div>
                                    <div>
                                      <span className="font-semibold">Contribution Type: </span>
                                      <span>{currentRate.employer_contribution_type || 'N/A'}</span>
                                    </div>
                                  </div>
                                  <div className="mt-2 text-xs text-[var(--glass-gray-medium)]">
                                    <span className="font-semibold">Rate: </span>
                                    <span>${currentRate.rate.toFixed(2)}</span>
                                    {currentRate.class_1_contribution_amount !== null && (
                                      <span className="ml-4">
                                        <span className="font-semibold">Class 1: </span>
                                        <span>${currentRate.class_1_contribution_amount.toFixed(2)}</span>
                                      </span>
                                    )}
                                    {currentRate.class_2_contribution_amount !== null && (
                                      <span className="ml-4">
                                        <span className="font-semibold">Class 2: </span>
                                        <span>${currentRate.class_2_contribution_amount.toFixed(2)}</span>
                                      </span>
                                    )}
                                    {currentRate.class_3_contribution_amount !== null && (
                                      <span className="ml-4">
                                        <span className="font-semibold">Class 3: </span>
                                        <span>${currentRate.class_3_contribution_amount.toFixed(2)}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <p className="text-sm text-[var(--glass-gray-medium)]">No current rate found.</p>
                              );
                            }
                          })()}
                        </div>

                        {/* Rate History Section - Planned and Ended Rates */}
                        <div className="pt-4 border-t border-white/20">
                          <h4 className="text-sm font-semibold text-[var(--glass-black-dark)] mb-3">
                            Rate History
                          </h4>
                          {(() => {
                            const historyRates = opt.rateHistory?.filter(rateRecord => {
                              const status = calculateRateStatus(rateRecord.start_date, rateRecord.end_date);
                              return status === 'Planned' || status === 'Ended';
                            }) || [];
                            
                            // Sort by start_date ascending (oldest first)
                            const sortedHistoryRates = [...historyRates].sort((a, b) => 
                              new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
                            );
                            
                            if (sortedHistoryRates.length > 0) {
                              return (
                                <div className="space-y-3">
                                  {sortedHistoryRates.map((rateRecord) => {
                                    const status = calculateRateStatus(rateRecord.start_date, rateRecord.end_date);
                                    const statusColors: Record<'Planned' | 'Current' | 'Ended', string> = {
                                      Planned: 'bg-blue-500/10 border-blue-500/20 text-blue-700',
                                      Current: 'bg-green-500/10 border-green-500/20 text-green-700',
                                      Ended: 'bg-gray-500/10 border-gray-500/20 text-gray-700'
                                    };
                                    
                                    return (
                                      <div
                                        key={rateRecord.id}
                                        className={`glass-card rounded-lg p-3 border ${statusColors[status]} cursor-pointer hover:opacity-80 transition-all`}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleEditRate(rateRecord, opt.id, opt.option);
                                        }}
                                        onKeyDown={(e) => {
                                          if (!isViewMode && (e.key === 'Enter' || e.key === ' ')) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleEditRate(rateRecord, opt.id, opt.option);
                                          }
                                        }}
                                        role={!isViewMode ? "button" : undefined}
                                        tabIndex={!isViewMode ? 0 : undefined}
                                        title={!isViewMode ? "Click to edit rate" : ""}
                                      >
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
                                          <div>
                                            <span className="font-semibold">Status: </span>
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                              status === 'Planned' ? 'bg-blue-500/20 text-blue-700' :
                                              'bg-gray-500/20 text-gray-700'
                                            }`}>
                                              {status}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="font-semibold">Rate Date Start: </span>
                                            <span>{new Date(rateRecord.start_date).toLocaleDateString()}</span>
                                          </div>
                                          <div>
                                            <span className="font-semibold">Rate End Date: </span>
                                            <span>{rateRecord.end_date ? new Date(rateRecord.end_date).toLocaleDateString() : 'N/A'}</span>
                                          </div>
                                          <div>
                                            <span className="font-semibold">Contribution Type: </span>
                                            <span>{rateRecord.employer_contribution_type || 'N/A'}</span>
                                          </div>
                                        </div>
                                        <div className="mt-2 text-xs text-[var(--glass-gray-medium)]">
                                          <span className="font-semibold">Rate: </span>
                                          <span>${rateRecord.rate.toFixed(2)}</span>
                                          {rateRecord.class_1_contribution_amount !== null && (
                                            <span className="ml-4">
                                              <span className="font-semibold">Class 1: </span>
                                              <span>${rateRecord.class_1_contribution_amount.toFixed(2)}</span>
                                            </span>
                                          )}
                                          {rateRecord.class_2_contribution_amount !== null && (
                                            <span className="ml-4">
                                              <span className="font-semibold">Class 2: </span>
                                              <span>${rateRecord.class_2_contribution_amount.toFixed(2)}</span>
                                            </span>
                                          )}
                                          {rateRecord.class_3_contribution_amount !== null && (
                                            <span className="ml-4">
                                              <span className="font-semibold">Class 3: </span>
                                              <span>${rateRecord.class_3_contribution_amount.toFixed(2)}</span>
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            } else {
                              return (
                                <p className="text-sm text-[var(--glass-gray-medium)]">No rate history records found.</p>
                              );
                            }
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {newOptions.length === 0 && existingOptions.length === 0 && !loadingOptions && (
              <p className="text-[var(--glass-gray-medium)] text-center py-4">
                No options configured for this plan. Click "+ Add Option" to add options.
              </p>
            )}

            {loadingOptions && (
              <p className="text-[var(--glass-gray-medium)] text-center py-4">
                Loading options...
              </p>
            )}
          </div>

          {/* Form Actions */}
          {!isViewMode && (
            <div className="flex items-center justify-end gap-4 pt-4 border-t border-white/20">
              <GlassButton
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className={isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
              >
                {isSubmitting ? 'Saving...' : 'Save Plan'}
              </GlassButton>
            </div>
          )}
        </form>
      </GlassCard>

      {/* CSV Upload Rates Modal */}
      {showCsvUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => !isUploadingRates && setShowCsvUploadModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-4 text-center">
              Upload Rates from File
            </h3>
            <p className="text-[var(--glass-gray-medium)] mb-6 text-sm text-center">
              Upload a CSV or Excel file (.xlsx, .xls) with Options and Rates. 
              The options and rates will be added to the form.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  File (CSV or Excel) *
                </label>
                <p className="text-xs text-[var(--glass-gray-medium)] mb-2">
                  Format: Option, Rate (or Price)
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
                )}
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
                disabled={isUploadingRates || !csvFile}
                className="px-6 py-3 rounded-full font-semibold bg-[var(--glass-secondary)] text-white hover:bg-[var(--glass-secondary-dark)] shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploadingRates ? 'Uploading...' : 'Upload Rates'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Rate Modal */}
      {showEditRateModal && editingRate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => {
          if (!isSavingEditRate) {
            setShowEditRateModal(false);
            setEditingRate(null);
            setEditRateFormData({
              rate: '',
              start_date: '',
              end_date: '',
              employer_contribution_type: '',
              employer_employee_contribution_value: '',
              employer_spouse_contribution_value: '',
              employer_child_contribution_value: '',
              class_1_contribution_amount: '',
              class_2_contribution_amount: '',
              class_3_contribution_amount: '',
            });
          }
        }}>
          <div 
            className="max-w-2xl w-full mx-4 shadow-2xl rounded-3xl p-8 bg-white/95 backdrop-blur-xl border border-white/40"
            style={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(24px) saturate(200%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-4">
              Edit Rate History
            </h3>
            
            <div className="space-y-4">
              {/* Option and Rate - Side by Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option Name (read-only) */}
                <div>
                  <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                    Option
                  </label>
                  <input
                    type="text"
                    value={editingRate.optionName}
                    disabled
                    className="glass-input-enhanced w-full px-4 py-3 rounded-xl opacity-75 cursor-not-allowed"
                  />
                </div>

                {/* Rate */}
                <div>
                  <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                    Rate *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editRateFormData.rate}
                    onChange={(e) => setEditRateFormData({ ...editRateFormData, rate: e.target.value })}
                    disabled={isSavingEditRate}
                    className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                    placeholder="Enter rate"
                    required
                  />
                </div>
              </div>

              {/* Rate Start Date and Rate End Date - Side by Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Rate Start Date */}
                <div>
                  <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                    Rate Start Date *
                  </label>
                  <div className="date-input-wrapper">
                    <input
                      type="date"
                      value={editRateFormData.start_date}
                      onChange={(e) => setEditRateFormData({ ...editRateFormData, start_date: e.target.value })}
                      disabled={isSavingEditRate}
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

                {/* Rate End Date */}
                <div>
                  <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                    Rate End Date
                  </label>
                  <div className="date-input-wrapper">
                    <input
                      type="date"
                      value={editRateFormData.end_date}
                      onChange={(e) => setEditRateFormData({ ...editRateFormData, end_date: e.target.value })}
                      disabled={isSavingEditRate}
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
                </div>
              </div>

              {/* Contribution Type */}
              <div>
                <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  Contribution Type
                </label>
                <select
                  value={editRateFormData.employer_contribution_type}
                  onChange={(e) => setEditRateFormData({ ...editRateFormData, employer_contribution_type: e.target.value })}
                  disabled={isSavingEditRate}
                  className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                >
                  <option value="">Select contribution type</option>
                  <option value="Dollar">Dollar</option>
                  <option value="Percentage">Percentage</option>
                </select>
              </div>

              {/* Employer Contribution Values - Only show if plan type is "Age Banded" */}
              {formData.plan_type === 'Age Banded' && (
                <div className="pt-4 border-t border-white/20">
                  <h4 className="text-sm font-semibold text-[var(--glass-black-dark)] mb-3">
                    Employer Contribution Values
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Employer Employee Contribution Value */}
                    <div>
                      <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                        Employer Employee Contribution Value
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editRateFormData.employer_employee_contribution_value}
                        onChange={(e) => setEditRateFormData({ ...editRateFormData, employer_employee_contribution_value: e.target.value })}
                        disabled={isSavingEditRate}
                        className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                        placeholder="Enter amount"
                      />
                    </div>

                    {/* Employer Spouse Contribution Value */}
                    <div>
                      <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                        Employer Spouse Contribution Value
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editRateFormData.employer_spouse_contribution_value}
                        onChange={(e) => setEditRateFormData({ ...editRateFormData, employer_spouse_contribution_value: e.target.value })}
                        disabled={isSavingEditRate}
                        className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                        placeholder="Enter amount"
                      />
                    </div>

                    {/* Employer Child Contribution Value */}
                    <div>
                      <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                        Employer Child Contribution Value
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editRateFormData.employer_child_contribution_value}
                        onChange={(e) => setEditRateFormData({ ...editRateFormData, employer_child_contribution_value: e.target.value })}
                        disabled={isSavingEditRate}
                        className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                        placeholder="Enter amount"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Class Contribution Amounts - Show based on number_of_classes */}
              {numberOfClasses > 0 && (
                <div className="pt-4 border-t border-white/20">
                  <h4 className="text-sm font-semibold text-[var(--glass-black-dark)] mb-3">
                    Class Contribution Amounts
                  </h4>
                  <div className={`grid grid-cols-1 gap-4 ${
                    numberOfClasses === 1 ? 'md:grid-cols-1' : 
                    numberOfClasses === 2 ? 'md:grid-cols-2' : 
                    'md:grid-cols-3'
                  }`}>
                    {/* Class 1 Contribution Amount */}
                    <div>
                      <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                        Class 1 Contribution Amount
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editRateFormData.class_1_contribution_amount}
                        onChange={(e) => setEditRateFormData({ ...editRateFormData, class_1_contribution_amount: e.target.value })}
                        disabled={isSavingEditRate}
                        className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                        placeholder="Enter amount"
                      />
                    </div>
                    
                    {/* Class 2 Contribution Amount - Show if 2 or more classes */}
                    {numberOfClasses >= 2 && (
                      <div>
                        <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                          Class 2 Contribution Amount
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editRateFormData.class_2_contribution_amount}
                          onChange={(e) => setEditRateFormData({ ...editRateFormData, class_2_contribution_amount: e.target.value })}
                          disabled={isSavingEditRate}
                          className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                          placeholder="Enter amount"
                        />
                      </div>
                    )}
                    
                    {/* Class 3 Contribution Amount - Show if 3 classes */}
                    {numberOfClasses >= 3 && (
                      <div>
                        <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                          Class 3 Contribution Amount
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editRateFormData.class_3_contribution_amount}
                          onChange={(e) => setEditRateFormData({ ...editRateFormData, class_3_contribution_amount: e.target.value })}
                          disabled={isSavingEditRate}
                          className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                          placeholder="Enter amount"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4 justify-end mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowEditRateModal(false);
                  setEditingRate(null);
                  setEditRateFormData({
                    rate: '',
                    start_date: '',
                    end_date: '',
                    employer_contribution_type: '',
                  });
                }}
                disabled={isSavingEditRate}
                className="px-6 py-3 rounded-full font-semibold bg-gray-500 text-white hover:bg-gray-600 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditRate}
                disabled={isSavingEditRate}
                className="px-6 py-3 rounded-full font-semibold bg-[var(--glass-secondary)] text-white hover:bg-[var(--glass-secondary-dark)] shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingEditRate ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
