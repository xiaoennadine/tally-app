// Settle Up — show simplified pay-down plan, tap to mark settled.
const T_set = window.TG_TOKENS;

function SettleScreen({ data, onBack, onSettled }) {
  const { user, wallet, summary } = data;
  const userId = user.id;

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
                <SettleRow key={i} tx={t} userId={userId} wallet={wallet} onSettled={onSettled} last={i===mine.length-1} />
              ))}
            </Card>
          </Section>
        )}

        {others.length > 0 && (
          <Section title="Between friends">
            <Card>
              {others.map((t, i) => (
                <SettleRow key={i} tx={t} userId={userId} wallet={wallet} onSettled={onSettled} last={i===others.length-1} />
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

function SettleRow({ tx, userId, wallet, onSettled, last }) {
  const from = wallet.members[tx.from];
  const to   = wallet.members[tx.to];
  const youAreFrom = tx.from === userId;
  const youAreTo   = tx.to   === userId;
  const [busy, setBusy] = React.useState(false);

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

  return (
    <Row last={last}>
      <Avatar name={from?.name || '?'} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: T_set.text }}>
          <b>{youAreFrom ? 'You' : (from?.name || '?')}</b> {' → '} <b>{youAreTo ? 'You' : (to?.name || '?')}</b>
        </div>
        <div style={{ fontSize: 11.5, color: T_set.secondary, marginTop: 1 }}>
          {fmtMoney(tx.amount, tx.ccy)} {youAreFrom ? '· you pay' : youAreTo ? '· you receive' : ''}
        </div>
      </div>
      <Button
        onClick={markSettled} disabled={busy}
        variant={youAreFrom ? 'primary' : 'ghost'}
        style={{ padding: '7px 14px', fontSize: 12, borderRadius: 100 }}
      >
        {busy ? '…' : 'Mark paid'}
      </Button>
    </Row>
  );
}

window.SettleScreen = SettleScreen;
