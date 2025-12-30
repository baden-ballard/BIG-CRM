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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileName = file.name.toLowerCase();
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
      const isCSV = fileName.endsWith('.csv') || file.type === 'text/csv';
      
      if (!isExcel && !isCSV) {
        alert('Please select a CSV or Excel file (.csv, .xlsx, .xls)');
        e.target.value = ''; // Clear the input
        setCsvFile(null);
        return;
      }
      setCsvFile(file);
      setUploadStatus(null);
    } else {
      setCsvFile(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!csvFile) {
      alert('Please select a CSV or Excel file');
      return;
    }

    if (!planStartDate) {
      alert('Please select a Plan Start Date');
      return;
    }

    setIsUploading(true);
    setUploadStatus(null);

    try {
      // Note: File parsing is now handled by the API endpoint
      // We just need to send the file to the API

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
        const fileInput = e.target.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }
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
          Upload participants from CSV or Excel file for {group.name}
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

          {/* File Upload */}
          <div>
            <label htmlFor="csvFile" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
              CSV or Excel File *
            </label>
            <input
              type="file"
              id="csvFile"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              required
              className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
            />
            {csvFile && (
              <p className="text-sm text-green-600 mt-2 font-medium">
                ✓ Selected: {csvFile.name}
              </p>
            )}
            <p className="text-xs text-[var(--glass-gray-medium)] mt-2">
              File must include columns: Participant, Date of Birth (Participant), Phone Number, Email Address, Address, Hire Date, Termination Date, Class, Plan Name, Option, Rate. For dependents, also include: Name (Dependent), Relationship to Participant, Date of Birth (Dependant). Dependents must come after their participant in the file.
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
            <div className="flex flex-col items-end gap-2">
              {(!csvFile || !planStartDate) && (
                <p className="text-xs text-[var(--glass-gray-medium)]">
                  {!csvFile && !planStartDate && 'Please select a file and plan start date'}
                  {!csvFile && planStartDate && 'Please select a file'}
                  {csvFile && !planStartDate && 'Please select a plan start date'}
                </p>
              )}
              <GlassButton
                type="submit"
                variant="primary"
                disabled={isUploading || !csvFile || !planStartDate}
                className={isUploading || !csvFile || !planStartDate ? 'opacity-50 cursor-not-allowed' : ''}
              >
                {isUploading ? 'Uploading...' : 'Upload Participants'}
              </GlassButton>
            </div>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}

