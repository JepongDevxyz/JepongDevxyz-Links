// Public link creation — no password needed.
//
// Abuse controls (this endpoint is open to the internet):
//   - Per-IP rate limit: 10 creates/hour (best-effort, in-memory; Vercel
//     serverless instances are recycled, so a determined abuser with many
//     IPs is not stopped — pair with Turnstile for stronger protection).
//   - Same code + URL validation as the admin API (see api/_util.js).
//   - Listing and deleting links stay admin-only (see api/admin.js).
//
//   POST /api/create  { url, code? }  -> { code, url }
//   400 invalid input, 409 code taken, 429 rate limited, 405 other methods.

import { randomInt } from 'node:crypto';
import { readLinks, writeLinks } from './_store.js';
import { isValidCode, isValidUrl } from './_util.js';

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 10;
const hits = new Map(); // ip -> { count, reset }

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return 'unknown';
}

// Returns seconds to wait when over the limit, 0 when allowed.
function overLimit(ip) {
  const now = Date.now();
  if (hits.size > 5000) {
    for (const [key, rec] of hits) {
      if (now > rec.reset) hits.delete(key);
    }
  }
  const rec = hits.get(ip);
  if (!rec || now > rec.reset) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return 0;
  }
  rec.count += 1;
  if (rec.count > MAX_PER_WINDOW) {
    return Math.max(1, Math.ceil((rec.reset - now) / 1000));
  }
  return 0;
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const retryAfter = overLimit(clientIp(req));
  if (retryAfter > 0) {
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'Too many links created. Try again later.' });
  }

  const { code, url } = req.body || {};
  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL. Use a full https:// address.' });
  }

  try {
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
    await writeLinks(links, sha, `Public create ${finalCode} -> ${url}`);
    return res.status(200).json({ code: finalCode, url });
  } catch (err) {
    return res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
}
