import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import * as XLSX from 'xlsx';

interface CSVRow {
  participant: string;
  dateOfBirth: string;
  phoneNumber: string;
  emailAddress: string;
  address: string;
  planStartDate: string;
  provider: string;
  planName: string;
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
    'plan start date',
    'provider',
    'plan name',
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
      planStartDate: values[headerMap['plan start date']] || '',
      provider: values[headerMap['provider']] || '',
      planName: values[headerMap['plan name']] || '',
      rate: values[headerMap['rate']] || '',
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
  
  // Expected headers (case-insensitive)
  const expectedHeaders = [
    'participant',
    'date of birth',
    'phone number',
    'email address',
    'address',
    'plan start date',
    'provider',
    'plan name',
    'rate'
  ];

  // Map headers to indices
  const headerMap: Record<string, number> = {};
  expectedHeaders.forEach(expected => {
    const index = headers.findIndex(h => {
      const normalizedH = String(h).trim();
      return normalizedH === expected || normalizedH === expected.replace(/\s+/g, '');
    });
    if (index === -1) {
      throw new Error(`Missing required column: ${expected}`);
    }
    headerMap[expected] = index;
  });

  // Parse data rows
  const rows: CSVRow[] = [];
  for (let i = 1; i < data.length; i++) {
    const values = data[i].map((v: any) => String(v || '').trim());
    if (values.length < expectedHeaders.length) {
      continue; // Skip incomplete rows
    }

    rows.push({
      participant: values[headerMap['participant']] || '',
      dateOfBirth: values[headerMap['date of birth']] || '',
      phoneNumber: values[headerMap['phone number']] || '',
      emailAddress: values[headerMap['email address']] || '',
      address: values[headerMap['address']] || '',
      planStartDate: values[headerMap['plan start date']] || '',
      provider: values[headerMap['provider']] || '',
      planName: values[headerMap['plan name']] || '',
      rate: values[headerMap['rate']] || '',
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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Missing file' },
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
        // Validate required fields
        if (!row.participant || !row.dateOfBirth || !row.provider || !row.planName || !row.rate || !row.planStartDate) {
          details.push(`Row ${rowNum}: Missing required fields (Participant, Date of Birth, Plan Start Date, Provider, Plan Name, or Rate)`);
          errors++;
          continue;
        }

        // Normalize dates
        const dob = normalizeDate(row.dateOfBirth);
        if (!dob) {
          details.push(`Row ${rowNum}: Invalid Date of Birth format: ${row.dateOfBirth}`);
          errors++;
          continue;
        }

        const planStartDate = normalizeDate(row.planStartDate);
        if (!planStartDate) {
          details.push(`Row ${rowNum}: Invalid Plan Start Date format: ${row.planStartDate}`);
          errors++;
          continue;
        }

        // Check if participant exists (by name and DOB)
        // Note: If a participant appears multiple times in the CSV, they will be created once
        // on the first occurrence, and subsequent rows will use the existing participant.
        // Each row will then create its own plan assignment.
        const { data: existingParticipants, error: participantError } = await supabase
          .from('participants')
          .select('id')
          .eq('client_name', row.participant.trim())
          .eq('dob', dob);

        if (participantError) {
          throw participantError;
        }

        let participantId: string;

        if (existingParticipants && existingParticipants.length > 0) {
          // Participant exists (either from database or created earlier in this CSV upload), use existing
          participantId = existingParticipants[0].id;
          
          // Update participant fields if provided
          const updateData: any = {};
          if (row.phoneNumber) updateData.phone_number = row.phoneNumber.trim();
          if (row.emailAddress) updateData.email_address = row.emailAddress.trim();
          if (row.address) updateData.address = row.address.trim();

          if (Object.keys(updateData).length > 0) {
            await supabase
              .from('participants')
              .update(updateData)
              .eq('id', participantId);
          }

          details.push(`Row ${rowNum}: Using existing participant "${row.participant}"`);
        } else {
          // Create new participant (first occurrence in CSV or new to database)
          const insertData: any = {
            client_name: row.participant.trim(),
            dob: dob,
            // Medicare participants don't belong to a group
            group_id: null,
          };

          if (row.phoneNumber) insertData.phone_number = row.phoneNumber.trim();
          if (row.emailAddress) insertData.email_address = row.emailAddress.trim();
          if (row.address) insertData.address = row.address.trim();

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

        // Find provider by name
        const { data: providers, error: providerError } = await supabase
          .from('providers')
          .select('id, name')
          .eq('name', row.provider.trim())
          .limit(1);

        if (providerError) {
          throw providerError;
        }

        if (!providers || providers.length === 0) {
          details.push(`Row ${rowNum}: Provider "${row.provider}" not found`);
          errors++;
          continue;
        }

        const providerId = providers[0].id;

        // Find matching Medicare plan by provider and plan name
        const { data: medicarePlans, error: planError } = await supabase
          .from('medicare_plans')
          .select('id, plan_name, provider_id')
          .eq('provider_id', providerId)
          .eq('plan_name', row.planName.trim())
          .limit(1);

        if (planError) {
          throw planError;
        }

        if (!medicarePlans || medicarePlans.length === 0) {
          details.push(`Row ${rowNum}: Medicare plan "${row.planName}" not found for provider "${row.provider}"`);
          errors++;
          continue;
        }

        const medicarePlanId = medicarePlans[0].id;

        // Find Rate History record matching the rate
        const rateValue = parseFloat(row.rate.trim());
        if (isNaN(rateValue)) {
          details.push(`Row ${rowNum}: Invalid rate value: ${row.rate}`);
          errors++;
          continue;
        }

        // Find rate that matches the value and is active for the plan start date
        const { data: rates, error: rateError } = await supabase
          .from('medicare_child_rates')
          .select('id, rate, start_date, end_date')
          .eq('medicare_plan_id', medicarePlanId)
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
          
          const isActive = (!rateStartDate || planStartDate >= rateStartDate) &&
                          (!rateEndDate || planStartDate <= rateEndDate);
          
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
          details.push(`Row ${rowNum}: Rate ${rateValue} not found for Medicare plan "${row.planName}" (Provider: "${row.provider}")`);
          errors++;
          continue;
        }

        // Create participant_medicare_plans record
        // Note: If the same participant appears multiple times with different plans,
        // each plan assignment will be created. If the same plan is assigned twice,
        // the database constraint will catch it and we'll report it as an error.
        const participantMedicarePlanData: any = {
          participant_id: participantId,
          medicare_plan_id: medicarePlanId,
          medicare_child_rate_id: matchingRate.id,
          effective_date: planStartDate,
        };

        const { data: participantMedicarePlan, error: pmpError } = await supabase
          .from('participant_medicare_plans')
          .insert([participantMedicarePlanData])
          .select()
          .single();

        if (pmpError) {
          // Check if it's a duplicate error (same participant + same plan already exists)
          if (pmpError.code === '23505') {
            details.push(`Row ${rowNum}: Participant "${row.participant}" already has this Medicare plan assignment (${row.planName} from ${row.provider})`);
            errors++;
            continue;
          }
          throw pmpError;
        }

        processed++;
        details.push(`Row ${rowNum}: Successfully created Medicare plan assignment for "${row.participant}"`);

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
    console.error('Error uploading Medicare participants:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload Medicare participants' },
      { status: 500 }
    );
  }
}

