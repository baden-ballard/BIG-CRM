'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import * as XLSX from 'xlsx';
import GlassCard from '../../../../../components/GlassCard';
import GlassButton from '../../../../../components/GlassButton';
import { supabase } from '../../../../../lib/supabase';

interface Program {
  id: string;
  name: string;
}

interface Provider {
  id: string;
  name: string;
}

export default function NewPlanPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = (params?.id ?? '') as string;

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
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [loadingGroup, setLoadingGroup] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newOptions, setNewOptions] = useState<Array<{ id: string; option: string; rate: string }>>([]);
  const [showCsvUploadModal, setShowCsvUploadModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvRateStartDate, setCsvRateStartDate] = useState('');
  const [csvRateEndDate, setCsvRateEndDate] = useState('');
  const [isUploadingRates, setIsUploadingRates] = useState(false);

  useEffect(() => {
    fetchGroup();
    fetchPrograms();
    fetchProviders();
  }, [groupId]);

  const fetchGroup = async () => {
    try {
      setLoadingGroup(true);
      if (!groupId) return;

      const { data, error } = await supabase
        .from('groups')
        .select('name')
        .eq('id', groupId)
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setGroupName(data.name);
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
    setNewOptions([...newOptions, { id: newId, option: '', rate: '' }]);
  };

  const handleRemoveOption = (id: string) => {
    const updatedOptions = newOptions.filter(opt => opt.id !== id);
    setNewOptions(updatedOptions);
  };

  const handleOptionChange = (id: string, field: 'option' | 'rate', value: string) => {
    setNewOptions(newOptions.map(opt => 
      opt.id === id ? { ...opt, [field]: value } : opt
    ));
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
      const newOptionsFromFile = csvData
        .filter(row => !existingOptions.has(row.option.toLowerCase()))
        .map(row => ({
          id: `temp-${Date.now()}-${Math.random()}-${row.option}`,
          option: row.option,
          rate: row.rate.toString(),
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
    setIsSubmitting(true);

    try {
      if (!groupId) {
        throw new Error('Group ID is required');
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

      // Prepare data for insertion
      const insertData: any = {
        group_id: groupId,
        plan_name: formData.plan_name,
        program_id: formData.program_id,
        provider_id: formData.provider_id,
        effective_date: formData.effective_date,
        plan_type: formData.plan_type,
      };
      if (formData.termination_date) {
        insertData.termination_date = formData.termination_date;
      }
      if (formData.plan_type) {
        insertData.plan_type = formData.plan_type;
      }
      if (formData.employer_contribution_type) {
        insertData.employer_contribution_type = formData.employer_contribution_type;
      }
      if (formData.employer_contribution_value) {
        insertData.employer_contribution_value = parseFloat(formData.employer_contribution_value);
      }
      if (formData.employer_spouse_contribution_value) {
        insertData.employer_spouse_contribution_value = parseFloat(formData.employer_spouse_contribution_value);
      }
      if (formData.employer_child_contribution_value) {
        insertData.employer_child_contribution_value = parseFloat(formData.employer_child_contribution_value);
      }

      // Insert plan into database
      const { data, error } = await supabase
        .from('group_plans')
        .insert([insertData])
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Save new options if any
      if (newOptions.length > 0 && data) {
        const validOptions = newOptions.filter(opt => opt.option.trim() !== '');
        
        if (validOptions.length > 0) {
          // Insert options
          const optionsToInsert = validOptions.map(opt => ({
            group_plan_id: data.id,
            option: opt.option.trim(),
          }));

          const { data: insertedOptions, error: optionsError } = await supabase
            .from('group_plan_options')
            .insert(optionsToInsert)
            .select();

          if (optionsError) {
            throw optionsError;
          }

          // If plan type is Composite or Age Banded, create rate records
          if ((formData.plan_type === 'Composite' || formData.plan_type === 'Age Banded') && insertedOptions) {
            const effectiveDate = formData.effective_date || new Date().toISOString().split('T')[0];
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

      // Redirect back to group page
      router.push(`/groups/${groupId}`);
    } catch (error: any) {
      console.error('Error creating plan:', error);
      alert(`Failed to create plan: ${error.message || 'Please try again.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <button
          onClick={() => router.push(`/groups/${groupId}`)}
          className="text-[var(--glass-secondary)] hover:text-[var(--glass-secondary-dark)] mb-4 flex items-center gap-2"
        >
          <span>←</span> Back to Group
        </button>
        <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
          Add New Plan
        </h1>
        <p className="text-[var(--glass-gray-medium)]">
          Create a new plan for this group
        </p>
      </div>

      <GlassCard>
        <form onSubmit={handleSubmit} className="space-y-6">
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
                className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
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
                className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                disabled={loadingPrograms}
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
                className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                disabled={loadingProviders}
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
              className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
            >
              <option value="">Select plan type</option>
              <option value="Age Banded">Age Banded</option>
              <option value="Composite">Composite</option>
            </select>
          </div>

          {/* Row 4: Employer Contribution */}
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
                className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
              >
                <option value="">Select contribution type</option>
                <option value="Percentage">Percentage</option>
                <option value="Dollar Amount">Dollar Amount</option>
              </select>
            </div>

            {/* Employer Contribution Fields - Always Visible */}
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
                  className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                  placeholder="Enter employee contribution"
                />
              </div>

              {/* Employer Spouse Contribution Value */}
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
                  className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                  placeholder="Enter spouse contribution"
                />
              </div>

              {/* Employer Child Contribution Value */}
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
                  className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                  placeholder="Enter child contribution"
                />
              </div>
            </div>
          </div>

          {/* Plan Options Section */}
          <div className="pt-6 border-t border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-[var(--glass-black-dark)]">
                Plan Options
              </h2>
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
            </div>

            {/* New Options Form Section */}
            {newOptions.length > 0 && (
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
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(newOption.id)}
                          className="px-4 py-3 rounded-full font-semibold bg-red-500 text-white hover:bg-red-600 shadow-lg hover:shadow-xl transition-all duration-300 whitespace-nowrap self-end"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {newOptions.length === 0 && (
              <p className="text-[var(--glass-gray-medium)] text-center py-4">
                No options configured for this plan. Click "+ Add Option" to add options.
              </p>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-white/20">
            <button
              type="button"
              onClick={() => router.push(`/groups/${groupId}`)}
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
              {isSubmitting ? 'Creating...' : 'Create Plan'}
            </GlassButton>
          </div>
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
    </div>
  );
}

