'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import { useAuth } from './AuthProvider';
import { supabase } from '../lib/supabase';

interface AppLayoutProps {
  children: React.ReactNode;
  navItems: Array<{ href: string; label: string }>;
}

export default function AppLayout({ children, navItems }: AppLayoutProps) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const { user } = useAuth();
  const [filteredNavItems, setFilteredNavItems] = useState(navItems);

  useEffect(() => {
    const filterNavItems = async () => {
      // If not logged in, show all items (will be filtered by ProtectedLayout)
      if (!user?.email) {
        // Remove developer-only items if not logged in
        setFilteredNavItems(
          navItems.filter(
            (item) =>
              item.href !== '/participant-group-plan-rates' &&
              item.href !== '/group-plan-options-rate-history'
          )
        );
        return;
      }

      try {
        // Fetch user's role from the users table
        const { data, error } = await supabase
          .from('users')
          .select('role')
          .eq('email', user.email)
          .single();

        if (error) {
          console.error('Error fetching user role:', error);
          // On error, don't show developer links
          setFilteredNavItems(
            navItems.filter(
              (item) =>
                item.href !== '/participant-group-plan-rates' &&
                item.href !== '/group-plan-options-rate-history'
            )
          );
          return;
        }

        // If user is a Developer, show all items including developer links
        if (data?.role === 'Developer') {
          setFilteredNavItems(navItems);
        } else {
          // Otherwise, hide developer-only links
          setFilteredNavItems(
            navItems.filter(
              (item) =>
                item.href !== '/participant-group-plan-rates' &&
                item.href !== '/group-plan-options-rate-history'
            )
          );
        }
      } catch (err) {
        console.error('Error checking user role:', err);
        // On error, don't show developer links
        setFilteredNavItems(
          navItems.filter(
            (item) =>
              item.href !== '/participant-group-plan-rates' &&
              item.href !== '/group-plan-options-rate-history'
          )
        );
      }
    };

    filterNavItems();
  }, [user?.email, navItems]);

  // Don't show sidebar on login page
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Show sidebar for authenticated pages
  return (
    <div className="flex h-screen">
      <Sidebar items={filteredNavItems} />
      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

