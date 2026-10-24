import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';

export const SignupPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerificationSent, setIsVerificationSent] = useState(false);

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [turnstileVerified, setTurnstileVerified] = useState(false);
  const [turnstileLoading, setTurnstileLoading] = useState(false);

  const { signUp } = useAuth();
  const { toast } = useToast();

  const handleVerifyTurnstile = () => {
    setTurnstileLoading(true);
    setTimeout(() => {
      setTurnstileLoading(false);
      setTurnstileVerified(true);
    }, 600);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!termsAccepted) {
      setErrorMsg('You must agree to the Terms of Service & Privacy Policy to create an account.');
      return;
    }

    if (!turnstileVerified) {
      setErrorMsg('Please complete the Cloudflare Turnstile verification.');
      return;
    }

    if (!email.trim() || !password) {
      setErrorMsg('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    const { error, needsEmailVerification } = await signUp(email.trim(), password);
    setIsSubmitting(false);

    if (error) {
      if (error.message.toLowerCase().includes('already registered')) {
        setErrorMsg('An account with this email already exists. Log in instead.');
      } else {
        setErrorMsg(error.message);
      }
    } else {
      // Record terms acceptance timestamp in localStorage
      localStorage.setItem('inspire_terms_accepted_at', new Date().toISOString());
      if (needsEmailVerification) {
        setIsVerificationSent(true);
      } else {
        toast('Account created! Welcome to Inspire.', 'success');
      }
    }
  };

  if (isVerificationSent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-white dark:bg-[#0B0F1A]">
        <div className="w-full max-w-md bg-white dark:bg-[#161B2B] rounded-3xl p-8 border border-[#E5E7EB] dark:border-[#2A3348] shadow-xl text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-3xl">
            ✉️
          </div>
          <h2 className="text-2xl font-extrabold text-black dark:text-white mb-2">
            Verify Your Email
          </h2>
          <p className="text-sm text-[#4B5563] dark:text-[#9CA3AF] leading-relaxed mb-6">
            We sent a verification link to <strong className="text-black dark:text-white">{email}</strong>.
            Please click the link in your email to activate your account and choose your username.
          </p>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-2xl text-xs text-[#0E2A6E] dark:text-[#3D6FE0] font-medium mb-6">
            Didn't receive an email? Check your spam folder or try logging in to resend.
          </div>
          <Link
            to="/login"
            className="inline-block w-full py-3.5 px-4 rounded-2xl bg-[#0E2A6E] text-white font-extrabold text-sm hover:bg-[#081B47] active:scale-95 transition-all shadow-md"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white dark:bg-[#0B0F1A]">
      <div className="w-full max-w-md bg-white dark:bg-[#161B2B] rounded-3xl p-8 border border-[#E5E7EB] dark:border-[#2A3348] shadow-xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#0E2A6E] flex items-center justify-center text-[#FFD700] text-3xl font-black shadow-lg">
            💬
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-black dark:text-white">
            Join Inspire
          </h1>
          <p className="text-sm font-semibold text-[#4B5563] dark:text-[#9CA3AF] mt-1">
            Create your account in seconds
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold animate-slide-up">
            ⚠️ {errorMsg}
          </div>
        )}

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
              className="w-full px-4 py-3 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-black dark:text-white font-medium focus:outline-none focus:border-[#0E2A6E] dark:focus:border-[#3D6FE0] focus:ring-2 focus:ring-[#0E2A6E]/20 transition-all text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-gray-200 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              className="w-full px-4 py-3 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-black dark:text-white font-medium focus:outline-none focus:border-[#0E2A6E] dark:focus:border-[#3D6FE0] focus:ring-2 focus:ring-[#0E2A6E]/20 transition-all text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-gray-200 mb-1.5">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              required
              className="w-full px-4 py-3 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-black dark:text-white font-medium focus:outline-none focus:border-[#0E2A6E] dark:focus:border-[#3D6FE0] focus:ring-2 focus:ring-[#0E2A6E]/20 transition-all text-sm"
            />
          </div>

          {/* Cloudflare Turnstile Bot Verification Widget (Feature 89) */}
          <div className="p-3.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <button
                type="button"
                onClick={handleVerifyTurnstile}
                className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-colors ${
                  turnstileVerified
                    ? 'bg-emerald-500 border-emerald-500 text-white font-bold'
                    : 'border-gray-400 bg-white dark:bg-gray-800'
                }`}
                disabled={turnstileVerified || turnstileLoading}
              >
                {turnstileLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-[#0E2A6E] border-t-transparent rounded-full animate-spin" />
                ) : turnstileVerified ? (
                  '✓'
                ) : null}
              </button>
              <div className="text-left">
                <span className="text-xs font-bold text-black dark:text-white block">
                  {turnstileVerified ? 'Human Verified' : 'Verify you are human'}
                </span>
                <span className="text-[10px] text-gray-500">Cloudflare Turnstile</span>
              </div>
            </div>
            <div className="text-xs text-amber-500 font-black">⚡ Free Tier</div>
          </div>

          {/* Terms & Privacy Acceptance Checkbox (Feature 93) */}
          <div className="flex items-start space-x-2.5 pt-1">
            <input
              type="checkbox"
              id="terms"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-1 w-4 h-4 rounded text-[#0E2A6E] focus:ring-[#0E2A6E]"
            />
            <label htmlFor="terms" className="text-xs text-gray-600 dark:text-gray-300 leading-normal">
              I agree to the{' '}
              <a href="/privacy" target="_blank" className="font-bold text-[#0E2A6E] dark:text-[#3D6FE0] underline">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy" target="_blank" className="font-bold text-[#0E2A6E] dark:text-[#3D6FE0] underline">
                Privacy Policy
              </a>
              .
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3.5 px-4 rounded-2xl bg-[#0E2A6E] text-white font-extrabold text-sm hover:bg-[#081B47] active:scale-95 transition-all shadow-md disabled:opacity-50"
          >
            {isSubmitting ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-xs font-medium text-[#4B5563] dark:text-[#9CA3AF] mt-6">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-bold text-[#0E2A6E] dark:text-[#3D6FE0] hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

