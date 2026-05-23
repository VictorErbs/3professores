"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTranslation } from 'react-i18next';

export default function RegisterForm() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    
    if (!lgpdConsent) {
      setError("Você precisa aceitar a Política de Privacidade (LGPD) para criar uma conta.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (signUpError) throw signUpError;
      router.push('/login');
    } catch (err) {
      setError((err as Error).message || t('auth.registerFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handle} className="w-full max-w-md p-6 border border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900 shadow-xl p-8">
        <h2 className="text-2xl font-black mb-6 text-slate-900 dark:text-white">{t('auth.registerTitle')}</h2>
        {error && <p className="text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl p-3 mb-4">{error}</p>}
        <label className="block mb-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{t('auth.email')}
          <input className="w-full mt-2 rounded-xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 px-4 py-2.5 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 text-slate-800 dark:text-slate-200" value={email} onChange={e=>setEmail(e.target.value)} required />
        </label>
        <label className="block mb-6 text-xs font-bold text-slate-400 uppercase tracking-wider">{t('auth.password')}
          <input type="password" className="w-full mt-2 rounded-xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 px-4 py-2.5 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 text-slate-800 dark:text-slate-200" value={password} onChange={e=>setPassword(e.target.value)} required />
        </label>
        
        <label className="flex items-start gap-2.5 mb-6 cursor-pointer text-xs text-slate-500 dark:text-slate-400 font-medium">
          <input 
            type="checkbox" 
            checked={lgpdConsent} 
            onChange={e => setLgpdConsent(e.target.checked)} 
            className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            required
          />
          <span>
            Declaro que li e concordo com o tratamento dos meus dados pessoais em conformidade com a <span className="text-indigo-600 font-semibold hover:underline">Política de Privacidade (LGPD)</span> do CreditGuard AI.
          </span>
        </label>

        <button className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 shadow-md shadow-indigo-600/10" type="submit" disabled={loading}>{loading ? t('auth.registering') : t('auth.registerBtn')}</button>
      </form>
    </div>
  );
}