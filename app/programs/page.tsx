'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import GlassCard from '../../components/GlassCard';
import GlassButton from '../../components/GlassButton';
import SearchFilter from '../../components/SearchFilter';
import { supabase } from '../../lib/supabase';

interface Program {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export default function ProgramsPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [filteredPrograms, setFilteredPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('programs')
        .select('*')
        .order('name', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setPrograms(data || []);
      setFilteredPrograms(data || []);
    } catch (err: any) {
      console.error('Error fetching programs:', err);
      setError(err.message || 'Failed to load programs');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
            Programs
          </h1>
          <p className="text-[var(--glass-gray-medium)]">
            Manage your insurance programs (e.g., Medicare, Group Health)
          </p>
        </div>
        <GlassButton variant="primary" href="/programs/new">
          + New Program
        </GlassButton>
      </div>

      {loading && (
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            Loading programs...
          </p>
        </GlassCard>
      )}

      {error && (
        <GlassCard>
          <p className="text-red-500 text-center py-8">
            Error: {error}
          </p>
        </GlassCard>
      )}

      {!loading && !error && programs.length === 0 && (
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            No programs found. Create your first program to get started.
          </p>
        </GlassCard>
      )}

      {!loading && !error && programs.length > 0 && filteredPrograms.length === 0 && (
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            No programs match your search criteria. Try adjusting your filters.
          </p>
        </GlassCard>
      )}

      {!loading && !error && programs.length > 0 && (
        <>
          <SearchFilter
            data={programs}
            onFilteredDataChange={setFilteredPrograms}
            searchFields={['name']}
            placeholder="Search programs by name..."
          />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredPrograms.map((program) => (
            <GlassCard 
              key={program.id} 
              className="hover:scale-105 transition-transform cursor-pointer"
              onClick={() => router.push(`/programs/${program.id}`)}
            >
              <div className="p-6 flex items-center justify-center min-h-[100px]">
                <h3 className="text-xl font-bold text-[var(--glass-black-dark)] text-center">
                  {program.name}
                </h3>
              </div>
            </GlassCard>
          ))}
          </div>
        </>
      )}
    </div>
  );
}
