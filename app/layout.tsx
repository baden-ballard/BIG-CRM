import type { Metadata } from 'next';
import './globals.css';
import '../styles/glassmorphic.css';
import { AuthProvider } from '../components/AuthProvider';
import ProtectedLayout from '../components/ProtectedLayout';
import AppLayout from '../components/AppLayout';

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
  { href: '/users', label: 'Users' },
  { href: '/participant-group-plan-rates', label: 'Participant Group Plan Rates' },
  { href: '/group-plan-options-rate-history', label: 'Group Plan Options Rate History' },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen relative">
        <AuthProvider>
          <ProtectedLayout>
            <AppLayout navItems={navItems}>
              {children}
            </AppLayout>
          </ProtectedLayout>
        </AuthProvider>
      </body>
    </html>
  );
}



