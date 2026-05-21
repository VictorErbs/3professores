"use client";
import { useState } from 'react';
import { createClient } from '@/lib/api';

export default function CreateClientPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const res = await createClient({ name, email, cpf });
      setMessage('Cliente criado: ' + (res.id || JSON.stringify(res)));
    } catch (err: any) {
      setMessage('Erro: ' + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handle} className="w-full max-w-md p-6 border rounded">
        <h2 className="text-xl font-bold mb-4">Criar Cliente</h2>
        <label className="block mb-2">Nome
          <input className="w-full" value={name} onChange={e=>setName(e.target.value)} required />
        </label>
        <label className="block mb-2">Email
          <input type="email" className="w-full" value={email} onChange={e=>setEmail(e.target.value)} required />
        </label>
        <label className="block mb-2">CPF
          <input className="w-full" value={cpf} onChange={e=>setCpf(e.target.value)} />
        </label>
        <div className="mt-4 flex items-center gap-3">
          <button className="px-4 py-2 bg-blue-600 text-white rounded" type="submit" disabled={loading}>{loading? 'Enviando...' : 'Criar'}</button>
          {message && <p className="text-sm">{message}</p>}
        </div>
      </form>
    </div>
  );
}
