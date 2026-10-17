// Returns your latest WHOOP numbers as JSON for whoop.html.
// WHOOP refresh tokens are single-use, so every call saves the new one right away.
const w = require('./_whoop');

async function get(token, route, days, pages = 1) {
  const out = [];
  let next = '';
  for (let i = 0; i < pages; i++) {
    const url = new URL(w.API_URL + '/' + route);
    url.searchParams.set('start', new Date(Date.now() - days * 864e5).toISOString());
    url.searchParams.set('limit', '25');
    if (next) url.searchParams.set('nextToken', next);
    const r = await fetch(url, { headers: { authorization: 'Bearer ' + token } });
    if (!r.ok) throw new Error('WHOOP ' + route + ' error ' + r.status);
    const j = await r.json();
    out.push(...(j.records || []));
    next = j.next_token || '';
    if (!next) break;
  }
  return out;
}

// Detailed timing of your main sleeps over the last 30 nights, for sleep.html.
async function bedtimeData(token) {
  const sleep = await get(token, 'activity/sleep', 30, 3);
  const min = ms => Math.round((ms || 0) / 60000);
  return sleep.filter(r => r.score_state === 'SCORED' && r.score && !r.nap).map(r => {
    const s = r.score.stage_summary || {};
    const asleep = min((s.total_light_sleep_time_milli || 0) + (s.total_slow_wave_sleep_time_milli || 0) + (s.total_rem_sleep_time_milli || 0));
    return {
      start: r.start, end: r.end, tz: r.timezone_offset,
      inBedMin: min(s.total_in_bed_time_milli),
      awakeMin: min(s.total_awake_time_milli) + min(s.total_no_data_time_milli),
      asleepMin: asleep,
      needMin: r.score.sleep_needed ? min(r.score.sleep_needed.baseline_milli) : null
    };
  });
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

  if (req.query && req.query.bedtime) {
    try { return res.status(200).json({ connected: true, sleeps: await bedtimeData(t.access_token) }); }
    catch (e) { return res.status(502).json({ connected: true, error: e.message }); }
  }

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
