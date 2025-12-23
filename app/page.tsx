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

interface ParticipantWithEligibility {
  id: string;
  client_name: string;
  dob: string | null;
  email_address: string | null;
  phone_number: string | null;
  group_id: string;
  group_name: string;
  hire_date: string | null;
  eligibility_start_date: Date | null;
  class_number: number | null;
}

export default function Dashboard() {
  const router = useRouter();
  const [recentBirthdays, setRecentBirthdays] = useState<ParticipantWithBirthday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eligibleWithoutPlans, setEligibleWithoutPlans] = useState<ParticipantWithEligibility[]>([]);
  const [loadingEligible, setLoadingEligible] = useState(true);
  const [errorEligible, setErrorEligible] = useState<string | null>(null);

  useEffect(() => {
    fetchRecentBirthdays();
    fetchEligibleWithoutPlans();
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

  const calculateEligibilityStartDate = (hireDate: Date, eligibilityPeriod: string | null): Date | null => {
    if (!eligibilityPeriod || !hireDate) return null;

    let daysToAdd = 0;
    if (eligibilityPeriod === 'First of Month Following 30 Days') {
      daysToAdd = 30;
    } else if (eligibilityPeriod === 'First of the Month Following 60 Days') {
      daysToAdd = 60;
    }
    // For "First of Month Following Date of Hire", daysToAdd stays 0

    const eligibilityDate = new Date(hireDate);
    eligibilityDate.setDate(hireDate.getDate() + daysToAdd);
    
    // Get first of the following month
    const firstOfMonth = new Date(eligibilityDate.getFullYear(), eligibilityDate.getMonth() + 1, 1);
    firstOfMonth.setHours(0, 0, 0, 0);
    
    return firstOfMonth;
  };

  const fetchEligibleWithoutPlans = async () => {
    try {
      setLoadingEligible(true);
      setErrorEligible(null);

      // Fetch participants with groups
      const { data: participantsData, error: participantsError } = await supabase
        .from('participants')
        .select(`
          id,
          client_name,
          email_address,
          phone_number,
          group_id,
          hire_date,
          class_number,
          group:groups (
            id,
            name,
            eligibility_period,
            eligibility_period_class_2,
            eligibility_period_class_3,
            number_of_classes
          )
        `)
        .not('group_id', 'is', null)
        .not('hire_date', 'is', null);

      if (participantsError) {
        throw participantsError;
      }

      // Fetch all participants with active plans
      const { data: plansData, error: plansError } = await supabase
        .from('participant_group_plans')
        .select(`
          participant_id,
          termination_date,
          group_plan:group_plans (
            termination_date
          )
        `);

      if (plansError) {
        throw plansError;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create a set of participant IDs with active plans
      const participantsWithActivePlans = new Set<string>();
      (plansData || []).forEach((plan: any) => {
        const participantTerminationDate = plan.termination_date 
          ? new Date(plan.termination_date)
          : null;
        const groupPlanTerminationDate = plan.group_plan?.termination_date 
          ? new Date(plan.group_plan.termination_date)
          : null;
        
        // Plan is active if both termination dates are null or in the future
        const isActive = (!participantTerminationDate || participantTerminationDate >= today) &&
                         (!groupPlanTerminationDate || groupPlanTerminationDate >= today);
        
        if (isActive) {
          participantsWithActivePlans.add(plan.participant_id);
        }
      });

      // Filter participants: must be within eligibility window and have no active plans
      const eligibleParticipants: ParticipantWithEligibility[] = [];

      (participantsData || []).forEach((participant: any) => {
        // Skip if participant has active plans
        if (participantsWithActivePlans.has(participant.id)) {
          return;
        }

        const group = participant.group;
        if (!group || !participant.hire_date) return;

        const hireDate = new Date(participant.hire_date);
        hireDate.setHours(0, 0, 0, 0);

        // Determine which eligibility period to use based on class_number
        let eligibilityPeriod: string | null = null;
        if (participant.class_number === 1) {
          eligibilityPeriod = group.eligibility_period;
        } else if (participant.class_number === 2) {
          eligibilityPeriod = group.eligibility_period_class_2;
        } else if (participant.class_number === 3) {
          eligibilityPeriod = group.eligibility_period_class_3;
        } else {
          // Default to first eligibility period if class_number is null or invalid
          eligibilityPeriod = group.eligibility_period;
        }

        const eligibilityStartDate = calculateEligibilityStartDate(hireDate, eligibilityPeriod);
        
        if (!eligibilityStartDate) return;

        // Check if participant is within eligibility window (eligibility has started)
        // Since there's no explicit end date, we consider them eligible once eligibility has started
        if (eligibilityStartDate <= today) {
          eligibleParticipants.push({
            id: participant.id,
            client_name: participant.client_name,
            dob: null,
            email_address: participant.email_address,
            phone_number: participant.phone_number,
            group_id: participant.group_id,
            group_name: group.name,
            hire_date: participant.hire_date,
            eligibility_start_date: eligibilityStartDate,
            class_number: participant.class_number,
          });
        }
      });

      // Sort by eligibility start date (most recent first)
      eligibleParticipants.sort((a, b) => {
        if (!a.eligibility_start_date || !b.eligibility_start_date) return 0;
        return b.eligibility_start_date.getTime() - a.eligibility_start_date.getTime();
      });

      setEligibleWithoutPlans(eligibleParticipants);
    } catch (err: any) {
      console.error('Error fetching eligible participants without plans:', err);
      setErrorEligible(err.message || 'Failed to load eligible participants');
    } finally {
      setLoadingEligible(false);
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <GlassCard className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--glass-gray-medium)] mb-1">
                Total Groups
              </p>
              <p className="text-3xl font-bold text-[var(--glass-black-dark)]">
                0
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
                0
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
                0
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--glass-gray-medium)] mb-1">
                Pipeline Status
              </p>
              <p className="text-3xl font-bold text-[var(--glass-black-dark)]">
                0
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Recent Medicare Birthdays */}
      <GlassCard>
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

      {/* Eligible Participants Without Plans */}
      <GlassCard className="mt-8">
        <h2 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-4">
          Eligible Participants Without Plans
        </h2>
        
        {loadingEligible && (
          <p className="text-[var(--glass-gray-medium)] py-4">
            Loading eligible participants...
          </p>
        )}

        {errorEligible && (
          <p className="text-red-500 py-4">
            Error: {errorEligible}
          </p>
        )}

        {!loadingEligible && !errorEligible && eligibleWithoutPlans.length === 0 && (
          <p className="text-[var(--glass-gray-medium)] py-4">
            No eligible participants without active plans found.
          </p>
        )}

        {!loadingEligible && !errorEligible && eligibleWithoutPlans.length > 0 && (
          <div className="space-y-4">
            {eligibleWithoutPlans.map((participant) => (
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
                        Group: <span className="text-[var(--glass-black-dark)]">{participant.group_name}</span>
                      </span>
                      {participant.class_number && (
                        <span>
                          Class: <span className="text-[var(--glass-black-dark)]">{participant.class_number}</span>
                        </span>
                      )}
                      {participant.hire_date && (
                        <span>
                          Hire Date: <span className="text-[var(--glass-black-dark)]">{formatDate(new Date(participant.hire_date))}</span>
                        </span>
                      )}
                      {participant.eligibility_start_date && (
                        <span>
                          Eligibility Started: <span className="text-[var(--glass-black-dark)]">{formatDate(participant.eligibility_start_date)}</span>
                        </span>
                      )}
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
