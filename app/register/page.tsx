"use client";
import { useState } from 'react';
import { auth } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Register failed');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handle} className="w-full max-w-md p-6 border rounded">
        <h2 className="text-xl font-bold mb-4">Registrar</h2>
        {error && <p className="text-red-600">{error}</p>}
        <label className="block mb-2">Email
          <input className="w-full" value={email} onChange={e=>setEmail(e.target.value)} />
        </label>
        <label className="block mb-2">Senha
          <input type="password" className="w-full" value={password} onChange={e=>setPassword(e.target.value)} />
        </label>
        <button className="mt-4 px-4 py-2 bg-green-600 text-white rounded" type="submit">Criar conta</button>
      </form>
    </div>
  );
}
