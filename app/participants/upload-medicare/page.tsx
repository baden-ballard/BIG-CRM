'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import GlassCard from '../../../components/GlassCard';
import GlassButton from '../../../components/GlassButton';

interface CSVRow {
  participant: string;
  dateOfBirth: string;
  phoneNumber: string;
  emailAddress: string;
  address: string;
  idNumber: string;
  planStartDate: string;
  provider: string;
  planName: string;
  rate: string;
}

export default function UploadMedicareParticipantsPage() {
  const router = useRouter();

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    success: boolean;
    message: string;
    details?: string[];
  } | null>(null);

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
      'id number',
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
        idNumber: values[headerMap['id number']] || '',
        planStartDate: values[headerMap['plan start date']] || '',
        provider: values[headerMap['provider']] || '',
        planName: values[headerMap['plan name']] || '',
        rate: values[headerMap['rate']] || '',
      });
    }

    return rows;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileName = file.name.toLowerCase();
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
      const isCSV = fileName.endsWith('.csv') || file.type === 'text/csv';
      
      if (!isExcel && !isCSV) {
        alert('Please select a CSV or Excel file (.csv, .xlsx, .xls)');
        return;
      }
      setCsvFile(file);
      setUploadStatus(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!csvFile) {
      alert('Please select a CSV or Excel file');
      return;
    }

    setIsUploading(true);
    setUploadStatus(null);

    try {
      const fileName = csvFile.name.toLowerCase();
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
      const isCSV = fileName.endsWith('.csv') || csvFile.type === 'text/csv';
      
      // Only validate CSV files client-side; Excel files are handled by the server
      if (isCSV) {
        // Read CSV file
        const csvText = await csvFile.text();
        const rows = parseCSV(csvText);

        if (rows.length === 0) {
          throw new Error('No data rows found in CSV');
        }
      }

      // Process upload via API
      const formData = new FormData();
      formData.append('file', csvFile);

      const response = await fetch('/api/upload-medicare-participants', {
        method: 'POST',
        body: formData,
      });

      // Check content type before parsing JSON
      const contentType = response.headers.get('content-type');
      let result: any;
      
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        // If not JSON, read as text to get the error message
        const text = await response.text();
        throw new Error(text || `Server error: ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload Medicare participants');
      }

      setUploadStatus({
        success: true,
        message: `Successfully processed ${result.processed} participant(s)`,
        details: result.details || [],
      });

      // Clear form
      setCsvFile(null);
      if (e.target instanceof HTMLFormElement) {
        e.target.reset();
      }
    } catch (error: any) {
      console.error('Error uploading Medicare participants:', error);
      setUploadStatus({
        success: false,
        message: error.message || 'Failed to upload Medicare participants',
        details: [],
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <button
          onClick={() => router.push('/participants')}
          className="text-[var(--glass-secondary)] hover:text-[var(--glass-secondary-dark)] mb-4 flex items-center gap-2"
        >
          <span>←</span> Back to Participants
        </button>
        <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
          Upload Medicare Participants
        </h1>
        <p className="text-[var(--glass-gray-medium)]">
          Upload Medicare participants from CSV or Excel file
        </p>
      </div>

      <GlassCard>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File Upload */}
          <div>
            <label htmlFor="csvFile" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
              File (CSV or Excel) *
            </label>
            <input
              type="file"
              id="csvFile"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              required
              className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
            />
            <p className="text-xs text-[var(--glass-gray-medium)] mt-2">
              File must include columns: Participant, Date of Birth, Phone Number, Email Address, Address, ID Number, Plan Start Date, Provider, Plan Name, Rate
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
              onClick={() => router.push('/participants')}
              className="px-6 py-3 rounded-full font-semibold bg-[#C6282B] text-white hover:bg-[#A01F22] shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Cancel
            </button>
            <GlassButton
              type="submit"
              variant="primary"
              disabled={isUploading || !csvFile}
              className={isUploading || !csvFile ? 'opacity-50 cursor-not-allowed' : ''}
            >
              {isUploading ? 'Uploading...' : 'Upload Medicare Participants'}
            </GlassButton>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}

