'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import GlassCard from '../../components/GlassCard';
import GlassButton from '../../components/GlassButton';
import { updatePassword, getSession } from '../../lib/auth';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Check if we have token_hash and type in URL (from email prefetch protection)
    const token_hash = searchParams.get('token_hash');
    const type = searchParams.get('type');
    const confirm = searchParams.get('confirm');
    const next = searchParams.get('next') || '/reset-password';
    
    // If we have token_hash and confirm flag, show confirmation button instead of auto-verifying
    // This prevents email prefetching from consuming the token
    if (token_hash && type && confirm === 'true') {
      // Don't auto-verify - wait for user to click button
      setCheckingSession(false);
      setIsValidSession(false); // Will be set to true after button click
      return;
    }
    
    // Check for error query parameter from API route
    const errorParam = searchParams.get('error');
    const errorDetail = searchParams.get('error_detail');
    if (errorParam) {
      let errorMessage = 'Invalid or expired reset link. Please request a new password reset.';
      if (errorParam === 'invalid_token') {
        errorMessage = 'Invalid reset token. Please request a new password reset.';
        if (errorDetail) {
          errorMessage += ` (Details: ${decodeURIComponent(errorDetail)})`;
        }
      } else if (errorParam === 'verification_failed') {
        errorMessage = 'Token verification failed. Please request a new password reset.';
        if (errorDetail) {
          errorMessage += ` (Details: ${decodeURIComponent(errorDetail)})`;
        }
      } else if (errorParam === 'missing_token') {
        errorMessage = 'Reset token is missing. Please request a new password reset.';
      } else if (errorParam === 'session_failed') {
        errorMessage = 'Session creation failed. Please request a new password reset.';
      }
      setError(errorMessage);
      setCheckingSession(false);
      return;
    }

    // Check if user has a valid session (from password recovery token)
    // Add a small delay to ensure cookies are available after redirect
    let interval: NodeJS.Timeout | null = null;
    let attempts = 0;
    const maxAttempts = 5;
    
    const tryGetSession = async (): Promise<boolean> => {
      try {
        const session = await getSession();
        if (session) {
          setIsValidSession(true);
          setCheckingSession(false);
          return true;
        }
        return false;
      } catch (err) {
        console.error('Error checking session:', err);
        return false;
      }
    };

    const checkSession = async () => {
      // Try immediately
      if (await tryGetSession()) {
        return;
      }

      // Retry with delays
      interval = setInterval(async () => {
        attempts++;
        const found = await tryGetSession();
        if (found || attempts >= maxAttempts) {
          if (interval) clearInterval(interval);
          if (attempts >= maxAttempts && !found) {
            setError('Invalid or expired reset link. Please request a new password reset.');
            setCheckingSession(false);
          }
        }
      }, 500); // Check every 500ms
    };

    checkSession();

    // Cleanup on unmount
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [searchParams]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    try {
      await updatePassword(password);
      setSuccess(true);
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <GlassCard>
            <div className="text-center">
              <p className="text-[var(--glass-gray-medium)]">Verifying reset link...</p>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  // Show confirmation page if we have token_hash but haven't verified yet
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const confirm = searchParams.get('confirm');
  const next = searchParams.get('next') || '/reset-password';
  
  // Handle token verification when user clicks the button
  const handleVerifyToken = async () => {
    if (!token_hash || !type) return;
    
    setCheckingSession(true);
    setError(null);
    
    try {
      // Call API route with verify=true flag to actually verify the token
      const verifyUrl = `/api/auth/confirm?token_hash=${encodeURIComponent(token_hash)}&type=${type}&next=${encodeURIComponent(next)}&verify=true`;
      const response = await fetch(verifyUrl);
      
      if (response.redirected) {
        // Success - follow redirect to reset password page with session
        window.location.href = response.url;
      } else {
        // Error - parse error from redirect
        const url = new URL(response.url);
        const errorParam = url.searchParams.get('error');
        const errorDetail = url.searchParams.get('error_detail');
        let errorMessage = 'Token verification failed. Please request a new password reset.';
        if (errorDetail) {
          errorMessage += ` (${decodeURIComponent(errorDetail)})`;
        }
        setError(errorMessage);
        setCheckingSession(false);
      }
    } catch (err: any) {
      console.error('Error verifying token:', err);
      setError('Token verification failed. Please request a new password reset.');
      setCheckingSession(false);
    }
  };
  
  // Show confirmation button if we have token_hash but haven't verified
  if (token_hash && type && confirm === 'true' && !isValidSession) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <GlassCard>
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
                Reset Password
              </h1>
              <p className="text-[var(--glass-gray-medium)] mb-6">
                Click the button below to verify your password reset link
              </p>
              {error && (
                <div className="mb-6 p-4 rounded-lg bg-red-500/20 border border-red-500/50">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}
              <GlassButton
                onClick={handleVerifyToken}
                variant="primary"
                className="w-full"
                disabled={checkingSession}
              >
                {checkingSession ? 'Verifying...' : 'Verify Reset Link'}
              </GlassButton>
              <div className="mt-4">
                <Link
                  href="/forgot-password"
                  className="text-sm text-[var(--glass-secondary)] hover:text-[var(--glass-secondary-dark)] transition-colors"
                >
                  Request New Reset Link
                </Link>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }
  
  if (!isValidSession && !token_hash) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <GlassCard>
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
                Invalid Reset Link
              </h1>
              <p className="text-[var(--glass-gray-medium)] mb-6">
                {error || 'This password reset link is invalid or has expired.'}
              </p>
              <Link href="/forgot-password">
                <GlassButton variant="primary" className="w-full">
                  Request New Reset Link
                </GlassButton>
              </Link>
              <div className="mt-4">
                <Link
                  href="/login"
                  className="text-sm text-[var(--glass-secondary)] hover:text-[var(--glass-secondary-dark)] transition-colors"
                >
                  Back to Login
                </Link>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <GlassCard>
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
              Reset Password
            </h1>
            <p className="text-[var(--glass-gray-medium)]">
              Enter your new password below
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-500/20 border border-red-500/50">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {success ? (
            <div className="space-y-6">
              <div className="p-4 rounded-lg bg-green-500/20 border border-green-500/50">
                <p className="text-green-600 text-sm">
                  Password reset successfully! Redirecting to login...
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2"
                >
                  New Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-[var(--glass-black-dark)] placeholder-[var(--glass-gray-medium)] focus:outline-none focus:ring-2 focus:ring-[var(--glass-secondary)] focus:border-transparent transition-all"
                  placeholder="Enter new password"
                  disabled={loading}
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2"
                >
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-[var(--glass-black-dark)] placeholder-[var(--glass-gray-medium)] focus:outline-none focus:ring-2 focus:ring-[var(--glass-secondary)] focus:border-transparent transition-all"
                  placeholder="Confirm new password"
                  disabled={loading}
                />
              </div>

              <GlassButton
                type="submit"
                variant="primary"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </GlassButton>

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-sm text-[var(--glass-secondary)] hover:text-[var(--glass-secondary-dark)] transition-colors"
                >
                  Back to Login
                </Link>
              </div>
            </form>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

