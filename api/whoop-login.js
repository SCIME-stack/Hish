// Sends you to WHOOP to approve access.
const crypto = require('crypto');
const w = require('./_whoop');

module.exports = (req, res) => {
  try {
    const { id } = w.settings();
    const state = crypto.randomBytes(16).toString('hex');
    const url = new URL(w.AUTH_URL);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', id);
    url.searchParams.set('redirect_uri', w.redirectUri(req));
    url.searchParams.set('scope', w.SCOPES);
    url.searchParams.set('state', state);
    res.setHeader('Set-Cookie', w.cookie('whoop_state', state, 600));
    res.writeHead(302, { Location: url.toString() }).end();
  } catch (e) {
    res.status(500).send(e.message);
  }
};
