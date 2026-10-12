// Returns your latest WHOOP numbers as JSON for whoop.html.
// WHOOP refresh tokens are single-use, so every call saves the new one right away.
const w = require('./_whoop');

async function get(token, route, days) {
  const url = new URL(w.API_URL + '/' + route);
  url.searchParams.set('start', new Date(Date.now() - days * 864e5).toISOString());
  url.searchParams.set('limit', '25');
  const r = await fetch(url, { headers: { authorization: 'Bearer ' + token } });
  if (!r.ok) throw new Error('WHOOP ' + route + ' error ' + r.status);
  return (await r.json()).records || [];
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.query && req.query.logout) {
    res.setHeader('Set-Cookie', w.cookie(w.COOKIE, '', 0));
    return res.status(200).json({ connected: false });
  }
  const rt = w.readCookie(req, w.COOKIE);
  if (!rt) return res.status(200).json({ connected: false });

  let t;
  try {
    t = await w.tokenRequest({ grant_type: 'refresh_token', refresh_token: rt, scope: 'offline' });
  } catch (e) {
    res.setHeader('Set-Cookie', w.cookie(w.COOKIE, '', 0));
    return res.status(200).json({ connected: false, error: 'Login expired, connect again.' });
  }
  if (t.refresh_token) res.setHeader('Set-Cookie', w.cookie(w.COOKIE, t.refresh_token, 60 * 60 * 24 * 365));

  try {
    const days = 7;
    const [recovery, sleep, cycles] = await Promise.all([
      get(t.access_token, 'recovery', days),
      get(t.access_token, 'activity/sleep', days),
      get(t.access_token, 'cycle', days)
    ]);
    const scored = r => r.score_state === 'SCORED' && r.score;
    res.status(200).json({
      connected: true,
      recovery: recovery.filter(scored).map(r => ({
        at: r.created_at, score: r.score.recovery_score,
        hrv: r.score.hrv_rmssd_milli, rhr: r.score.resting_heart_rate
      })),
      sleep: sleep.filter(r => scored(r) && !r.nap).map(r => {
        const s = r.score.stage_summary || {};
        const asleep = (s.total_light_sleep_time_milli || 0) + (s.total_slow_wave_sleep_time_milli || 0) + (s.total_rem_sleep_time_milli || 0);
        return { at: r.end, performance: r.score.sleep_performance_percentage, asleepMin: Math.round(asleep / 60000) };
      }),
      strain: cycles.filter(scored).map(r => ({ at: r.start, strain: r.score.strain }))
    });
  } catch (e) {
    res.status(502).json({ connected: true, error: e.message });
  }
};
