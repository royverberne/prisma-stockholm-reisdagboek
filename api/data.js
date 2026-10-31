import { get, put, BlobPreconditionFailedError } from '@vercel/blob';
import { roleOf, rejectBad } from './_lib.js';

const PATH = 'pop/state.json';
const MAX_BYTES = 3_500_000;

async function readState() {
  const r = await get(PATH, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return null;
  const text = await new Response(r.stream).text();
  return { state: JSON.parse(text), etag: r.blob.etag };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const role = roleOf(req);
  if (role === 'bad') return rejectBad(res);

  try {
    if (req.method === 'GET') {
      const cur = await readState();
      let state = cur ? cur.state : null;
      if (state && role !== 'editor') {
        // Kijkers krijgen nooit de privé dagboeknotities.
        delete state.notes;
      }
      return res.status(200).json({ editor: role === 'editor', state, etag: cur ? cur.etag : null });
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      if (role !== 'editor') return res.status(401).json({ error: 'unauthorized' });
      const { state, etag } = req.body || {};
      if (!state || typeof state !== 'object') return res.status(400).json({ error: 'bad request' });
      const json = JSON.stringify(state);
      if (json.length > MAX_BYTES) return res.status(413).json({ error: 'too large' });

      if (!etag) {
        // Eerste keer opslaan: nooit een bestaande versie overschrijven.
        const cur = await readState();
        if (cur) return res.status(409).json({ error: 'conflict' });
      }
      try {
        const out = await put(PATH, json, {
          access: 'private',
          allowOverwrite: true,
          addRandomSuffix: false,
          contentType: 'application/json',
          ...(etag ? { ifMatch: etag } : {}),
        });
        return res.status(200).json({ ok: true, etag: out.etag });
      } catch (e) {
        if (e instanceof BlobPreconditionFailedError) return res.status(409).json({ error: 'conflict' });
        throw e;
      }
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    console.error('data api error', e);
    return res.status(500).json({ error: 'server error' });
  }
}
