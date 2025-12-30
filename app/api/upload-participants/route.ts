import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

interface CSVRow {
  participant: string;
  dateOfBirth: string;
  phoneNumber: string;
  emailAddress: string;
  address: string;
  hireDate: string;
  terminationDate: string;
  class: string;
  planName: string;
  option: string;
  rate: string;
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
  
  // Expected headers (case-insensitive)
  const expectedHeaders = [
    'participant',
    'date of birth',
    'phone number',
    'email address',
    'address',
    'hire date',
    'termination date',
    'class',
    'plan name',
    'option',
    'rate'
  ];

  // Map headers to indices
  const headerMap: Record<string, number> = {};
  expectedHeaders.forEach(expected => {
    const index = headers.findIndex(h => {
      const normalizedH = h.replace(/^"|"$/g, '').trim();
      return normalizedH === expected || normalizedH === expected.replace(/\s+/g, '');
    });
    if (index === -1) {
      throw new Error(`Missing required column: ${expected}`);
    }
    headerMap[expected] = index;
  });

  // Parse data rows
  const rows: CSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, ''));
    if (values.length < expectedHeaders.length) {
      continue; // Skip incomplete rows
    }

    rows.push({
      participant: values[headerMap['participant']] || '',
      dateOfBirth: values[headerMap['date of birth']] || '',
      phoneNumber: values[headerMap['phone number']] || '',
      emailAddress: values[headerMap['email address']] || '',
      address: values[headerMap['address']] || '',
      hireDate: values[headerMap['hire date']] || '',
      terminationDate: values[headerMap['termination date']] || '',
      class: values[headerMap['class']] || '',
      planName: values[headerMap['plan name']] || '',
      option: values[headerMap['option']] || '',
      rate: values[headerMap['rate']] || '',
    });
  }

  return rows;
}

function normalizeDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  const dateStrTrimmed = dateStr.trim();
  
  // Try MM/DD/YYYY or DD/MM/YYYY
  if (dateStrTrimmed.includes('/')) {
    const parts = dateStrTrimmed.split('/').map(Number);
    if (parts.length === 3) {
      if (parts[0] > 12) {
        // DD/MM/YYYY format
        const [day, month, year] = parts;
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      } else {
        // Assume MM/DD/YYYY format
        const [month, day, year] = parts;
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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

    // Read CSV file
    const csvText = await file.text();
    const rows = parseCSV(csvText);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No data rows found in CSV' },
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
        // Validate required fields
        if (!row.participant || !row.dateOfBirth || !row.planName || !row.option || !row.rate) {
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
          // Participant exists, use existing
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
          // Create new participant
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

