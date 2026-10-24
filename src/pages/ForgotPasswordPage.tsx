import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, isConfigured } from '../lib/supabaseClient';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    if (isConfigured) {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`,
      }).catch(() => {});
    }
    setIsSubmitting(false);
    // Always show same message to prevent account enumeration
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white dark:bg-[#0B0F1A]">
      <div className="w-full max-w-md bg-white dark:bg-[#161B2B] rounded-3xl p-8 border border-[#E5E7EB] dark:border-[#2A3348] shadow-xl">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[#0E2A6E] flex items-center justify-center text-[#FFD700] text-2xl font-black">
            🔑
          </div>
          <h1 className="text-2xl font-extrabold text-black dark:text-white">
            Reset Password
          </h1>
          <p className="text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mt-1">
            Enter your email to receive recovery instructions
          </p>
        </div>

        {submitted ? (
          <div className="text-center space-y-4 animate-slide-up">
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-medium leading-relaxed">
              If an account with that email exists, we've sent password reset instructions to your inbox.
            </div>
            <Link
              to="/login"
              className="inline-block w-full py-3 px-4 rounded-2xl bg-[#0E2A6E] text-white font-extrabold text-xs hover:bg-[#081B47] transition-all shadow-md"
            >
              Return to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-gray-200 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-black dark:text-white font-medium focus:outline-none focus:border-[#0E2A6E] dark:focus:border-[#3D6FE0] focus:ring-2 focus:ring-[#0E2A6E]/20 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#0E2A6E] text-white font-extrabold text-sm hover:bg-[#081B47] active:scale-95 transition-all shadow-md disabled:opacity-50"
            >
              {isSubmitting ? 'Sending instructions…' : 'Send Reset Link'}
            </button>

            <div className="text-center pt-2">
              <Link
                to="/login"
                className="text-xs font-bold text-[#0E2A6E] dark:text-[#3D6FE0] hover:underline"
              >
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
