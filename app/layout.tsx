import type { Metadata } from 'next';
import './globals.css';
import '../styles/glassmorphic.css';
import Sidebar from '../components/Sidebar';

export const metadata: Metadata = {
  title: 'BIG CRM - Sales Pipeline & Account Management',
  description: 'Simple CRM for managing groups, participants, programs, and providers',
};

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/groups', label: 'Groups' },
  { href: '/medicare-plans', label: 'Medicare Plans' },
  { href: '/participants', label: 'Participants' },
  { href: '/programs', label: 'Programs' },
  { href: '/providers', label: 'Providers' },
  { href: '/participant-group-plan-rates', label: 'Participant Group Plan Rates' },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen relative">
        <div className="flex h-screen">
          <Sidebar items={navItems} />
          <main className="flex-1 ml-64 overflow-y-auto">
            <div className="p-8">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}

