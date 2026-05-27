// POST /api/settled — record a payment between two members.
// Body: { fromId, toId, amount, ccy }

const { requireUser } = require('./_lib/auth');
const { getWallet, saveWallet } = require('./_lib/db');

module.exports = async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  if (req.method !== 'POST') return res.status(405).end();
  const userId = String(user.id);
  const wallet = await getWallet(userId);
  const body = await readBody(req);

  const fromId = String(body.fromId || '');
  const toId   = String(body.toId   || '');
  const amount = Number(body.amount);
  const ccy    = (body.ccy || wallet.defaultCcy || 'USD').toUpperCase();

  if (!fromId || !toId || fromId === toId) return res.status(400).json({ error: 'fromId / toId required' });
  if (!isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'invalid amount' });
  if (!wallet.members[fromId] || !wallet.members[toId]) return res.status(400).json({ error: 'unknown member' });

  const s = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    from: fromId, to: toId, amount, ccy,
    date: new Date().toISOString(),
  };
  wallet.settlements.push(s);
  await saveWallet(userId, wallet);
  res.status(200).json({ settlement: s });
};

async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  return await new Promise((resolve) => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
  });
}
