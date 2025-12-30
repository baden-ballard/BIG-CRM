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

interface ParticipantWithBirthday extends Participant {
  birthdayDate: Date;
  daysAgo: number;
}

interface ParticipantWithUpcomingBirthday extends Participant {
  birthdayDate: Date;
  daysUntil: number;
}


export default function Dashboard() {
  const router = useRouter();
  const [recentBirthdays, setRecentBirthdays] = useState<ParticipantWithBirthday[]>([]);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<ParticipantWithUpcomingBirthday[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorUpcoming, setErrorUpcoming] = useState<string | null>(null);
  const [totalGroups, setTotalGroups] = useState<number>(0);
  const [totalParticipants, setTotalParticipants] = useState<number>(0);
  const [activePrograms, setActivePrograms] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    fetchRecentBirthdays();
    fetchUpcomingBirthdays();
    fetchDashboardStats();
  }, []);

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

      participants.forEach((participant) => {
        if (!participant.dob) return;

        const dob = new Date(participant.dob);
        const currentYear = today.getFullYear();
        
        // Create birthday date for this year
        const thisYearBirthday = new Date(currentYear, dob.getMonth(), dob.getDate());
        thisYearBirthday.setHours(0, 0, 0, 0);
        
        // Create birthday date for last year (in case we're early in the year)
        const lastYearBirthday = new Date(currentYear - 1, dob.getMonth(), dob.getDate());
        lastYearBirthday.setHours(0, 0, 0, 0);

        // Check if this year's birthday is within the last 60 days
        if (thisYearBirthday <= today && thisYearBirthday >= sixtyDaysAgo) {
          const daysAgo = Math.floor((today.getTime() - thisYearBirthday.getTime()) / (1000 * 60 * 60 * 24));
          recentBirthdayParticipants.push({
            ...participant,
            birthdayDate: thisYearBirthday,
            daysAgo,
          });
        }
        // Check if last year's birthday is within the last 60 days (handles year boundary)
        else if (lastYearBirthday <= today && lastYearBirthday >= sixtyDaysAgo) {
          const daysAgo = Math.floor((today.getTime() - lastYearBirthday.getTime()) / (1000 * 60 * 60 * 24));
          recentBirthdayParticipants.push({
            ...participant,
            birthdayDate: lastYearBirthday,
            daysAgo,
          });
        }
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

      participants.forEach((participant) => {
        if (!participant.dob) return;

        const dob = new Date(participant.dob);
        const currentYear = today.getFullYear();
        
        // Create birthday date for this year
        const thisYearBirthday = new Date(currentYear, dob.getMonth(), dob.getDate());
        thisYearBirthday.setHours(0, 0, 0, 0);
        
        // Create birthday date for next year (in case we're late in the year)
        const nextYearBirthday = new Date(currentYear + 1, dob.getMonth(), dob.getDate());
        nextYearBirthday.setHours(0, 0, 0, 0);

        // Check if this year's birthday is within the next 60 days
        if (thisYearBirthday > today && thisYearBirthday <= sixtyDaysFromNow) {
          const daysUntil = Math.floor((thisYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          upcomingBirthdayParticipants.push({
            ...participant,
            birthdayDate: thisYearBirthday,
            daysUntil,
          });
        }
        // Check if next year's birthday is within the next 60 days (handles year boundary)
        else if (nextYearBirthday > today && nextYearBirthday <= sixtyDaysFromNow) {
          const daysUntil = Math.floor((nextYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          upcomingBirthdayParticipants.push({
            ...participant,
            birthdayDate: nextYearBirthday,
            daysUntil,
          });
        }
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

      // Get participants with Medicare plans (assuming all Medicare plans are active)
      const { data: medicarePlans, error: medicareError } = await supabase
        .from('participant_medicare_plans')
        .select('participant_id');

      if (medicareError) {
        throw medicareError;
      }

      const participantsWithMedicarePlans = new Set<string>();
      (medicarePlans || []).forEach((plan: any) => {
        if (plan.participant_id) {
          participantsWithMedicarePlans.add(plan.participant_id);
        }
      });

      // Combine both sets to get total unique participants with active plans
      const allParticipantsWithPlans = new Set([
        ...Array.from(participantsWithActiveGroupPlans),
        ...Array.from(participantsWithMedicarePlans)
      ]);
      setTotalParticipants(allParticipantsWithPlans.size);

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
                Total Participants
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
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Upcoming Medicare Birthdays */}
      <GlassCard>
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
