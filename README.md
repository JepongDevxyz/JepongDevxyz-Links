# Jepong Links

Short redirect links on **go.jepong-devxyz.com**. Visit `go.jepong-devxyz.com/<code>`
and get sent straight to the target URL with an instant 302 redirect —
the address bar shows the real target after loading.

## How it works

- `middleware.js` (Vercel Edge): intercepts `/<code>` paths, looks up the code
  in the link store, and returns a 302. `/`, `/admin`, `/api/*` and real files
  are untouched.
- `links.json` (repo root): the link store — a simple `{ "code": "https://target" }`
  map. Read and written through the GitHub Contents API by `api/_store.js`.
- `api/admin.js`: password-protected admin API (list / create / delete).
- `admin.html`: mobile-first admin UI. Password lives in `sessionStorage`
  (cleared when the tab closes).
- Demo link `jepongdevxyz` → `https://example.com` works from the first
  deploy, even before env vars are set.

## Setup (one time)

1. Create the GitHub repo **JepongDevxyz/JepongDevxyz-Links** (empty, no README).
2. Push this code to `main`.
3. Create a **fine-grained personal access token** at
   github.com/settings/personal-access-tokens:
   - Token name: `Jepong Links`
   - Repository access: **Only select repositories** → `JepongDevxyz-Links`
   - Permissions → **Contents**: Read and write
   - Generate and copy the token. Keep it secret — it can rewrite `links.json`.
4. In Vercel: **Add New → Project → Import** the repo.
5. Project **Settings → Environment Variables** (Production):
   - `GITHUB_TOKEN` = the token from step 3
   - `GITHUB_REPO` = `JepongDevxyz/JepongDevxyz-Links`
   - `ADMIN_PASSWORD` = the password you want for `/admin`
6. **Redeploy** (env vars only apply to new deployments).
7. In Vercel: project **Settings → Domains → Add** `go.jepong-devxyz.com`.
   (The `jepong-devxyz.com` apex is left untouched — it serves an existing
   WordPress page, so the shortener lives on the `go` subdomain.) Vercel shows
   the DNS record to add — add it in the Northwest DNS panel as a
   **CNAME** record: Host `go` → `cname.vercel-dns.com`.

## Using it

**Public (anyone):** open `go.jepong-devxyz.com`, paste the target URL,
optionally pick a custom code (3–64 chars: letters, numbers, `-`, `_`;
blank = random 12-char code). No password needed.

**Admin (owner only):** `go.jepong-devxyz.com/admin` + password —
list every link and delete any of them.

- Every created link is a commit in `links.json`, so there is a full history.
- New links work immediately — every redirect does one GitHub API read,
  well within the 5,000/hour token limit for personal use.

## Abuse controls

The public create endpoint (`POST /api/create`) is open to the internet:

- Per-IP rate limit: 10 creates/hour (best-effort, in-memory — Vercel
  serverless instances recycle, so it slows casual abuse, not a determined
  attacker with many IPs).
- Same code/URL validation as the admin API; reserved codes blocked.
- Listing and deleting stay behind the admin password.
- For stronger protection, put a CAPTCHA (e.g. Cloudflare Turnstile) in
  front of the public form and verify it in `api/create.js`.

## Security notes

- `ADMIN_PASSWORD` and `GITHUB_TOKEN` live only in Vercel env vars — never in
  code, commits, or chat.
- The token is scoped to this one repo, Contents read+write only. If it ever
  leaks, revoke it at github.com/settings/personal-access-tokens.
- `links.json` is publicly readable by design (a short link's target is no
  secret — visiting the code reveals it anyway).

## Local tests

```
node tests/run.mjs
```

(tests and the design preview live only in the local working copy — they are
git-ignored and never deployed.)
