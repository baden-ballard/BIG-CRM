import { ReactNode, HTMLAttributes } from 'react';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  variant?: 'light' | 'dark';
}

/**
 * GlassCard Component
 * 
 * A versatile card component with glassmorphic styling.
 */
export default function GlassCard({
  children,
  className = '',
  variant = 'light',
  ...props
}: GlassCardProps) {
  const baseClasses = variant === 'light' ? 'glass-card' : 'glass-card-dark';
  
  return (
    <div className={`${baseClasses} rounded-3xl p-8 ${className}`} {...props}>
      {children}
    </div>
  );
}

