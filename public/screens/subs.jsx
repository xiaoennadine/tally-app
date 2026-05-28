// Subscriptions — track recurring shared services.
const T_sub = window.TG_TOKENS;

// Given a sub with nextCharge + cycle, compute days-until-renewal and bar progress.
function computeCycleProgress(s) {
  if (!s.nextCharge) return null;
  const next = new Date(s.nextCharge + 'T00:00:00');
  if (isNaN(next.getTime())) return null;
  const now = new Date();
  // Today at midnight for stable day math
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLeft = Math.round((next - today) / 86400000);
  const cycleDays = (s.cycle === 'yearly') ? 365 : 30;
  const elapsed = Math.max(0, cycleDays - daysLeft);
  const progressPct = (elapsed / cycleDays) * 100;
  const formattedDate = next.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return { daysLeft, progressPct, formattedDate };
}

function SubsScreen({ data, onBack, onChanged }) {
  const { user, wallet } = data;
  const userId = user.id;
  const allMembers = Object.values(wallet.members);
  const [showAdd, setShowAdd] = React.useState(false);

  const remove = async (id, name) => {
    if (!window.confirm(`Stop tracking ${name}?`)) return;
    try {
      await TallyAPI.subs.remove(id);
      onChanged();
    } catch (e) {
      alert(e.message);
    }
  };

  const yourMonthlyShare = wallet.subs.reduce((sum, s) => {
    if (s.members.includes(userId)) return sum + s.price / s.members.length;
    return sum;
  }, 0);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T_sub.bg }}>
      <Header title="Subscriptions" subtitle={`${wallet.subs.length} active`} onBack={onBack} />

      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 100 }} className="no-scroll">
        {/* totals */}
        {wallet.subs.length > 0 && (
          <div style={{ padding: 14 }}>
            <div style={{
              background: '#fff', borderRadius: 14, padding: 16, border: `1px solid ${T_sub.divider}`,
            }}>
              <div style={{ fontSize: 11, color: T_sub.secondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>Your monthly share</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: T_sub.text, letterSpacing: -0.8, marginTop: 2 }}>{fmtMoney(yourMonthlyShare, wallet.defaultCcy || 'USD')}</div>
            </div>
          </div>
        )}

        {/* list */}
        <div style={{ padding: '0 14px' }}>
          {!wallet.subs.length && <Empty icon="📺" title="No subscriptions yet. Track Netflix, Disney+, Spotify..." />}
          {wallet.subs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {wallet.subs.map(s => {
                const share = s.price / s.members.length;
                const cycleInfo = computeCycleProgress(s);
                return (
                  <Card key={s.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: '#ede9fe', color: T_sub.primary, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.emoji}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: T_sub.text }}>{s.name}</div>
                        <div style={{ fontSize: 11.5, color: T_sub.secondary }}>
                          {wallet.members[s.payer]?.name || '?'} pays · ÷ {s.members.length} · {s.cycle || 'monthly'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: T_sub.text, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(share, s.ccy)}</div>
                        <div style={{ fontSize: 10.5, color: T_sub.muted }}>of {fmtMoney(s.price, s.ccy)}</div>
                      </div>
                    </div>

                    {/* Renewal progress bar */}
                    {cycleInfo && (
                      <div style={{ padding: '0 14px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11, color: T_sub.secondary, marginBottom: 4 }}>
                          <span>Renews {cycleInfo.formattedDate}</span>
                          <span style={{
                            fontWeight: 600,
                            color: cycleInfo.daysLeft <= 3 ? T_sub.negative : cycleInfo.daysLeft <= 7 ? '#d97706' : T_sub.secondary,
                          }}>
                            {cycleInfo.daysLeft <= 0 ? 'due today' :
                             cycleInfo.daysLeft === 1 ? 'tomorrow' :
                             `${cycleInfo.daysLeft} day${cycleInfo.daysLeft === 1 ? '' : 's'}`}
                          </span>
                        </div>
                        <div style={{ height: 4, background: '#eceef0', borderRadius: 100, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', width: `${Math.min(100, cycleInfo.progressPct)}%`,
                            background: cycleInfo.daysLeft <= 3 ? T_sub.negative : cycleInfo.daysLeft <= 7 ? '#f59e0b' : T_sub.primary,
                            transition: 'width 300ms ease',
                          }} />
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', borderTop: `1px solid ${T_sub.divider}` }}>
                      <div onClick={() => remove(s.id, s.name)} style={{ flex: 1, padding: '10px', textAlign: 'center', fontSize: 13, color: T_sub.negative, cursor: 'pointer' }}>Remove</div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* FAB */}
      <div onClick={() => setShowAdd(true)} style={{
        position: 'absolute', right: 18, bottom: 80,
        width: 56, height: 56, borderRadius: '50%',
        background: `linear-gradient(135deg, ${T_sub.primary} 0%, #ff7ab3 100%)`,
        boxShadow: '0 10px 24px rgba(124,92,255,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 28, fontWeight: 300, cursor: 'pointer',
      }}>＋</div>

      {showAdd && <AddSubSheet allMembers={allMembers} userId={userId} wallet={wallet} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); onChanged(); }} />}
    </div>
  );
}

function AddSubSheet({ allMembers, userId, wallet, onClose, onSaved }) {
  const [name, setName] = React.useState('');
  const [emoji, setEmoji] = React.useState('📺');
  const [price, setPrice] = React.useState('');
  const [ccy, setCcy] = React.useState(wallet.defaultCcy || 'USD');
  const [cycle, setCycle] = React.useState('monthly');
  const [nextCharge, setNextCharge] = React.useState(() => {
    // Default: 1 month from today, formatted YYYY-MM-DD for <input type=date>
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [members, setMembers] = React.useState(new Set([userId]));
  const [payer, setPayer] = React.useState(userId);
  const [busy, setBusy] = React.useState(false);

  const toggle = (id) => {
    const s = new Set(members);
    s.has(id) ? s.delete(id) : s.add(id);
    setMembers(s);
  };

  const save = async () => {
    if (!name.trim() || !parseFloat(price)) return;
    setBusy(true);
    try {
      await TallyAPI.subs.add({
        name: name.trim(), emoji,
        price: parseFloat(price), ccy,
        cycle,
        nextCharge,
        members: [...members], payer,
      });
      onSaved();
    } catch (e) {
      alert(e.message);
      setBusy(false);
    }
  };

  return (
    <Sheet open={true} onClose={onClose} title="Add subscription">
      <div style={{ padding: '12px 16px 20px' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <input value={emoji} onChange={e => setEmoji(e.target.value.slice(0, 2))} maxLength={2}
                 style={{ width: 60, fontSize: 28, textAlign: 'center', border: `1px solid ${T_sub.divider}`, borderRadius: 10, outline: 'none' }} />
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Netflix Premium"
                 style={{ flex: 1, border: `1px solid ${T_sub.divider}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <input type="number" inputMode="decimal" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)}
                 style={{ flex: 1, border: `1px solid ${T_sub.divider}`, borderRadius: 10, padding: '10px 12px', fontSize: 18, fontWeight: 700, outline: 'none' }} />
          <select value={ccy} onChange={e => setCcy(e.target.value)} style={{
            border: `1px solid ${T_sub.divider}`, borderRadius: 10, padding: '8px 10px',
            background: '#fff', fontSize: 14, fontWeight: 600,
          }}>
            {window.SUPPORTED_CCYS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Billing cycle + next charge */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: T_sub.secondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>Cycle</label>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {['monthly', 'yearly'].map(c => (
                <div key={c} onClick={() => setCycle(c)} style={{
                  flex: 1, padding: '8px 0', borderRadius: 10, textAlign: 'center',
                  background: cycle === c ? T_sub.primarySoft : '#f4f5f7',
                  border: `1.5px solid ${cycle === c ? T_sub.primary : 'transparent'}`,
                  fontSize: 13, fontWeight: 600, color: cycle === c ? T_sub.primary : T_sub.secondary,
                  cursor: 'pointer', textTransform: 'capitalize',
                }}>{c}</div>
              ))}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: T_sub.secondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>Next charge</label>
            <input
              type="date" value={nextCharge}
              onChange={e => setNextCharge(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              style={{
                marginTop: 6, width: '100%', border: `1px solid ${T_sub.divider}`,
                borderRadius: 10, padding: '8px 10px', fontSize: 13,
                color: T_sub.text, outline: 'none', fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        <label style={{ fontSize: 11, color: T_sub.secondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>Who pays?</label>
        <div style={{ display: 'flex', gap: 6, marginTop: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {allMembers.map(m => (
            <div key={m.id} onClick={() => setPayer(m.id)} style={{
              padding: '5px 12px 5px 5px', borderRadius: 100,
              background: m.id === payer ? T_sub.primarySoft : '#f4f5f7',
              border: `1.5px solid ${m.id === payer ? T_sub.primary : 'transparent'}`,
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: T_sub.text, fontWeight: 500,
            }}>
              <Avatar name={m.name} size={20} />
              {m.id === userId ? 'You' : m.name}
            </div>
          ))}
        </div>

        <label style={{ fontSize: 11, color: T_sub.secondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>Split with</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 6, marginBottom: 14 }}>
          {allMembers.map(m => {
            const on = members.has(m.id);
            return (
              <div key={m.id} onClick={() => toggle(m.id)} style={{
                padding: '10px 6px', borderRadius: 12, textAlign: 'center',
                background: on ? T_sub.primarySoft : '#f4f5f7',
                border: `1.5px solid ${on ? T_sub.primary : 'transparent'}`,
                cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}><Avatar name={m.name} size={32} /></div>
                <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.id === userId ? 'You' : m.name}</div>
              </div>
            );
          })}
        </div>

        <Button onClick={save} disabled={!name.trim() || !parseFloat(price) || busy} style={{ width: '100%' }}>
          {busy ? 'Saving…' : 'Save subscription'}
        </Button>
      </div>
    </Sheet>
  );
}

window.SubsScreen = SubsScreen;
