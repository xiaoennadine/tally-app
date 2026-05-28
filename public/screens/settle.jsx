// Settle Up — show simplified pay-down plan, tap to mark settled.
const T_set = window.TG_TOKENS;

function SettleScreen({ data, onBack, onSettled }) {
  const { user, wallet, summary } = data;
  const userId = user.id;
  const homeCcy = wallet.defaultCcy || 'USD';
  const { rates, ready: fxReady } = window.useFx();

  const allTx = [];
  for (const ccy of Object.keys(summary)) {
    for (const tx of summary[ccy].transactions) {
      allTx.push({ ...tx, ccy });
    }
  }
  const mine = allTx.filter(t => t.from === userId || t.to === userId);
  const others = allTx.filter(t => t.from !== userId && t.to !== userId);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T_set.bg }}>
      <Header title="Settle up" subtitle={`${allTx.length} payment${allTx.length===1?'':'s'} needed`} onBack={onBack} />

      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 100 }} className="no-scroll">
        {!allTx.length && (
          <Empty icon="🎉" title="All settled up! No one owes anyone anything." />
        )}

        {mine.length > 0 && (
          <Section title="Involving you">
            <Card>
              {mine.map((t, i) => (
                <SettleRow key={i} tx={t} userId={userId} wallet={wallet} onSettled={onSettled} last={i===mine.length-1} homeCcy={homeCcy} rates={rates} fxReady={fxReady} />
              ))}
            </Card>
          </Section>
        )}

        {others.length > 0 && (
          <Section title="Between friends">
            <Card>
              {others.map((t, i) => (
                <SettleRow key={i} tx={t} userId={userId} wallet={wallet} onSettled={onSettled} last={i===others.length-1} homeCcy={homeCcy} rates={rates} fxReady={fxReady} />
              ))}
            </Card>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ padding: '14px 14px 0' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: T_set.secondary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function SettleRow({ tx, userId, wallet, onSettled, last, homeCcy, rates, fxReady }) {
  const from = wallet.members[tx.from];
  const to   = wallet.members[tx.to];
  const youAreFrom = tx.from === userId;
  const youAreTo   = tx.to   === userId;
  const [busy, setBusy] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  const isForeign = tx.ccy !== homeCcy;
  const amountInHome = isForeign && fxReady
    ? window.convertMoney(tx.amount, tx.ccy, homeCcy, rates)
    : null;

  // Find expenses connecting these two people in this currency.
  // "from" owes "to" their share of each expense where "to" paid and "from" is in splitWith.
  const relatedExpenses = React.useMemo(() => {
    return (wallet.expenses || [])
      .filter(e => e.ccy === tx.ccy && e.payer === tx.to && e.splitWith?.includes(tx.from))
      .map(e => ({
        ...e,
        share: e.amount / Math.max(1, e.splitWith.length),
      }))
      // newest first
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [wallet.expenses, tx.from, tx.to, tx.ccy]);

  const markSettled = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await TallyAPI.settled({ fromId: tx.from, toId: tx.to, amount: tx.amount, ccy: tx.ccy });
      onSettled();
    } catch (e) {
      alert('Could not save: ' + e.message);
      setBusy(false);
    }
  };

  // Pre-expansion preview line: first 1-2 expenses summarized
  const previewText = relatedExpenses.length
    ? relatedExpenses.slice(0, 2).map(e => e.desc).join(', ') + (relatedExpenses.length > 2 ? `, +${relatedExpenses.length - 2} more` : '')
    : null;

  return (
    <div style={{ borderBottom: last ? 'none' : `1px solid ${T_set.divider}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
        <Avatar name={from?.name || '?'} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, color: T_set.text }}>
            <b>{youAreFrom ? 'You' : (from?.name || '?')}</b> {' → '} <b>{youAreTo ? 'You' : (to?.name || '?')}</b>
          </div>
          <div style={{ fontSize: 11.5, color: T_set.secondary, marginTop: 1 }}>
            {fmtMoney(tx.amount, tx.ccy)}
            {amountInHome !== null && <span style={{ color: T_set.muted }}> · ≈ {fmtMoney(amountInHome, homeCcy)}</span>}
            {' '}{youAreFrom ? '· you pay' : youAreTo ? '· you receive' : ''}
          </div>
        </div>
        <Button
          onClick={markSettled} disabled={busy}
          variant={youAreFrom ? 'primary' : 'ghost'}
          style={{ padding: '7px 14px', fontSize: 12, borderRadius: 100 }}
        >
          {busy ? '…' : 'Mark paid'}
        </Button>
      </div>

      {/* Context: what is this payment for? */}
      {relatedExpenses.length > 0 && (
        <div style={{ padding: '0 14px 12px' }}>
          <div
            onClick={() => setExpanded(v => !v)}
            style={{
              fontSize: 11.5, color: T_set.secondary, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 42,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 20 20" style={{
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 150ms ease', flexShrink: 0,
            }}>
              <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
              {expanded ? `${relatedExpenses.length} expense${relatedExpenses.length === 1 ? '' : 's'} — tap to collapse` : `for: ${previewText}`}
            </span>
          </div>

          {expanded && (
            <div style={{
              marginTop: 8, marginLeft: 42, padding: 10,
              background: '#f4f5f7', borderRadius: 10,
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              {relatedExpenses.map(e => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: T_set.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.desc}
                    </div>
                    <div style={{ fontSize: 10.5, color: T_set.muted, marginTop: 1 }}>
                      {fmtMoney(e.amount, e.ccy)} ÷ {e.splitWith.length}
                    </div>
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: T_set.text, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {fmtMoney(e.share, e.ccy)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

window.SettleScreen = SettleScreen;
