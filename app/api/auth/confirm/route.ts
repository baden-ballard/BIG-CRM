import { type EmailOtpType } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../lib/supabase-server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/reset-password';

  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = next;
  redirectTo.searchParams.delete('token_hash');
  redirectTo.searchParams.delete('type');
  redirectTo.searchParams.delete('next');

  if (token_hash && type) {
    try {
      // Create response first so we can set cookies in it
      const response = NextResponse.redirect(redirectTo);
      const supabase = await createServerSupabaseClient(response);
      
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash,
      });

      if (!error) {
        // Get the session to ensure cookies are set
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // Return the response with cookies set
          return response;
        } else {
          // Session not created, redirect with error
          redirectTo.pathname = '/reset-password';
          redirectTo.searchParams.set('error', 'session_failed');
          return NextResponse.redirect(redirectTo);
        }
      } else {
        console.error('OTP verification error:', error);
        // Redirect to error page or reset password page with error
        redirectTo.pathname = '/reset-password';
        redirectTo.searchParams.set('error', 'invalid_token');
        return NextResponse.redirect(redirectTo);
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      redirectTo.pathname = '/reset-password';
      redirectTo.searchParams.set('error', 'verification_failed');
      return NextResponse.redirect(redirectTo);
    }
  }

  // If no token_hash or type, redirect to reset password page with error
  redirectTo.pathname = '/reset-password';
  redirectTo.searchParams.set('error', 'missing_token');
  return NextResponse.redirect(redirectTo);
}

