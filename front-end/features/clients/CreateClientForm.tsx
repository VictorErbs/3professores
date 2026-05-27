"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/api/clients';
import { useTranslation } from 'react-i18next';
import Header from '@/components/Header';

export default function CreateClientForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await createClient({ name, email, cpf, phone });
      // Redireciona para a lista de clientes após cadastro bem-sucedido
      router.push('/clients');
    } catch (err) {
      setMessage(t('clients.errorLabel') + ((err as Error).message || String(err)));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <Header />
      <main className="mx-auto w-full max-w-5xl px-6 py-10 flex-1">
        <div className="mb-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{t('clients.createKicker')}</p>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2">{t('clients.createTitle')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-2xl">
            {t('clients.createSubtitle')}
          </p>
        </div>

        <form onSubmit={handle} className="grid grid-cols-1 gap-6 rounded-3xl border border-slate-100 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <label className="space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <span>{t('clients.nameLabel')}</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('clients.namePlaceholder')}
                required
              />
            </label>

            <label className="space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <span>{t('clients.emailLabel')}</span>
              <input
                type="email"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t('clients.emailPlaceholder')}
                required
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <label className="space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <span>{t('clients.cpfLabel')}</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                value={cpf}
                onChange={e => setCpf(e.target.value)}
                placeholder={t('clients.cpfPlaceholder')}
              />
            </label>

            <label className="space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <span>{t('clients.phoneLabel')}</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder={t('clients.phonePlaceholder')}
              />
            </label>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <button
              className="rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60"
              type="submit"
              disabled={loading}
            >
              {loading ? t('clients.sending') : t('clients.createBtn')}
            </button>
            <p className="text-xs text-slate-400">
              {t('clients.createHint')}
            </p>
          </div>

          {message && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              {message}
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
