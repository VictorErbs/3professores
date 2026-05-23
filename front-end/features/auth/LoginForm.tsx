"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTranslation } from 'react-i18next';

export default function LoginForm() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;
      router.push('/');
    } catch (err) {
      setError((err as Error).message || t('auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handle} className="w-full max-w-md p-6 border rounded">
        <h2 className="text-xl font-bold mb-4">{t('auth.loginTitle')}</h2>
        {error && <p className="text-red-600">{error}</p>}
        <label className="block mb-2">{t('auth.email')}
          <input className="w-full" value={email} onChange={e=>setEmail(e.target.value)} />
        </label>
        <label className="block mb-2">{t('auth.password')}
          <input type="password" className="w-full" value={password} onChange={e=>setPassword(e.target.value)} />
        </label>
        <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded" type="submit" disabled={loading}>{loading ? t('auth.loggingIn') : t('auth.loginBtn')}</button>
      </form>
    </div>
  );
}