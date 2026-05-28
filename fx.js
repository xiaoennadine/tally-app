// GET /api/fx — returns latest exchange rates for the 7 supported currencies.
// Source: open.er-api.com (free, no key required, updated every 24h).
// Cached in KV for 6h so we don't hammer the upstream.

const { requireUser } = require('./lib/auth');
const { get, set } = require('./lib/db');

const SUPPORTED = ['USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AUD', 'CAD'];
const CACHE_KEY = 'fx:rates';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

module.exports = async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  if (req.method !== 'GET') return res.status(405).end();

  try {
    // Try cache first
    const cached = await get(CACHE_KEY);
    if (cached && (Date.now() - cached.fetchedAt < CACHE_TTL_MS)) {
      return res.status(200).json(cached);
    }

    // Fetch fresh rates (base USD)
    const r = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!r.ok) {
      // Fall back to stale cache if we have one
      if (cached) return res.status(200).json({ ...cached, stale: true });
      return res.status(502).json({ error: 'FX upstream unreachable' });
    }
    const data = await r.json();
    if (data.result !== 'success' || !data.rates) {
      if (cached) return res.status(200).json({ ...cached, stale: true });
      return res.status(502).json({ error: 'FX upstream returned bad data' });
    }

    // Build a compact rates table: only the currencies we support, base USD.
    const rates = { USD: 1 };
    for (const c of SUPPORTED) {
      if (c === 'USD') continue;
      if (typeof data.rates[c] === 'number') rates[c] = data.rates[c];
    }
    const out = {
      base: 'USD',
      rates,
      source: 'open.er-api.com',
      fetchedAt: Date.now(),
      upstreamUpdated: data.time_last_update_utc || null,
    };
    await set(CACHE_KEY, out);
    return res.status(200).json(out);
  } catch (e) {
    console.error('fx error', e);
    return res.status(500).json({ error: e.message });
  }
};
