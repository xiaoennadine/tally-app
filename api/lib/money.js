// Money parsing, formatting, and debt-graph simplification.

const CCY_SYM = { '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY' };
const SYM_OF  = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', SGD: 'S$', AUD: 'A$', CAD: 'C$' };
const SUPPORTED_CCYS = ['USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AUD', 'CAD'];

function fmtMoney(amount, ccy = 'USD') {
  const sym = SYM_OF[ccy] || (ccy + ' ');
  if (ccy === 'JPY') return `${sym}${Math.round(amount).toLocaleString()}`;
  return `${sym}${amount.toFixed(2)}`;
}

// Pull a money expression out of text. Returns { amount, ccy, rest } or null.
function parseAmount(text) {
  const patterns = [
    /([$€£¥])\s*([\d,]+(?:\.\d+)?)/,
    /([\d,]+(?:\.\d+)?)\s*(USD|EUR|GBP|JPY|SGD|AUD|CAD)\b/i,
    /([\d,]+(?:\.\d+)?)/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    let amount, ccy;
    if (CCY_SYM[m[1]]) {
      amount = parseFloat(m[2].replace(/,/g, ''));
      ccy = CCY_SYM[m[1]];
    } else if (m[2] && /USD|EUR|GBP|JPY|SGD|AUD|CAD/i.test(m[2])) {
      amount = parseFloat(m[1].replace(/,/g, ''));
      ccy = m[2].toUpperCase();
    } else {
      amount = parseFloat(m[1].replace(/,/g, ''));
      ccy = 'USD';
    }
    if (!isFinite(amount) || amount <= 0) continue;
    return { amount, ccy, rest: text.replace(m[0], '').trim() };
  }
  return null;
}

// Compute net balances + simplified pay-down plan per currency.
// All math is keyed by memberId; the wallet's "Me" record uses the owner's userId
// as its id, and friends use string ids like 'g:abc' (see api/friends.js).
function simplify(wallet) {
  const byCcy = {};
  for (const e of wallet.expenses) {
    (byCcy[e.ccy] ||= []).push(e);
  }
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

    // Greedy simplification: largest creditor matched against largest debtor, repeat.
    const cred = Object.entries(bal).filter(([, v]) => v > 0.01).sort((a,b) => b[1]-a[1]).map(([k,v]) => [k,v]);
    const debt = Object.entries(bal).filter(([, v]) => v < -0.01).sort((a,b) => a[1]-b[1]).map(([k,v]) => [k,v]);
    const tx = [];
    let i=0, j=0;
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

module.exports = { fmtMoney, parseAmount, simplify, SUPPORTED_CCYS, SYM_OF };
