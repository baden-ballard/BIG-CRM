'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import GlassCard from '../../../components/GlassCard';
import { supabase } from '../../../lib/supabase';

interface GroupsReportRow {
  group_id: string;
  group_name: string;
  participant_id: string;
  participant_name: string;
  class_number: number | null;
  active_group_plans: string;
  plan_ids: string[]; // Store plan IDs for filtering
  program_ids: string[]; // Store program IDs for filtering
  options: string;
  email: string | null;
  phone: string | null;
  dob: string | null;
}

interface Group {
  id: string;
  name: string;
}

interface Program {
  id: string;
  name: string;
}

interface GroupPlan {
  id: string;
  plan_name: string;
  program_id: string;
  group_id: string;
}

interface GroupPlanOption {
  id: string;
  option: string;
  group_plan_id: string;
}

export default function GroupsDownloadReportPage() {
  const router = useRouter();
  const [reportData, setReportData] = useState<GroupsReportRow[]>([]);
  const [allReportData, setAllReportData] = useState<GroupsReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [groups, setGroups] = useState<Group[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [groupPlans, setGroupPlans] = useState<GroupPlan[]>([]);
  const [groupPlanOptions, setGroupPlanOptions] = useState<GroupPlanOption[]>([]);
  
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedProgram, setSelectedProgram] = useState<string>('all');
  const [selectedPlan, setSelectedPlan] = useState<string>('all');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedOption, setSelectedOption] = useState<string>('all');

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Fetch groups, programs, and initial data
  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all groups
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('id, name')
        .order('name', { ascending: true });

      if (groupsError) throw groupsError;
      setGroups(groupsData || []);

      // Fetch all programs
      const { data: programsData, error: programsError } = await supabase
        .from('programs')
        .select('id, name')
        .order('name', { ascending: true });

      if (programsError) throw programsError;
      setPrograms(programsData || []);

      await fetchReportData();
    } catch (err: any) {
      console.error('Error fetching initial data:', err);
      setError(err.message || 'Failed to load data');
      setLoading(false);
    }
  };

  // Fetch report data
  const fetchReportData = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayString = today.toISOString().split('T')[0];

      // Fetch all participants with their group plans
      const { data: participantsData, error: participantsError } = await supabase
        .from('participants')
        .select(`
          id,
          client_name,
          email_address,
          phone_number,
          dob,
          class_number,
          group_id,
          group:groups (
            id,
            name
          ),
          participant_group_plans (
            id,
            termination_date,
            dependent_id,
            group_plan:group_plans (
              id,
              plan_name,
              program_id,
              group_id,
              termination_date,
              program:programs (
                id,
                name
              )
            ),
            group_plan_option:group_plan_options (
              id,
              option
            )
          )
        `)
        .not('group_id', 'is', null)
        .order('client_name', { ascending: true });

      if (participantsError) {
        throw participantsError;
      }

      if (!participantsData || participantsData.length === 0) {
        setAllReportData([]);
        setReportData([]);
        setLoading(false);
        return;
      }

      // Fetch all group plans for filter options
      const { data: plansData, error: plansError } = await supabase
        .from('group_plans')
        .select('id, plan_name, program_id, group_id')
        .is('termination_date', null);

      if (plansError) {
        console.error('Error fetching group plans:', plansError);
      } else {
        setGroupPlans(plansData || []);
      }

      // Fetch all group plan options
      const { data: optionsData, error: optionsError } = await supabase
        .from('group_plan_options')
        .select('id, option, group_plan_id');

      if (optionsError) {
        console.error('Error fetching group plan options:', optionsError);
      } else {
        setGroupPlanOptions(optionsData || []);
      }

      // Process the data to create report rows
      const reportRows: GroupsReportRow[] = [];

      for (const participant of participantsData) {
        const groupPlans = participant.participant_group_plans || [];
        
        // Filter for active group plans (employee plans only, not dependents)
        const activePlans = groupPlans.filter((plan: any) => {
          // Only include employee plans (dependent_id is null)
          if (plan.dependent_id) {
            return false;
          }

          // Check if participant plan is terminated
          if (plan.termination_date) {
            const terminationDate = new Date(plan.termination_date);
            terminationDate.setHours(0, 0, 0, 0);
            if (terminationDate < today) {
              return false;
            }
          }

          // Check if group plan is terminated
          if (plan.group_plan?.termination_date) {
            const groupPlanTerminationDate = new Date(plan.group_plan.termination_date);
            groupPlanTerminationDate.setHours(0, 0, 0, 0);
            if (groupPlanTerminationDate < today) {
              return false;
            }
          }

          return true;
        });

        if (activePlans.length > 0) {
          // Format active group plans as a comma-separated list
          const planNames = activePlans.map((plan: any) => {
            return plan.group_plan?.plan_name || 'Unknown Plan';
          });

          // Get plan IDs and program IDs for filtering
          const planIds = activePlans
            .map((plan: any) => plan.group_plan?.id)
            .filter(Boolean);
          
          const programIds = activePlans
            .map((plan: any) => plan.group_plan?.program_id)
            .filter(Boolean)
            .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates

          // Format options as a comma-separated list
          const optionNames = activePlans
            .map((plan: any) => plan.group_plan_option?.option)
            .filter(Boolean);

          reportRows.push({
            group_id: participant.group_id || '',
            group_name: participant.group?.name || 'Unknown Group',
            participant_id: participant.id,
            participant_name: participant.client_name || 'Unknown',
            class_number: participant.class_number,
            active_group_plans: planNames.join(', '),
            plan_ids: planIds,
            program_ids: programIds,
            options: optionNames.join(', ') || 'N/A',
            email: participant.email_address,
            phone: participant.phone_number,
            dob: participant.dob,
          });
        }
      }

      setAllReportData(reportRows);
      setReportData(reportRows);
    } catch (err: any) {
      console.error('Error fetching Groups report:', err);
      setError(err.message || 'Failed to load Groups report');
    } finally {
      setLoading(false);
    }
  };

  // Filtered programs based on selected group
  const filteredPrograms = useMemo(() => {
    if (selectedGroup === 'all') {
      return programs;
    }

    // Get programs associated with the selected group from group_plans
    const groupPlanProgramIds = groupPlans
      .filter(plan => plan.group_id === selectedGroup)
      .map(plan => plan.program_id)
      .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates

    return programs.filter(program => groupPlanProgramIds.includes(program.id));
  }, [selectedGroup, programs, groupPlans]);

  // Filtered plans based on selected group and program
  const filteredPlans = useMemo(() => {
    let filtered = groupPlans;

    if (selectedGroup !== 'all') {
      filtered = filtered.filter(plan => plan.group_id === selectedGroup);
    }

    if (selectedProgram !== 'all') {
      filtered = filtered.filter(plan => plan.program_id === selectedProgram);
    }

    return filtered;
  }, [selectedGroup, selectedProgram, groupPlans]);

  // Filtered classes based on selected group
  const filteredClasses = useMemo(() => {
    if (selectedGroup === 'all') {
      // Get all unique class numbers from all report data
      const classes = new Set<number>();
      allReportData.forEach(row => {
        if (row.class_number !== null) {
          classes.add(row.class_number);
        }
      });
      return Array.from(classes).sort();
    }

    // Get unique class numbers for the selected group
    const classes = new Set<number>();
    allReportData
      .filter(row => row.group_id === selectedGroup)
      .forEach(row => {
        if (row.class_number !== null) {
          classes.add(row.class_number);
        }
      });
    return Array.from(classes).sort();
  }, [selectedGroup, allReportData]);

  // Filtered options based on selected plan
  const filteredOptions = useMemo(() => {
    if (selectedPlan === 'all') {
      return [];
    }

    return groupPlanOptions
      .filter(option => option.group_plan_id === selectedPlan)
      .map(option => option.option)
      .filter((value, index, self) => self.indexOf(value) === index) // Remove duplicates
      .sort();
  }, [selectedPlan, groupPlanOptions]);

  // Apply filters to report data
  useEffect(() => {
    let filtered = [...allReportData];

    if (selectedGroup !== 'all') {
      filtered = filtered.filter(row => row.group_id === selectedGroup);
    }

    if (selectedProgram !== 'all') {
      // Filter by program - check if participant has plans with this program
      filtered = filtered.filter(row => {
        return row.program_ids.includes(selectedProgram);
      });
    }

    if (selectedPlan !== 'all') {
      // Filter by plan ID
      filtered = filtered.filter(row => {
        return row.plan_ids.includes(selectedPlan);
      });
    }

    if (selectedClass !== 'all') {
      const classNum = parseInt(selectedClass);
      filtered = filtered.filter(row => row.class_number === classNum);
    }

    if (selectedOption !== 'all') {
      filtered = filtered.filter(row => {
        return row.options.split(', ').includes(selectedOption);
      });
    }

    setReportData(filtered);
  }, [selectedGroup, selectedProgram, selectedPlan, selectedClass, selectedOption, allReportData, filteredPlans]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const dateOnlyMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      const localDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return localDate.toLocaleDateString();
    }
    return new Date(dateString).toLocaleDateString();
  };

  const downloadCSV = () => {
    if (reportData.length === 0) return;

    const headers = ['Group', 'Participant Name', 'Class', 'Active Group Plans', 'Options', 'Email', 'Phone', 'DOB'];
    
    const rows = reportData.map(row => [
      row.group_name,
      row.participant_name,
      row.class_number?.toString() || 'N/A',
      `"${row.active_group_plans}"`,
      `"${row.options}"`,
      row.email || '',
      row.phone || '',
      row.dob ? formatDate(row.dob) : '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `groups-report-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearFilters = () => {
    setSelectedGroup('all');
    setSelectedProgram('all');
    setSelectedPlan('all');
    setSelectedClass('all');
    setSelectedOption('all');
  };

  const hasActiveFilters = selectedGroup !== 'all' || selectedProgram !== 'all' || 
                          selectedPlan !== 'all' || selectedClass !== 'all' || selectedOption !== 'all';

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            Loading Groups report...
          </p>
        </GlassCard>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <GlassCard>
          <p className="text-red-500 text-center py-8">
            {error}
          </p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <button
          onClick={() => router.push('/participants')}
          className="text-[var(--glass-secondary)] hover:text-[var(--glass-secondary-dark)] mb-4 flex items-center gap-2"
        >
          <span>←</span> Back to Participants
        </button>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
              Groups Download Report
            </h1>
            <p className="text-[var(--glass-gray-medium)]">
              Participants with active group plans ({reportData.length} participants)
            </p>
          </div>
          <button
            onClick={downloadCSV}
            disabled={reportData.length === 0}
            className="px-6 py-3 rounded-full font-semibold bg-[var(--glass-secondary)] text-white shadow-lg hover:shadow-xl hover:opacity-90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Download CSV
          </button>
        </div>

        {/* Filters */}
        <GlassCard className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Group Filter */}
            <div>
              <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                Group
              </label>
              <select
                value={selectedGroup}
                onChange={(e) => {
                  setSelectedGroup(e.target.value);
                  setSelectedProgram('all');
                  setSelectedPlan('all');
                  setSelectedOption('all');
                }}
                className="w-full px-4 py-2 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 text-[var(--glass-black-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--glass-secondary)] focus:border-transparent transition-all"
              >
                <option value="all">All Groups</option>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>

            {/* Program Filter */}
            <div>
              <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                Program
              </label>
              <select
                value={selectedProgram}
                onChange={(e) => {
                  setSelectedProgram(e.target.value);
                  setSelectedPlan('all');
                  setSelectedOption('all');
                }}
                disabled={selectedGroup === 'all'}
                className="w-full px-4 py-2 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 text-[var(--glass-black-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--glass-secondary)] focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="all">All Programs</option>
                {filteredPrograms.map(program => (
                  <option key={program.id} value={program.id}>{program.name}</option>
                ))}
              </select>
            </div>

            {/* Plans Filter */}
            <div>
              <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                Plans
              </label>
              <select
                value={selectedPlan}
                onChange={(e) => {
                  setSelectedPlan(e.target.value);
                  setSelectedOption('all');
                }}
                disabled={selectedGroup === 'all'}
                className="w-full px-4 py-2 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 text-[var(--glass-black-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--glass-secondary)] focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="all">All Plans</option>
                {filteredPlans.map(plan => (
                  <option key={plan.id} value={plan.id}>{plan.plan_name}</option>
                ))}
              </select>
            </div>

            {/* Class Filter */}
            <div>
              <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                Class
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                disabled={selectedGroup === 'all'}
                className="w-full px-4 py-2 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 text-[var(--glass-black-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--glass-secondary)] focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="all">All Classes</option>
                {filteredClasses.map(classNum => (
                  <option key={classNum} value={classNum.toString()}>Class {classNum}</option>
                ))}
              </select>
            </div>

            {/* Option Filter */}
            <div>
              <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                Option
              </label>
              <select
                value={selectedOption}
                onChange={(e) => setSelectedOption(e.target.value)}
                disabled={selectedPlan === 'all'}
                className="w-full px-4 py-2 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 text-[var(--glass-black-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--glass-secondary)] focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="all">All Options</option>
                {filteredOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-4 pt-4 border-t border-white/20">
              <button
                onClick={clearFilters}
                className="px-4 py-2 rounded-full text-sm font-semibold bg-gray-500/20 backdrop-blur-md border border-gray-500/30 text-[var(--glass-black-dark)] hover:bg-gray-500/30 transition-all duration-300"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </GlassCard>
      </div>

      <GlassCard>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/20">
                <th className="text-left py-4 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                  Group
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                  Participant Name
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                  Class
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                  Active Group Plans
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                  Options
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                  Email
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                  Phone
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                  DOB
                </th>
              </tr>
            </thead>
            <tbody>
              {reportData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-[var(--glass-gray-medium)]">
                    No participants found matching the selected filters.
                  </td>
                </tr>
              ) : (
                reportData.map((row) => (
                  <tr
                    key={`${row.group_id}-${row.participant_id}`}
                    className="border-b border-white/10 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-4 px-4 text-sm text-[var(--glass-black-dark)]">
                      {row.group_name}
                    </td>
                    <td className="py-4 px-4 text-sm text-[var(--glass-black-dark)]">
                      {row.participant_name}
                    </td>
                    <td className="py-4 px-4 text-sm text-[var(--glass-black-dark)]">
                      {row.class_number !== null ? `Class ${row.class_number}` : 'N/A'}
                    </td>
                    <td className="py-4 px-4 text-sm text-[var(--glass-black-dark)]">
                      {row.active_group_plans}
                    </td>
                    <td className="py-4 px-4 text-sm text-[var(--glass-black-dark)]">
                      {row.options}
                    </td>
                    <td className="py-4 px-4 text-sm text-[var(--glass-black-dark)]">
                      {row.email || 'N/A'}
                    </td>
                    <td className="py-4 px-4 text-sm text-[var(--glass-black-dark)]">
                      {row.phone || 'N/A'}
                    </td>
                    <td className="py-4 px-4 text-sm text-[var(--glass-black-dark)]">
                      {formatDate(row.dob)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}

