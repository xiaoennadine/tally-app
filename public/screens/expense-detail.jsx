// Expense detail — drill into one expense (or a receipt-grouped set) to see who got what.
const T_xd = window.TG_TOKENS;

function ExpenseDetailScreen({ data, expenseId, onBack, onChanged }) {
  const { user, wallet } = data;
  const userId = user.id;
  const homeCcy = wallet.defaultCcy || 'USD';
  const { rates, ready: fxReady } = window.useFx();
  const [busy, setBusy] = React.useState(false);

  // Find the expense; if it has a receiptId, surface all expenses from that receipt.
  const anchor = wallet.expenses.find(e => e.id === expenseId);
  if (!anchor) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T_xd.bg }}>
        <Header title="Expense" onBack={onBack} />
        <Empty icon="🔍" title="Expense not found" />
      </div>
    );
  }

  const siblings = anchor.receiptId
    ? wallet.expenses.filter(e => e.receiptId === anchor.receiptId)
    : [anchor];

  const cat = window.getCategory(anchor.category || 'other');
  const group = anchor.groupId ? (wallet.groups || []).find(g => g.id === anchor.groupId) : null;
  const payer = wallet.members[anchor.payer];
  const isYou = anchor.payer === userId;
  const date = new Date(anchor.date);

  // Aggregate across siblings for vendor/receipt view
  const totalInCcy = siblings.reduce((a, e) => a + e.amount, 0);
  const totalInHome = (anchor.ccy === homeCcy) ? totalInCcy
    : (fxReady ? (window.convertMoney(totalInCcy, anchor.ccy, homeCcy, rates) || 0) : null);

  // Per-person share: each expense bucket apportions equal share to its splitWith.
  const perPerson = {};
  for (const e of siblings) {
    const share = e.amount / Math.max(1, e.splitWith.length);
    for (const id of e.splitWith) {
      perPerson[id] = (perPerson[id] || 0) + share;
    }
  }

  // Your impact: you paid (- share if you're in splitWith) + (positive what others owe you)
  const yourShare = perPerson[userId] || 0;
  const youPaid = siblings.filter(e => e.payer === userId).reduce((a, e) => a + e.amount, 0);
  const yourImpact = youPaid - yourShare;

  const remove = async () => {
    if (busy) return;
    if (!confirm(`Delete ${siblings.length > 1 ? `all ${siblings.length} entries` : 'this expense'}?`)) return;
    setBusy(true);
    try {
      for (const e of siblings) {
        await TallyAPI.expenses.remove(e.id);
      }
      await onChanged();
      onBack();
    } catch (e) {
      alert(e.message);
      setBusy(false);
    }
  };

  const title = anchor.vendor || (anchor.desc.split(' — ')[0]) || 'Expense';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T_xd.bg }}>
      <Header title={title} onBack={onBack} />

      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 100 }} className="no-scroll">
        <div style={{ padding: 14 }}>
          {/* Hero card */}
          <div style={{
            background: '#fff', borderRadius: 14, padding: 16, marginBottom: 14,
            border: `1px solid ${T_xd.divider}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: `${cat.color}22`, color: cat.color,
                fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>{cat.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: T_xd.text }}>{title}</div>
                <div style={{ fontSize: 11.5, color: T_xd.secondary, marginTop: 2 }}>
                  {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {' · '}
                  {isYou ? 'You' : payer?.name || '?'} paid
                </div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', background: `${cat.color}22`, color: cat.color,
                    borderRadius: 100, fontSize: 10.5, fontWeight: 600,
                  }}>{cat.label}</div>
                  {group && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', background: T_xd.primarySoft, color: T_xd.primary,
                      borderRadius: 100, fontSize: 10.5, fontWeight: 600,
                    }}>{group.emoji} {group.name}</div>
                  )}
                  {siblings.length > 1 && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', background: '#fef3c7', color: '#92400e',
                      borderRadius: 100, fontSize: 10.5, fontWeight: 600,
                    }}>📄 Receipt · {siblings.length} entries</div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ height: 1, background: T_xd.divider, margin: '14px -16px 14px' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <div style={{ fontSize: 10.5, color: T_xd.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Total</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: T_xd.text, letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtMoney(totalInCcy, anchor.ccy)}
                </div>
                {anchor.ccy !== homeCcy && totalInHome !== null && (
                  <div style={{ fontSize: 11.5, color: T_xd.muted, marginTop: 2 }}>
                    ≈ {fmtMoney(totalInHome, homeCcy)}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10.5, color: T_xd.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Your impact</div>
                <div style={{
                  fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  color: yourImpact > 0.01 ? '#1fbf75' : yourImpact < -0.01 ? '#ef4444' : T_xd.text,
                }}>
                  {yourImpact >= 0 ? '+' : '−'}{fmtMoney(Math.abs(yourImpact), anchor.ccy)}
                </div>
              </div>
            </div>
          </div>

          {/* Per-person shares */}
          <div style={{ fontSize: 11, fontWeight: 700, color: T_xd.secondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, padding: '0 4px' }}>
            Who paid what
          </div>
          <Card style={{ marginBottom: 14 }}>
            {Object.entries(perPerson).map(([id, amt], i, arr) => {
              const m = wallet.members[id];
              if (!m) return null;
              const isPayer = id === anchor.payer;
              const isUser = id === userId;
              const amtInHome = anchor.ccy !== homeCcy && fxReady
                ? window.convertMoney(amt, anchor.ccy, homeCcy, rates)
                : null;
              return (
                <Row key={id} last={i === arr.length - 1}>
                  <Avatar name={m.name} size={36} emoji={m.avatarEmoji} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T_xd.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isUser ? 'You' : m.name}
                      {isPayer && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                          color: T_xd.primary, background: T_xd.primarySoft,
                          padding: '2px 6px', borderRadius: 4,
                        }}>PAID</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: T_xd.muted, marginTop: 1 }}>
                      Their share
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T_xd.text, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtMoney(amt, anchor.ccy)}
                    </div>
                    {amtInHome !== null && (
                      <div style={{ fontSize: 10.5, color: T_xd.muted, fontVariantNumeric: 'tabular-nums' }}>
                        ≈ {fmtMoney(amtInHome, homeCcy)}
                      </div>
                    )}
                  </div>
                </Row>
              );
            })}
          </Card>

          {/* Receipt line items (sibling expenses) */}
          {siblings.length > 1 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: T_xd.secondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, padding: '0 4px' }}>
                Receipt breakdown
              </div>
              <Card style={{ marginBottom: 14 }}>
                {siblings.map((e, i) => (
                  <Row key={e.id} last={i === siblings.length - 1}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 6, background: '#f4f5f7',
                      fontSize: 10, fontWeight: 700, color: T_xd.secondary,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, color: T_xd.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {e.desc.replace(/^[^—]+— /, '')}
                      </div>
                      <div style={{ fontSize: 10.5, color: T_xd.muted, marginTop: 1 }}>
                        Split with {e.splitWith.length} {e.splitWith.length === 1 ? 'person' : 'people'}
                      </div>
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: T_xd.text, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtMoney(e.amount, e.ccy)}
                    </div>
                  </Row>
                ))}
              </Card>
            </>
          )}

          {/* Delete button */}
          <div onClick={remove} style={{
            padding: '12px', textAlign: 'center', borderRadius: 12,
            background: '#fee2e2', color: '#7f1d1d',
            fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
          }}>
            {busy ? 'Deleting…' : (siblings.length > 1 ? `🗑 Delete receipt (${siblings.length} entries)` : '🗑 Delete expense')}
          </div>
        </div>
      </div>
    </div>
  );
}

window.ExpenseDetailScreen = ExpenseDetailScreen;
