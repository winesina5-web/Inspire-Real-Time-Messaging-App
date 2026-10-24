import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { signIn, setDemoUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setIsSubmitting(false);

    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        setErrorMsg('Please verify your email before logging in. Check your inbox for the confirmation link.');
      } else {
        setErrorMsg('Invalid email or password.');
      }
    } else {
      toast('Welcome back to Inspire!', 'success');
      navigate('/chats');
    }
  };

  const handleDemoLogin = (type: 'user' | 'admin') => {
    setDemoUser(type);
    toast(`Logged in as demo ${type}!`, 'success');
    navigate(type === 'admin' ? '/admin' : '/chats');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white dark:bg-[#0B0F1A]">
      <div className="w-full max-w-md bg-white dark:bg-[#161B2B] rounded-3xl p-8 border border-[#E5E7EB] dark:border-[#2A3348] shadow-xl">
        {/* Logo and Brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#0E2A6E] flex items-center justify-center text-[#FFD700] text-3xl font-black shadow-lg">
            💬
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-black dark:text-white">
            Inspire
          </h1>
          <p className="text-sm font-semibold text-[#4B5563] dark:text-[#9CA3AF] mt-1">
            Real-time messaging for everyone
          </p>
        </div>

        {/* Error message */}
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-gray-200">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs font-bold text-[#0E2A6E] dark:text-[#3D6FE0] hover:underline"
              >
                Forgot?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-3 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-black dark:text-white font-medium focus:outline-none focus:border-[#0E2A6E] dark:focus:border-[#3D6FE0] focus:ring-2 focus:ring-[#0E2A6E]/20 transition-all text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3.5 px-4 rounded-2xl bg-[#0E2A6E] text-white font-extrabold text-sm hover:bg-[#081B47] active:scale-95 transition-all shadow-md disabled:opacity-50"
          >
            {isSubmitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {/* Demo instant test shortcuts */}
        <div className="mt-6 pt-6 border-t border-[#E5E7EB] dark:border-[#2A3348]">
          <p className="text-[11px] font-bold text-[#4B5563] dark:text-[#9CA3AF] text-center mb-2.5 uppercase tracking-wider">
            Quick Instant Preview
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleDemoLogin('user')}
              className="py-2 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-xs font-bold text-black dark:text-white transition-colors"
            >
              Demo User (@alex_dev)
            </button>
            <button
              type="button"
              onClick={() => handleDemoLogin('admin')}
              className="py-2 px-3 rounded-xl bg-[#FFD700]/20 hover:bg-[#FFD700]/30 text-xs font-bold text-[#1A1A2E] dark:text-[#FFD700] transition-colors"
            >
              Demo Admin (Sarah)
            </button>
          </div>
        </div>

        {/* Signup Link */}
        <p className="text-center text-xs font-medium text-[#4B5563] dark:text-[#9CA3AF] mt-6">
          Don’t have an account?{' '}
          <Link
            to="/signup"
            className="font-bold text-[#0E2A6E] dark:text-[#3D6FE0] hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};
