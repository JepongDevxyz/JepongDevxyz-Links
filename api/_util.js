// Shared validation helpers for Jepong Links.
// NOTE: middleware.js keeps its own copy of CODE_RE (edge middleware must stay self-contained).

export const CODE_RE = /^[A-Za-z0-9_-]{3,64}$/;

// Codes that would collide with app routes/files and can never be created.
export const RESERVED = new Set([
  'api',
  'admin',
  'index',
  'links',
  'links-db',
  'favicon',
  'robots',
  'sitemap',
  'assets',
  'public',
  '_next'
]);

export function isValidCode(code) {
  return (
    typeof code === 'string' &&
    CODE_RE.test(code) &&
    !RESERVED.has(code.toLowerCase())
  );
}

export function isValidUrl(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
