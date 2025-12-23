'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname?.startsWith(href);
  };

  return (
    <aside className="glass-sidebar fixed left-0 top-0 h-full w-64 z-40">
      <div className="flex flex-col h-full p-6">
        {/* Logo */}
        <div className="mb-8 pb-6 border-b border-white/20">
          <Link href="/" className="block">
            <div className="relative w-full max-w-[200px]">
              <img
                src="/assets/ballard-logo.png"
                alt="Ballard Insurance Group LLC"
                className="h-auto w-full max-w-[200px]"
                style={{ 
                  backgroundColor: 'transparent',
                  display: 'block'
                }}
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
                      ? 'text-[var(--glass-secondary)] bg-white/30 shadow-sm'
                      : 'text-[var(--glass-black-dark)] hover:bg-white/20 hover:text-[var(--glass-secondary)] transition-colors duration-200'
                  }
                `}
              >
                {active && (
                  <div className="absolute left-[5px] top-0 bottom-0 w-1 bg-red-500 rounded-l-xl" />
                )}
                {item.icon && <span className="text-xl">{item.icon}</span>}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
