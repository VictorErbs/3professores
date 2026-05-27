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
      <form onSubmit={handle} className="w-full max-w-md p-6 border rounded">
        <h2 className="text-xl font-bold mb-4">{t('auth.registerTitle')}</h2>
        {error && <p className="text-red-600 mb-4 text-xs font-semibold">{error}</p>}
        <label className="block mb-2">{t('auth.email')}
          <input className="w-full" value={email} onChange={e=>setEmail(e.target.value)} required />
        </label>
        <label className="block mb-4">{t('auth.password')}
          <input type="password" className="w-full" value={password} onChange={e=>setPassword(e.target.value)} required />
        </label>
        
        <label className="flex items-start gap-2 mb-4 cursor-pointer text-xs text-slate-600 dark:text-slate-400">
          <input 
            type="checkbox" 
            checked={lgpdConsent} 
            onChange={e => setLgpdConsent(e.target.checked)} 
            className="mt-0.5"
            required
          />
          <span>
            Declaro que li e concordo com o tratamento dos meus dados pessoais em conformidade com a{' '}
            <a href="/privacy" className="text-blue-600 hover:underline">Política de Privacidade (LGPD)</a>{' '}
            do CreditGuard AI.
          </span>
        </label>

        <button className="mt-4 px-4 py-2 bg-green-600 text-white rounded w-full" type="submit" disabled={loading}>{loading ? t('auth.registering') : t('auth.registerBtn')}</button>
      </form>
    </div>
  );
}
