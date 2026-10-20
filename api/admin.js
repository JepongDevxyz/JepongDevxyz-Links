// Admin API: list, create and delete short links.
// Auth: Authorization: Bearer <ADMIN_PASSWORD> (Vercel env var, never in code).
//
//   GET    /api/admin            -> { links }
//   POST   /api/admin  { url, code? }  -> { code, url }   (409 if code taken)
//   DELETE /api/admin  { code }         -> { deleted }
//
// Writes go through the GitHub Contents API (_store.js), so every change
// is a commit in links.json with a clear message.

import { randomInt } from 'node:crypto';
import { readLinks, writeLinks } from './_store.js';
import { isValidCode, isValidUrl } from './_util.js';

function authorized(req) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const header = req.headers.authorization || '';
  return header === `Bearer ${expected}`;
}

function generateCode(links) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 12; i++) {
      code += alphabet[randomInt(alphabet.length)];
    }
  } while (links[code]);
  return code;
}

export default async function handler(req, res) {
  if (!authorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (req.method === 'GET') {
      const { links } = await readLinks();
      return res.status(200).json({ links });
    }

    if (req.method === 'POST') {
      const { code, url } = req.body || {};
      if (!isValidUrl(url)) {
        return res.status(400).json({ error: 'Invalid URL. Use a full https:// address.' });
      }
      const { links, sha } = await readLinks();
      let finalCode = (code || '').trim();
      if (finalCode) {
        if (!isValidCode(finalCode)) {
          return res.status(400).json({ error: 'Invalid or reserved code.' });
        }
        if (links[finalCode]) {
          return res.status(409).json({ error: 'That code is already taken.' });
        }
      } else {
        finalCode = generateCode(links);
      }
      links[finalCode] = url;
      await writeLinks(links, sha, `Add link ${finalCode} -> ${url}`);
      return res.status(200).json({ code: finalCode, url });
    }

    if (req.method === 'DELETE') {
      const { code } = req.body || {};
      const { links, sha } = await readLinks();
      if (!code || !links[code]) {
        return res.status(404).json({ error: 'Code not found.' });
      }
      delete links[code];
      await writeLinks(links, sha, `Delete link ${code}`);
      return res.status(200).json({ deleted: code });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    return res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
}
