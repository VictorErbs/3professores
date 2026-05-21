// Helper to call backend Firebase Functions API
const FUNCTIONS_BASE = process.env.NEXT_PUBLIC_FUNCTIONS_BASE_URL || '';

export async function createClient(client: any) {
  const url = (FUNCTIONS_BASE || '') + '/clients';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(client),
  });
  if (!res.ok) throw new Error('Failed to create client: ' + res.statusText);
  return res.json();
}

export async function predict(data: any) {
  const url = (FUNCTIONS_BASE || '') + '/predict';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Predict failed: ' + res.statusText);
  return res.json();
}
