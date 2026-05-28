// GET/POST/DELETE /api/expenses
// GET    → recent expenses
// POST   → { amount, ccy, description, splitWith[ids], payerId? }
// DELETE → ?id=N — remove one

const { requireUser } = require('./lib/auth');
const { getWallet, saveWallet } = require('./lib/db');

module.exports = async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const userId = String(user.id);
  const wallet = await getWallet(userId);

  if (req.method === 'GET') {
    return res.status(200).json({ expenses: wallet.expenses.slice().reverse() });
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const amount = Number(body.amount);
    const ccy = (body.ccy || wallet.defaultCcy || 'USD').toUpperCase();
    const desc = String(body.description || 'expense').slice(0, 200);
    const splitWith = Array.isArray(body.splitWith) ? body.splitWith.map(String) : [];
    const payer = String(body.payerId || userId);
    const groupId = body.groupId ? String(body.groupId) : null;

    if (!isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'invalid amount' });
    if (splitWith.length < 1) return res.status(400).json({ error: 'splitWith required' });
    // Verify all referenced members exist
    for (const id of [payer, ...splitWith]) {
      if (!wallet.members[id]) return res.status(400).json({ error: `unknown member ${id}` });
    }

    const exp = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      payer,
      amount,
      ccy,
      desc,
      splitWith,
      groupId,
      date: new Date().toISOString(),
    };
    wallet.expenses.push(exp);
    await saveWallet(userId, wallet);
    return res.status(200).json({ expense: exp });
  }

  if (req.method === 'DELETE') {
    const id = (req.query?.id || '').toString();
    const idx = wallet.expenses.findIndex(e => e.id === id);
    if (idx === -1) return res.status(404).json({ error: 'not found' });
    wallet.expenses.splice(idx, 1);
    await saveWallet(userId, wallet);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
};

async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  return await new Promise((resolve) => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
  });
}
