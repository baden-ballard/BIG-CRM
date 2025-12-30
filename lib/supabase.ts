import { createBrowserClient } from '@supabase/ssr';

// Try NEXT_PUBLIC_ prefixed vars first (for client-side), then fall back to non-prefixed
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

// Debug logging (only in development)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('Supabase Config Check:');
  console.log('   URL configured:', !!supabaseUrl && !supabaseUrl.includes('placeholder'));
  console.log('   URL length:', supabaseUrl.length);
  console.log('   Key configured:', !!supabaseAnonKey && !supabaseAnonKey.includes('placeholder'));
  console.log('   Key length:', supabaseAnonKey.length);
  console.log('   Key starts with:', supabaseAnonKey.substring(0, 20) + '...');
  console.log('   Key has spaces:', supabaseAnonKey.includes(' '));
  console.log('   Key has quotes:', supabaseAnonKey.startsWith('"') || supabaseAnonKey.startsWith("'"));
}

// Validate environment variables
if (!supabaseUrl || supabaseUrl === '' || supabaseUrl.includes('placeholder')) {
  console.error('Supabase URL is not configured.');
  console.error('   Please set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) in your .env.local file.');
  console.error('   Note: For client-side access, use NEXT_PUBLIC_SUPABASE_URL');
}

if (!supabaseAnonKey || supabaseAnonKey === '' || supabaseAnonKey.includes('placeholder')) {
  console.error('Supabase API key is not configured.');
  console.error('   Please set NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_KEY) in your .env.local file.');
  console.error('   Note: For client-side access, use NEXT_PUBLIC_SUPABASE_ANON_KEY');
} else if (supabaseAnonKey.length < 100) {
  console.warn('API key seems too short. Expected length: 200+ characters. Current length:', supabaseAnonKey.length);
  console.warn('   Make sure you copied the entire key from Supabase Dashboard.');
} else if (supabaseAnonKey.includes(' ')) {
  console.warn('API key contains spaces. This might cause issues. Remove any spaces.');
} else if (supabaseAnonKey.startsWith('"') || supabaseAnonKey.startsWith("'")) {
  console.warn('API key starts with quotes. Remove quotes from your .env file.');
}

// Create browser client using @supabase/ssr for proper cookie handling
// This ensures cookies set by server-side routes are properly read
export const supabase = createBrowserClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

