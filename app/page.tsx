'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import GlassCard from '../components/GlassCard';
import { supabase } from '../lib/supabase';

interface Participant {
  id: string;
  client_name: string;
  dob: string | null;
  email_address: string | null;
  phone_number: string | null;
}

interface ActivePlan {
  id: string;
  planName: string;
  providerName: string;
  planType: 'medicare' | 'group';
}

interface ParticipantWithBirthday extends Participant {
  birthdayDate: Date;
  daysAgo: number;
  activePlans: ActivePlan[];
}

interface ParticipantWithUpcomingBirthday extends Participant {
  birthdayDate: Date;
  daysUntil: number;
  activePlans: ActivePlan[];
}

interface ParticipantTurning65 extends Participant {
  turning65Date: Date;
  daysUntil65: number;
}


export default function Dashboard() {
  const router = useRouter();
  const [recentBirthdays, setRecentBirthdays] = useState<ParticipantWithBirthday[]>([]);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<ParticipantWithUpcomingBirthday[]>([]);
  const [turning65Participants, setTurning65Participants] = useState<ParticipantTurning65[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const [loadingTurning65, setLoadingTurning65] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorUpcoming, setErrorUpcoming] = useState<string | null>(null);
  const [errorTurning65, setErrorTurning65] = useState<string | null>(null);
  const [totalGroups, setTotalGroups] = useState<number>(0);
  const [totalParticipants, setTotalParticipants] = useState<number>(0);
  const [activePrograms, setActivePrograms] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    fetchRecentBirthdays();
    fetchUpcomingBirthdays();
    fetchDashboardStats();
    fetchGroupParticipantsTurning65();
  }, []);

  const fetchActivePlansForParticipants = async (participantIds: string[]): Promise<Map<string, ActivePlan[]>> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    const plansMap = new Map<string, ActivePlan[]>();

    // Initialize map with empty arrays
    participantIds.forEach(id => plansMap.set(id, []));

    if (participantIds.length === 0) {
      return plansMap;
    }

    try {
      // Batch fetch all active Medicare plans for all participants
      const { data: medicarePlans, error: medicareError } = await supabase
        .from('participant_medicare_plans')
        .select(`
          participant_id,
          medicare_plan:medicare_plans (
            id,
            plan_name,
            provider:providers (
              id,
              name
            )
          ),
          effective_date
        `)
        .in('participant_id', participantIds);

      if (!medicareError && medicarePlans) {
        medicarePlans.forEach((plan: any) => {
          const effectiveDate = plan.effective_date ? new Date(plan.effective_date) : null;
          const isActive = !effectiveDate || effectiveDate <= today;
          
          if (isActive && plan.medicare_plan && plan.participant_id) {
            const medicarePlan = Array.isArray(plan.medicare_plan) 
              ? plan.medicare_plan[0] 
              : plan.medicare_plan;
            
            if (medicarePlan) {
              const provider = Array.isArray(medicarePlan.provider) 
                ? medicarePlan.provider[0] 
                : medicarePlan.provider;
              
              const activePlan: ActivePlan = {
                id: medicarePlan.id,
                planName: medicarePlan.plan_name || 'Unknown Plan',
                providerName: provider?.name || 'Unknown Provider',
                planType: 'medicare',
              };

              const existingPlans = plansMap.get(plan.participant_id) || [];
              plansMap.set(plan.participant_id, [...existingPlans, activePlan]);
            }
          }
        });
      }

      // Batch fetch all active Group plans for all participants
      const { data: groupPlans, error: groupError } = await supabase
        .from('participant_group_plans')
        .select(`
          participant_id,
          group_plan:group_plans (
            id,
            plan_name,
            termination_date,
            provider:providers (
              id,
              name
            )
          ),
          termination_date
        `)
        .in('participant_id', participantIds);

      if (!groupError && groupPlans) {
        groupPlans.forEach((plan: any) => {
          const participantTerminationDate = plan.termination_date 
            ? new Date(plan.termination_date)
            : null;
          
          const groupPlan = Array.isArray(plan.group_plan) 
            ? plan.group_plan[0] 
            : plan.group_plan;
          
          const groupPlanTerminationDate = groupPlan?.termination_date 
            ? new Date(groupPlan.termination_date)
            : null;
          
          const isActive = (!participantTerminationDate || participantTerminationDate >= today) &&
                          (!groupPlanTerminationDate || groupPlanTerminationDate >= today);
          
          if (isActive && groupPlan && plan.participant_id) {
            const provider = Array.isArray(groupPlan.provider) 
              ? groupPlan.provider[0] 
              : groupPlan.provider;
            
            const activePlan: ActivePlan = {
              id: groupPlan.id,
              planName: groupPlan.plan_name || 'Unknown Plan',
              providerName: provider?.name || 'Unknown Provider',
              planType: 'group',
            };

            const existingPlans = plansMap.get(plan.participant_id) || [];
            plansMap.set(plan.participant_id, [...existingPlans, activePlan]);
          }
        });
      }
    } catch (err) {
      console.error('Error fetching active plans:', err);
    }

    return plansMap;
  };

  const fetchRecentBirthdays = async () => {
    try {
      setLoading(true);
      setError(null);

      // First, get all participant IDs that have Medicare plans
      const { data: medicareData, error: medicareError } = await supabase
        .from('participant_medicare_plans')
        .select('participant_id');

      if (medicareError) {
        throw medicareError;
      }

      const medicareParticipantIds = new Set<string>();
      (medicareData || []).forEach((plan: any) => {
        medicareParticipantIds.add(plan.participant_id);
      });

      // If no participants have Medicare plans, return early
      if (medicareParticipantIds.size === 0) {
        setRecentBirthdays([]);
        setLoading(false);
        return;
      }

      // Fetch participants with Medicare plans and DOB
      const { data, error: fetchError } = await supabase
        .from('participants')
        .select('id, client_name, dob, email_address, phone_number')
        .not('dob', 'is', null)
        .in('id', Array.from(medicareParticipantIds));

      if (fetchError) {
        throw fetchError;
      }

      const participants = (data || []) as Participant[];
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize to start of day
      const sixtyDaysAgo = new Date(today);
      sixtyDaysAgo.setDate(today.getDate() - 60);

      // Filter participants whose birthday occurred in the last 60 days
      const recentBirthdayParticipants: ParticipantWithBirthday[] = [];
      const participantIdsToFetchPlans: string[] = [];

      // First pass: identify participants with recent birthdays
      for (const participant of participants) {
        if (!participant.dob) continue;

        const dob = new Date(participant.dob);
        const currentYear = today.getFullYear();
        
        // Create birthday date for this year
        const thisYearBirthday = new Date(currentYear, dob.getMonth(), dob.getDate());
        thisYearBirthday.setHours(0, 0, 0, 0);
        
        // Create birthday date for last year (in case we're early in the year)
        const lastYearBirthday = new Date(currentYear - 1, dob.getMonth(), dob.getDate());
        lastYearBirthday.setHours(0, 0, 0, 0);

        let birthdayDate: Date | null = null;
        let daysAgo: number | null = null;

        // Check if this year's birthday is within the last 60 days
        if (thisYearBirthday <= today && thisYearBirthday >= sixtyDaysAgo) {
          daysAgo = Math.floor((today.getTime() - thisYearBirthday.getTime()) / (1000 * 60 * 60 * 24));
          birthdayDate = thisYearBirthday;
        }
        // Check if last year's birthday is within the last 60 days (handles year boundary)
        else if (lastYearBirthday <= today && lastYearBirthday >= sixtyDaysAgo) {
          daysAgo = Math.floor((today.getTime() - lastYearBirthday.getTime()) / (1000 * 60 * 60 * 24));
          birthdayDate = lastYearBirthday;
        }

        if (birthdayDate !== null && daysAgo !== null) {
          recentBirthdayParticipants.push({
            ...participant,
            birthdayDate,
            daysAgo,
            activePlans: [], // Will be populated below
          });
          participantIdsToFetchPlans.push(participant.id);
        }
      }

      // Batch fetch all active plans for all participants at once
      const plansMap = await fetchActivePlansForParticipants(participantIdsToFetchPlans);

      // Map plans to participants
      recentBirthdayParticipants.forEach(participant => {
        participant.activePlans = plansMap.get(participant.id) || [];
      });

      // Sort by most recent birthday first
      recentBirthdayParticipants.sort((a, b) => b.birthdayDate.getTime() - a.birthdayDate.getTime());

      setRecentBirthdays(recentBirthdayParticipants);
    } catch (err: any) {
      console.error('Error fetching recent birthdays:', err);
      setError(err.message || 'Failed to load recent birthdays');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getDaysAgoText = (daysAgo: number) => {
    if (daysAgo === 0) return 'Today';
    if (daysAgo === 1) return '1 day ago';
    return `${daysAgo} days ago`;
  };

  const fetchUpcomingBirthdays = async () => {
    try {
      setLoadingUpcoming(true);
      setErrorUpcoming(null);

      // First, get all participant IDs that have Medicare plans
      const { data: medicareData, error: medicareError } = await supabase
        .from('participant_medicare_plans')
        .select('participant_id');

      if (medicareError) {
        throw medicareError;
      }

      const medicareParticipantIds = new Set<string>();
      (medicareData || []).forEach((plan: any) => {
        medicareParticipantIds.add(plan.participant_id);
      });

      // If no participants have Medicare plans, return early
      if (medicareParticipantIds.size === 0) {
        setUpcomingBirthdays([]);
        setLoadingUpcoming(false);
        return;
      }

      // Fetch participants with Medicare plans and DOB
      const { data, error: fetchError } = await supabase
        .from('participants')
        .select('id, client_name, dob, email_address, phone_number')
        .not('dob', 'is', null)
        .in('id', Array.from(medicareParticipantIds));

      if (fetchError) {
        throw fetchError;
      }

      const participants = (data || []) as Participant[];
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize to start of day
      const sixtyDaysFromNow = new Date(today);
      sixtyDaysFromNow.setDate(today.getDate() + 60);

      // Filter participants whose birthday will occur in the next 60 days
      const upcomingBirthdayParticipants: ParticipantWithUpcomingBirthday[] = [];
      const participantIdsToFetchPlans: string[] = [];

      // First pass: identify participants with upcoming birthdays
      for (const participant of participants) {
        if (!participant.dob) continue;

        const dob = new Date(participant.dob);
        const currentYear = today.getFullYear();
        
        // Create birthday date for this year
        const thisYearBirthday = new Date(currentYear, dob.getMonth(), dob.getDate());
        thisYearBirthday.setHours(0, 0, 0, 0);
        
        // Create birthday date for next year (in case we're late in the year)
        const nextYearBirthday = new Date(currentYear + 1, dob.getMonth(), dob.getDate());
        nextYearBirthday.setHours(0, 0, 0, 0);

        let birthdayDate: Date | null = null;
        let daysUntil: number | null = null;

        // Check if this year's birthday is within the next 60 days
        if (thisYearBirthday > today && thisYearBirthday <= sixtyDaysFromNow) {
          daysUntil = Math.floor((thisYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          birthdayDate = thisYearBirthday;
        }
        // Check if next year's birthday is within the next 60 days (handles year boundary)
        else if (nextYearBirthday > today && nextYearBirthday <= sixtyDaysFromNow) {
          daysUntil = Math.floor((nextYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          birthdayDate = nextYearBirthday;
        }

        if (birthdayDate !== null && daysUntil !== null) {
          upcomingBirthdayParticipants.push({
            ...participant,
            birthdayDate,
            daysUntil,
            activePlans: [], // Will be populated below
          });
          participantIdsToFetchPlans.push(participant.id);
        }
      }

      // Batch fetch all active plans for all participants at once
      const plansMap = await fetchActivePlansForParticipants(participantIdsToFetchPlans);

      // Map plans to participants
      upcomingBirthdayParticipants.forEach(participant => {
        participant.activePlans = plansMap.get(participant.id) || [];
      });

      // Sort by soonest birthday first
      upcomingBirthdayParticipants.sort((a, b) => a.birthdayDate.getTime() - b.birthdayDate.getTime());

      setUpcomingBirthdays(upcomingBirthdayParticipants);
    } catch (err: any) {
      console.error('Error fetching upcoming birthdays:', err);
      setErrorUpcoming(err.message || 'Failed to load upcoming birthdays');
    } finally {
      setLoadingUpcoming(false);
    }
  };

  const getDaysUntilText = (daysUntil: number) => {
    if (daysUntil === 0) return 'Today';
    if (daysUntil === 1) return 'In 1 day';
    return `In ${daysUntil} days`;
  };

  const fetchGroupParticipantsTurning65 = async () => {
    try {
      setLoadingTurning65(true);
      setErrorTurning65(null);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const ninetyDaysFromNow = new Date(today);
      ninetyDaysFromNow.setDate(today.getDate() + 90);

      // First, get all participants with active Medicare plans
      const { data: medicarePlans, error: medicareError } = await supabase
        .from('participant_medicare_plans')
        .select('participant_id, effective_date');

      if (medicareError) {
        throw medicareError;
      }

      const participantsWithActiveMedicarePlans = new Set<string>();
      (medicarePlans || []).forEach((plan: any) => {
        if (plan.participant_id) {
          if (plan.effective_date) {
            const effectiveDate = new Date(plan.effective_date);
            effectiveDate.setHours(0, 0, 0, 0);
            
            // If effective_date is today or in the past, consider it active
            if (effectiveDate <= today) {
              participantsWithActiveMedicarePlans.add(plan.participant_id);
            }
          } else {
            // If no effective_date, consider it active (legacy data)
            participantsWithActiveMedicarePlans.add(plan.participant_id);
          }
        }
      });

      // Fetch group participants (where group_id is not null) with DOB
      const { data, error: fetchError } = await supabase
        .from('participants')
        .select('id, client_name, dob, email_address, phone_number, group_id')
        .not('dob', 'is', null)
        .not('group_id', 'is', null);

      if (fetchError) {
        throw fetchError;
      }

      const participants = (data || []) as Participant[];
      
      // Filter participants who don't have active Medicare plans and calculate their 65th birthday
      const turning65ParticipantsList: ParticipantTurning65[] = [];

      participants.forEach((participant) => {
        // Skip if participant has an active Medicare plan
        if (participantsWithActiveMedicarePlans.has(participant.id)) {
          return;
        }

        if (!participant.dob) return;

        const dob = new Date(participant.dob);
        
        // Calculate 65th birthday
        const turning65Date = new Date(dob.getFullYear() + 65, dob.getMonth(), dob.getDate());
        turning65Date.setHours(0, 0, 0, 0);

        // Check if 65th birthday is within the next 90 days (including today)
        if (turning65Date >= today && turning65Date <= ninetyDaysFromNow) {
          const daysUntil65 = Math.floor((turning65Date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          turning65ParticipantsList.push({
            ...participant,
            turning65Date,
            daysUntil65,
          });
        }
      });

      // Sort by soonest 65th birthday first
      turning65ParticipantsList.sort((a, b) => a.turning65Date.getTime() - b.turning65Date.getTime());

      setTurning65Participants(turning65ParticipantsList);
    } catch (err: any) {
      console.error('Error fetching group participants turning 65:', err);
      setErrorTurning65(err.message || 'Failed to load group participants turning 65');
    } finally {
      setLoadingTurning65(false);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      setLoadingStats(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      // 1. Total Groups with active plans
      // A plan is active if: effective_date <= today AND (termination_date is null OR termination_date >= today)
      const { data: activeGroupPlans, error: groupsError } = await supabase
        .from('group_plans')
        .select('group_id, program_id, effective_date, termination_date')
        .lte('effective_date', todayStr)
        .or(`termination_date.is.null,termination_date.gte.${todayStr}`);

      if (groupsError) {
        throw groupsError;
      }

      // Count distinct group_ids
      const uniqueGroupIds = new Set<string>();
      (activeGroupPlans || []).forEach((plan: any) => {
        if (plan.group_id) {
          uniqueGroupIds.add(plan.group_id);
        }
      });
      setTotalGroups(uniqueGroupIds.size);

      // 2. Total Participants with active plans
      // First, get participants with active group plans
      const { data: participantGroupPlans, error: pgpError } = await supabase
        .from('participant_group_plans')
        .select(`
          participant_id,
          termination_date,
          group_plan:group_plans (
            termination_date
          )
        `)
        .or(`termination_date.is.null,termination_date.gte.${todayStr}`);

      if (pgpError) {
        throw pgpError;
      }

      const participantsWithActiveGroupPlans = new Set<string>();
      (participantGroupPlans || []).forEach((plan: any) => {
        const participantTerminationDate = plan.termination_date 
          ? new Date(plan.termination_date)
          : null;
        const groupPlanTerminationDate = plan.group_plan?.termination_date 
          ? new Date(plan.group_plan.termination_date)
          : null;
        
        // Plan is active if both termination dates are null or in the future
        const isActive = (!participantTerminationDate || participantTerminationDate >= today) &&
                         (!groupPlanTerminationDate || groupPlanTerminationDate >= today);
        
        if (isActive && plan.participant_id) {
          participantsWithActiveGroupPlans.add(plan.participant_id);
        }
      });

      // Get participants with active Medicare plans
      // A plan is active if effective_date is today or in the past (or null for legacy data)
      const { data: medicarePlans, error: medicareError } = await supabase
        .from('participant_medicare_plans')
        .select('participant_id, effective_date');

      if (medicareError) {
        throw medicareError;
      }

      const participantsWithActiveMedicarePlans = new Set<string>();
      (medicarePlans || []).forEach((plan: any) => {
        if (plan.participant_id) {
          if (plan.effective_date) {
            const effectiveDate = new Date(plan.effective_date);
            effectiveDate.setHours(0, 0, 0, 0);
            
            // If effective_date is today or in the past, consider it active
            if (effectiveDate <= today) {
              participantsWithActiveMedicarePlans.add(plan.participant_id);
            }
          } else {
            // If no effective_date, consider it active (legacy data)
            participantsWithActiveMedicarePlans.add(plan.participant_id);
          }
        }
      });

      // Set total to only count participants with active Medicare plans
      setTotalParticipants(participantsWithActiveMedicarePlans.size);

      // 3. Active Programs - count all program_ids from active group plans (not distinct)
      // This counts programs per group, so if Group A has 3 programs with active plans, that's 3
      let programCount = 0;
      (activeGroupPlans || []).forEach((plan: any) => {
        if (plan.program_id) {
          programCount++;
        }
      });
      setActivePrograms(programCount);

    } catch (err: any) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };


  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
          Dashboard
        </h1>
        <p className="text-[var(--glass-gray-medium)]">
          Welcome to BIG CRM - Sales Pipeline & Account Management
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <GlassCard className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--glass-gray-medium)] mb-1">
                Total Groups
              </p>
              <p className="text-3xl font-bold text-[var(--glass-black-dark)]">
                {loadingStats ? '...' : totalGroups}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--glass-gray-medium)] mb-1">
                Total Medicare Clients
              </p>
              <p className="text-3xl font-bold text-[var(--glass-black-dark)]">
                {loadingStats ? '...' : totalParticipants}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--glass-gray-medium)] mb-1">
                Active Programs
              </p>
              <p className="text-3xl font-bold text-[var(--glass-black-dark)]">
                {loadingStats ? '...' : activePrograms}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Recent Medicare Birthdays */}
      <GlassCard className="mb-8">
        <h2 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-4">
          Recent Medicare Birthdays (Last 60 Days)
        </h2>
        
        {loading && (
          <p className="text-[var(--glass-gray-medium)] py-4">
            Loading recent Medicare birthdays...
          </p>
        )}

        {error && (
          <p className="text-red-500 py-4">
            Error: {error}
          </p>
        )}

        {!loading && !error && recentBirthdays.length === 0 && (
          <p className="text-[var(--glass-gray-medium)] py-4">
            No Medicare participants have had birthdays in the last 60 days.
          </p>
        )}

        {!loading && !error && recentBirthdays.length > 0 && (
          <div className="space-y-4">
            {recentBirthdays.map((participant) => (
              <div
                key={participant.id}
                className="p-4 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                onClick={() => router.push(`/participants/${participant.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-[var(--glass-black-dark)] mb-1">
                      {participant.client_name}
                    </h3>
                    <div className="flex flex-wrap gap-4 text-sm text-[var(--glass-gray-medium)]">
                      <span>
                        Birthday: <span className="text-[var(--glass-black-dark)]">{formatDate(participant.birthdayDate)}</span>
                      </span>
                      <span className="text-[var(--glass-black-dark)] font-medium">
                        {getDaysAgoText(participant.daysAgo)}
                      </span>
                      {participant.email_address && (
                        <span>
                          Email: <span className="text-[var(--glass-black-dark)]">{participant.email_address}</span>
                        </span>
                      )}
                      {participant.phone_number && (
                        <span>
                          Phone: <span className="text-[var(--glass-black-dark)]">{participant.phone_number}</span>
                        </span>
                      )}
                    </div>
                    {participant.activePlans && participant.activePlans.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-white/10">
                        <span className="text-xs text-[var(--glass-gray-medium)] font-medium">Active Plans: </span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {participant.activePlans.map((plan) => (
                            <span
                              key={plan.id}
                              className="inline-flex items-center px-2 py-1 rounded text-xs bg-white/10 text-[var(--glass-black-dark)] border border-white/20"
                            >
                              {plan.planName} ({plan.providerName})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Upcoming Medicare Birthdays */}
      <GlassCard className="mb-8">
        <h2 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-4">
          Upcoming Medicare Birthdays (Next 60 Days)
        </h2>
        
        {loadingUpcoming && (
          <p className="text-[var(--glass-gray-medium)] py-4">
            Loading upcoming Medicare birthdays...
          </p>
        )}

        {errorUpcoming && (
          <p className="text-red-500 py-4">
            Error: {errorUpcoming}
          </p>
        )}

        {!loadingUpcoming && !errorUpcoming && upcomingBirthdays.length === 0 && (
          <p className="text-[var(--glass-gray-medium)] py-4">
            No Medicare participants have birthdays in the next 60 days.
          </p>
        )}

        {!loadingUpcoming && !errorUpcoming && upcomingBirthdays.length > 0 && (
          <div className="space-y-4">
            {upcomingBirthdays.map((participant) => (
              <div
                key={participant.id}
                className="p-4 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                onClick={() => router.push(`/participants/${participant.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-[var(--glass-black-dark)] mb-1">
                      {participant.client_name}
                    </h3>
                    <div className="flex flex-wrap gap-4 text-sm text-[var(--glass-gray-medium)]">
                      <span>
                        Birthday: <span className="text-[var(--glass-black-dark)]">{formatDate(participant.birthdayDate)}</span>
                      </span>
                      <span className="text-[var(--glass-black-dark)] font-medium">
                        {getDaysUntilText(participant.daysUntil)}
                      </span>
                      {participant.email_address && (
                        <span>
                          Email: <span className="text-[var(--glass-black-dark)]">{participant.email_address}</span>
                        </span>
                      )}
                      {participant.phone_number && (
                        <span>
                          Phone: <span className="text-[var(--glass-black-dark)]">{participant.phone_number}</span>
                        </span>
                      )}
                    </div>
                    {participant.activePlans && participant.activePlans.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-white/10">
                        <span className="text-xs text-[var(--glass-gray-medium)] font-medium">Active Plans: </span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {participant.activePlans.map((plan) => (
                            <span
                              key={plan.id}
                              className="inline-flex items-center px-2 py-1 rounded text-xs bg-white/10 text-[var(--glass-black-dark)] border border-white/20"
                            >
                              {plan.planName} ({plan.providerName})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Group Participants Turning 65 */}
      <GlassCard>
        <h2 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-4">
          Group Participants Turning 65 (Next 90 Days)
        </h2>
        
        {loadingTurning65 && (
          <p className="text-[var(--glass-gray-medium)] py-4">
            Loading group participants turning 65...
          </p>
        )}

        {errorTurning65 && (
          <p className="text-red-500 py-4">
            Error: {errorTurning65}
          </p>
        )}

        {!loadingTurning65 && !errorTurning65 && turning65Participants.length === 0 && (
          <p className="text-[var(--glass-gray-medium)] py-4">
            No group participants are turning 65 in the next 90 days without an active Medicare plan.
          </p>
        )}

        {!loadingTurning65 && !errorTurning65 && turning65Participants.length > 0 && (
          <div className="space-y-4">
            {turning65Participants.map((participant) => (
              <div
                key={participant.id}
                className="p-4 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                onClick={() => router.push(`/participants/${participant.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-[var(--glass-black-dark)] mb-1">
                      {participant.client_name}
                    </h3>
                    <div className="flex flex-wrap gap-4 text-sm text-[var(--glass-gray-medium)]">
                      <span>
                        Turning 65: <span className="text-[var(--glass-black-dark)]">{formatDate(participant.turning65Date)}</span>
                      </span>
                      <span className="text-[var(--glass-black-dark)] font-medium">
                        {getDaysUntilText(participant.daysUntil65)}
                      </span>
                      {participant.email_address && (
                        <span>
                          Email: <span className="text-[var(--glass-black-dark)]">{participant.email_address}</span>
                        </span>
                      )}
                      {participant.phone_number && (
                        <span>
                          Phone: <span className="text-[var(--glass-black-dark)]">{participant.phone_number}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
