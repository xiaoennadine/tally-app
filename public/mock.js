// Offline demo backend. Activates ONLY when the app is opened outside Telegram
// with no dev server (i.e. previews / plain-browser demos). In production the
// real /api/* endpoints answer first, so none of this runs.
//
// It mirrors the server's wallet shape + the /api/me response, persists to
// localStorage, and ports lib/money.js `simplify` verbatim so the Settle Up
// math is identical to production.
(function () {
  const KEY = 'tally_mock_wallet_v4';

  // ── Debt simplification (ported from lib/money.js) ──────────────────
  function simplify(wallet) {
    const byCcy = {};
    for (const e of wallet.expenses) (byCcy[e.ccy] ||= []).push(e);
    const settlements = wallet.settlements || [];
    for (const s of settlements) byCcy[s.ccy] ||= [];

    const out = {};
    for (const ccy of Object.keys(byCcy)) {
      const bal = {};
      const touch = (id) => { if (bal[id] === undefined) bal[id] = 0; };
      for (const e of byCcy[ccy]) {
        touch(e.payer);
        bal[e.payer] += e.amount;
        const share = e.amount / Math.max(1, e.splitWith.length);
        for (const id of e.splitWith) { touch(id); bal[id] -= share; }
      }
      for (const s of settlements.filter(x => x.ccy === ccy)) {
        touch(s.from); touch(s.to);
        bal[s.from] += s.amount;
        bal[s.to]   -= s.amount;
      }
      const cred = Object.entries(bal).filter(([, v]) => v > 0.01).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v]);
      const debt = Object.entries(bal).filter(([, v]) => v < -0.01).sort((a, b) => a[1] - b[1]).map(([k, v]) => [k, v]);
      const tx = [];
      let i = 0, j = 0;
      while (i < cred.length && j < debt.length) {
        const amt = Math.min(cred[i][1], -debt[j][1]);
        tx.push({ from: debt[j][0], to: cred[i][0], amount: amt });
        cred[i][1] -= amt;
        debt[j][1] += amt;
        if (cred[i][1] < 0.01) i++;
        if (debt[j][1] > -0.01) j++;
      }
      out[ccy] = { balances: bal, transactions: tx };
    }
    return out;
  }

  // ── Seed ────────────────────────────────────────────────────────────
  function isoDaysFromNow(n) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function isoTimeDaysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
  }

  function seed() {
    const members = {
      me: { id: 'me', name: 'Maya', ghost: false, isOwner: true, avatarEmoji: '🌸', username: 'maya' },
      yf: { id: 'yf', name: 'Yi Fang', ghost: true },
      i:  { id: 'i',  name: 'Ishita', ghost: true, avatarEmoji: '🦊' },
      s:  { id: 's',  name: 'Suman', ghost: true },
      y:  { id: 'y',  name: 'Yashu', ghost: true },
      t:  { id: 't',  name: 'Theo', ghost: true, avatarEmoji: '🐼' },
      p:  { id: 'p',  name: 'Priya', ghost: true },
      j:  { id: 'j',  name: 'Jordan', ghost: true },
    };
    const groups = [
      { id: 'grp:dinner', name: 'Dinner @ Schweinfurt', emoji: '🍽️', memberIds: ['me', 'i', 's', 'y'], createdAt: isoTimeDaysAgo(6) },
      { id: 'grp:flat',   name: 'Flat',                 emoji: '🏠', memberIds: ['me', 't', 'p'],      createdAt: isoTimeDaysAgo(40) },
    ];
    const expenses = [
      { id: 'e1', payer: 'me', amount: 74.50, ccy: 'EUR', splitWith: ['me', 'i', 's', 'y'], desc: 'Dinner @ Schweinfurt', date: isoTimeDaysAgo(4), groupId: 'grp:dinner', category: 'food' },
      { id: 'e2', payer: 'me', amount: 32.00, ccy: 'EUR', splitWith: ['me', 't', 'p'],      desc: 'Groceries',           date: isoTimeDaysAgo(3), groupId: 'grp:flat',   category: 'home' },
      { id: 'e3', payer: 'i',  amount: 12.00, ccy: 'EUR', splitWith: ['me', 'i', 's', 'y'], desc: 'Cab home',            date: isoTimeDaysAgo(4), groupId: 'grp:dinner', category: 'travel' },
      { id: 'e4', payer: 'yf', amount: 1.00,  ccy: 'EUR', splitWith: ['me'],                desc: 'Cloakroom tip',       date: isoTimeDaysAgo(4), groupId: 'grp:dinner', category: 'other' },
    ];
    const subs = [
      { id: 'su_dis', name: 'Disney+',         emoji: '🏰', color: '#113ccf', brand: 'disney',  price: 6.99,  ccy: 'EUR', cycle: 'monthly', members: ['me', 'yf'],           payer: 'me', nextCharge: isoDaysFromNow(0),  addedAt: isoTimeDaysAgo(60) },
      { id: 'su_net', name: 'Netflix',         emoji: '🎬', color: '#e50914', brand: 'netflix', price: 4.99,  ccy: 'EUR', cycle: 'monthly', members: ['me', 'yf'],           payer: 'me', nextCharge: isoDaysFromNow(2),  addedAt: isoTimeDaysAgo(90) },
      { id: 'su_spo', name: 'Spotify Family',  emoji: '🎵', color: '#1db954', brand: 'spotify', price: 17.99, ccy: 'EUR', cycle: 'monthly', members: ['me', 'i', 's', 'y'],  payer: 'me', nextCharge: isoDaysFromNow(11), addedAt: isoTimeDaysAgo(120) },
      { id: 'su_icl', name: 'iCloud+ 2TB',     emoji: '☁️', color: '#3693f3', brand: 'icloud',  price: 9.99,  ccy: 'EUR', cycle: 'monthly', members: ['me', 'p'],            payer: 'me', nextCharge: isoDaysFromNow(16), addedAt: isoTimeDaysAgo(200) },
      { id: 'su_yt',  name: 'YouTube Premium', emoji: '▶️', color: '#ff0000', brand: 'youtube', price: 12.99, ccy: 'EUR', cycle: 'monthly', members: ['me', 't', 'p', 'i'],  payer: 'me', nextCharge: isoDaysFromNow(22), addedAt: isoTimeDaysAgo(30) },
    ];
    return { members, expenses, subs, groups, settlements: [], defaultCcy: 'EUR' };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    const w = seed();
    save(w);
    return w;
  }
  function save(w) {
    try { localStorage.setItem(KEY, JSON.stringify(w)); } catch {}
  }

  let wallet = null;
  const W = () => (wallet ||= load());
  const persist = () => save(W());
  const newId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const delay = (v) => new Promise(r => setTimeout(() => r(v), 70));

  function meResponse() {
    const w = W();
    if (!w.members.me) w.members.me = { id: 'me', name: 'You', ghost: false, isOwner: true };
    const me = w.members.me;
    return {
      user: { id: 'me', name: me.name, username: me.username || null, avatarEmoji: me.avatarEmoji || null },
      wallet: {
        members: w.members,
        expenses: w.expenses.slice(-50).reverse(),
        subs: w.subs,
        groups: w.groups || [],
        defaultCcy: w.defaultCcy || 'EUR',
      },
      summary: simplify(w),
    };
  }

  const FX_RATES = { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 156, SGD: 1.35, AUD: 1.52, CAD: 1.37 };

  window.TallyMock = {
    active: false,
    reset() { wallet = seed(); save(wallet); },
    buildAPI(tg) {
      return {
        tg,
        me: () => delay(meResponse()),
        expenses: {
          add: (body) => {
            const w = W();
            const e = {
              id: newId('e'),
              payer: String(body.payer || 'me'),
              amount: Number(body.amount) || 0,
              ccy: (body.ccy || w.defaultCcy || 'EUR').toUpperCase(),
              splitWith: Array.isArray(body.splitWith) && body.splitWith.length ? body.splitWith.map(String) : ['me'],
              desc: String(body.desc || 'Expense'),
              date: new Date().toISOString(),
              groupId: body.groupId || undefined,
              category: body.category || 'other',
              vendor: body.vendor || undefined,
              receiptId: body.receiptId || undefined,
            };
            w.expenses.push(e); persist();
            return delay({ expense: e });
          },
          remove: (id) => { const w = W(); w.expenses = w.expenses.filter(e => e.id !== id); persist(); return delay({ ok: true }); },
        },
        friends: {
          list: () => delay({ friends: Object.values(W().members).filter(m => m.ghost) }),
          add: (names) => {
            const w = W(); const added = [];
            for (const raw of (names || [])) {
              const name = String(raw).trim(); if (!name) continue;
              if (Object.values(w.members).find(m => m.name.toLowerCase() === name.toLowerCase())) continue;
              const id = newId('g:');
              w.members[id] = { id, name, ghost: true };
              added.push(w.members[id]);
            }
            persist();
            return delay({ added, friends: Object.values(w.members).filter(m => m.ghost) });
          },
          patch: (id, body) => {
            const w = W(); const m = w.members[id];
            if (m) {
              if (typeof body.avatarEmoji === 'string') m.avatarEmoji = body.avatarEmoji.slice(0, 4);
              if (typeof body.name === 'string' && body.name.trim()) m.name = body.name.trim().slice(0, 40);
              persist();
            }
            return delay({ member: m });
          },
          remove: (id) => {
            const w = W();
            const used = w.expenses.some(e => e.payer === id || e.splitWith.includes(id));
            if (used) return Promise.reject(new Error('friend has expenses — settle up first'));
            delete w.members[id]; persist();
            return delay({ ok: true });
          },
        },
        settled: (body) => {
          const w = W();
          w.settlements.push({ id: newId('s'), from: String(body.fromId), to: String(body.toId), amount: Number(body.amount), ccy: (body.ccy || 'EUR').toUpperCase(), date: new Date().toISOString() });
          persist();
          return delay({ ok: true });
        },
        subs: {
          add: (body) => {
            const w = W();
            const sub = {
              id: newId('su'),
              name: String(body.name || 'Subscription').slice(0, 60),
              emoji: body.emoji || '📺',
              color: body.color || '#7c5cff',
              brand: body.brand || null,
              price: Number(body.price) || 0,
              ccy: (body.ccy || w.defaultCcy || 'EUR').toUpperCase(),
              cycle: body.cycle === 'yearly' ? 'yearly' : 'monthly',
              billDay: body.billDay || null,
              members: Array.isArray(body.members) ? body.members.map(String) : ['me'],
              payer: String(body.payer || 'me'),
              nextCharge: body.nextCharge || null,
              addedAt: new Date().toISOString(),
            };
            w.subs.push(sub); persist();
            return delay({ sub });
          },
          remove: (id) => { const w = W(); w.subs = w.subs.filter(s => s.id !== id); persist(); return delay({ ok: true }); },
        },
        groups: {
          add: (body) => {
            const w = W();
            const g = { id: newId('grp:'), name: String(body.name || 'Group').slice(0, 60), emoji: String(body.emoji || '📁').slice(0, 4), memberIds: [...new Set(['me', ...(body.memberIds || []).map(String).filter(id => w.members[id])])], createdAt: new Date().toISOString() };
            w.groups.push(g); persist();
            return delay({ group: g });
          },
          update: (id, body) => {
            const w = W(); const g = (w.groups || []).find(x => x.id === id);
            if (g) {
              if (typeof body.name === 'string' && body.name.trim()) g.name = body.name.trim().slice(0, 60);
              if (typeof body.emoji === 'string' && body.emoji.length) g.emoji = body.emoji.slice(0, 4);
              if (Array.isArray(body.memberIds)) g.memberIds = [...new Set(['me', ...body.memberIds.map(String).filter(x => w.members[x])])];
              persist();
            }
            return delay({ group: g });
          },
          remove: (id) => {
            const w = W();
            w.groups = (w.groups || []).filter(g => g.id !== id);
            for (const e of w.expenses) if (e.groupId === id) delete e.groupId;
            persist();
            return delay({ ok: true });
          },
        },
        settings: (body) => {
          const w = W();
          if (body.defaultCcy) w.defaultCcy = String(body.defaultCcy).toUpperCase();
          if (typeof body.name === 'string' && body.name.trim()) w.members.me.name = body.name.trim().slice(0, 40);
          if (typeof body.avatarEmoji === 'string') w.members.me.avatarEmoji = body.avatarEmoji.slice(0, 4);
          persist();
          return delay({ ok: true, defaultCcy: w.defaultCcy, name: w.members.me.name, avatarEmoji: w.members.me.avatarEmoji });
        },
        fx: () => delay({ rates: FX_RATES, base: 'USD' }),
      };
    },
  };
})();
