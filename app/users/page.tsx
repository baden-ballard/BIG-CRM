'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import GlassCard from '../../components/GlassCard';
import GlassButton from '../../components/GlassButton';
import SearchFilter from '../../components/SearchFilter';
import { supabase } from '../../lib/supabase';
import { getCurrentUser } from '../../lib/auth';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Agent' | 'Developer';
  created_at: string;
  updated_at: string;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const user = await getCurrentUser();
      setCurrentUserEmail(user?.email || null);
    } catch (err) {
      console.error('Error fetching current user:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .order('name', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setUsers(data || []);
      setFilteredUsers(data || []);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
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

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
            Users
          </h1>
          <p className="text-[var(--glass-gray-medium)]">
            Manage system users and their roles
          </p>
        </div>
        <GlassButton variant="primary" href="/users/new">
          + New User
        </GlassButton>
      </div>

      {loading && (
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            Loading users...
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

      {!loading && !error && users.length === 0 && (
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            No users found. Create your first user to get started.
          </p>
        </GlassCard>
      )}

      {!loading && !error && users.length > 0 && filteredUsers.length === 0 && (
        <GlassCard>
          <p className="text-[var(--glass-gray-medium)] text-center py-8">
            No users match your search criteria. Try adjusting your filters.
          </p>
        </GlassCard>
      )}

      {!loading && !error && users.length > 0 && (
        <>
          <SearchFilter
            data={users}
            onFilteredDataChange={setFilteredUsers}
            searchFields={['name', 'email']}
            filterOptions={[
              {
                field: 'role',
                label: 'Role',
                searchable: false,
                options: [
                  { label: 'Admin', value: 'Admin' },
                  { label: 'Agent', value: 'Agent' },
                  { label: 'Developer', value: 'Developer' },
                ],
              },
            ]}
            placeholder="Search users by name or email..."
          />
          <div className="space-y-6">
            {filteredUsers.map((user) => (
            <GlassCard 
              key={user.id} 
              className="hover:scale-105 transition-transform cursor-pointer"
              onClick={() => router.push(`/users/${user.id}`)}
            >
              <div className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-[var(--glass-black-dark)] mb-2">
                      {user.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-[var(--glass-gray-medium)] mb-1">
                        {user.email}
                      </p>
                      {currentUserEmail && currentUserEmail.toLowerCase() === user.email.toLowerCase() && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-700 font-medium">
                          Currently Logged In
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(user.role)}`}>
                      {user.role}
                    </span>
                  </div>
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

