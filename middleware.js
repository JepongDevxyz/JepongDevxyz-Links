// Edge middleware: turns jepong-devxyz.com/<code> into a 302 redirect.
// Runs before static files; only short-code paths are intercepted, so
// "/", "/admin", "/api/*" and real files keep working.
//
// Self-contained on purpose (no imports): edge middleware bundles every
// import, and the regex copy below matches api/_util.js CODE_RE.

// Demo link — works from the first deploy, even before env vars are set.
const DEMO_LINKS = {
  jepongdevxyz: 'https://example.com'
};
const CODE_RE = /^[A-Za-z0-9_-]{3,64}$/;

const notFoundHtml = (code, noStore) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Link not found — Jepong Devxyz</title>
<style>
body{background:#0b1120;color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif;
display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:#111a30;border:1px solid #1e2a4a;border-radius:16px;padding:32px;max-width:420px;text-align:center}
h1{font-size:20px;margin:0 0 8px;color:#38bdf8}
code{background:#0b1120;padding:2px 8px;border-radius:6px;color:#fbbf24}
p{color:#94a3b8;font-size:14px;line-height:1.6}
a{color:#38bdf8}
.brand{margin-top:16px;font-size:11px;color:#475569}
</style></head><body><div class="card">
<h1>Link not found</h1>
<p>No redirect is set for <code>/${code}</code>.</p>
${noStore ? '<p>The link store is not reachable right now — only demo links work.</p>' : ''}
<p class="brand">Powered by Jepong Devxyz</p>
</div></body></html>`;

async function fetchStoreLinks() {
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  if (!repo || !token) return null;
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/links.json?ref=main`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'jepong-links'
      }
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const binary = atob(data.content.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/') return;                    // index page
  if (path.includes('.')) return;              // real files (links.json, favicon, css…)
  if (path.startsWith('/api')) return;         // api routes
  if (path === '/admin') return;               // admin page

  const code = path.replace(/^\/+|\/+$/g, '');
  if (code.includes('/') || !CODE_RE.test(code)) return;

  if (DEMO_LINKS[code]) {
    return Response.redirect(DEMO_LINKS[code], 302);
  }

  let links = null;
  try {
    links = await fetchStoreLinks();
  } catch {
    links = null;
  }

  if (links && links[code]) {
    return Response.redirect(links[code], 302);
  }

  return new Response(notFoundHtml(code, !links), {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

// Skip /api entirely; everything else is filtered inside the handler.
export const config = { matcher: '/((?!api/).*)' };
