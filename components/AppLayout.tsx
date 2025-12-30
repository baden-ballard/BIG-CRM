'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
  navItems: Array<{ href: string; label: string }>;
}

export default function AppLayout({ children, navItems }: AppLayoutProps) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  // Don't show sidebar on login page
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Show sidebar for authenticated pages
  return (
    <div className="flex h-screen">
      <Sidebar items={navItems} />
      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

