import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import * as XLSX from 'xlsx';

interface CSVRow {
  participant: string;
  dateOfBirth: string; // Participant DOB
  phoneNumber: string;
  emailAddress: string;
  address: string;
  hireDate: string;
  terminationDate: string;
  class: string;
  planName: string;
  option: string;
  rate: string;
  dependentName: string;
  dependentRelationship: string;
  dependentDateOfBirth: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  result.push(current.trim());
  
  return result;
}

function parseCSV(csvText: string): CSVRow[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row');
  }

  // Parse header row
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/^"|"$/g, ''));
  
  // Expected headers (case-insensitive) - plan fields are optional for dependent rows
  const expectedHeaders = [
    'participant',
    'date of birth (participant)',
    'phone number',
    'email address',
    'address',
    'hire date',
    'termination date',
    'class',
    'plan name',
    'option',
    'rate',
    'name (dependent)',
    'relationship to partcipant', // Note: typo in Excel file
    'date of birth (dependant)' // Note: spelling in Excel file
  ];

  // Also check for alternative header names
  const headerAliases: Record<string, string[]> = {
    'date of birth (participant)': ['date of birth', 'participant date of birth', 'dob (participant)'],
    'date of birth (dependant)': ['date of birth (dependent)', 'dependent date of birth', 'dob (dependent)', 'dob (dependant)'],
    'relationship to partcipant': ['relationship', 'relationship to participant', 'relationship to partcipant'],
    'name (dependent)': ['dependent name', 'name', 'dependent'],
    'class': ['class (1,2 or, 3)', 'class (1,2 or 3)']
  };

  // Map headers to indices
  const headerMap: Record<string, number> = {};
  expectedHeaders.forEach(expected => {
    // Try exact match first
    let index = headers.findIndex(h => {
      const normalizedH = h.replace(/^"|"$/g, '').trim();
      return normalizedH === expected || normalizedH === expected.replace(/\s+/g, '');
    });
    
    // Try aliases if exact match failed
    if (index === -1 && headerAliases[expected]) {
      for (const alias of headerAliases[expected]) {
        index = headers.findIndex(h => {
          const normalizedH = h.replace(/^"|"$/g, '').trim();
          return normalizedH === alias || normalizedH === alias.replace(/\s+/g, '');
        });
        if (index !== -1) break;
      }
    }
    
    // Only require participant and date of birth - others are optional
    if (index === -1 && (expected === 'participant' || expected === 'date of birth (participant)' || expected === 'date of birth')) {
      throw new Error(`Missing required column: ${expected}`);
    }
    
    if (index !== -1) {
      headerMap[expected] = index;
    }
  });

  // Parse data rows
  const rows: CSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, ''));
    
    // Get participant DOB - try both column names
    const participantDOB = values[headerMap['date of birth (participant)']] || 
                           values[headerMap['date of birth']] || '';

    rows.push({
      participant: values[headerMap['participant']] || '',
      dateOfBirth: participantDOB,
      phoneNumber: values[headerMap['phone number']] || '',
      emailAddress: values[headerMap['email address']] || '',
      address: values[headerMap['address']] || '',
      hireDate: values[headerMap['hire date']] || '',
      terminationDate: values[headerMap['termination date']] || '',
      class: values[headerMap['class']] || '',
      planName: values[headerMap['plan name']] || '',
      option: values[headerMap['option']] || '',
      rate: values[headerMap['rate']] || '',
      dependentName: values[headerMap['name (dependent)']] || '',
      dependentRelationship: values[headerMap['relationship to partcipant']] || '',
      dependentDateOfBirth: values[headerMap['date of birth (dependant)']] || '',
    });
  }

  return rows;
}

function parseExcel(buffer: ArrayBuffer): CSVRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON with header row
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
  
  if (data.length < 2) {
    throw new Error('Excel file must have at least a header row and one data row');
  }

  // Parse header row
  const headers = data[0].map((h: any) => String(h).toLowerCase().trim());
  
  // Expected headers (case-insensitive) - plan fields are optional for dependent rows
  const expectedHeaders = [
    'participant',
    'date of birth (participant)',
    'phone number',
    'email address',
    'address',
    'hire date',
    'termination date',
    'class',
    'plan name',
    'option',
    'rate',
    'name (dependent)',
    'relationship to partcipant', // Note: typo in Excel file
    'date of birth (dependant)' // Note: spelling in Excel file
  ];

  // Also check for alternative header names
  const headerAliases: Record<string, string[]> = {
    'date of birth (participant)': ['date of birth', 'participant date of birth', 'dob (participant)'],
    'date of birth (dependant)': ['date of birth (dependent)', 'dependent date of birth', 'dob (dependent)', 'dob (dependant)'],
    'relationship to partcipant': ['relationship', 'relationship to participant', 'relationship to partcipant'],
    'name (dependent)': ['dependent name', 'name', 'dependent'],
    'class': ['class (1,2 or, 3)', 'class (1,2 or 3)']
  };

  // Map headers to indices
  const headerMap: Record<string, number> = {};
  expectedHeaders.forEach(expected => {
    // Try exact match first
    let index = headers.findIndex(h => {
      const normalizedH = String(h).trim();
      return normalizedH === expected || normalizedH === expected.replace(/\s+/g, '');
    });
    
    // Try aliases if exact match failed
    if (index === -1 && headerAliases[expected]) {
      for (const alias of headerAliases[expected]) {
        index = headers.findIndex(h => {
          const normalizedH = String(h).trim();
          return normalizedH === alias || normalizedH === alias.replace(/\s+/g, '');
        });
        if (index !== -1) break;
      }
    }
    
    // Only require participant and date of birth - others are optional
    if (index === -1 && (expected === 'participant' || expected === 'date of birth (participant)' || expected === 'date of birth')) {
      throw new Error(`Missing required column: ${expected}`);
    }
    
    if (index !== -1) {
      headerMap[expected] = index;
    }
  });

  // Parse data rows
  const rows: CSVRow[] = [];
  for (let i = 1; i < data.length; i++) {
    const values = data[i].map((v: any) => {
      // Preserve 0 values - only use '' for null/undefined
      if (v == null) return '';
      return String(v).trim();
    });
    
    // Get participant DOB - try both column names
    const participantDOB = values[headerMap['date of birth (participant)']] || 
                           values[headerMap['date of birth']] || '';

    rows.push({
      participant: values[headerMap['participant']] || '',
      dateOfBirth: participantDOB,
      phoneNumber: values[headerMap['phone number']] || '',
      emailAddress: values[headerMap['email address']] || '',
      address: values[headerMap['address']] || '',
      hireDate: values[headerMap['hire date']] || '',
      terminationDate: values[headerMap['termination date']] || '',
      class: values[headerMap['class']] || '',
      planName: values[headerMap['plan name']] || '',
      option: values[headerMap['option']] || '',
      rate: values[headerMap['rate']] ?? '',
      dependentName: values[headerMap['name (dependent)']] || '',
      dependentRelationship: values[headerMap['relationship to partcipant']] || '',
      dependentDateOfBirth: values[headerMap['date of birth (dependant)']] || '',
    });
  }

  return rows;
}

function normalizeDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  const dateStrTrimmed = dateStr.trim();
  
  // Helper function to convert 2-digit year to 4-digit year
  const convertYear = (year: number): number => {
    if (year < 100) {
      // 2-digit year: if < 50, assume 20XX (2000-2049), else assume 19XX (1950-1999)
      return year < 50 ? 2000 + year : 1900 + year;
    }
    return year;
  };
  
  // Try MM/DD/YYYY or DD/MM/YYYY
  if (dateStrTrimmed.includes('/')) {
    const parts = dateStrTrimmed.split('/').map(Number);
    if (parts.length === 3) {
      if (parts[0] > 12) {
        // DD/MM/YYYY format
        const [day, month, year] = parts;
        const fullYear = convertYear(year);
        return `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      } else {
        // Assume MM/DD/YYYY format
        const [month, day, year] = parts;
        const fullYear = convertYear(year);
        return `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
  }
  
  // Try YYYY-MM-DD format
  if (dateStrTrimmed.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStrTrimmed;
  }
  
  // Try parsing as Date object
  const date = new Date(dateStrTrimmed);
  if (!isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return null;
}

// Helper function to calculate age as of a specific date
function calculateAgeAsOf(dob: string, asOfDate: string): number | null {
  if (!dob || !asOfDate) return null;
  
  const birthDate = new Date(dob);
  const asOf = new Date(asOfDate);
  
  if (isNaN(birthDate.getTime()) || isNaN(asOf.getTime())) return null;
  
  let age = asOf.getFullYear() - birthDate.getFullYear();
  const monthDiff = asOf.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

// Helper function to find matching age option for Age Banded plans
function findMatchingAgeOption(age: number, options: Array<{ id: string; option: string }>): { id: string; option: string } | null {
  // Try to find exact match first
  const exactMatch = options.find(opt => {
    const optionAge = parseInt(opt.option);
    return !isNaN(optionAge) && optionAge === age;
  });
  if (exactMatch) return exactMatch;

  // Find the closest age option (round down to nearest age band)
  const ageOptions = options
    .map(opt => {
      const optionAge = parseInt(opt.option);
      return isNaN(optionAge) ? null : { option: opt, age: optionAge };
    })
    .filter((item): item is { option: { id: string; option: string }; age: number } => item !== null)
    .sort((a, b) => b.age - a.age); // Sort descending

  // Find the highest age band that the person fits into
  for (const item of ageOptions) {
    if (age >= item.age) {
      return item.option;
    }
  }

  // If no match found, return the lowest age option
  return ageOptions.length > 0 ? ageOptions[ageOptions.length - 1].option : null;
}

// Helper function to find active rate for a given date
function findActiveRateForDate(rates: Array<{ id: string; rate: number; start_date: string | null; end_date: string | null }>, effectiveDate: string): { id: string; rate: number; start_date: string | null; end_date: string | null } | null {
  if (!effectiveDate || rates.length === 0) return null;

  const effectiveDateStr = effectiveDate.split('T')[0];

  // Find rates where the effective_date falls within the rate period
  const activeRates = rates.filter(rate => {
    const startDateStr = rate.start_date ? rate.start_date.split('T')[0] : null;
    const endDateStr = rate.end_date ? rate.end_date.split('T')[0] : null;

    const isEffectiveStartValid = !startDateStr || effectiveDateStr >= startDateStr;
    const isEffectiveEndValid = !endDateStr || effectiveDateStr <= endDateStr;

    return isEffectiveStartValid && isEffectiveEndValid;
  });

  // Return the most recent active rate (by start_date)
  if (activeRates.length > 0) {
    return activeRates.reduce((latest, current) => {
      const latestStart = latest.start_date ? latest.start_date.split('T')[0] : '';
      const currentStart = current.start_date ? current.start_date.split('T')[0] : '';
      return currentStart > latestStart ? current : latest;
    });
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const groupId = formData.get('groupId') as string;
    const planStartDate = formData.get('planStartDate') as string;

    if (!file || !groupId || !planStartDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check file type
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    const isCSV = fileName.endsWith('.csv') || file.type === 'text/csv';

    if (!isExcel && !isCSV) {
      return NextResponse.json(
        { error: 'File must be CSV or Excel format (.csv, .xlsx, .xls)' },
        { status: 400 }
      );
    }

    // Parse file based on type
    let rows: CSVRow[];
    if (isExcel) {
      const buffer = await file.arrayBuffer();
      rows = parseExcel(buffer);
    } else {
      const csvText = await file.text();
      rows = parseCSV(csvText);
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No data rows found in file' },
        { status: 400 }
      );
    }

    const details: string[] = [];
    let processed = 0;
    let errors = 0;

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because row 1 is header, and we're 0-indexed

      try {
        // Check if this is a dependent row (all three dependent fields present)
        const isDependentRow = row.dependentName && row.dependentName.trim() !== '' &&
                              row.dependentRelationship && row.dependentRelationship.trim() !== '' &&
                              row.dependentDateOfBirth && row.dependentDateOfBirth.trim() !== '';

        if (isDependentRow) {
          // Process as dependent row
          if (!row.participant || !row.dateOfBirth) {
            details.push(`Row ${rowNum}: Missing required fields for dependent (Participant Name and Participant Date of Birth)`);
            errors++;
            continue;
          }

          // Normalize participant DOB
          const participantDOB = normalizeDate(row.dateOfBirth);
          if (!participantDOB) {
            details.push(`Row ${rowNum}: Invalid Participant Date of Birth format: ${row.dateOfBirth}`);
            errors++;
            continue;
          }

          // Find participant by name and DOB
          const { data: participants, error: participantError } = await supabase
            .from('participants')
            .select('id')
            .eq('client_name', row.participant.trim())
            .eq('dob', participantDOB)
            .limit(1);

          if (participantError) {
            throw participantError;
          }

          if (!participants || participants.length === 0) {
            details.push(`Row ${rowNum}: Participant "${row.participant}" (DOB: ${participantDOB}) not found. Dependents must come after their participant in the file.`);
            errors++;
            continue;
          }

          const participantId = participants[0].id;

          // Normalize dependent DOB
          const dependentDOB = normalizeDate(row.dependentDateOfBirth);
          if (!dependentDOB) {
            details.push(`Row ${rowNum}: Invalid Dependent Date of Birth format: ${row.dependentDateOfBirth}`);
            errors++;
            continue;
          }

          // Validate relationship
          const relationship = row.dependentRelationship.trim();
          if (relationship !== 'Spouse' && relationship !== 'Child') {
            details.push(`Row ${rowNum}: Invalid relationship "${relationship}". Must be "Spouse" or "Child"`);
            errors++;
            continue;
          }

          // Check if dependent already exists (by participant, name, and DOB)
          const { data: existingDependents, error: dependentCheckError } = await supabase
            .from('dependents')
            .select('id')
            .eq('participant_id', participantId)
            .eq('name', row.dependentName.trim())
            .eq('dob', dependentDOB)
            .limit(1);

          if (dependentCheckError) {
            throw dependentCheckError;
          }

          if (existingDependents && existingDependents.length > 0) {
            details.push(`Row ${rowNum}: Dependent "${row.dependentName}" already exists for participant "${row.participant}"`);
            errors++;
            continue;
          }

          // Create dependent
          const { data: newDependent, error: dependentInsertError } = await supabase
            .from('dependents')
            .insert([{
              participant_id: participantId,
              relationship: relationship,
              name: row.dependentName.trim(),
              dob: dependentDOB,
            }])
            .select()
            .single();

          if (dependentInsertError) {
            throw dependentInsertError;
          }

          // Find participant's active group plans and connect dependent to rates
          // Get participant's group_id
          const { data: participantData, error: participantDataError } = await supabase
            .from('participants')
            .select('group_id')
            .eq('id', participantId)
            .single();

          if (participantDataError) {
            throw participantDataError;
          }

          if (participantData?.group_id) {
            // Find all plans for this group (both Age Banded and Composite)
            const { data: groupPlans, error: groupPlansError } = await supabase
              .from('group_plans')
              .select('id, plan_name, plan_type, effective_date')
              .eq('group_id', participantData.group_id)
              .in('plan_type', ['Age Banded', 'Composite']);

            if (groupPlansError) {
              console.error('Error fetching group plans for dependent:', groupPlansError);
              // Don't fail, just log
            } else if (groupPlans && groupPlans.length > 0) {
              // Process each plan
              for (const groupPlan of groupPlans) {
                // Check if participant already has this plan
                const { data: existingParticipantPlans, error: existingPlansError } = await supabase
                  .from('participant_group_plans')
                  .select('id, effective_date, group_plan_option_id, group_option_rate_id')
                  .eq('participant_id', participantId)
                  .eq('group_plan_id', groupPlan.id)
                  .is('dependent_id', null) // Only check employee plans
                  .limit(1);

                if (existingPlansError) {
                  console.error('Error checking existing participant plans:', existingPlansError);
                  continue;
                }

                if (!existingParticipantPlans || existingParticipantPlans.length === 0) {
                  // Participant doesn't have this plan yet, skip dependent connection
                  continue;
                }

                const participantPlan = existingParticipantPlans[0];
                const effectiveDate = participantPlan.effective_date || planStartDate.split('T')[0];

                // Check if dependent plan record already exists
                const { data: existingDependentPlan, error: checkDependentPlanError } = await supabase
                  .from('participant_group_plans')
                  .select('id')
                  .eq('participant_id', participantId)
                  .eq('group_plan_id', groupPlan.id)
                  .eq('dependent_id', newDependent.id)
                  .limit(1);

                if (checkDependentPlanError) {
                  console.error('Error checking existing dependent plan:', checkDependentPlanError);
                  continue;
                }

                if (existingDependentPlan && existingDependentPlan.length > 0) {
                  // Dependent plan already exists, skip
                  continue;
                }

                let matchingOptionId: string | null = null;
                let activeRate: { id: string; rate: number; start_date: string | null; end_date: string | null } | null = null;

                if (groupPlan.plan_type === 'Age Banded') {
                  // For Age Banded plans: find rate based on dependent's age
                  // Get plan options
                  const { data: planOptions, error: optionsError } = await supabase
                    .from('group_plan_options')
                    .select('id, option')
                    .eq('group_plan_id', groupPlan.id);

                  if (optionsError || !planOptions || planOptions.length === 0) {
                    continue;
                  }

                  // Calculate dependent's age as of effective date
                  const dependentAge = calculateAgeAsOf(dependentDOB, effectiveDate);
                  if (dependentAge === null) {
                    details.push(`Row ${rowNum}: Could not calculate age for dependent "${row.dependentName}" - skipping plan connection`);
                    continue;
                  }

                  // Find matching age option
                  const matchingOption = findMatchingAgeOption(dependentAge, planOptions);
                  if (!matchingOption) {
                    details.push(`Row ${rowNum}: No matching age option found for dependent "${row.dependentName}" (age ${dependentAge}) in plan "${groupPlan.plan_name}"`);
                    continue;
                  }

                  matchingOptionId = matchingOption.id;

                  // Get rates for this option
                  const { data: rates, error: ratesError } = await supabase
                    .from('group_option_rates')
                    .select('id, rate, start_date, end_date')
                    .eq('group_plan_option_id', matchingOption.id)
                    .order('start_date', { ascending: false });

                  if (ratesError || !rates || rates.length === 0) {
                    details.push(`Row ${rowNum}: No rates found for dependent "${row.dependentName}" option "${matchingOption.option}" in plan "${groupPlan.plan_name}"`);
                    continue;
                  }

                  // Find active rate for effective date
                  activeRate = findActiveRateForDate(rates, effectiveDate);
                  if (!activeRate) {
                    details.push(`Row ${rowNum}: No active rate found for dependent "${row.dependentName}" on effective date ${effectiveDate} in plan "${groupPlan.plan_name}"`);
                    continue;
                  }
                } else if (groupPlan.plan_type === 'Composite') {
                  // For Composite plans: use the same option and rate as the participant
                  if (!participantPlan.group_plan_option_id || !participantPlan.group_option_rate_id) {
                    // Participant doesn't have option/rate set, skip
                    details.push(`Row ${rowNum}: Participant doesn't have option/rate set for Composite plan "${groupPlan.plan_name}" - skipping dependent connection`);
                    continue;
                  }

                  matchingOptionId = participantPlan.group_plan_option_id;

                  // Get the rate that the participant is using
                  const { data: participantRate, error: rateError } = await supabase
                    .from('group_option_rates')
                    .select('id, rate, start_date, end_date')
                    .eq('id', participantPlan.group_option_rate_id)
                    .single();

                  if (rateError || !participantRate) {
                    details.push(`Row ${rowNum}: Could not find rate for participant in Composite plan "${groupPlan.plan_name}" - skipping dependent connection`);
                    continue;
                  }

                  // Verify the rate is still active for the effective date
                  activeRate = findActiveRateForDate([participantRate], effectiveDate);
                  if (!activeRate) {
                    // Try to find the current active rate for this option
                    const { data: currentRates, error: currentRatesError } = await supabase
                      .from('group_option_rates')
                      .select('id, rate, start_date, end_date')
                      .eq('group_plan_option_id', participantPlan.group_plan_option_id)
                      .order('start_date', { ascending: false });

                    if (currentRatesError || !currentRates || currentRates.length === 0) {
                      details.push(`Row ${rowNum}: No rates found for option in Composite plan "${groupPlan.plan_name}" - skipping dependent connection`);
                      continue;
                    }

                    activeRate = findActiveRateForDate(currentRates, effectiveDate);
                    if (!activeRate) {
                      details.push(`Row ${rowNum}: No active rate found for dependent "${row.dependentName}" on effective date ${effectiveDate} in Composite plan "${groupPlan.plan_name}"`);
                      continue;
                    }
                  }
                } else {
                  // Unknown plan type, skip
                  continue;
                }

                if (!matchingOptionId || !activeRate) {
                  continue;
                }

                // Create participant_group_plans record for dependent
                const { data: dependentPlanRecord, error: dependentPlanError } = await supabase
                  .from('participant_group_plans')
                  .insert([{
                    participant_id: participantId,
                    group_plan_id: groupPlan.id,
                    group_plan_option_id: matchingOptionId,
                    group_option_rate_id: activeRate.id,
                    dependent_id: newDependent.id,
                    effective_date: effectiveDate,
                  }])
                  .select()
                  .single();

                if (dependentPlanError) {
                  console.error('Error creating dependent plan record:', dependentPlanError);
                  details.push(`Row ${rowNum}: Created dependent "${row.dependentName}" but failed to connect to plan "${groupPlan.plan_name}"`);
                  continue;
                }

                // Get plan details for contribution calculation
                const { data: planDetails, error: planDetailsError } = await supabase
                  .from('group_plans')
                  .select('employer_contribution_type, employer_contribution_value')
                  .eq('id', groupPlan.id)
                  .single();

                // Create participant_group_plan_rates junction record
                const junctionData: any = {
                  participant_group_plan_id: dependentPlanRecord.id,
                  group_option_rate_id: activeRate.id,
                  start_date: effectiveDate,
                };

                if (planDetails && !planDetailsError) {
                  if (planDetails.employer_contribution_type) {
                    junctionData.employer_contribution_type = planDetails.employer_contribution_type;
                  }
                  if (planDetails.employer_contribution_value) {
                    junctionData.employer_contribution_amount = planDetails.employer_contribution_value;
                  }
                }

                const { error: junctionError } = await supabase
                  .from('participant_group_plan_rates')
                  .insert([junctionData]);

                if (junctionError) {
                  console.error('Error creating junction record for dependent:', junctionError);
                  details.push(`Row ${rowNum}: Created dependent "${row.dependentName}" and plan connection but failed to link rate`);
                } else {
                  const planTypeLabel = groupPlan.plan_type === 'Age Banded' ? 'age-based' : 'same option';
                  details.push(`Row ${rowNum}: Successfully connected dependent "${row.dependentName}" to plan "${groupPlan.plan_name}" (${planTypeLabel}) with rate $${activeRate.rate.toFixed(2)}`);
                }
              }
            }
          }

          processed++;
          details.push(`Row ${rowNum}: Successfully created dependent "${row.dependentName}" (${relationship}) for participant "${row.participant}"`);
          continue; // Skip plan assignment logic for dependent rows
        }

        // Process as participant row
        // Validate required fields for participant rows
        // Allow 0 rates but reject blank/null/undefined
        const isRateMissing = row.rate == null || String(row.rate).trim() === '';
        if (!row.participant || !row.dateOfBirth || !row.planName || !row.option || isRateMissing) {
          details.push(`Row ${rowNum}: Missing required fields (Participant, Date of Birth, Plan Name, Option, or Rate)`);
          errors++;
          continue;
        }

        // Parse class number if provided
        let classNumber: number | null = null;
        if (row.class && row.class.trim() !== '') {
          const parsedClass = parseInt(row.class.trim());
          if (!isNaN(parsedClass) && parsedClass > 0) {
            classNumber = parsedClass;
          } else {
            details.push(`Row ${rowNum}: Invalid class number: ${row.class}`);
            // Don't fail, just warn
          }
        }

        // Normalize dates
        const dob = normalizeDate(row.dateOfBirth);
        if (!dob) {
          details.push(`Row ${rowNum}: Invalid Date of Birth format: ${row.dateOfBirth}`);
          errors++;
          continue;
        }

        const hireDate = normalizeDate(row.hireDate);
        const terminationDate = normalizeDate(row.terminationDate) || null;

        // Check if participant exists (by name and DOB)
        // Note: If a participant appears multiple times in the file, they will be created once
        // on the first occurrence, and subsequent rows will use the existing participant.
        // Each row will then create its own plan assignment.
        const { data: existingParticipants, error: participantError } = await supabase
          .from('participants')
          .select('id, group_id')
          .eq('client_name', row.participant.trim())
          .eq('dob', dob);

        if (participantError) {
          throw participantError;
        }

        let participantId: string;

        if (existingParticipants && existingParticipants.length > 0) {
          // Participant exists (either from database or created earlier in this file upload), use existing
          participantId = existingParticipants[0].id;
          
          // Update group_id if not set or different
          if (!existingParticipants[0].group_id || existingParticipants[0].group_id !== groupId) {
            await supabase
              .from('participants')
              .update({ group_id: groupId })
              .eq('id', participantId);
          }

          // Update other fields if provided
          const updateData: any = {};
          if (row.phoneNumber) updateData.phone_number = row.phoneNumber.trim();
          if (row.emailAddress) updateData.email_address = row.emailAddress.trim();
          if (row.address) updateData.address = row.address.trim();
          if (hireDate) updateData.hire_date = hireDate;
          if (terminationDate) updateData.termination_date = terminationDate;
          if (classNumber !== null) updateData.class_number = classNumber;

          if (Object.keys(updateData).length > 0) {
            await supabase
              .from('participants')
              .update(updateData)
              .eq('id', participantId);
          }

          details.push(`Row ${rowNum}: Using existing participant "${row.participant}"`);
        } else {
          // Create new participant (first occurrence in file or new to database)
          const insertData: any = {
            client_name: row.participant.trim(),
            dob: dob,
            group_id: groupId,
          };

          if (row.phoneNumber) insertData.phone_number = row.phoneNumber.trim();
          if (row.emailAddress) insertData.email_address = row.emailAddress.trim();
          if (row.address) insertData.address = row.address.trim();
          if (hireDate) insertData.hire_date = hireDate;
          if (terminationDate) insertData.termination_date = terminationDate;
          if (classNumber !== null) insertData.class_number = classNumber;

          const { data: newParticipant, error: insertError } = await supabase
            .from('participants')
            .insert([insertData])
            .select()
            .single();

          if (insertError) {
            throw insertError;
          }

          participantId = newParticipant.id;
          details.push(`Row ${rowNum}: Created new participant "${row.participant}"`);
        }

        // Find matching plan for the group
        const { data: groupPlans, error: planError } = await supabase
          .from('group_plans')
          .select('id, plan_name')
          .eq('group_id', groupId)
          .eq('plan_name', row.planName.trim())
          .limit(1);

        if (planError) {
          throw planError;
        }

        if (!groupPlans || groupPlans.length === 0) {
          details.push(`Row ${rowNum}: Plan "${row.planName}" not found for this group`);
          errors++;
          continue;
        }

        const groupPlanId = groupPlans[0].id;

        // Find option for that plan
        const { data: planOptions, error: optionError } = await supabase
          .from('group_plan_options')
          .select('id, option')
          .eq('group_plan_id', groupPlanId)
          .eq('option', row.option.trim())
          .limit(1);

        if (optionError) {
          throw optionError;
        }

        if (!planOptions || planOptions.length === 0) {
          details.push(`Row ${rowNum}: Option "${row.option}" not found for plan "${row.planName}"`);
          errors++;
          continue;
        }

        const groupPlanOptionId = planOptions[0].id;

        // Find Rate History record matching the rate
        const rateValue = parseFloat(row.rate.trim());
        if (isNaN(rateValue)) {
          details.push(`Row ${rowNum}: Invalid rate value: ${row.rate}`);
          errors++;
          continue;
        }

        // Find rate that matches the value and is active for the plan start date
        const { data: rates, error: rateError } = await supabase
          .from('group_option_rates')
          .select('id, rate, start_date, end_date')
          .eq('group_plan_option_id', groupPlanOptionId)
          .eq('rate', rateValue)
          .order('start_date', { ascending: false });

        if (rateError) {
          throw rateError;
        }

        // Find the rate that is active for the plan start date
        let matchingRate = null;
        for (const rate of rates || []) {
          const rateStartDate = rate.start_date ? new Date(rate.start_date).toISOString().split('T')[0] : null;
          const rateEndDate = rate.end_date ? new Date(rate.end_date).toISOString().split('T')[0] : null;
          
          const planStartDateStr = planStartDate.split('T')[0];
          
          const isActive = (!rateStartDate || planStartDateStr >= rateStartDate) &&
                          (!rateEndDate || planStartDateStr <= rateEndDate);
          
          if (isActive) {
            matchingRate = rate;
            break;
          }
        }

        // If no active rate found, try to find the most recent rate with matching value
        if (!matchingRate && rates && rates.length > 0) {
          matchingRate = rates[0]; // Use the most recent rate
          details.push(`Row ${rowNum}: Using rate ${rateValue} (not active for plan start date, using most recent)`);
        }

        if (!matchingRate) {
          details.push(`Row ${rowNum}: Rate ${rateValue} not found for option "${row.option}"`);
          errors++;
          continue;
        }

        // Create participant_group_plans record
        const participantGroupPlanData: any = {
          participant_id: participantId,
          group_plan_id: groupPlanId,
          group_plan_option_id: groupPlanOptionId,
          group_option_rate_id: matchingRate.id,
          effective_date: planStartDate.split('T')[0],
        };

        if (terminationDate) {
          participantGroupPlanData.termination_date = terminationDate;
        }

        const { data: participantGroupPlan, error: pgpError } = await supabase
          .from('participant_group_plans')
          .insert([participantGroupPlanData])
          .select()
          .single();

        if (pgpError) {
          // Check if it's a duplicate error
          if (pgpError.code === '23505') {
            details.push(`Row ${rowNum}: Participant already has this plan assignment`);
            errors++;
            continue;
          }
          throw pgpError;
        }

        // Create participant_group_plan_rates junction record
        const { data: groupPlan } = await supabase
          .from('group_plans')
          .select('employer_contribution_type, employer_contribution_value')
          .eq('id', groupPlanId)
          .single();

        if (groupPlan) {
          const junctionData: any = {
            participant_group_plan_id: participantGroupPlan.id,
            group_option_rate_id: matchingRate.id,
            start_date: planStartDate.split('T')[0],
          };

          if (groupPlan.employer_contribution_type) {
            junctionData.employer_contribution_type = groupPlan.employer_contribution_type;
          }
          if (groupPlan.employer_contribution_value) {
            junctionData.employer_contribution_amount = groupPlan.employer_contribution_value;
          }

          const { error: junctionError } = await supabase
            .from('participant_group_plan_rates')
            .insert([junctionData]);

          if (junctionError) {
            console.error('Error creating junction record:', junctionError);
            // Don't fail the whole operation, just log it
          }
        }

        processed++;
        details.push(`Row ${rowNum}: Successfully created participant group plan for "${row.participant}"`);

      } catch (error: any) {
        console.error(`Error processing row ${rowNum}:`, error);
        details.push(`Row ${rowNum}: Error - ${error.message || 'Unknown error'}`);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      errors,
      details,
    });

  } catch (error: any) {
    console.error('Error uploading participants:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload participants' },
      { status: 500 }
    );
  }
}

