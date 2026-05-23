"use client"
import React from 'react'

export default function CreateClientButton() {
  async function handleClick() {
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Cliente Exemplo', email: 'ex@ex.com' })
      })
      if (!res.ok) throw new Error('Erro')
      alert('Client created (local)')
    } catch (e) {
      alert('Falha ao criar client: ' + e)
    }
  }

  return (
    <button onClick={handleClick} className="px-3 py-2 bg-green-400 text-white rounded">
      Criar client (local)
    </button>
  )
}