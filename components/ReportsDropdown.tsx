'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ReportOption {
  label: string;
  href: string;
  description?: string;
}

interface ReportsDropdownProps {
  reports?: ReportOption[];
}

const defaultReports: ReportOption[] = [
  {
    label: 'Active Plans',
    href: '/reports/active-plans',
    description: 'View all active group plans',
  },
  {
    label: 'Medicare Download Report',
    href: '/reports/medicare-download',
    description: 'Export participants with active Medicare plans',
  },
  {
    label: 'Groups Download Report',
    href: '/reports/groups-download',
    description: 'Export participants with active group plans',
  },
  // Add more reports here as they are created
];

export default function ReportsDropdown({ reports = defaultReports }: ReportsDropdownProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle clicking outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleReportClick = (href: string) => {
    router.push(href);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-6 py-3 rounded-full font-semibold transition-all duration-300 bg-[var(--glass-secondary)] text-white shadow-lg hover:shadow-xl hover:opacity-90 flex items-center gap-2"
      >
        <span>Reports</span>
        <span className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-64 bg-white/95 backdrop-blur-md border border-white/30 rounded-xl shadow-lg overflow-hidden">
          <div className="py-2">
            {reports.length === 0 ? (
              <div className="px-4 py-3 text-sm text-[var(--glass-gray-medium)]">
                No reports available
              </div>
            ) : (
              reports.map((report, index) => (
                <button
                  key={index}
                  onClick={() => handleReportClick(report.href)}
                  className="w-full px-4 py-3 text-left hover:bg-white/50 transition-colors border-b border-white/10 last:border-b-0"
                >
                  <div className="font-semibold text-[var(--glass-black-dark)]">
                    {report.label}
                  </div>
                  {report.description && (
                    <div className="text-xs text-[var(--glass-gray-medium)] mt-1">
                      {report.description}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

