'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import GlassCard from '../../components/GlassCard';
import GlassButton from '../../components/GlassButton';
import { resetPasswordForEmail } from '../../lib/auth';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await resetPasswordForEmail(email);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <GlassCard>
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-[var(--glass-black-dark)] mb-2">
              Reset Password
            </h1>
            <p className="text-[var(--glass-gray-medium)]">
              Enter your email address and we'll send you a link to reset your password
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
                  Password reset email sent! Please check your inbox and follow the instructions to reset your password.
                </p>
              </div>
              <Link href="/login">
                <GlassButton variant="primary" className="w-full">
                  Back to Login
                </GlassButton>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-semibold text-[var(--glass-black-dark)] mb-2"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-[var(--glass-black-dark)] placeholder-[var(--glass-gray-medium)] focus:outline-none focus:ring-2 focus:ring-[var(--glass-secondary)] focus:border-transparent transition-all"
                  placeholder="your.email@example.com"
                  disabled={loading}
                />
              </div>

              <GlassButton
                type="submit"
                variant="primary"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
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

