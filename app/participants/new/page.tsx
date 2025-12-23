'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import GlassCard from '../../../components/GlassCard';
import GlassButton from '../../../components/GlassButton';
import { supabase } from '../../../lib/supabase';

function NewParticipantPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const groupId = searchParams.get('group_id');

  const [formData, setFormData] = useState({
    client_name: '',
    dob: '',
    address: '',
    phone_number: '',
    email_address: '',
    group_id: groupId || '',
    class_number: '',
    hire_date: '',
    termination_date: '',
  });

  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dependents, setDependents] = useState<Array<{ name: string; relationship: string; dob: string }>>([]);
  const [showDependentForm, setShowDependentForm] = useState(false);
  const [dependentForm, setDependentForm] = useState({
    name: '',
    relationship: '',
    dob: '',
  });

  useEffect(() => {
    if (!groupId) {
      fetchGroups();
    } else {
      // If groupId is provided, fetch group details
      fetchGroupDetails(groupId);
    }
  }, [groupId]);

  useEffect(() => {
    // When group_id changes, fetch group details
    if (formData.group_id) {
      fetchGroupDetails(formData.group_id);
    } else {
      setSelectedGroup(null);
    }
  }, [formData.group_id]);

  const fetchGroups = async () => {
    try {
      setLoadingGroups(true);
      const { data, error } = await supabase
        .from('groups')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      setGroups(data || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleDependentChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setDependentForm(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddDependent = () => {
    if (dependentForm.name && dependentForm.relationship) {
      setDependents(prev => [...prev, { ...dependentForm }]);
      setDependentForm({ name: '', relationship: '', dob: '' });
      setShowDependentForm(false);
    }
  };

  const handleRemoveDependent = (index: number) => {
    setDependents(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
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

      // Hire Date is only required when coming from a group page
      if (groupId && (!formData.hire_date || formData.hire_date.trim() === '')) {
        alert('Please enter a hire date. Hire Date is required.');
        setIsSubmitting(false);
        return;
      }

      // Validate phone number and email address when not coming from a group page
      if (!groupId) {
        if (!formData.phone_number || formData.phone_number.trim() === '') {
          alert('Please enter a phone number. Phone Number is required.');
          setIsSubmitting(false);
          return;
        }

        if (!formData.email_address || formData.email_address.trim() === '') {
          alert('Please enter an email address. Email Address is required.');
          setIsSubmitting(false);
          return;
        }
      }

      // Validate class selection if group has multiple classes
      if (formData.group_id && selectedGroup && selectedGroup.number_of_classes && selectedGroup.number_of_classes > 1) {
        if (!formData.class_number || formData.class_number.trim() === '') {
          alert('Please select a class. Class is required when the group has multiple classes.');
          setIsSubmitting(false);
          return;
        }
      }

      // Prepare data for insertion
      const insertData: any = {
        client_name: formData.client_name,
      };

      // Add optional fields only if they have values
      if (formData.dob) {
        insertData.dob = formData.dob;
      }
      if (formData.address) {
        insertData.address = formData.address;
      }
      // Phone number and email are required when not coming from a group, optional otherwise
      if (formData.phone_number) {
        insertData.phone_number = formData.phone_number;
      }
      if (formData.email_address) {
        insertData.email_address = formData.email_address;
      }
      if (formData.group_id) {
        insertData.group_id = formData.group_id;
      }
      if (formData.class_number) {
        insertData.class_number = parseInt(formData.class_number);
      }
      if (formData.hire_date) {
        insertData.hire_date = formData.hire_date;
      }
      if (formData.termination_date) {
        insertData.termination_date = formData.termination_date;
      }

      // Insert participant into database
      const { data, error } = await supabase
        .from('participants')
        .insert([insertData])
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log('Participant created successfully:', data);

      // Insert dependents if any
      if (dependents.length > 0 && data) {
        const dependentsToInsert = dependents.map(dep => ({
          participant_id: data.id,
          name: dep.name,
          relationship: dep.relationship,
          dob: dep.dob || null,
        }));

        const { error: dependentsError } = await supabase
          .from('dependents')
          .insert(dependentsToInsert);

        if (dependentsError) {
          console.error('Error inserting dependents:', dependentsError);
          // Don't throw - participant was created successfully
        }
      }
      
      // Redirect based on whether we came from a group page
      if (groupId) {
        router.push(`/groups/${groupId}`);
      } else {
        router.push('/participants');
      }
    } catch (error) {
      console.error('Error creating participant:', error);
      alert('Failed to create participant. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <button
          onClick={() => {
            if (groupId) {
              router.push(`/groups/${groupId}`);
            } else {
              router.back();
            }
          }}
          className="text-[var(--glass-secondary)] hover:text-[var(--glass-secondary-dark)] mb-4 flex items-center gap-2"
        >
          <span>←</span> {groupId ? 'Back to Group' : 'Back to Participants'}
        </button>
        <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
          Add New Participant
        </h1>
        <p className="text-[var(--glass-gray-medium)]">
          Create a new participant to track in your system
        </p>
      </div>

      <GlassCard>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Participant Information Section */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-4 border-b border-black pb-4">
              Participant Information
            </h2>
            
            {/* Row 1: Client Name and Date of Birth */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                  placeholder="Enter client name"
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
            </div>

            {/* Row 2: Phone Number and Email Address */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Phone Number */}
              <div>
                <label htmlFor="phone_number" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  Phone Number {!groupId && '*'}
                </label>
                <input
                  type="tel"
                  id="phone_number"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleChange}
                  required={!groupId}
                  className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                  placeholder="Enter phone number"
                />
              </div>

              {/* Email Address */}
              <div>
                <label htmlFor="email_address" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  Email Address {!groupId && '*'}
                </label>
                <input
                  type="email"
                  id="email_address"
                  name="email_address"
                  value={formData.email_address}
                  onChange={handleChange}
                  required={!groupId}
                  className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                  placeholder="Enter email address"
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
                className="glass-input-enhanced w-full px-4 py-3 rounded-xl resize-none"
                placeholder="Enter address"
              />
            </div>
          </div>

          {/* Group Information Section - Only show when coming from a group page */}
          {groupId && (
          <div className="pt-6 border-t border-white/20">
            <h2 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-4 border-b border-black pb-4">
              Group Information
            </h2>
            
            {/* Group Selection */}
            <div className="space-y-6">
              {/* Group and Class in the same row */}
              <div className={`${selectedGroup && selectedGroup.number_of_classes && selectedGroup.number_of_classes > 1 ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : ''}`}>
                <div>
                  <label htmlFor="group_id" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                    Group
                  </label>
                  {groupId ? (
                    <div className="glass-input-enhanced w-full px-4 py-3 rounded-xl opacity-75">
                      <span className="text-[var(--glass-black-dark)]">
                        {selectedGroup?.name || 'Loading...'}
                      </span>
                    </div>
                  ) : (
                    <select
                      id="group_id"
                      name="group_id"
                      value={formData.group_id}
                      onChange={handleChange}
                      className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                      disabled={loadingGroups}
                    >
                      <option value="">Select a group (optional)</option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
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
                      required
                      className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
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
                  <div className="date-input-wrapper">
                    <input
                      type="date"
                      id="hire_date"
                      name="hire_date"
                      value={formData.hire_date}
                      onChange={handleChange}
                      required
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
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Employment Status */}
                <div>
                  <label htmlFor="employment_status" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                    Employment Status
                  </label>
                  <div className="glass-input-enhanced w-full px-4 py-3 rounded-xl opacity-75">
                    <span className="font-semibold text-[var(--glass-black-dark)]">
                      {(() => {
                        if (!formData.hire_date) return 'Inactive';
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const hireDate = new Date(formData.hire_date);
                        hireDate.setHours(0, 0, 0, 0);
                        
                        if (formData.termination_date) {
                          const termDate = new Date(formData.termination_date);
                          termDate.setHours(0, 0, 0, 0);
                          if (today >= hireDate && today <= termDate) {
                            return 'Active';
                          }
                        } else {
                          if (today >= hireDate) {
                            return 'Active';
                          }
                        }
                        return 'Inactive';
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Dependents Section - Only show when coming from a group page */}
          {groupId && (
          <div className="pt-6 border-t border-white/20">
            <div className="flex items-center justify-between mb-6 border-b border-black pb-4">
              <h2 className="text-2xl font-bold text-[var(--glass-black-dark)]">
                Dependents
              </h2>
              <GlassButton
                type="button"
                variant="primary"
                onClick={() => setShowDependentForm(!showDependentForm)}
              >
                + Add Dependent
              </GlassButton>
            </div>

            {/* Add Dependent Form */}
            {showDependentForm && (
              <div className="glass-card rounded-xl p-6 mb-6 bg-white/5 border border-white/10">
                <h3 className="text-lg font-semibold text-[var(--glass-black-dark)] mb-4">
                  Add Dependent
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="dependent_name" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                      Name *
                    </label>
                    <input
                      type="text"
                      id="dependent_name"
                      name="name"
                      value={dependentForm.name}
                      onChange={handleDependentChange}
                      className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                      placeholder="Enter name"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="dependent_relationship" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                      Relationship *
                    </label>
                    <select
                      id="dependent_relationship"
                      name="relationship"
                      value={dependentForm.relationship}
                      onChange={handleDependentChange}
                      className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                      required
                    >
                      <option value="">Select relationship</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Child">Child</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="dependent_dob" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                      Date of Birth
                    </label>
                    <div className="date-input-wrapper">
                      <input
                        type="date"
                        id="dependent_dob"
                        name="dob"
                        value={dependentForm.dob}
                        onChange={handleDependentChange}
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
                </div>
                <div className="flex items-center justify-end gap-4 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDependentForm(false);
                      setDependentForm({ name: '', relationship: '', dob: '' });
                    }}
                    className="px-4 py-2 rounded-full font-semibold text-[var(--glass-black-dark)] hover:bg-white/20 transition-all"
                  >
                    Cancel
                  </button>
                  <GlassButton
                    type="button"
                    variant="primary"
                    onClick={handleAddDependent}
                    disabled={!dependentForm.name || !dependentForm.relationship}
                  >
                    Add Dependent
                  </GlassButton>
                </div>
              </div>
            )}

            {/* Dependents Report */}
            {dependents.length === 0 ? (
              <p className="text-[var(--glass-gray-medium)] text-center py-4">
                No dependents added
              </p>
            ) : (
              <div className="space-y-3">
                {dependents.map((dependent, index) => (
                  <div
                    key={index}
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
                              : 'bg-[var(--glass-primary)]/20 text-[var(--glass-primary)]'
                          }`}>
                            {dependent.relationship}
                          </span>
                          {dependent.dob && (
                            <span className="text-sm text-[var(--glass-gray-medium)]">
                              DOB: {(() => {
                                // Parse date string as local date to avoid timezone issues
                                const dateOnly = dependent.dob.split('T')[0];
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
                                return new Date(dependent.dob).toLocaleDateString();
                              })()}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveDependent(index)}
                        className="px-3 py-1 rounded-full text-sm font-semibold text-[#C6282B] hover:bg-[#C6282B]/20 transition-all"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-white/20">
            <button
              type="button"
              onClick={() => {
                if (groupId) {
                  router.push(`/groups/${groupId}`);
                } else {
                  router.back();
                }
              }}
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
              {isSubmitting ? 'Creating...' : 'Create Participant'}
            </GlassButton>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}

export default function NewParticipantPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewParticipantPageContent />
    </Suspense>
  );
}
