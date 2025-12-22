'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import GlassCard from '../../components/GlassCard';
import GlassButton from '../../components/GlassButton';
import SearchFilter from '../../components/SearchFilter';
import { supabase } from '../../lib/supabase';

interface Provider {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  programs?: Program[];
}

interface Program {
  id: string;
  name: string;
}

export default function ProvidersPage() {
  const router = useRouter();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [filteredProviders, setFilteredProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('providers')
        .select('*')
        .order('name', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      if (!data || data.length === 0) {
        setProviders([]);
        setFilteredProviders([]);
        return;
      }

      // Fetch programs for each provider
      const providersWithPrograms = await Promise.all(
        data.map(async (provider: any) => {
          // Get program_providers entries for this provider
          const { data: programProviders } = await supabase
            .from('program_providers')
            .select('program_id')
            .eq('provider_id', provider.id);

          if (!programProviders || programProviders.length === 0) {
            return { ...provider, programs: [] };
          }

          // Get program IDs
          const programIds = programProviders.map((pp: any) => pp.program_id);

          // Fetch the actual programs
          const { data: programsData } = await supabase
            .from('programs')
            .select('id, name')
            .in('id', programIds)
            .order('name', { ascending: true });

          return {
            ...provider,
            programs: programsData || [],
          };
        })
      );

      setProviders(providersWithPrograms);
      setFilteredProviders(providersWithPrograms);
    } catch (err: any) {
      console.error('Error fetching providers:', err);
      setError(err.message || 'Failed to load providers');
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
            Providers
          </h1>
          <p className="text-[var(--glass-gray-medium)]">
            Manage your insurance providers
          </p>
        </div>
        <GlassButton variant="primary" href="/providers/new">
          + New Provider
        </GlassButton>
      </div>

      {loading && (
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            Loading providers...
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

      {!loading && !error && providers.length === 0 && (
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            No providers found. Create your first provider to get started.
          </p>
        </GlassCard>
      )}

      {!loading && !error && providers.length > 0 && filteredProviders.length === 0 && (
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            No providers match your search criteria. Try adjusting your filters.
          </p>
        </GlassCard>
      )}

      {!loading && !error && providers.length > 0 && (
        <>
          <SearchFilter
            data={providers}
            onFilteredDataChange={setFilteredProviders}
            searchFields={['name']}
            placeholder="Search providers by name..."
          />
          <div className="space-y-6">
            {filteredProviders.map((provider) => (
            <GlassCard 
              key={provider.id} 
              className="hover:scale-105 transition-transform cursor-pointer"
              onClick={() => router.push(`/providers/${provider.id}`)}
            >
              <div className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-xl font-bold text-[var(--glass-black-dark)]">
                    {provider.name}
                  </h3>
                  {provider.programs && provider.programs.length > 0 ? (
                    <div className="flex flex-wrap gap-2 items-center">
                      {provider.programs.map((program) => (
                        <span
                          key={program.id}
                          className="px-2 py-1 rounded-full text-xs font-semibold bg-[var(--glass-secondary)]/20 text-[var(--glass-secondary)]"
                        >
                          {program.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--glass-gray-medium)]">
                      No programs associated
                    </p>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
          </div>
        </>
      )}
    </div>
  );
}

