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
    // Check for error query parameter from API route
    const errorParam = searchParams.get('error');
    if (errorParam) {
      let errorMessage = 'Invalid or expired reset link. Please request a new password reset.';
      if (errorParam === 'invalid_token') {
        errorMessage = 'Invalid reset token. Please request a new password reset.';
      } else if (errorParam === 'verification_failed') {
        errorMessage = 'Token verification failed. Please request a new password reset.';
      } else if (errorParam === 'missing_token') {
        errorMessage = 'Reset token is missing. Please request a new password reset.';
      }
      setError(errorMessage);
      setCheckingSession(false);
      return;
    }

    // Check if user has a valid session (from password recovery token)
    const checkSession = async () => {
      try {
        const session = await getSession();
        if (session) {
          setIsValidSession(true);
        } else {
          setError('Invalid or expired reset link. Please request a new password reset.');
        }
      } catch (err) {
        setError('Invalid or expired reset link. Please request a new password reset.');
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();
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

  if (!isValidSession) {
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

