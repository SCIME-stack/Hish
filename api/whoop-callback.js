// WHOOP sends you back here after you approve. Saves the login in a private cookie.
const w = require('./_whoop');

module.exports = async (req, res) => {
  const url = new URL(req.url, 'https://x');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (url.searchParams.get('error')) return res.writeHead(302, { Location: '/whoop.html?error=denied' }).end();
  if (!code || !state || state !== w.readCookie(req, 'whoop_state')) {
    return res.writeHead(302, { Location: '/whoop.html?error=state' }).end();
  }
  try {
    const t = await w.tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: w.redirectUri(req) });
    if (!t.refresh_token) throw new Error('no refresh token (is the "offline" scope allowed?)');
    res.setHeader('Set-Cookie', [
      w.cookie(w.COOKIE, t.refresh_token, 60 * 60 * 24 * 365),
      w.cookie('whoop_state', '', 0)
    ]);
    res.writeHead(302, { Location: '/whoop.html' }).end();
  } catch (e) {
    res.writeHead(302, { Location: '/whoop.html?error=' + encodeURIComponent(e.message) }).end();
  }
};
