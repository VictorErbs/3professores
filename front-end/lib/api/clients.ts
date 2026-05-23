export interface CreateClientInput {
  name: string;
  email: string;
  cpf?: string;
  phone?: string;
}

export async function createClient(client: CreateClientInput) {
  const res = await fetch('/api/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(client),
  });
  if (!res.ok) throw new Error('Failed to create client: ' + res.statusText);
  return res.json();
}

export async function listClients() {
  const res = await fetch('/api/clients');
  if (!res.ok) throw new Error('Failed to list clients: ' + res.statusText);
  return res.json();
}