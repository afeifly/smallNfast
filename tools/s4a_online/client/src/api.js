const BASE = '';

export async function detect() {
  const r = await fetch(`${BASE}/api/detect`, { method: 'POST' });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'detect failed');
  return j;
}

export async function fetchValues() {
  const r = await fetch(`${BASE}/api/values`);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'values failed');
  return j.values;
}

export async function fetchStatus() {
  const r = await fetch(`${BASE}/api/status`);
  return r.json();
}
