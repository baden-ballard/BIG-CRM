'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import GlassCard from '../../components/GlassCard';
import GlassButton from '../../components/GlassButton';
import SearchFilter from '../../components/SearchFilter';
import { supabase } from '../../lib/supabase';

interface Participant {
  id: string;
  group_id: string | null;
  client_name: string;
  dob: string | null;
  address: string | null;
  phone_number: string | null;
  email_address: string | null;
  employment_status: string | null;
  created_at: string;
  updated_at: string;
}

interface Group {
  id: string;
  name: string;
}

export default function ParticipantsPage() {
  const router = useRouter();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [filteredParticipants, setFilteredParticipants] = useState<Participant[]>([]);
  const [groups, setGroups] = useState<Record<string, Group>>({});
  const [participantsWithMedicare, setParticipantsWithMedicare] = useState<Set<string>>(new Set());
  const [participantsWithActiveMedicare, setParticipantsWithActiveMedicare] = useState<Set<string>>(new Set());
  const [showOnlyMedicare, setShowOnlyMedicare] = useState(false);
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [hasSearchFilterActive, setHasSearchFilterActive] = useState(false);
  const searchFilterClearRef = useRef<(() => void) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchParticipants();
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('groups')
        .select('id, name');

      if (fetchError) {
        throw fetchError;
      }

      const groupsMap: Record<string, Group> = {};
      (data || []).forEach((group: Group) => {
        groupsMap[group.id] = group;
      });
      setGroups(groupsMap);
    } catch (err: any) {
      console.error('Error fetching groups:', err);
    }
  };

  const fetchParticipants = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('participants')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      const participantsData = data || [];
      
      // Fetch Medicare plans for all participants
      await fetchMedicarePlans(participantsData.map(p => p.id));
      // Fetch active Medicare plans
      await fetchActiveMedicarePlans(participantsData.map(p => p.id));

      setParticipants(participantsData);
      setFilteredParticipants(participantsData);
    } catch (err: any) {
      console.error('Error fetching participants:', err);
      setError(err.message || 'Failed to load participants');
    } finally {
      setLoading(false);
    }
  };

  const fetchMedicarePlans = async (participantIds: string[]) => {
    try {
      if (participantIds.length === 0) {
        setParticipantsWithMedicare(new Set());
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("participant_medicare_plans")
        .select("participant_id")
        .in("participant_id", participantIds);

      if (fetchError) {
        console.error("Error fetching Medicare plans:", fetchError);
        return;
      }

      // Create a set of participant IDs that have Medicare plans (active or non-active)
      const medicareParticipantIds = new Set<string>();
      (data || []).forEach((plan: any) => {
        medicareParticipantIds.add(plan.participant_id);
      });

      setParticipantsWithMedicare(medicareParticipantIds);
    } catch (err: any) {
      console.error("Error fetching Medicare plans:", err);
    }
  };

  const fetchActiveMedicarePlans = async (participantIds: string[]) => {
    try {
      if (participantIds.length === 0) {
        setParticipantsWithActiveMedicare(new Set());
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayString = today.toISOString().split('T')[0];

      const { data, error: fetchError } = await supabase
        .from("participant_medicare_plans")
        .select("participant_id, effective_date")
        .in("participant_id", participantIds);

      if (fetchError) {
        console.error("Error fetching active Medicare plans:", fetchError);
        return;
      }

      // Create a set of participant IDs that have active Medicare plans
      // A plan is active if effective_date is today or in the past
      const activeMedicareParticipantIds = new Set<string>();
      (data || []).forEach((plan: any) => {
        if (plan.effective_date) {
          const effectiveDate = new Date(plan.effective_date);
          effectiveDate.setHours(0, 0, 0, 0);
          
          // If effective_date is today or in the past, consider it active
          if (effectiveDate <= today) {
            activeMedicareParticipantIds.add(plan.participant_id);
          }
        } else {
          // If no effective_date, consider it active (legacy data)
          activeMedicareParticipantIds.add(plan.participant_id);
        }
      });

      setParticipantsWithActiveMedicare(activeMedicareParticipantIds);
    } catch (err: any) {
      console.error("Error fetching active Medicare plans:", err);
    }
  };

  // Get unique group IDs for filter
  const groupFilterOptions = Object.values(groups).map(group => ({
    label: group.name,
    value: group.id,
  })).sort((a, b) => a.label.localeCompare(b.label));

  // Apply Medicare filter to filtered participants
  const medicareFilteredParticipants = useMemo(() => {
    if (!showOnlyMedicare) {
      return filteredParticipants;
    }
    return filteredParticipants.filter(participant => 
      participantsWithMedicare.has(participant.id)
    );
  }, [filteredParticipants, showOnlyMedicare, participantsWithMedicare]);

  // Apply Active filter to medicare-filtered participants and sort alphabetically
  const activeFilteredParticipants = useMemo(() => {
    let filtered = medicareFilteredParticipants;
    
    if (showOnlyActive) {
      filtered = medicareFilteredParticipants.filter(participant => {
        // If participant is part of a group, check employment_status
        if (participant.group_id) {
          return participant.employment_status === 'Active';
        }
        // If participant only has Medicare plan, check if they have an active Medicare plan
        return participantsWithActiveMedicare.has(participant.id);
      });
    }
    
    // Sort alphabetically by client_name
    return [...filtered].sort((a, b) => {
      const nameA = (a.client_name || '').toLowerCase();
      const nameB = (b.client_name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [medicareFilteredParticipants, showOnlyActive, participantsWithActiveMedicare]);

  const handleMedicareFilter = () => {
    setShowOnlyMedicare(!showOnlyMedicare);
  };

  const handleActiveFilter = () => {
    setShowOnlyActive(!showOnlyActive);
  };

  const handleClearFilters = () => {
    setShowOnlyMedicare(false);
    setShowOnlyActive(false);
    if (searchFilterClearRef.current) {
      searchFilterClearRef.current();
    }
  };

  // Check if any filters are active
  const hasAnyFiltersActive = showOnlyMedicare || showOnlyActive || hasSearchFilterActive;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
            Participants
          </h1>
          <p className="text-[var(--glass-gray-medium)]">
            Manage individual clients and participants
          </p>
        </div>
        <GlassButton variant="primary" href="/participants/new">
          + New Participant
        </GlassButton>
      </div>

      {loading && (
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            Loading participants...
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

      {!loading && !error && participants.length === 0 && (
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            No participants found. Create your first participant to get started.
          </p>
        </GlassCard>
      )}

      {!loading && !error && participants.length > 0 && (
        <>
          <SearchFilter
            data={participants}
            onFilteredDataChange={setFilteredParticipants}
            searchFields={['client_name', 'email_address', 'phone_number', 'address']}
            filterOptions={groupFilterOptions.length > 0 ? [
              {
                field: 'group_id',
                label: 'Group',
                searchable: true,
                options: groupFilterOptions,
              },
            ] : []}
            placeholder="Search participants by name, email, phone, or address..."
            customResultsCount={activeFilteredParticipants.length}
            customTotalCount={participants.length}
            onFiltersActiveChange={setHasSearchFilterActive}
            clearFiltersRef={searchFilterClearRef}
            actions={
              <>
                <button
                  onClick={handleActiveFilter}
                  className={`px-6 py-3 rounded-full font-semibold transition-all duration-300 shadow-lg hover:shadow-xl ${
                    showOnlyActive 
                      ? 'bg-green-600 text-white hover:opacity-90' 
                      : 'bg-[var(--glass-secondary)] text-white hover:opacity-90'
                  }`}
                >
                  {showOnlyActive ? '✓ Active Filter' : 'Show Only Active'}
                </button>
                <button
                  onClick={handleMedicareFilter}
                  className="px-6 py-3 rounded-full font-semibold transition-all duration-300 bg-[var(--glass-secondary)] text-white shadow-lg hover:shadow-xl hover:opacity-90"
                >
                  {showOnlyMedicare ? 'Remove Medicare Filter' : 'Show Only Medicare'}
                </button>
                {hasAnyFiltersActive && (
                  <button
                    onClick={handleClearFilters}
                    className="px-6 py-3 rounded-full font-semibold bg-gray-500/20 backdrop-blur-md border border-gray-500/30 text-[var(--glass-black-dark)] hover:bg-gray-500/30 transition-all duration-300"
                  >
                    Clear Filters
                  </button>
                )}
              </>
            }
          />

          {activeFilteredParticipants.length === 0 && (
            <GlassCard>
              <p className="text-[var(--glass-gray-medium)] text-center py-8">
                No participants match your search criteria. Try adjusting your filters.
              </p>
            </GlassCard>
          )}

          {activeFilteredParticipants.length > 0 && (
          <div className="grid gap-6 grid-cols-1">
            {activeFilteredParticipants.map((participant) => (
            <GlassCard 
              key={participant.id} 
              className="hover:scale-105 transition-transform cursor-pointer"
              onClick={() => router.push(`/participants/${participant.id}`)}
            >
              <div className="p-6">
                <h3 className="text-xl font-bold text-[var(--glass-black-dark)] mb-4">
                  {participant.client_name}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  {participant.group_id && groups[participant.group_id] && (
                    <div>
                      <span className="text-[var(--glass-gray-medium)]">Group: </span>
                      <span className="text-[var(--glass-black-dark)]">
                        {groups[participant.group_id].name}
                      </span>
                    </div>
                  )}
                  {participant.email_address && (
                    <div>
                      <span className="text-[var(--glass-gray-medium)]">Email: </span>
                      <span className="text-[var(--glass-black-dark)]">
                        {participant.email_address}
                      </span>
                    </div>
                  )}
                  {participant.phone_number && (
                    <div>
                      <span className="text-[var(--glass-gray-medium)]">Phone: </span>
                      <span className="text-[var(--glass-black-dark)]">
                        {participant.phone_number}
                      </span>
                    </div>
                  )}
                  {participant.dob && (
                    <div>
                      <span className="text-[var(--glass-gray-medium)]">DOB: </span>
                      <span className="text-[var(--glass-black-dark)]">
                        {formatDate(participant.dob)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
          </div>
          )}
        </>
      )}
    </div>
  );
}


