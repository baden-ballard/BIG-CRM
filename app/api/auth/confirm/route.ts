import { type EmailOtpType } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../lib/supabase-server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // Get token_hash - try both encoded and decoded versions
  // Supabase sends it URL-encoded, but we need to use it as-is for verification
  const token_hash_raw = searchParams.get('token_hash');
  const token_hash = token_hash_raw || null;
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/reset-password';

  console.log('Password reset confirmation:', {
    token_hash: token_hash ? `${token_hash.substring(0, 20)}...` : null,
    token_hash_length: token_hash?.length || 0,
    type,
    next,
    has_token_hash: !!token_hash,
    has_type: !!type,
  });

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
      
      console.log('Verifying OTP with type:', type, 'token_hash length:', token_hash?.length);
      
      // Verify the OTP - this should create a session for password recovery
      const { data: verifyData, error } = await supabase.auth.verifyOtp({
        type,
        token_hash,
      });

      console.log('OTP verification result:', {
        hasError: !!error,
        errorMessage: error?.message,
        errorStatus: error?.status,
        hasSession: !!verifyData?.session,
        hasUser: !!verifyData?.user,
      });

      if (!error && verifyData?.session) {
        console.log('OTP verified successfully, session created for user:', verifyData.user?.email);
        // The session should already be set in cookies by createServerClient
        // Return the response with cookies set
        return response;
      } else if (!error && !verifyData?.session) {
        console.error('OTP verified but no session returned');
        // Try to get session explicitly
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Error getting session after OTP verification:', sessionError);
        }
        
        if (session) {
          console.log('Session retrieved successfully for user:', session.user.email);
          return response;
        } else {
          console.error('No session available after OTP verification');
          // Session not created, redirect with error
          redirectTo.pathname = '/reset-password';
          redirectTo.searchParams.set('error', 'session_failed');
          return NextResponse.redirect(redirectTo);
        }
      } else {
        console.error('OTP verification error:', {
          message: error?.message,
          status: error?.status,
          name: error?.name,
        });
        // Redirect to error page or reset password page with error
        redirectTo.pathname = '/reset-password';
        redirectTo.searchParams.set('error', 'invalid_token');
        redirectTo.searchParams.set('error_detail', encodeURIComponent(error?.message || 'Unknown error'));
        return NextResponse.redirect(redirectTo);
      }
    } catch (error: any) {
      console.error('Exception verifying OTP:', {
        message: error?.message,
        stack: error?.stack,
      });
      redirectTo.pathname = '/reset-password';
      redirectTo.searchParams.set('error', 'verification_failed');
      return NextResponse.redirect(redirectTo);
    }
  }

  // If no token_hash or type, redirect to reset password page with error
  console.error('Missing token_hash or type:', { token_hash: !!token_hash, type });
  redirectTo.pathname = '/reset-password';
  redirectTo.searchParams.set('error', 'missing_token');
  return NextResponse.redirect(redirectTo);
}

