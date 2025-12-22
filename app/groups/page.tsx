'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import GlassCard from '../../components/GlassCard';
import GlassButton from '../../components/GlassButton';
import SearchFilter from '../../components/SearchFilter';
import { supabase } from '../../lib/supabase';

interface Group {
  id: string;
  name: string;
  initial_contact_date: string | null;
  lead_source: string | null;
  from_who: string | null;
  pipeline_status: string | null;
  status_change_notes: string | null;
  programs: string[];
  activeParticipants: number;
  created_at: string;
  updated_at: string;
}

export default function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('groups')
        .select('*')
        .order('name', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      // Fetch programs and active participants for each group
      const groupsWithData = await Promise.all(
        (data || []).map(async (group) => {
          // Fetch programs for this group
          const { data: groupProgramsData } = await supabase
            .from('group_programs')
            .select('program_id')
            .eq('group_id', group.id);

          let programs: string[] = [];
          if (groupProgramsData && groupProgramsData.length > 0) {
            const programIds = groupProgramsData.map(gp => gp.program_id);
            const { data: programsData } = await supabase
              .from('programs')
              .select('id, name')
              .in('id', programIds);
            
            if (programsData) {
              programs = programsData.map(program => program.name);
            }
          }

          // Count active participants for this group (employment_status === 'Active')
          let activeParticipants = 0;
          const { data: participantsData, error: participantsError } = await supabase
            .from('participants')
            .select('id, employment_status')
            .eq('group_id', group.id);

          if (!participantsError && participantsData) {
            activeParticipants = participantsData.filter(
              participant => participant.employment_status === 'Active'
            ).length;
          }

          return {
            ...group,
            programs,
            activeParticipants,
          };
        })
      );

      // Sort groups alphabetically by name
      const sortedGroups = groupsWithData.sort((a, b) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      setGroups(sortedGroups);
      setFilteredGroups(sortedGroups);
    } catch (err: any) {
      console.error('Error fetching groups:', err);
      setError(err.message || 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const searchFields = useMemo(() => ['name', 'from_who', 'status_change_notes'] as const, []);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
            Groups
          </h1>
          <p className="text-[var(--glass-gray-medium)]">
            Manage your sales pipeline and group accounts
          </p>
        </div>
        <GlassButton variant="primary" href="/groups/new">
          + New Group
        </GlassButton>
      </div>

      {loading && (
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            Loading groups...
          </p>
        </GlassCard>
      )}

      {error && (
        <GlassCard>
          <p className="text-red-500 text-center py-8">
            Error: {error}
          </p>
        </GlassCard>
      )}

      {!loading && !error && groups.length === 0 && (
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            No groups found. Create your first group to get started.
          </p>
        </GlassCard>
      )}

      {!loading && !error && groups.length > 0 && filteredGroups.length === 0 && (
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            No groups match your search criteria. Try adjusting your filters.
          </p>
        </GlassCard>
      )}

      {!loading && !error && groups.length > 0 && (
        <>
          <SearchFilter
            data={groups}
            onFilteredDataChange={setFilteredGroups}
            searchFields={searchFields}
            placeholder="Search groups by name, from who, or notes..."
          />
          <div className="grid gap-6 grid-cols-1">
            {filteredGroups.map((group) => (
              <GlassCard 
                key={group.id} 
                className="hover:scale-105 transition-transform cursor-pointer"
                onClick={() => router.push(`/groups/${group.id}`)}
              >
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-xl font-bold text-[var(--glass-black-dark)]">
                      {group.name}
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {group.programs && group.programs.length > 0 ? (
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="text-sm font-semibold text-[var(--glass-gray-medium)]">
                          Programs:
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {group.programs.map((programName, index) => (
                            <div
                              key={index}
                              className="px-3 py-2 rounded-lg bg-[var(--glass-secondary)]/20 border border-[var(--glass-secondary)]/30"
                            >
                              <div className="text-sm font-semibold text-[var(--glass-secondary-dark)]">
                                {programName}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-[var(--glass-gray-medium)]">
                        No programs assigned
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-semibold text-[var(--glass-gray-medium)]">
                        Active Participants: <span className="font-bold text-[var(--glass-black-dark)]">{group.activeParticipants}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

