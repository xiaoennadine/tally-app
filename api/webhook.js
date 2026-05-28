// POST /api/webhook — Telegram bot webhook handler.
// Receives updates from Telegram, dispatches commands, replies via Bot API.
//
// Setup: after deploy, hit
//   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<YOUR_VERCEL_URL>/api/webhook"
// (or use the helper in README.md).

const { getWallet, saveWallet } = require('./lib/db');
const { parseAmount, fmtMoney, simplify } = require('./lib/money');

const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

async function tg(method, payload) {
  const r = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return r.json();
}

const send = (chatId, text, extra = {}) => tg('sendMessage', { chat_id: chatId, parse_mode: 'HTML', text, ...extra });

function htmlEscape(s) {
  return String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); }

const HELP = `
👋 Hi! I'm <b>Tally</b> — your shared-expense tracker.

📱 <b>Tap the menu button (left of the input)</b> to open the full app — add expenses, see balances, manage friends, snap receipts.

You can also use these commands here in chat:

<b>The basics</b>
<code>/add 42 lunch with Alice Bob</code> — log; you paid; split 3 ways
<code>/add 30 cab by Alice with Bob</code> — Alice paid
<code>/paid 14 Alice</code> — Alice paid you back
/balance — net balances
/settle — pay-down plan

<b>Friends</b>
<code>/friend add Alice Bob</code>
/friends · <code>/friend remove Alice</code>

<b>Other</b>
/expenses · /undo · /help
`.trim();

function ensureOwner(wallet, user) {
  const userId = String(user.id);
  if (!wallet.members[userId]) {
    wallet.members[userId] = {
      id: userId,
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'You',
      ghost: false,
      tgId: user.id,
      username: user.username || null,
      isOwner: true,
    };
  }
  return userId;
}

function joinFriend(wallet, name) {
  const clean = name.trim();
  if (!clean) return null;
  const existing = Object.values(wallet.members).find(m => m.name.toLowerCase() === clean.toLowerCase());
  if (existing) return existing;
  const id = 'g:' + Date.now() + ':' + clean.toLowerCase().replace(/\s+/g, '_') + Math.random().toString(36).slice(2,5);
  wallet.members[id] = { id, name: clean, ghost: true };
  return wallet.members[id];
}

function parseSplitClause(text) {
  let rest = text;
  let splitNames = null;
  let payerName = null;
  const byM = rest.match(/\bby\s+([A-Za-z][\w-]*)/i);
  if (byM) { payerName = capitalize(byM[1]); rest = rest.replace(byM[0], ' ').trim(); }
  const withM = rest.match(/\bwith\s+(.+?)$/i);
  if (withM) {
    splitNames = withM[1].split(/\s*,\s*|\s+and\s+|\s+&\s+|\s+/i).map(s => s.trim()).filter(Boolean).map(capitalize);
    rest = rest.replace(withM[0], ' ').trim();
  }
  return { splitNames, payerName, rest };
}

// ─── command handlers ──────────────────────────────────────────
async function cmdStart(msg) { await send(msg.chat.id, HELP); }

async function cmdAdd(msg, args) {
  const userId = String(msg.from.id);
  const wallet = await getWallet(userId);
  ensureOwner(wallet, msg.from);

  const { splitNames, payerName, rest } = parseSplitClause(args);
  const parsed = parseAmount(rest);
  if (!parsed) return send(msg.chat.id, "Need an amount. Try: <code>/add 42 lunch with Alice Bob</code>");

  let payerId = userId;
  if (payerName) payerId = String(joinFriend(wallet, payerName).id);

  let memberIds;
  if (splitNames && splitNames.length) {
    const set = new Set([payerId]);
    for (const n of splitNames) set.add(String(joinFriend(wallet, n).id));
    memberIds = [...set];
  } else {
    memberIds = Object.keys(wallet.members);
  }
  if (memberIds.length < 2) {
    return send(msg.chat.id, `Who are you splitting with?\n<code>/add 42 lunch with Alice Bob</code>`);
  }

  const exp = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,5),
    payer: payerId,
    amount: parsed.amount, ccy: parsed.ccy,
    desc: parsed.rest || 'expense',
    splitWith: memberIds,
    date: new Date().toISOString(),
  };
  wallet.expenses.push(exp);
  await saveWallet(userId, wallet);

  const per = parsed.amount / memberIds.length;
  const payerLabel = htmlEscape(wallet.members[payerId].name);
  const names = memberIds.map(id => htmlEscape(wallet.members[id].name)).join(', ');
  await send(msg.chat.id,
    `💸 <b>${htmlEscape(exp.desc)}</b>\n` +
    `<b>${fmtMoney(parsed.amount, parsed.ccy)}</b> · paid by <b>${payerLabel}</b>\n` +
    `Split ${memberIds.length} ways → <b>${fmtMoney(per, parsed.ccy)}</b> each\n` +
    `<i>${names}</i>`,
  );
}

async function cmdBalance(msg) {
  const userId = String(msg.from.id);
  const wallet = await getWallet(userId);
  if (!wallet.expenses.length) return send(msg.chat.id, 'No expenses yet. Try <code>/add 42 lunch with Alice</code>.');
  const sim = simplify(wallet);
  let out = '';
  for (const ccy of Object.keys(sim)) {
    const rows = Object.entries(sim[ccy].balances)
      .sort((a,b) => b[1]-a[1])
      .map(([id, bal]) => {
        const n = htmlEscape(wallet.members[id]?.name || 'Unknown');
        if (Math.abs(bal) < 0.01) return `· ${n} — <i>even</i>`;
        return `· ${n} — <b>${bal > 0 ? '+' : '−'}${fmtMoney(Math.abs(bal), ccy)}</b>`;
      });
    out += `<b>Balances (${ccy})</b>\n${rows.join('\n')}\n\n`;
  }
  await send(msg.chat.id, out.trim() + '\n\n<i>Run /settle for who-pays-whom.</i>');
}

async function cmdSettle(msg) {
  const userId = String(msg.from.id);
  const wallet = await getWallet(userId);
  const sim = simplify(wallet);
  const txs = [];
  for (const ccy of Object.keys(sim)) sim[ccy].transactions.forEach(t => txs.push({ ...t, ccy }));
  if (!txs.length) return send(msg.chat.id, '🎉 All settled up!');
  const lines = txs.map(t => {
    const f = htmlEscape(wallet.members[t.from]?.name || '?');
    const u = htmlEscape(wallet.members[t.to]?.name   || '?');
    return `· <b>${f}</b> → <b>${u}</b>: ${fmtMoney(t.amount, t.ccy)}`;
  }).join('\n');
  await send(msg.chat.id, `<b>Settle up — ${txs.length} payment${txs.length>1?'s':''}</b>\n${lines}`);
}

async function cmdPaid(msg, args) {
  const userId = String(msg.from.id);
  const wallet = await getWallet(userId);
  ensureOwner(wallet, msg.from);
  const tokens = args.trim().split(/\s+/);
  let friend = null, amountText = args;
  for (let i = 0; i < tokens.length; i++) {
    const cand = tokens[i].replace(/^@/, '');
    const m = Object.values(wallet.members).find(x => x.id !== userId &&
      (x.name.toLowerCase() === cand.toLowerCase() || x.username === cand));
    if (m) { friend = m; amountText = tokens.filter((_, j) => j !== i).join(' '); break; }
  }
  if (!friend) return send(msg.chat.id, 'Who paid? <code>/paid 14 Alice</code>');
  const parsed = parseAmount(amountText);
  if (!parsed) return send(msg.chat.id, 'Need an amount. <code>/paid 14 Alice</code>');
  wallet.settlements.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,5),
    from: friend.id, to: userId, amount: parsed.amount, ccy: parsed.ccy,
    date: new Date().toISOString(),
  });
  await saveWallet(userId, wallet);
  await send(msg.chat.id, `✓ <b>${htmlEscape(friend.name)}</b> paid you ${fmtMoney(parsed.amount, parsed.ccy)}.`);
}

async function cmdFriendAdd(msg, args) {
  const userId = String(msg.from.id);
  const wallet = await getWallet(userId);
  ensureOwner(wallet, msg.from);
  const names = args.split(/\s*,\s*|\s+and\s+|\s+&\s+|\s+/i).map(s => s.trim()).filter(Boolean).map(capitalize);
  const added = [];
  for (const n of names) {
    const existed = Object.values(wallet.members).some(m => m.name.toLowerCase() === n.toLowerCase());
    if (!existed) added.push(joinFriend(wallet, n).name);
  }
  if (!added.length) return send(msg.chat.id, 'No new friends added (already exist?).');
  await saveWallet(userId, wallet);
  await send(msg.chat.id, `✓ Added: <b>${added.map(htmlEscape).join(', ')}</b>`);
}

async function cmdFriendRemove(msg, args) {
  const userId = String(msg.from.id);
  const wallet = await getWallet(userId);
  const name = args.trim().toLowerCase();
  const f = Object.values(wallet.members).find(m => m.ghost && m.name.toLowerCase() === name);
  if (!f) return send(msg.chat.id, `No friend "${htmlEscape(args)}".`);
  const used = wallet.expenses.some(e => e.payer === f.id || e.splitWith.includes(f.id));
  if (used) return send(msg.chat.id, `<b>${htmlEscape(f.name)}</b> has expenses — settle first.`);
  delete wallet.members[f.id];
  await saveWallet(userId, wallet);
  await send(msg.chat.id, `✕ Removed <b>${htmlEscape(f.name)}</b>.`);
}

async function cmdFriends(msg) {
  const userId = String(msg.from.id);
  const wallet = await getWallet(userId);
  const ghosts = Object.values(wallet.members).filter(m => m.ghost);
  if (!ghosts.length) return send(msg.chat.id, 'No friends yet. <code>/friend add Alice Bob</code>');
  await send(msg.chat.id, `<b>Friends:</b>\n${ghosts.map(f => `· ${htmlEscape(f.name)}`).join('\n')}`);
}

async function cmdExpenses(msg) {
  const userId = String(msg.from.id);
  const wallet = await getWallet(userId);
  const recent = wallet.expenses.slice(-10).reverse();
  if (!recent.length) return send(msg.chat.id, 'No expenses yet.');
  const lines = recent.map(e => {
    const n = htmlEscape(wallet.members[e.payer]?.name || '?');
    return `· <b>${fmtMoney(e.amount, e.ccy)}</b> — ${htmlEscape(e.desc)} <i>(${n})</i>`;
  });
  await send(msg.chat.id, `<b>Recent:</b>\n${lines.join('\n')}`);
}

async function cmdUndo(msg) {
  const userId = String(msg.from.id);
  const wallet = await getWallet(userId);
  for (let i = wallet.expenses.length - 1; i >= 0; i--) {
    if (wallet.expenses[i].payer === userId) {
      const r = wallet.expenses.splice(i, 1)[0];
      await saveWallet(userId, wallet);
      return send(msg.chat.id, `✕ Undone: <b>${htmlEscape(r.desc)}</b> (${fmtMoney(r.amount, r.ccy)})`);
    }
  }
  await send(msg.chat.id, 'Nothing of yours to undo.');
}

// ─── webhook entry ─────────────────────────────────────────────
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(200).send('Tally webhook OK. Use POST.');
  }
  // Optional simple-secret check
  if (process.env.WEBHOOK_SECRET) {
    if (req.headers['x-telegram-bot-api-secret-token'] !== process.env.WEBHOOK_SECRET) {
      return res.status(403).end();
    }
  }
  try {
    const update = req.body || await readBody(req);
    const msg = update.message;
    if (!msg || !msg.text) return res.status(200).end();
    const text = msg.text.trim();
    const m = text.match(/^\/(\w+)(?:@\w+)?(?:\s+(.+))?$/s);
    if (!m) return res.status(200).end();
    const cmd  = m[1].toLowerCase();
    const args = (m[2] || '').trim();

    if (cmd === 'start' || cmd === 'help') await cmdStart(msg);
    else if (cmd === 'add')      await cmdAdd(msg, args);
    else if (cmd === 'balance')  await cmdBalance(msg);
    else if (cmd === 'settle')   await cmdSettle(msg);
    else if (cmd === 'paid')     await cmdPaid(msg, args);
    else if (cmd === 'friends')  await cmdFriends(msg);
    else if (cmd === 'friend') {
      const sub = args.split(/\s+/)[0];
      const rest = args.slice(sub.length).trim();
      if (sub === 'add')    await cmdFriendAdd(msg, rest);
      else if (sub === 'remove') await cmdFriendRemove(msg, rest);
      else await send(msg.chat.id, 'Usage: <code>/friend add NAME</code> or <code>/friend remove NAME</code>');
    }
    else if (cmd === 'expenses') await cmdExpenses(msg);
    else if (cmd === 'undo')     await cmdUndo(msg);
    else await send(msg.chat.id, `Unknown: /${cmd}. Try /help.`);

    res.status(200).end();
  } catch (e) {
    console.error('webhook error', e);
    res.status(200).end(); // Always 200 so Telegram doesn't retry
  }
};

async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  return await new Promise((resolve) => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
  });
}
