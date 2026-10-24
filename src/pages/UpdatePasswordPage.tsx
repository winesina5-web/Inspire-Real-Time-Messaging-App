import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, isConfigured } from '../lib/supabaseClient';

export const UpdatePasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ready, setReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    const checkSession = async () => {
      if (!isConfigured) {
        if (active) {
          setErrorMessage('Password recovery is not configured yet.');
          setReady(true);
        }
        return;
      }
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (error || !data.session) {
        setErrorMessage('This recovery link is invalid or expired. Request a new reset link.');
      }
      setReady(true);
    };
    void checkSession();
    return () => { active = false; };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    if (password.length < 8) {
      setErrorMessage('Use at least 8 characters for your new password.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('The passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      window.setTimeout(() => navigate('/login', { replace: true }), 1200);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not update password. Request a new recovery link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white dark:bg-[#0B0F1A]">
      <div className="w-full max-w-md bg-white dark:bg-[#161B2B] rounded-3xl p-8 border border-[#E5E7EB] dark:border-[#2A3348] shadow-xl">
        <h1 className="text-2xl font-extrabold text-black dark:text-white text-center mb-2">Choose a new password</h1>
        <p className="text-xs text-center text-[#4B5563] dark:text-[#9CA3AF] mb-6">Use at least 8 characters and keep it private.</p>
        {!ready ? (
          <p className="text-sm text-center">Checking recovery link…</p>
        ) : success ? (
          <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 p-4 text-sm text-emerald-800 dark:text-emerald-200">Password updated. Returning to sign in…</div>
        ) : errorMessage && !isConfigured ? (
          <div className="space-y-4">
            <p className="text-sm text-rose-600">{errorMessage}</p>
            <Link className="text-sm font-bold text-[#0E2A6E] dark:text-[#3D6FE0]" to="/forgot-password">Request another reset link</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && <p role="alert" className="text-sm text-rose-600">{errorMessage}</p>}
            <label className="block text-xs font-bold text-black dark:text-white">
              New password
              <input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full px-4 py-3 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348]" />
            </label>
            <label className="block text-xs font-bold text-black dark:text-white">
              Confirm new password
              <input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1 w-full px-4 py-3 rounded-xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348]" />
            </label>
            <button type="submit" disabled={isSubmitting} className="w-full py-3 rounded-xl bg-[#0E2A6E] text-white font-extrabold disabled:opacity-50">{isSubmitting ? 'Updating…' : 'Update password'}</button>
          </form>
        )}
      </div>
    </div>
  );
};
