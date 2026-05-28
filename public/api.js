// API client + Telegram bridge.
// Loaded as a plain script (not babel) so it's available immediately.

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.enableClosingConfirmation();
}

// Auth header carries the signed initData; server validates with bot token.
function authHeaders() {
  const initData = tg?.initData || '';
  return { 'x-tg-init-data': initData };
}

// Append ?devUser=Name in your browser to preview without Telegram.
// Server only respects this when ALLOW_DEV_USER=1 env var is set.
function devUser() {
  const m = window.location.search.match(/[?&]devUser=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function api(path, opts = {}) {
  const u = devUser();
  const url = u ? `${path}${path.includes('?') ? '&' : '?'}devUser=${encodeURIComponent(u)}` : path;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      ...authHeaders(),
      ...(opts.headers || {}),
    },
    body: opts.body && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body,
  });
  if (!res.ok) {
    let err = 'request failed';
    try { err = (await res.json()).error || err; } catch {}
    throw new Error(err);
  }
  return res.json();
}

window.TallyAPI = {
  tg,
  me:        ()              => api('/api/me'),
  expenses: {
    add:    (body)           => api('/api/expenses',   { method: 'POST',   body }),
    remove: (id)             => api(`/api/expenses?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
  friends: {
    list:   ()               => api('/api/friends'),
    add:    (names)          => api('/api/friends',    { method: 'POST',   body: { names } }),
    remove: (id)             => api(`/api/friends?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
  settled:  (body)           => api('/api/settled',    { method: 'POST',   body }),
  subs: {
    add:    (body)           => api('/api/subs',       { method: 'POST',   body }),
    remove: (id)             => api(`/api/subs?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
  groups: {
    add:    (body)           => api('/api/groups',     { method: 'POST',   body }),
    update: (id, body)       => api(`/api/groups?id=${encodeURIComponent(id)}`, { method: 'PATCH', body }),
    remove: (id)             => api(`/api/groups?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
  settings: (body)           => api('/api/settings',   { method: 'POST',   body }),
  fx:       ()               => api('/api/fx'),
};

// ─── FX helpers ───────────────────────────────────────────────────────
// Convert an amount between any two supported currencies using a rates
// table {USD: 1, EUR: 0.92, JPY: 156, ...} (base = USD).
window.convertMoney = function(amount, from, to, rates) {
  if (!rates || !rates[from] || !rates[to]) return null;
  if (from === to) return amount;
  // amount in USD = amount / rates[from]; then * rates[to]
  return (amount / rates[from]) * rates[to];
};

// React hook: loads FX rates once on mount, caches in module scope so
// switching screens doesn't re-fetch. Returns { rates, ready, error }.
let _fxCache = null;
let _fxPromise = null;
window.useFx = function() {
  const [state, setState] = React.useState(() => _fxCache
    ? { rates: _fxCache.rates, ready: true, error: null }
    : { rates: null, ready: false, error: null });
  React.useEffect(() => {
    if (_fxCache) return;
    if (!_fxPromise) _fxPromise = window.TallyAPI.fx().then(r => { _fxCache = r; return r; });
    _fxPromise.then(r => setState({ rates: r.rates, ready: true, error: null }))
              .catch(e => setState({ rates: null, ready: false, error: e.message }));
  }, []);
  return state;
};

// Helpers
const SYMBOL_OF = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', SGD: 'S$', AUD: 'A$', CAD: 'C$' };
window.fmtMoney = function(amount, ccy = 'USD') {
  const sym = SYMBOL_OF[ccy] || (ccy + ' ');
  if (ccy === 'JPY') return `${sym}${Math.round(amount).toLocaleString()}`;
  return `${sym}${(+amount).toFixed(2)}`;
};
window.SUPPORTED_CCYS = ['USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AUD', 'CAD'];
window.TG_TOKENS = {
  bg: '#f4f5f7', card: '#ffffff', text: '#1c1e21',
  secondary: '#65676b', muted: '#a0a3a8', divider: '#eceef0',
  primary: '#7c5cff', primarySoft: '#efeaff',
  positive: '#1fbf75', negative: '#ef4444',
};
