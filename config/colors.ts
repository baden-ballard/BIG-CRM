/**
 * Color Palette Configuration
 * 
 * Customize these colors to match your brand.
 * Update the CSS variables in glassmorphic.css to use these values.
 */

export const colors = {
  // Primary Colors - Modern professional blue-purple gradient
  primary: '#192552', // Custom blue
  primaryDark: '#141d3f', // Darker blue
  primaryLight: '#2a3a6b', // Lighter blue
  
  // Secondary Colors
  secondary: '#8b5cf6', // Violet-500
  secondaryDark: '#7c3aed', // Violet-600
  secondaryLight: '#a78bfa', // Violet-400
  
  // Accent Colors
  accent: '#06b6d4', // Cyan-500
  accentDark: '#0891b2', // Cyan-600
  accentLight: '#22d3ee', // Cyan-400
  
  // Status Colors
  success: '#10b981', // Emerald-500
  successLight: '#34d399', // Emerald-400
  warning: '#f59e0b', // Amber-500
  warningLight: '#fbbf24', // Amber-400
  error: '#C6282B', // Custom red
  errorLight: '#E85C5F', // Custom red light
  info: '#192552', // Custom blue
  infoLight: '#2a3a6b', // Lighter blue
  
  // Neutral Colors - Refined grays
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
  
  grayLight: '#9ca3af',
  grayMedium: '#6b7280',
  grayDark: '#4b5563',
  black: '#111827',
  blackDark: '#0f172a',
  
  // Glass Effects - Enhanced transparency and depth
  glass: {
    bgLight: 'rgba(255, 255, 255, 0.1)',
    bgMedium: 'rgba(255, 255, 255, 0.2)',
    bgDark: 'rgba(255, 255, 255, 0.05)',
    bgPrimary: 'rgba(25, 37, 82, 0.1)', // Custom blue with transparency
    borderLight: 'rgba(255, 255, 255, 0.25)',
    borderMedium: 'rgba(255, 255, 255, 0.35)',
    borderDark: 'rgba(0, 0, 0, 0.08)',
    shadowLight: 'rgba(25, 37, 82, 0.1)',
    shadowMedium: 'rgba(25, 37, 82, 0.15)',
  },
  
  // Base Colors
  background: '#f8fafc', // Slate-50
  backgroundAlt: '#f1f5f9', // Slate-100
  foreground: '#0f172a', // Slate-900
  foregroundLight: '#475569', // Slate-600
};

/**
 * Helper function to convert hex to rgba
 */
export function hexToRgba(hex: string, alpha: number = 1): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
