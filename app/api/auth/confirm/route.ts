import { type EmailOtpType } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../lib/supabase-server';

export async function GET(request: NextRequest) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/3a6a5ac4-a463-4d1c-82bb-202cb212287a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/confirm/route.ts:6',message:'API route entry',data:{url:request.url,method:request.method},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  const { searchParams } = new URL(request.url);
  // Get token_hash - searchParams.get() automatically decodes URL encoding
  // But Supabase token_hash might contain special characters that need to stay encoded
  // Try getting it raw from the URL string first
  const urlString = request.url;
  let token_hash: string | null = null;
  
  // Extract token_hash from URL manually to preserve encoding
  const tokenHashMatch = urlString.match(/[?&]token_hash=([^&]+)/);
  if (tokenHashMatch) {
    token_hash = tokenHashMatch[1];
  } else {
    // Fallback to searchParams if manual extraction fails
    token_hash = searchParams.get('token_hash');
  }
  
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/reset-password';

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/3a6a5ac4-a463-4d1c-82bb-202cb212287a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/confirm/route.ts:18',message:'Query params parsed',data:{token_hash_present:!!token_hash,token_hash_length:token_hash?.length||0,token_hash_preview:token_hash?.substring(0,30)||null,type,next,allParams:Object.fromEntries(searchParams)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3a6a5ac4-a463-4d1c-82bb-202cb212287a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/confirm/route.ts:32',message:'Before Supabase client creation',data:{hasTokenHash:!!token_hash,hasType:!!type},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion

      // Create response first so we can set cookies in it
      const response = NextResponse.redirect(redirectTo);
      const supabase = await createServerSupabaseClient(response);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3a6a5ac4-a463-4d1c-82bb-202cb212287a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/confirm/route.ts:37',message:'Supabase client created',data:{supabaseUrlConfigured:!!process.env.NEXT_PUBLIC_SUPABASE_URL,supabaseKeyConfigured:!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      console.log('Verifying OTP with type:', type, 'token_hash length:', token_hash?.length);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3a6a5ac4-a463-4d1c-82bb-202cb212287a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/confirm/route.ts:42',message:'Before verifyOtp call',data:{type,token_hash_length:token_hash?.length||0,token_hash_start:token_hash?.substring(0,20)||null,token_hash_end:token_hash?.substring(token_hash.length-20)||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      // Verify the OTP - this should create a session for password recovery
      const { data: verifyData, error } = await supabase.auth.verifyOtp({
        type,
        token_hash,
      });

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3a6a5ac4-a463-4d1c-82bb-202cb212287a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/confirm/route.ts:50',message:'After verifyOtp call',data:{hasError:!!error,errorMessage:error?.message,errorStatus:error?.status,errorName:error?.name,hasSession:!!verifyData?.session,hasUser:!!verifyData?.user,userId:verifyData?.user?.id||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D,E'})}).catch(()=>{});
      // #endregion

      console.log('OTP verification result:', {
        hasError: !!error,
        errorMessage: error?.message,
        errorStatus: error?.status,
        hasSession: !!verifyData?.session,
        hasUser: !!verifyData?.user,
      });

      if (!error && verifyData?.session) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3a6a5ac4-a463-4d1c-82bb-202cb212287a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/confirm/route.ts:58',message:'Success path - session in verifyData',data:{userId:verifyData.user?.id,userEmail:verifyData.user?.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        console.log('OTP verified successfully, session created for user:', verifyData.user?.email);
        // The session should already be set in cookies by createServerClient
        // Return the response with cookies set
        return response;
      } else if (!error && !verifyData?.session) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3a6a5ac4-a463-4d1c-82bb-202cb212287a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/confirm/route.ts:65',message:'No session in verifyData, trying getSession',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        console.error('OTP verified but no session returned');
        // Try to get session explicitly
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3a6a5ac4-a463-4d1c-82bb-202cb212287a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/confirm/route.ts:70',message:'getSession result',data:{hasSession:!!session,hasSessionError:!!sessionError,sessionErrorMsg:sessionError?.message,userId:session?.user?.id||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
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
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3a6a5ac4-a463-4d1c-82bb-202cb212287a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/confirm/route.ts:85',message:'Error path - verifyOtp failed',data:{errorMessage:error?.message,errorStatus:error?.status,errorName:error?.name,fullError:JSON.stringify(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3a6a5ac4-a463-4d1c-82bb-202cb212287a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/confirm/route.ts:95',message:'Exception caught',data:{errorMessage:error?.message,errorStack:error?.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      console.error('Exception verifying OTP:', {
        message: error?.message,
        stack: error?.stack,
      });
      redirectTo.pathname = '/reset-password';
      redirectTo.searchParams.set('error', 'verification_failed');
      return NextResponse.redirect(redirectTo);
    }
  }

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/3a6a5ac4-a463-4d1c-82bb-202cb212287a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/confirm/route.ts:104',message:'Missing params path',data:{token_hash:!!token_hash,type:!!type},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  // If no token_hash or type, redirect to reset password page with error
  console.error('Missing token_hash or type:', { token_hash: !!token_hash, type });
  redirectTo.pathname = '/reset-password';
  redirectTo.searchParams.set('error', 'missing_token');
  return NextResponse.redirect(redirectTo);
}

