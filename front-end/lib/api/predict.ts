export async function predict(data: Record<string, unknown>) {
  const res = await fetch('/api/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Predict failed: ' + res.statusText);
  return res.json();
}