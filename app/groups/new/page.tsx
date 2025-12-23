'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import GlassCard from '../../../components/GlassCard';
import GlassButton from '../../../components/GlassButton';
import { supabase } from '../../../lib/supabase';

interface Program {
  id: string;
  name: string;
}

export default function NewGroupPage() {
  const router = useRouter();
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
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [programsDropdownOpen, setProgramsDropdownOpen] = useState(false);
  const programsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPrograms();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (programsDropdownRef.current && !programsDropdownRef.current.contains(event.target as Node)) {
        setProgramsDropdownOpen(false);
      }
    };

    if (programsDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [programsDropdownOpen]);

  const toggleProgram = (programId: string) => {
    setSelectedPrograms(prev => {
      if (prev.includes(programId)) {
        return prev.filter(id => id !== programId);
      } else {
        return [...prev, programId];
      }
    });
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: name === 'number_of_classes' ? parseInt(value) : value,
      };
      // Clear status_change_notes if pipeline_status is cleared
      if (name === 'pipeline_status' && !value) {
        updated.status_change_notes = '';
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

      // Prepare data for insertion (only include fields with values)
      const insertData: any = {
        name: formData.name,
      };

      // Add optional fields only if they have values
      if (formData.initial_contact_date) {
        insertData.initial_contact_date = formData.initial_contact_date;
      }
      if (formData.lead_source) {
        insertData.lead_source = formData.lead_source;
      }
      if (formData.from_who) {
        insertData.from_who = formData.from_who;
      }
      // Explicitly set pipeline_status to null if empty, otherwise use the selected value
      if (formData.pipeline_status && formData.pipeline_status.trim() !== '') {
        insertData.pipeline_status = formData.pipeline_status;
      } else {
        insertData.pipeline_status = null;
      }
      if (formData.status_change_notes) {
        insertData.status_change_notes = formData.status_change_notes;
      }
      insertData.number_of_classes = formData.number_of_classes || 1;
      if (formData.eligibility_period) {
        insertData.eligibility_period = formData.eligibility_period;
      }
      if (formData.eligibility_period_class_2) {
        insertData.eligibility_period_class_2 = formData.eligibility_period_class_2;
      }
      if (formData.eligibility_period_class_3) {
        insertData.eligibility_period_class_3 = formData.eligibility_period_class_3;
      }

      // Insert group into database
      const { data, error } = await supabase
        .from('groups')
        .insert([insertData])
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log('Group created successfully:', data);

      // Insert group programs if any selected
      if (data && selectedPrograms.length > 0) {
        const groupProgramsToInsert = selectedPrograms.map(programId => ({
          group_id: data.id,
          program_id: programId,
        }));

        const { error: programsError } = await supabase
          .from('group_programs')
          .insert(groupProgramsToInsert);

        if (programsError) {
          console.error('Error inserting group programs:', programsError);
          // Don't throw - group was created successfully
        }
      }
      
      // Redirect to groups page
      router.push('/groups');
    } catch (error) {
      console.error('Error creating group:', error);
      alert('Failed to create group. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="text-[var(--glass-secondary)] hover:text-[var(--glass-secondary-dark)] mb-4 flex items-center gap-2"
        >
          <span>←</span> Back to Groups
        </button>
        <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
          Add New Group
        </h1>
        <p className="text-[var(--glass-gray-medium)]">
          Create a new group to track in your sales pipeline
        </p>
      </div>

      <GlassCard>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Group Information Section */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-4">
              Group Information
            </h2>

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
                className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                placeholder="Enter group name"
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
                      onClick={() => setProgramsDropdownOpen(!programsDropdownOpen)}
                      className="glass-input-enhanced w-full px-4 py-3 rounded-xl text-left flex items-center justify-between"
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
                  className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
              </div>
            </div>

            {/* Row 4: Eligibility Period Fields - All in one row */}
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
                  className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
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
                    className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
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
                    className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                  >
                    <option value="">Select eligibility period</option>
                    <option value="First of Month Following Date of Hire">First of Month Following Date of Hire</option>
                    <option value="First of Month Following 30 Days">First of Month Following 30 Days</option>
                    <option value="First of the Month Following 60 Days">First of the Month Following 60 Days</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Sales Status Section */}
          <div className="pt-6 border-t border-white/20 space-y-6">
            <h2 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-4">
              Sales Status
            </h2>

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
                  className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
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
                  className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
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
                  className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                  placeholder="Person who prospected/referred"
                />
              </div>
            </div>

            {/* Status Change Notes - Only show when pipeline status is selected */}
            {formData.pipeline_status && (
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
                  className="glass-input-enhanced w-full px-4 py-3 rounded-xl resize-none"
                  placeholder="Add any notes about status changes..."
                />
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-white/20">
            <button
              type="button"
              onClick={() => router.back()}
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
              {isSubmitting ? 'Creating...' : 'Create Group'}
            </GlassButton>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}


