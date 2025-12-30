'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import GlassCard from '../../../components/GlassCard';
import GlassButton from '../../../components/GlassButton';
import { supabase } from '../../../lib/supabase';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Agent' | 'Developer';
  created_at: string;
  updated_at: string;
}

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'Agent' as 'Admin' | 'Agent' | 'Developer',
  });
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchUser();
    }
  }, [userId]);

  const fetchUser = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      if (data) {
        setUser(data);
        setFormData({
          name: data.name,
          email: data.email,
          role: data.role,
        });
      }
    } catch (err: any) {
      console.error('Error fetching user:', err);
      setError(err.message || 'Failed to load user');
    } finally {
      setLoading(false);
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
      const { error: updateError } = await supabase
        .from('users')
        .update({
          name: formData.name,
          email: formData.email,
          role: formData.role,
        })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      setIsEditing(false);
      await fetchUser();
    } catch (err: any) {
      console.error('Error updating user:', err);
      setError(err.message || 'Failed to update user. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (deleteError) {
        throw deleteError;
      }

      router.push('/users');
    } catch (err: any) {
      console.error('Error deleting user:', err);
      setError(err.message || 'Failed to delete user. Please try again.');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const dateOnlyMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      const localDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return localDate.toLocaleDateString();
    }
    return new Date(dateString).toLocaleDateString();
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'Admin':
        return 'bg-red-500/20 text-red-700';
      case 'Developer':
        return 'bg-blue-500/20 text-blue-700';
      case 'Agent':
        return 'bg-green-500/20 text-green-700';
      default:
        return 'bg-gray-500/20 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            Loading user...
          </p>
        </GlassCard>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="max-w-4xl mx-auto">
        <GlassCard>
          <p className="text-red-500 text-center py-8">
            Error: {error}
          </p>
        </GlassCard>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto">
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            User not found.
          </p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="text-[var(--glass-secondary)] hover:text-[var(--glass-secondary-dark)] mb-4 flex items-center gap-2"
        >
          <span>←</span> Back to Users
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
              {isEditing ? 'Edit User' : user.name}
            </h1>
            <p className="text-[var(--glass-gray-medium)]">
              {isEditing ? 'Update user information' : 'User details and settings'}
            </p>
          </div>
          {!isEditing && (
            <div className="flex gap-3">
              <GlassButton variant="outline" onClick={() => setIsEditing(true)}>
                Edit
              </GlassButton>
              <button
                onClick={handleDelete}
                className="px-6 py-3 rounded-full font-semibold bg-[#C6282B] text-white hover:bg-[#A01F22] shadow-lg hover:shadow-xl transition-all duration-300"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <GlassCard>
        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/30">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-[var(--glass-black-dark)] mb-4">
                User Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                    placeholder="Enter user name"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                    placeholder="Enter email address"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="role" className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2">
                  Role *
                </label>
                <select
                  id="role"
                  name="role"
                  required
                  value={formData.role}
                  onChange={handleChange}
                  className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                >
                  <option value="Agent">Agent</option>
                  <option value="Admin">Admin</option>
                  <option value="Developer">Developer</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-4 pt-4 border-t border-white/20">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setFormData({
                    name: user.name,
                    email: user.email,
                    role: user.role,
                  });
                  setError(null);
                }}
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
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </GlassButton>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-[var(--glass-gray-medium)] mb-2">
                  Name
                </label>
                <p className="text-lg text-[var(--glass-black-dark)]">
                  {user.name}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--glass-gray-medium)] mb-2">
                  Email
                </label>
                <p className="text-lg text-[var(--glass-black-dark)]">
                  {user.email}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--glass-gray-medium)] mb-2">
                  Role
                </label>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getRoleBadgeColor(user.role)}`}>
                  {user.role}
                </span>
              </div>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

