import { type EmailOtpType } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../lib/supabase-server';

export async function GET(request: NextRequest) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/3a6a5ac4-a463-4d1c-82bb-202cb212287a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/confirm/route.ts:6',message:'API route entry',data:{url:request.url,method:request.method,userAgent:request.headers.get('user-agent')?.substring(0,50)||null,referer:request.headers.get('referer')||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
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
  
  // Also try decoded version in case email client double-encoded it
  const token_hash_decoded = token_hash ? decodeURIComponent(token_hash) : null;
  const token_hash_from_params = searchParams.get('token_hash');
  
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/reset-password';

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/3a6a5ac4-a463-4d1c-82bb-202cb212287a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/confirm/route.ts:25',message:'Query params parsed',data:{token_hash_present:!!token_hash,token_hash_length:token_hash?.length||0,token_hash_preview:token_hash?.substring(0,30)||null,token_hash_end:token_hash?.substring(Math.max(0,token_hash.length-30))||null,token_hash_from_params_present:!!token_hash_from_params,token_hash_from_params_length:token_hash_from_params?.length||0,token_hash_decoded_length:token_hash_decoded?.length||0,token_hash_has_percent:token_hash?.includes('%')||false,type,next,allParams:Object.fromEntries(searchParams)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,C'})}).catch(()=>{});
  // #endregion

  console.log('Password reset confirmation:', {
    token_hash: token_hash ? `${token_hash.substring(0, 20)}...` : null,
    token_hash_length: token_hash?.length || 0,
    type,
    next,
    has_token_hash: !!token_hash,
    has_type: !!type,
  });

  // Check if this is a direct verification request (from button click) or email link
  const isDirectVerify = searchParams.get('verify') === 'true';
  
  // If we have token_hash but NOT a direct verify request, redirect to confirmation page
  // This prevents email prefetching from consuming the OTP token
  if (token_hash && type && !isDirectVerify) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3a6a5ac4-a463-4d1c-82bb-202cb212287a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/confirm/route.ts:50',message:'Redirecting to confirmation page to prevent email prefetch',data:{userAgent:userAgent.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Redirect to confirmation page - user must click button to verify
    const confirmUrl = request.nextUrl.clone();
    confirmUrl.pathname = '/reset-password';
    confirmUrl.searchParams.set('token_hash', token_hash);
    confirmUrl.searchParams.set('type', type);
    confirmUrl.searchParams.set('next', next);
    confirmUrl.searchParams.set('confirm', 'true');
    return NextResponse.redirect(confirmUrl);
  }

  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = next;
  redirectTo.searchParams.delete('token_hash');
  redirectTo.searchParams.delete('type');
  redirectTo.searchParams.delete('next');
  redirectTo.searchParams.delete('verify');

  if (token_hash && type && isDirectVerify) {
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
      fetch('http://127.0.0.1:7242/ingest/3a6a5ac4-a463-4d1c-82bb-202cb212287a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/confirm/route.ts:70',message:'Before verifyOtp call',data:{type,token_hash_length:token_hash?.length||0,token_hash_start:token_hash?.substring(0,30)||null,token_hash_end:token_hash?.substring(Math.max(0,token_hash.length-30))||null,token_hash_has_special_chars:token_hash ? /[^a-zA-Z0-9\-_]/g.test(token_hash) : false,using_decoded:false},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      // Verify the OTP - this should create a session for password recovery
      // For recovery type, verifyOtp creates a temporary recovery session
      let verifyData: any = null;
      let error: any = null;
      
      // Try with original token_hash first
      const verifyResult = await supabase.auth.verifyOtp({
        type,
        token_hash,
      });
      verifyData = verifyResult.data;
      error = verifyResult.error;
      
      // If that fails and we have a decoded version, try that
      if (error && token_hash_decoded && token_hash_decoded !== token_hash) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3a6a5ac4-a463-4d1c-82bb-202cb212287a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/confirm/route.ts:82',message:'First verifyOtp failed, trying decoded token_hash',data:{firstError:error?.message,firstErrorStatus:error?.status,token_hash_decoded_length:token_hash_decoded?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        
        const verifyResult2 = await supabase.auth.verifyOtp({
          type,
          token_hash: token_hash_decoded,
        });
        if (!verifyResult2.error) {
          verifyData = verifyResult2.data;
          error = verifyResult2.error;
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/3a6a5ac4-a463-4d1c-82bb-202cb212287a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/confirm/route.ts:90',message:'Decoded token_hash worked',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
        }
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3a6a5ac4-a463-4d1c-82bb-202cb212287a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/confirm/route.ts:68',message:'After verifyOtp call',data:{hasError:!!error,errorMessage:error?.message,errorStatus:error?.status,errorName:error?.name,errorCode:error?.code,hasSession:!!verifyData?.session,hasUser:!!verifyData?.user,userId:verifyData?.user?.id||null,sessionAccessToken:verifyData?.session?.access_token?.substring(0,20)||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D,E'})}).catch(()=>{});
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
        fetch('http://127.0.0.1:7242/ingest/3a6a5ac4-a463-4d1c-82bb-202cb212287a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/confirm/route.ts:120',message:'Error path - verifyOtp failed',data:{errorMessage:error?.message,errorStatus:error?.status,errorName:error?.name,errorCode:error?.code,fullError:JSON.stringify(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        console.error('OTP verification error:', {
          message: error?.message,
          status: error?.status,
          name: error?.name,
          code: error?.code,
        });
        // Redirect to error page or reset password page with error
        // Include detailed error info for debugging
        redirectTo.pathname = '/reset-password';
        redirectTo.searchParams.set('error', 'invalid_token');
        const errorDetail = `${error?.message || 'Unknown error'} (Status: ${error?.status || 'N/A'}, Code: ${error?.code || 'N/A'})`;
        redirectTo.searchParams.set('error_detail', encodeURIComponent(errorDetail));
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

