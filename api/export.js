import { get } from '@vercel/blob';
import { timingSafeEqual } from 'node:crypto';

// Alleen-lezen export voor het verwerken van notities (aparte sleutel, niet het bewerkwachtwoord).
function okKey(req) {
  const given = req.headers['x-export-key'] || (req.query && req.query.key);
  const real = process.env.EXPORT_KEY;
  if (!given || !real) return false;
  const a = Buffer.from(String(given)), b = Buffer.from(String(real));
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method' });
  if (!okKey(req)) {
    await new Promise((r) => setTimeout(r, 800));
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const r = await get('pop/state.json', { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200) return res.status(200).json({ state: null });
    const s = JSON.parse(await new Response(r.stream).text());
    return res.status(200).json({
      verzoek: s.verzoek || null,
      notes: s.notes || [],
      schools: (s.schools || []).map((x) => ({
        id: x.id, name: x.name, date: x.date, obs: x.obs, trans: x.trans,
        rating: x.rating, visited: x.visited, goals: x.goals,
        vragen: x.vragen, qdone: x.qdone,
      })),
      exp: s.exp || {}, out: s.out || {}, prismaGevoel: s.prismaGevoel || '',
    });
  } catch (e) {
    return res.status(500).json({ error: 'server' });
  }
}
