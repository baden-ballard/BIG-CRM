'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import GlassCard from '../../../components/GlassCard';
import { supabase } from '../../../lib/supabase';

interface MedicareReportRow {
  participant_id: string;
  employee: string;
  active_medicare_plans: string;
  email: string | null;
  phone: string | null;
  dob: string | null;
}

type StatusFilter = 'all' | 'active' | 'pending' | 'ended';

export default function MedicareDownloadReportPage() {
  const router = useRouter();
  const [reportData, setReportData] = useState<MedicareReportRow[]>([]);
  const [allReportData, setAllReportData] = useState<MedicareReportRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMedicareReport();
  }, []);

  const fetchMedicareReport = async () => {
    try {
      setLoading(true);
      setError(null);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayString = today.toISOString().split('T')[0];

      // Fetch all participants with their Medicare plans
      const { data: participantsData, error: participantsError } = await supabase
        .from('participants')
        .select(`
          id,
          client_name,
          email_address,
          phone_number,
          dob,
          participant_medicare_plans (
            id,
            effective_date,
            medicare_plan_id,
            medicare_plan:medicare_plans (
              id,
              plan_name,
              provider:providers (
                id,
                name
              )
            )
          )
        `)
        .order('client_name', { ascending: true });

      if (participantsError) {
        throw participantsError;
      }

      if (!participantsData || participantsData.length === 0) {
        setReportData([]);
        return;
      }

      // Get unique Medicare plan IDs to fetch rates
      const planIds = new Set<string>();
      participantsData.forEach((participant: any) => {
        (participant.participant_medicare_plans || []).forEach((plan: any) => {
          if (plan.medicare_plan_id) {
            planIds.add(plan.medicare_plan_id);
          }
        });
      });

      // Fetch all rates for all Medicare plans
      const ratesByPlanId = new Map<string, any[]>();
      for (const planId of planIds) {
        const { data: ratesData } = await supabase
          .from('medicare_child_rates')
          .select('*')
          .eq('medicare_plan_id', planId)
          .order('start_date', { ascending: false });
        
        if (ratesData) {
          ratesByPlanId.set(planId, ratesData);
        }
      }

      // Helper function to determine if a rate is active
      const calculateRateStatus = (startDate: string | null, endDate: string | null): 'Pending' | 'Active' | 'Ended' => {
        if (!startDate) return 'Ended';
        
        const start = new Date(startDate).toISOString().split('T')[0];
        
        // If start date is in the future, it's Pending
        if (start > todayString) {
          return 'Pending';
        }
        
        // If end date is null or in the future, it's Active
        if (!endDate || endDate >= todayString) {
          return 'Active';
        }
        
        // Otherwise, it's Ended
        return 'Ended';
      };

      // Process the data to create report rows
      const reportRows: MedicareReportRow[] = [];

      for (const participant of participantsData) {
        const medicarePlans = participant.participant_medicare_plans || [];
        
        // Include all participants with Medicare plans
        if (medicarePlans.length > 0) {
          // Format all Medicare plans as a comma-separated list
          const planNames = medicarePlans.map((plan: any) => {
            const planName = plan.medicare_plan?.plan_name || 'Unknown Plan';
            const providerName = plan.medicare_plan?.provider?.name || 'Unknown Provider';
            
            // Determine plan status
            const rates = ratesByPlanId.get(plan.medicare_plan_id) || [];
            let statusLabel = '';
            
            if (rates.length > 0) {
              // Check rate statuses
              const hasPendingRates = rates.some((rate: any) => {
                const status = calculateRateStatus(rate.start_date, rate.end_date);
                return status === 'Pending';
              });
              const hasActiveRates = rates.some((rate: any) => {
                const status = calculateRateStatus(rate.start_date, rate.end_date);
                return status === 'Active';
              });
              const hasEndedRates = rates.some((rate: any) => {
                const status = calculateRateStatus(rate.start_date, rate.end_date);
                return status === 'Ended';
              });
              
              // Determine status label based on rate statuses
              // Priority: Active/Pending > Pending > Active > Ended
              if (hasPendingRates && hasActiveRates) {
                statusLabel = ' (Active/Pending)';
              } else if (hasPendingRates) {
                statusLabel = ' (Pending)';
              } else if (hasActiveRates) {
                statusLabel = ' (Active)';
              } else if (hasEndedRates && !hasActiveRates && !hasPendingRates) {
                // Only mark as Ended if there are no active or pending rates
                statusLabel = ' (Ended)';
              } else {
                // If we have rates but can't determine status, check if all are ended
                const allRatesEnded = rates.every((rate: any) => {
                  const status = calculateRateStatus(rate.start_date, rate.end_date);
                  return status === 'Ended';
                });
                if (allRatesEnded) {
                  statusLabel = ' (Ended)';
                }
              }
            } else {
              // No rates - check effective_date
              if (plan.effective_date) {
                const effectiveDate = new Date(plan.effective_date);
                effectiveDate.setHours(0, 0, 0, 0);
                if (effectiveDate <= today) {
                  statusLabel = ' (Active)';
                } else {
                  statusLabel = ' (Pending)';
                }
              } else {
                // No effective_date and no rates - assume active
                statusLabel = ' (Active)';
              }
            }
            
            return `${planName} (${providerName})${statusLabel}`;
          });

          reportRows.push({
            participant_id: participant.id,
            employee: participant.client_name || 'Unknown',
            active_medicare_plans: planNames.join(', '),
            email: participant.email_address,
            phone: participant.phone_number,
            dob: participant.dob,
          });
        }
      }

      setAllReportData(reportRows);
      setReportData(reportRows);
    } catch (err: any) {
      console.error('Error fetching Medicare report:', err);
      setError(err.message || 'Failed to load Medicare report');
    } finally {
      setLoading(false);
    }
  };

  // Filter report data based on status filter
  useEffect(() => {
    if (statusFilter === 'all') {
      setReportData(allReportData);
      return;
    }

    const filteredData = allReportData.filter((row) => {
      // Parse the plan names to check their status
      const planStrings = row.active_medicare_plans.split(', ');
      
      return planStrings.some((planString) => {
        if (statusFilter === 'active') {
          // Show if plan has Active status (but not Ended)
          return planString.includes('(Active)') && !planString.includes('(Ended)');
        } else if (statusFilter === 'pending') {
          // Show if plan has Pending status (but not Ended)
          return planString.includes('(Pending)') && !planString.includes('(Ended)');
        } else if (statusFilter === 'ended') {
          // Show if plan has Ended status or no status label (which means ended)
          return planString.includes('(Ended)') || 
                 (!planString.includes('(Active)') && 
                  !planString.includes('(Pending)') && 
                  !planString.includes('(Active/Pending)'));
        }
        return true;
      });
    });

    setReportData(filteredData);
  }, [statusFilter, allReportData]);

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

  const downloadCSV = () => {
    if (reportData.length === 0) return;

    // Create CSV header
    const headers = ['Employee', 'Active Medicare Plans', 'Email', 'Phone', 'DOB'];
    
    // Create CSV rows
    const rows = reportData.map(row => [
      row.employee,
      `"${row.active_medicare_plans}"`, // Wrap in quotes to handle commas in plan names
      row.email || '',
      row.phone || '',
      row.dob ? formatDate(row.dob) : '',
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `medicare-report-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            Loading Medicare report...
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
              Medicare Download Report
            </h1>
            <p className="text-[var(--glass-gray-medium)]">
              Participants with Medicare plans ({reportData.length} participants)
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

        {/* Status Filter */}
        <GlassCard className="mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-semibold text-[var(--glass-black-dark)]">
              Status:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-4 py-2 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 text-[var(--glass-black-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--glass-secondary)] focus:border-transparent transition-all"
            >
              <option value="all">All Plans</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="ended">Ended</option>
            </select>
            {statusFilter !== 'all' && (
              <button
                onClick={() => setStatusFilter('all')}
                className="px-4 py-2 rounded-full text-sm font-semibold bg-gray-500/20 backdrop-blur-md border border-gray-500/30 text-[var(--glass-black-dark)] hover:bg-gray-500/30 transition-all duration-300"
              >
                Clear Filter
              </button>
            )}
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/20">
                <th className="text-left py-4 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                  Employee
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-[var(--glass-black-dark)]">
                  Active Medicare Plans
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
                  <td colSpan={5} className="text-center py-8 text-[var(--glass-gray-medium)]">
                    No participants with active or pending Medicare plans found
                  </td>
                </tr>
              ) : (
                reportData.map((row) => (
                  <tr
                    key={row.participant_id}
                    className="border-b border-white/10 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-4 px-4 text-sm text-[var(--glass-black-dark)]">
                      {row.employee}
                    </td>
                    <td className="py-4 px-4 text-sm text-[var(--glass-black-dark)]">
                      {row.active_medicare_plans}
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

