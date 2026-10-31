import { timingSafeEqual } from 'node:crypto';

// Wie vraagt dit? 'editor' = Roy (juiste wachtwoord), 'viewer' = iedereen zonder wachtwoord,
// 'bad' = er is een wachtwoord meegestuurd dat niet klopt.
export function roleOf(req) {
  const given = req.headers['x-edit-key'];
  if (!given) return 'viewer';
  const real = process.env.EDIT_KEY;
  if (!real) return 'bad';
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(real));
  return a.length === b.length && timingSafeEqual(a, b) ? 'editor' : 'bad';
}

export async function rejectBad(res) {
  await new Promise((r) => setTimeout(r, 800)); // remt gokken af
  res.status(401).json({ error: 'unauthorized' });
}
