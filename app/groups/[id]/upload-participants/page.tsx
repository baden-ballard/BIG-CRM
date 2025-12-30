'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import GlassCard from '../../../../components/GlassCard';
import GlassButton from '../../../../components/GlassButton';
import { supabase } from '../../../../lib/supabase';

interface Group {
  id: string;
  name: string;
}

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

export default function UploadParticipantsPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = (params?.id ?? '') as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [planStartDate, setPlanStartDate] = useState<string>('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    success: boolean;
    message: string;
    details?: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (groupId) {
      fetchGroup();
    }
  }, [groupId]);

  const fetchGroup = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('groups')
        .select('id, name')
        .eq('id', groupId)
        .single();

      if (error) {
        throw error;
      }

      setGroup(data);
    } catch (error: any) {
      console.error('Error fetching group:', error);
      alert('Failed to load group');
    } finally {
      setLoading(false);
    }
  };

  const parseCSVLine = (line: string): string[] => {
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
  };

  const parseCSV = (csvText: string): CSVRow[] => {
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
  };

  const normalizeDate = (dateStr: string): string | null => {
    if (!dateStr || dateStr.trim() === '') return null;
    
    // Handle various date formats
    const dateStrTrimmed = dateStr.trim();
    
    // Try MM/DD/YYYY or DD/MM/YYYY
    if (dateStrTrimmed.includes('/')) {
      const parts = dateStrTrimmed.split('/').map(Number);
      if (parts.length === 3) {
        // Check if first part is > 12, then it's likely DD/MM/YYYY
        if (parts[0] > 12) {
          // DD/MM/YYYY format
          const [day, month, year] = parts;
          return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        } else {
          // Assume MM/DD/YYYY format (US format)
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
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        alert('Please select a CSV file');
        return;
      }
      setCsvFile(file);
      setUploadStatus(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!csvFile) {
      alert('Please select a CSV file');
      return;
    }

    if (!planStartDate) {
      alert('Please select a Plan Start Date');
      return;
    }

    setIsUploading(true);
    setUploadStatus(null);

    try {
      // Read CSV file
      const csvText = await csvFile.text();
      const rows = parseCSV(csvText);

      if (rows.length === 0) {
        throw new Error('No data rows found in CSV');
      }

      // Process upload via API
      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('groupId', groupId);
      formData.append('planStartDate', planStartDate);

      const response = await fetch('/api/upload-participants', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload participants');
      }

      setUploadStatus({
        success: true,
        message: `Successfully processed ${result.processed} participant(s)`,
        details: result.details || [],
      });

      // Clear form
      setCsvFile(null);
      setPlanStartDate('');
      if (e.target instanceof HTMLFormElement) {
        e.target.reset();
      }
    } catch (error: any) {
      console.error('Error uploading participants:', error);
      setUploadStatus({
        success: false,
        message: error.message || 'Failed to upload participants',
        details: [],
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            Loading...
          </p>
        </GlassCard>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="max-w-4xl mx-auto">
        <GlassCard>
          <p className="text-red-500 text-center py-8">
            Group not found
          </p>
          <div className="flex justify-center mt-4">
            <GlassButton variant="primary" onClick={() => router.push('/groups')}>
              Back to Groups
            </GlassButton>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <button
          onClick={() => router.push(`/groups/${groupId}`)}
          className="text-[var(--glass-secondary)] hover:text-[var(--glass-secondary-dark)] mb-4 flex items-center gap-2"
        >
          <span>←</span> Back to Group
        </button>
        <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
          Upload Participants
        </h1>
        <p className="text-[var(--glass-gray-medium)]">
          Upload participants from CSV file for {group.name}
        </p>
      </div>

      <GlassCard>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Group Display */}
          <div>
            <label className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
              Group
            </label>
            <div className="glass-input-enhanced w-full px-4 py-3 rounded-xl opacity-75">
              <span className="text-[var(--glass-black-dark)]">
                {group.name}
              </span>
            </div>
          </div>

          {/* Plan Start Date */}
          <div>
            <label htmlFor="planStartDate" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
              Plan Start Date *
            </label>
            <div className="date-input-wrapper">
              <input
                type="date"
                id="planStartDate"
                value={planStartDate}
                onChange={(e) => setPlanStartDate(e.target.value)}
                required
                className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
              />
              <div className="calendar-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </div>
            </div>
          </div>

          {/* CSV File Upload */}
          <div>
            <label htmlFor="csvFile" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
              CSV File *
            </label>
            <input
              type="file"
              id="csvFile"
              accept=".csv"
              onChange={handleFileChange}
              required
              className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
            />
            <p className="text-xs text-[var(--glass-gray-medium)] mt-2">
              CSV must include columns: Participant, Date of Birth, Phone Number, Email Address, Address, Hire Date, Termination Date, Class, Plan Name, Option, Rate
            </p>
          </div>

          {/* Upload Status */}
          {uploadStatus && (
            <div className={`p-4 rounded-xl border ${
              uploadStatus.success 
                ? 'bg-green-500/10 border-green-500/20' 
                : 'bg-red-500/10 border-red-500/20'
            }`}>
              <p className={`font-semibold ${
                uploadStatus.success ? 'text-green-700' : 'text-red-700'
              }`}>
                {uploadStatus.message}
              </p>
              {uploadStatus.details && uploadStatus.details.length > 0 && (
                <ul className="mt-2 text-sm text-[var(--glass-gray-medium)] list-disc list-inside">
                  {uploadStatus.details.map((detail, index) => (
                    <li key={index}>{detail}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-white/20">
            <button
              type="button"
              onClick={() => router.push(`/groups/${groupId}`)}
              className="px-6 py-3 rounded-full font-semibold bg-[#C6282B] text-white hover:bg-[#A01F22] shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Cancel
            </button>
            <GlassButton
              type="submit"
              variant="primary"
              disabled={isUploading || !csvFile || !planStartDate}
              className={isUploading || !csvFile || !planStartDate ? 'opacity-50 cursor-not-allowed' : ''}
            >
              {isUploading ? 'Uploading...' : 'Upload Participants'}
            </GlassButton>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}

