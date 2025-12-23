'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import GlassCard from '../../../components/GlassCard';
import GlassButton from '../../../components/GlassButton';
import { supabase } from '../../../lib/supabase';

export default function NewProgramPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Insert program into database
      const { data, error } = await supabase
        .from('programs')
        .insert([{ name: formData.name }])
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log('Program created successfully:', data);
      
      // Redirect to programs page
      router.push('/programs');
    } catch (error) {
      console.error('Error creating program:', error);
      alert('Failed to create program. Please try again.');
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
          <span>←</span> Back to Programs
        </button>
        <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
          Add New Program
        </h1>
        <p className="text-[var(--glass-gray-medium)]">
          Create a new program (e.g., Medicare, Group Health)
        </p>
      </div>

      <GlassCard>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Program Information Section */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-4">
              Program Information
            </h2>

            {/* Program Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                Program Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                placeholder="Enter program name (e.g., Medicare, Group Health)"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-white/20">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 rounded-full font-semibold bg-red-500 text-white hover:bg-red-600 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Cancel
            </button>
            <GlassButton
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className={isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
            >
              {isSubmitting ? 'Creating...' : 'Create Program'}
            </GlassButton>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}

