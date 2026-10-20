// GitHub-backed store for Jepong Links.
//
// The single source of truth is links.json in the GitHub repo
// (env GITHUB_REPO, e.g. "JepongDevxyz/JepongDevxyz-Links").
// Reads and writes go through the GitHub Contents API using a
// fine-grained personal access token (env GITHUB_TOKEN) scoped to
// that one repo with Contents: Read and write.
//
// Env vars (set in Vercel project settings, never in code):
//   GITHUB_TOKEN   fine-grained PAT, Contents read+write on this repo only
//   GITHUB_REPO    owner/repo
//   GITHUB_BRANCH  optional, defaults to "main"

const API_BASE = 'https://api.github.com';
const LINKS_FILE = 'links.json';

function repo() {
  return process.env.GITHUB_REPO || '';
}

function branch() {
  return process.env.GITHUB_BRANCH || 'main';
}

function headers() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN || ''}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'jepong-links'
  };
}

export async function readLinks() {
  const url =
    `${API_BASE}/repos/${repo()}/contents/${LINKS_FILE}` +
    `?ref=${encodeURIComponent(branch())}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    throw new Error(`GitHub read failed (HTTP ${res.status})`);
  }
  const data = await res.json();
  const text = Buffer.from(data.content, 'base64').toString('utf8');
  return { links: JSON.parse(text), sha: data.sha };
}

export async function writeLinks(links, sha, message) {
  const url = `${API_BASE}/repos/${repo()}/contents/${LINKS_FILE}`;
  const body = JSON.stringify(links, null, 2) + '\n';
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: Buffer.from(body, 'utf8').toString('base64'),
      sha,
      branch: branch()
    })
  });
  if (!res.ok) {
    throw new Error(`GitHub write failed (HTTP ${res.status})`);
  }
  return res.json();
}
