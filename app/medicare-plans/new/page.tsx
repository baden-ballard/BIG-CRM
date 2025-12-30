'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import GlassCard from '../../../components/GlassCard';
import GlassButton from '../../../components/GlassButton';
import { supabase } from '../../../lib/supabase';

interface Provider {
  id: string;
  name: string;
}

export default function NewMedicarePlanPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    provider_id: '',
    plan_name: '',
    plan_end_date: '',
  });
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      setLoadingProviders(true);

      const { data, error: fetchError } = await supabase
        .from('providers')
        .select('*')
        .order('name', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setProviders(data || []);
    } catch (err: any) {
      console.error('Error fetching providers:', err);
      setError(err.message || 'Failed to load providers');
    } finally {
      setLoadingProviders(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Prepare data for insert
      const insertData: any = {
        provider_id: formData.provider_id,
        plan_name: formData.plan_name,
        plan_end_date: formData.plan_end_date || null,
      };

      // Insert Medicare plan into database
      const { data, error: insertError } = await supabase
        .from('medicare_plans')
        .insert([insertData])
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      console.log('Medicare plan created successfully:', data);
      
      // Redirect to the plan detail page
      router.push(`/medicare-plans/${data.id}`);
    } catch (err: any) {
      console.error('Error creating Medicare plan:', err);
      setError(err.message || 'Failed to create Medicare plan. Please try again.');
      alert('Failed to create Medicare plan. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="text-[var(--glass-secondary)] hover:text-[var(--glass-secondary-dark)] mb-4 flex items-center gap-2"
        >
          <span>←</span> Back to Medicare Plans
        </button>
        <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
          Add New Medicare Plan
        </h1>
        <p className="text-[var(--glass-gray-medium)]">
          Create a new Medicare-specific insurance plan
        </p>
      </div>

      {error && (
        <GlassCard className="mb-6">
          <p className="text-red-500 text-center py-4">
            {error}
          </p>
        </GlassCard>
      )}

      <GlassCard>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Plan Information Section */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-4">
              Plan Information
            </h2>

            {/* Row 1: Provider and Plan Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="provider_id" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  Provider *
                </label>
                {loadingProviders ? (
                  <p className="text-[var(--glass-gray-medium)] text-sm py-2">Loading providers...</p>
                ) : (
                  <select
                    id="provider_id"
                    name="provider_id"
                    required
                    value={formData.provider_id}
                    onChange={handleChange}
                    className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                  >
                    <option value="">Select provider</option>
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label htmlFor="plan_name" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  Plan Name *
                </label>
                <input
                  type="text"
                  id="plan_name"
                  name="plan_name"
                  required
                  value={formData.plan_name}
                  onChange={handleChange}
                  className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                  placeholder="Enter plan name"
                />
              </div>
            </div>

            {/* Row 2: Plan End Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="plan_end_date" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  Plan End Date
                </label>
                <input
                  type="date"
                  id="plan_end_date"
                  name="plan_end_date"
                  value={formData.plan_end_date}
                  onChange={handleChange}
                  className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                  placeholder="Leave empty if plan is active"
                />
                <p className="text-xs text-[var(--glass-gray-medium)] mt-1">
                  Leave empty if the plan is currently active
                </p>
              </div>
            </div>

          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-white/20">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 rounded-full font-semibold bg-[#C6282B] text-white hover:bg-[#A01F22] shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Cancel
            </button>
            <GlassButton
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className={isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
            >
              {isSubmitting ? 'Creating...' : 'Create Medicare Plan'}
            </GlassButton>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}


