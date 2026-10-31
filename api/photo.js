import { Readable } from 'node:stream';
import { get, put } from '@vercel/blob';
import { roleOf, rejectBad } from './_lib.js';

const ID = /^[a-z0-9]{6,40}$/;

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const id = String(req.query.id || '');
      if (!ID.test(id)) return res.status(400).end();
      const r = await get(`pop/photos/${id}.jpg`, { access: 'private' });
      if (!r || r.statusCode !== 200) return res.status(404).end();
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      Readable.fromWeb(r.stream).pipe(res);
      return;
    }

    if (req.method === 'POST') {
      const role = roleOf(req);
      if (role === 'bad') return rejectBad(res);
      if (role !== 'editor') return res.status(401).json({ error: 'unauthorized' });
      const { id, data } = req.body || {};
      if (!ID.test(String(id || ''))) return res.status(400).json({ error: 'bad id' });
      const m = /^data:image\/jpeg;base64,(.+)$/.exec(String(data || ''));
      if (!m) return res.status(400).json({ error: 'bad image' });
      const buf = Buffer.from(m[1], 'base64');
      if (buf.length > 3_000_000) return res.status(413).json({ error: 'too large' });
      await put(`pop/photos/${id}.jpg`, buf, {
        access: 'private',
        contentType: 'image/jpeg',
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return res.status(200).json({ url: `/api/photo?id=${id}` });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    console.error('photo api error', e);
    return res.status(500).json({ error: 'server error' });
  }
}
