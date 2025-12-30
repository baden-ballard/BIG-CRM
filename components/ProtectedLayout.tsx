'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';

interface ProtectedLayoutProps {
  children: React.ReactNode;
}

export default function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Wait for auth to finish loading
    if (loading) {
      return;
    }

    // If on login page and already authenticated, redirect to home
    if (pathname === '/login' && user) {
      router.push('/');
      return;
    }

    // If not on login page and not authenticated, redirect to login
    if (pathname !== '/login' && !user) {
      router.push('/login');
    }
  }, [user, loading, router, pathname]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--glass-secondary)]"></div>
          <p className="mt-4 text-[var(--glass-gray-medium)]">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render protected content if not authenticated (will redirect)
  if (!user && pathname !== '/login') {
    return null;
  }

  return <>{children}</>;
}

