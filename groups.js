// GET/POST/PATCH/DELETE /api/groups
const { requireUser } = require('./lib/auth');
const { getWallet, saveWallet } = require('./lib/db');

module.exports = async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const userId = String(user.id);
  const wallet = await getWallet(userId);
  if (!wallet.groups) wallet.groups = [];

  if (req.method === 'GET') {
    return res.status(200).json({ groups: wallet.groups });
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const name = String(body.name || '').trim().slice(0, 60);
    const emoji = String(body.emoji || '📁').slice(0, 4);
    if (!name) return res.status(400).json({ error: 'name required' });
    const memberIds = sanitizeMemberIds(body.memberIds, wallet, userId);
    const g = {
      id: 'grp:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      name, emoji,
      memberIds,
      createdAt: new Date().toISOString(),
    };
    wallet.groups.push(g);
    await saveWallet(userId, wallet);
    return res.status(200).json({ group: g });
  }

  if (req.method === 'PATCH') {
    const id = (req.query?.id || '').toString();
    const body = await readBody(req);
    const g = wallet.groups.find(x => x.id === id);
    if (!g) return res.status(404).json({ error: 'not found' });
    if (typeof body.name === 'string') {
      const trimmed = body.name.trim().slice(0, 60);
      if (!trimmed) return res.status(400).json({ error: 'name required' });
      g.name = trimmed;
    }
    if (typeof body.emoji === 'string' && body.emoji.length) {
      g.emoji = body.emoji.slice(0, 4);
    }
    if (Array.isArray(body.memberIds)) {
      g.memberIds = sanitizeMemberIds(body.memberIds, wallet, userId);
    }
    await saveWallet(userId, wallet);
    return res.status(200).json({ group: g });
  }

  if (req.method === 'DELETE') {
    const id = (req.query?.id || '').toString();
    const idx = wallet.groups.findIndex(g => g.id === id);
    if (idx === -1) return res.status(404).json({ error: 'not found' });
    wallet.groups.splice(idx, 1);
    // un-tag any expenses that used it
    for (const e of wallet.expenses) {
      if (e.groupId === id) delete e.groupId;
    }
    await saveWallet(userId, wallet);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
};

// Drop any ids we don't know, dedupe, always include the owner.
function sanitizeMemberIds(input, wallet, ownerId) {
  const set = new Set();
  set.add(ownerId);
  if (Array.isArray(input)) {
    for (const raw of input) {
      const id = String(raw);
      if (wallet.members[id]) set.add(id);
    }
  }
  return [...set];
}

async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  return await new Promise((resolve) => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
  });
}
