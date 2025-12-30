'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { signOut } from '../lib/auth';

interface NavItem {
  href: string;
  label: string;
  icon?: React.ReactNode;
}

interface SidebarProps {
  items: NavItem[];
}

export default function Sidebar({ items }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname?.startsWith(href);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <aside className="glass-sidebar fixed left-0 top-0 h-full w-64 z-40">
      <div className="flex flex-col h-full p-6">
        {/* Logo */}
        <div className="mb-8 pb-6 border-b border-white/20">
          <Link href="/" className="block">
            <div className="relative w-full max-w-[200px]">
              <Image
                src="/assets/ballard-logo.png"
                alt="Ballard Insurance Group LLC"
                width={1360}
                height={347}
                className="h-auto w-full max-w-[200px]"
                style={{ 
                  backgroundColor: 'transparent',
                  background: 'none',
                  display: 'block'
                }}
                priority
              />
            </div>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1">
          {items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                  className={`
                  relative flex items-center gap-3 px-4 py-3 rounded-xl
                  font-semibold text-sm
                  ${
                    active
                      ? 'text-white bg-[var(--glass-secondary)] shadow-sm'
                      : 'text-[var(--glass-black-dark)] hover:bg-white/20 hover:text-[var(--glass-secondary)] transition-colors duration-200'
                  }
                `}
              >
                {item.icon && <span className="text-xl">{item.icon}</span>}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info and Logout */}
        <div className="pt-6 border-t border-white/20">
          {user && (
            <div className="mb-4 px-4 py-2">
              <p className="text-xs text-[var(--glass-gray-medium)] mb-1">Signed in as</p>
              <p className="text-sm font-semibold text-[var(--glass-black-dark)] truncate">
                {user.email}
              </p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full px-4 py-3 rounded-xl font-semibold text-sm text-[var(--glass-black-dark)] hover:bg-white/20 hover:text-red-600 transition-colors duration-200 text-left"
          >
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
