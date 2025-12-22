import { ReactNode, ButtonHTMLAttributes } from 'react';
import Link from 'next/link';

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  href?: string;
  variant?: 'primary' | 'glass' | 'outline';
  className?: string;
}

/**
 * GlassButton Component
 * 
 * Button component with glassmorphic effects and optional link functionality.
 */
export default function GlassButton({
  children,
  href,
  variant = 'glass',
  className = '',
  ...props
}: GlassButtonProps) {
  const baseClasses = 'px-6 py-3 rounded-full font-semibold transition-all duration-300 cursor-pointer';
  
  const variantClasses = {
    primary: 'bg-[var(--glass-secondary)] text-white hover:bg-[var(--glass-secondary-dark)] shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300',
    glass: 'bg-[var(--glass-secondary)] text-white hover:bg-[var(--glass-secondary-dark)] shadow-lg hover:shadow-xl transition-all duration-300',
    outline: 'bg-[var(--glass-secondary)] text-white hover:bg-[var(--glass-secondary-dark)] shadow-lg hover:shadow-xl transition-all duration-300',
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
