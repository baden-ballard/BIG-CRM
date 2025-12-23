'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import GlassCard from '../../../components/GlassCard';
import GlassButton from '../../../components/GlassButton';
import { supabase } from '../../../lib/supabase';

interface Program {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface Group {
  id: string;
  name: string;
  initial_contact_date: string | null;
  lead_source: string | null;
  from_who: string | null;
  pipeline_status: string | null;
  created_at: string;
  updated_at: string;
}

export default function ProgramDetailPage() {
  const router = useRouter();
  const params = useParams();
  const programId = (params?.id ?? '') as string;

  const [program, setProgram] = useState<Program | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({ name: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (programId) {
      fetchProgram();
      fetchGroups();
    } else {
      setError('Program ID is missing');
      setLoading(false);
      setLoadingGroups(false);
    }
  }, [programId]);

  const fetchProgram = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!programId) {
        throw new Error('Program ID is required');
      }

      const { data, error: fetchError } = await supabase
        .from('programs')
        .select('*')
        .eq('id', programId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      if (!data) {
        throw new Error('Program not found');
      }

      setProgram(data);
      setFormData({ name: data.name });
    } catch (err: any) {
      console.error('Error fetching program:', err);
      setError(err.message || 'Failed to load program');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      setLoadingGroups(true);

      if (!programId) {
        return;
      }

      // First, get all group_programs entries for this program
      const { data: groupPrograms, error: junctionError } = await supabase
        .from('group_programs')
        .select('group_id')
        .eq('program_id', programId);

      if (junctionError) {
        throw junctionError;
      }

      if (!groupPrograms || groupPrograms.length === 0) {
        setGroups([]);
        return;
      }

      // Extract group IDs
      const groupIds = groupPrograms.map((gp: any) => gp.group_id);

      // Fetch the actual groups
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('id, name, initial_contact_date, lead_source, from_who, pipeline_status, created_at, updated_at')
        .in('id', groupIds)
        .order('name', { ascending: true });

      if (groupsError) {
        throw groupsError;
      }

      setGroups(groupsData || []);
    } catch (err: any) {
      console.error('Error fetching groups:', err);
    } finally {
      setLoadingGroups(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getPipelineStatusBadgeColor = (status: string | null) => {
    if (!status) return 'bg-gray-500/20 text-gray-500';
    
    switch (status) {
      case 'Won':
        return 'bg-green-500/20 text-green-500';
      case 'Lost':
        return 'bg-red-500/20 text-red-500';
      case 'Meeting Set':
        return 'bg-blue-500/20 text-blue-500';
      case 'Waiting On Decision':
        return 'bg-yellow-500/20 text-yellow-500';
      default:
        return 'bg-gray-500/20 text-gray-500';
    }
  };

  const handleEditClick = () => {
    setIsEditMode(true);
    if (program) {
      setFormData({ name: program.name });
    }
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    if (program) {
      setFormData({ name: program.name });
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ name: e.target.value });
  };

  const handleSaveProgram = async () => {
    if (!programId || !formData.name.trim()) {
      alert('Program name is required');
      return;
    }

    setIsSaving(true);
    try {
      const { data, error: updateError } = await supabase
        .from('programs')
        .update({ name: formData.name.trim() })
        .eq('id', programId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      setProgram(data);
      setIsEditMode(false);
      alert('Program updated successfully!');
    } catch (err: any) {
      console.error('Error saving program:', err);
      alert('Failed to update program. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProgram = async () => {
    if (!programId) return;

    try {
      setIsDeleting(true);

      const { error: deleteError } = await supabase
        .from('programs')
        .delete()
        .eq('id', programId);

      if (deleteError) {
        throw deleteError;
      }

      // Close dialog and redirect to programs list
      setShowDeleteDialog(false);
      alert('Program deleted successfully!');
      router.push('/programs');
    } catch (err: any) {
      console.error('Error deleting program:', err);
      alert('Failed to delete program. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            Loading program...
          </p>
        </GlassCard>
      </div>
    );
  }

  if (error || !program) {
    return (
      <div className="max-w-4xl mx-auto">
        <GlassCard>
          <p className="text-red-500 text-center py-8">
            {error || 'Program not found'}
          </p>
          <div className="flex justify-center mt-4">
            <GlassButton variant="primary" onClick={() => router.push('/programs')}>
              Back to Programs
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
          onClick={() => router.push('/programs')}
          className="text-[var(--glass-secondary)] hover:text-[var(--glass-secondary-dark)] mb-4 flex items-center gap-2"
        >
          <span>←</span> Back to Programs
        </button>
        <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
          {program.name}
        </h1>
        <p className="text-[var(--glass-gray-medium)]">
          View program details and associated groups
        </p>
      </div>

      <GlassCard>
        <div className="space-y-6">
          {/* Program Information Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-[var(--glass-black-dark)]">
                Program Information
              </h2>
              {isEditMode ? (
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setShowDeleteDialog(true)}
                    className="px-6 py-3 rounded-full font-semibold bg-[#C6282B] text-white hover:bg-[#A01F22] shadow-lg hover:shadow-xl transition-all duration-300"
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
                    variant="primary"
                    onClick={handleSaveProgram}
                    disabled={isSaving}
                    className={isSaving ? 'opacity-50 cursor-not-allowed' : ''}
                  >
                    {isSaving ? 'Saving...' : 'Save Program'}
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

            <div>
              <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                Program Name
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formData.name}
                  onChange={handleNameChange}
                  className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                  placeholder="Enter program name"
                  required
                />
              ) : (
                <div className="text-lg text-[var(--glass-black-dark)]">
                  {program.name}
                </div>
              )}
            </div>

          </div>

          {/* Groups Section */}
          <div className="pt-6 border-t border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-[var(--glass-black-dark)]">
                Groups in this Program
              </h2>
              <GlassButton
                variant="primary"
                onClick={() => router.push('/groups/new')}
              >
                + Add New Group
              </GlassButton>
            </div>

            {loadingGroups ? (
              <p className="text-[var(--glass-gray-medium)] text-center py-4">
                Loading groups...
              </p>
            ) : groups.length === 0 ? (
              <p className="text-[var(--glass-gray-medium)] text-center py-4">
                No groups are associated with this program yet.
              </p>
            ) : (
              <div className="space-y-3">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className="glass-card rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer"
                    onClick={() => router.push(`/groups/${group.id}`)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-[var(--glass-black-dark)] mb-2 text-lg">
                          {group.name}
                        </h3>
                        <div className="flex flex-wrap gap-4 text-sm text-[var(--glass-gray-medium)] mb-2">
                          {group.lead_source && (
                            <span>
                              <span className="font-semibold">Lead Source:</span> {group.lead_source}
                            </span>
                          )}
                          {group.from_who && (
                            <span>
                              <span className="font-semibold">From:</span> {group.from_who}
                            </span>
                          )}
                          {group.initial_contact_date && (
                            <span>
                              <span className="font-semibold">Contact Date:</span> {formatDate(group.initial_contact_date)}
                            </span>
                          )}
                        </div>
                        {group.pipeline_status && (
                          <div className="mt-2">
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getPipelineStatusBadgeColor(group.pipeline_status)}`}>
                              {group.pipeline_status}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Delete Program Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeleteDialog(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-4 text-center">
              Delete Program
            </h3>
            <p className="text-[var(--glass-gray-medium)] mb-6 text-center">
              You are deleting this program. This action cannot be undone. Are you sure you want to continue?
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
                onClick={handleDeleteProgram}
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


