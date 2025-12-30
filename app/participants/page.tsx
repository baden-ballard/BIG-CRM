'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import GlassCard from '../../components/GlassCard';
import GlassButton from '../../components/GlassButton';
import SearchFilter from '../../components/SearchFilter';
import ReportsDropdown from '../../components/ReportsDropdown';
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

interface ActiveGroupPlan {
  id: string;
  plan_name: string;
  option: string;
  total_employee_responsible_amount: number | null;
}

interface ActiveMedicarePlan {
  id: string;
  plan_name: string;
  provider_name: string;
  rate: number | null;
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
  const [participantGroupPlans, setParticipantGroupPlans] = useState<Record<string, ActiveGroupPlan[]>>({});
  const [participantMedicarePlans, setParticipantMedicarePlans] = useState<Record<string, ActiveMedicarePlan[]>>({});

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
      // Fetch active group plans and Medicare plans for display
      await fetchActivePlansForParticipants(participantsData.map(p => p.id));

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

  const fetchActivePlansForParticipants = async (participantIds: string[]) => {
    if (participantIds.length === 0) {
      setParticipantGroupPlans({});
      setParticipantMedicarePlans({});
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayString = today.toISOString().split('T')[0];

    try {
      // Fetch active group plans (only employee plans, not dependents)
      const { data: groupPlansData, error: groupPlansError } = await supabase
        .from('participant_group_plans')
        .select(`
          id,
          participant_id,
          total_employee_responsible_amount,
          termination_date,
          dependent_id,
          group_plan_option_id,
          group_plan:group_plans (
            id,
            plan_name,
            termination_date
          ),
          group_plan_option:group_plan_options (
            id,
            option
          )
        `)
        .in('participant_id', participantIds)
        .is('termination_date', null)
        .is('dependent_id', null)
        .order('created_at', { ascending: false });

      if (groupPlansError) {
        console.error('Error fetching group plans:', groupPlansError);
      } else {
        const groupPlansMap: Record<string, ActiveGroupPlan[]> = {};
        
        (groupPlansData || []).forEach((plan: any) => {
          const participantId = plan.participant_id;
          
          // Check if group plan is still active (not terminated)
          const groupPlanTerminationDate = plan.group_plan?.termination_date 
            ? new Date(plan.group_plan.termination_date)
            : null;
          
          if (groupPlanTerminationDate && groupPlanTerminationDate < today) {
            return; // Skip terminated group plans
          }

          // Get the option from group_plan_option
          const option = plan.group_plan_option?.option || 'N/A';

          if (!groupPlansMap[participantId]) {
            groupPlansMap[participantId] = [];
          }

          // Only add employee plans (dependent_id is null)
          // Filter duplicates by plan name and option
          const planKey = `${plan.group_plan?.plan_name}-${option}`;
          const existingPlan = groupPlansMap[participantId].find(
            p => `${p.plan_name}-${p.option}` === planKey
          );

          if (!existingPlan) {
            groupPlansMap[participantId].push({
              id: plan.id,
              plan_name: plan.group_plan?.plan_name || 'Unknown Plan',
              option: option,
              total_employee_responsible_amount: plan.total_employee_responsible_amount,
            });
          }
        });

        setParticipantGroupPlans(groupPlansMap);
      }

      // Fetch active Medicare plans
      const { data: medicarePlansData, error: medicarePlansError } = await supabase
        .from('participant_medicare_plans')
        .select(`
          id,
          participant_id,
          effective_date,
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
            rate,
            start_date,
            end_date
          )
        `)
        .in('participant_id', participantIds)
        .order('created_at', { ascending: false });

      if (medicarePlansError) {
        console.error('Error fetching Medicare plans:', medicarePlansError);
      } else {
        const medicarePlansMap: Record<string, ActiveMedicarePlan[]> = {};
        
        (medicarePlansData || []).forEach((plan: any) => {
          const participantId = plan.participant_id;
          
          // Check if plan is active (effective_date is today or in the past, or null)
          if (plan.effective_date) {
            const effectiveDate = new Date(plan.effective_date);
            effectiveDate.setHours(0, 0, 0, 0);
            if (effectiveDate > today) {
              return; // Skip future-dated plans
            }
          }

          // Get the active rate
          let activeRate: number | null = null;
          if (plan.medicare_child_rate) {
            const rate = Array.isArray(plan.medicare_child_rate) 
              ? plan.medicare_child_rate[0] 
              : plan.medicare_child_rate;
            
            if (rate) {
              const rateStartDate = rate.start_date ? new Date(rate.start_date) : null;
              const rateEndDate = rate.end_date ? new Date(rate.end_date) : null;
              
              // Check if rate is currently active
              if (rateStartDate && rateStartDate <= today && (!rateEndDate || rateEndDate >= today)) {
                activeRate = rate.rate;
              } else if (!rateStartDate) {
                // If no start date, use the rate
                activeRate = rate.rate;
              }
            }
          }

          if (!medicarePlansMap[participantId]) {
            medicarePlansMap[participantId] = [];
          }

          const planName = plan.medicare_plan?.plan_name || 'Unknown Plan';
          const providerName = plan.medicare_plan?.provider?.name || 'Unknown Provider';
          
          // Avoid duplicates
          const existingPlan = medicarePlansMap[participantId].find(
            p => p.plan_name === planName && p.provider_name === providerName
          );

          if (!existingPlan) {
            medicarePlansMap[participantId].push({
              id: plan.id,
              plan_name: planName,
              provider_name: providerName,
              rate: activeRate,
            });
          }
        });

        setParticipantMedicarePlans(medicarePlansMap);
      }
    } catch (err: any) {
      console.error('Error fetching active plans:', err);
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
    // Parse date-only strings (YYYY-MM-DD) as local dates to avoid timezone shifts
    const dateOnlyMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      const localDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return localDate.toLocaleDateString();
    }
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
            Medicare/Member Search
          </h1>
          <p className="text-[var(--glass-gray-medium)]">
            Search for Medicare Clients and Group Members
          </p>
        </div>
        <div className="flex gap-3">
          <GlassButton variant="primary" href="/participants/new">
            + New Participant
          </GlassButton>
          <GlassButton variant="primary" href="/participants/upload-medicare">
            Upload Medicare Participants
          </GlassButton>
        </div>
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
                <ReportsDropdown />
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-4">
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

                {/* Active Group Plans */}
                {participantGroupPlans[participant.id] && participantGroupPlans[participant.id].length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200/30">
                    <h4 className="text-sm font-semibold text-[var(--glass-gray-medium)] mb-2">
                      Active Group Plans:
                    </h4>
                    <div className="space-y-2">
                      {participantGroupPlans[participant.id].map((plan) => (
                        <div key={plan.id} className="text-sm">
                          <span className="text-[var(--glass-black-dark)] font-medium">
                            {plan.plan_name}
                          </span>
                          <span className="text-[var(--glass-gray-medium)] mx-2">•</span>
                          <span className="text-[var(--glass-gray-medium)]">Class/Option: </span>
                          <span className="text-[var(--glass-black-dark)]">{plan.option}</span>
                          {plan.total_employee_responsible_amount !== null && (
                            <>
                              <span className="text-[var(--glass-gray-medium)] mx-2">•</span>
                              <span className="text-[var(--glass-gray-medium)]">Employee Responsible: </span>
                              <span className="text-[var(--glass-black-dark)]">
                                ${plan.total_employee_responsible_amount.toFixed(2)}
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Medicare Plans */}
                {participantMedicarePlans[participant.id] && participantMedicarePlans[participant.id].length > 0 && (
                  <div className={`mt-4 pt-4 ${participantGroupPlans[participant.id]?.length > 0 ? '' : 'border-t border-gray-200/30'}`}>
                    <h4 className="text-sm font-semibold text-[var(--glass-gray-medium)] mb-2">
                      Active Medicare Plans:
                    </h4>
                    <div className="space-y-2">
                      {participantMedicarePlans[participant.id].map((plan) => (
                        <div key={plan.id} className="text-sm">
                          <span className="text-[var(--glass-black-dark)] font-medium">
                            {plan.plan_name}
                          </span>
                          <span className="text-[var(--glass-gray-medium)] mx-2">•</span>
                          <span className="text-[var(--glass-gray-medium)]">Provider: </span>
                          <span className="text-[var(--glass-black-dark)]">{plan.provider_name}</span>
                          {plan.rate !== null && (
                            <>
                              <span className="text-[var(--glass-gray-medium)] mx-2">•</span>
                              <span className="text-[var(--glass-gray-medium)]">Rate: </span>
                              <span className="text-[var(--glass-black-dark)]">
                                ${plan.rate.toFixed(2)}
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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


