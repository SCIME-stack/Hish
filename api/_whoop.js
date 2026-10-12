// Shared helpers for the WHOOP connection. Files starting with _ are not public pages.
const AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const API_URL = 'https://api.prod.whoop.com/developer/v2';
const SCOPES = 'offline read:recovery read:sleep read:cycles read:workout read:profile';
const COOKIE = 'whoop_rt';

function baseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return proto + '://' + req.headers.host;
}
function redirectUri(req) { return baseUrl(req) + '/api/whoop-callback'; }

function readCookie(req, name) {
  const all = req.headers.cookie || '';
  for (const part of all.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return '';
}
function cookie(name, value, maxAgeSec) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`;
}

function settings() {
  const id = process.env.WHOOP_CLIENT_ID, secret = process.env.WHOOP_CLIENT_SECRET;
  if (!id || !secret) throw new Error('WHOOP_CLIENT_ID / WHOOP_CLIENT_SECRET are not set in Vercel');
  return { id, secret };
}

async function tokenRequest(params) {
  const { id, secret } = settings();
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...params, client_id: id, client_secret: secret })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('WHOOP token error ' + r.status + ' ' + (j.error_description || j.error || ''));
  return j;
}

module.exports = { AUTH_URL, API_URL, SCOPES, COOKIE, redirectUri, readCookie, cookie, settings, tokenRequest };
