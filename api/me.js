// GET /api/me — bootstrap call, returns user info + their wallet snapshot.
const { requireUser } = require('../lib/auth');
const { getWallet, saveWallet } = require('../lib/db');
const { simplify } = require('../lib/money');

module.exports = async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const userId = String(user.id);
  const wallet = await getWallet(userId);

  // Ensure the owner is in the members map (so they show up in balance views).
  if (!wallet.members[userId]) {
    wallet.members[userId] = {
      id: userId,
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'You',
      ghost: false,
      tgId: user.id,
      username: user.username || null,
      isOwner: true,
    };
    await saveWallet(userId, wallet);
  }

  const sim = simplify(wallet);

  res.status(200).json({
    user: {
      id: userId,
      name: wallet.members[userId].name,
      username: user.username || null,
    },
    wallet: {
      members: wallet.members,
      expenses: wallet.expenses.slice(-50).reverse(), // recent first
      subs: wallet.subs,
      groups: wallet.groups || [],
      defaultCcy: wallet.defaultCcy || 'USD',
    },
    summary: sim, // { USD: { balances, transactions }, ... }
  });
};
