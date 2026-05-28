// Subscriptions — track recurring shared services with timeline + savings hero.
const T_sub = window.TG_TOKENS;

// Curated palette for color-coding subs
const SUB_COLORS = ['#ef4444', '#10b981', '#3b82f6', '#06b6d4', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];
const SUB_ICONS = ['📺', '🎬', '🎵', '☁️', '🎮', '📰', '🛒', '📚', '💪', '🎨'];

// Given a sub with nextCharge + cycle, compute days-until-renewal and bar progress.
function computeCycleProgress(s) {
  if (!s.nextCharge) return null;
  const next = new Date(s.nextCharge + 'T00:00:00');
  if (isNaN(next.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLeft = Math.round((next - today) / 86400000);
  const cycleDays = (s.cycle === 'yearly') ? 365 : 30;
  const elapsed = Math.max(0, cycleDays - daysLeft);
  const progressPct = (elapsed / cycleDays) * 100;
  const formattedDate = next.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return { daysLeft, progressPct, formattedDate, nextDate: next };
}

function SubsScreen({ data, onBack, onChanged }) {
  const { user, wallet } = data;
  const userId = user.id;
  const allMembers = Object.values(wallet.members);
  const [showAdd, setShowAdd] = React.useState(false);
  const [editing, setEditing] = React.useState(null);

  const remove = async (id, name) => {
    if (!window.confirm(`Stop tracking ${name}?`)) return;
    try { await TallyAPI.subs.remove(id); onChanged(); } catch (e) { alert(e.message); }
  };

  const homeCcy = wallet.defaultCcy || 'USD';
  // Your share per sub, normalized to monthly equivalents
  let yourMonthlyShare = 0;
  let yourMonthlyIfSolo = 0;
  const upcomingChargesIn30d = [];
  const now = new Date();
  for (const s of wallet.subs) {
    if (!s.members.includes(userId)) continue;
    const cycleDivisor = (s.cycle === 'yearly') ? 12 : 1;
    yourMonthlyShare += (s.price / s.members.length) / cycleDivisor;
    yourMonthlyIfSolo += s.price / cycleDivisor;
    const c = computeCycleProgress(s);
    if (c && c.daysLeft >= 0 && c.daysLeft <= 30) {
      upcomingChargesIn30d.push({ sub: s, ...c });
    }
  }
  upcomingChargesIn30d.sort((a, b) => a.daysLeft - b.daysLeft);
  const savings = Math.max(0, yourMonthlyIfSolo - yourMonthlyShare);
  const nextCharge = upcomingChargesIn30d[0];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T_sub.bg }}>
      <Header title="Subscriptions" subtitle={`${wallet.subs.length} active · split with friends`} onBack={onBack} />

      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 100 }} className="no-scroll">
        {/* Hero card */}
        <div style={{ padding: 14 }}>
          <div style={{
            background: '#eef2ff', borderRadius: 18, padding: 18,
            border: `1px solid ${T_sub.primarySoft}`,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, color: T_sub.secondary, letterSpacing: 0.8, fontWeight: 700, textTransform: 'uppercase' }}>
                  Your monthly share
                </div>
                <div style={{ fontSize: 34, fontWeight: 700, color: T_sub.text, letterSpacing: -1, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtMoney(yourMonthlyShare, homeCcy)}
                </div>
                {savings > 0.005 && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6,
                    padding: '3px 10px', background: '#dbeafe', color: '#1e40af',
                    borderRadius: 100, fontSize: 11.5, fontWeight: 600,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6' }} />
                    Saving {fmtMoney(savings, homeCcy)}/mo vs solo
                  </div>
                )}
              </div>
              {nextCharge && (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 10.5, color: T_sub.secondary, letterSpacing: 0.5, fontWeight: 600, textTransform: 'uppercase' }}>Next charge</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T_sub.text, marginTop: 2 }}>
                    in {nextCharge.daysLeft === 0 ? 'today' : `${nextCharge.daysLeft} day${nextCharge.daysLeft === 1 ? '' : 's'}`}
                  </div>
                  <div style={{ fontSize: 11, color: T_sub.secondary, marginTop: 2 }}>
                    {nextCharge.sub.name} · {fmtMoney(nextCharge.sub.price / nextCharge.sub.members.length, nextCharge.sub.ccy)}
                  </div>
                </div>
              )}
            </div>

            {/* Charges timeline */}
            <div style={{ marginTop: 16, padding: '12px 12px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: 12 }}>
              <div style={{ fontSize: 10.5, color: T_sub.secondary, letterSpacing: 0.5, fontWeight: 600, textTransform: 'uppercase', marginBottom: 10 }}>Charges timeline</div>
              <ChargesTimeline charges={upcomingChargesIn30d} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10.5, color: T_sub.secondary }}>
                <span>Today</span>
                <span>+30d</span>
              </div>
            </div>
          </div>
        </div>

        {/* Active subs list header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 18px 8px' }}>
          <div style={{ fontSize: 11, color: T_sub.secondary, letterSpacing: 0.8, fontWeight: 700, textTransform: 'uppercase' }}>
            Active subscriptions
          </div>
          <div onClick={() => setShowAdd(true)} style={{
            background: T_sub.primary, color: '#fff',
            padding: '6px 12px', borderRadius: 100,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            boxShadow: '0 4px 10px rgba(124,92,255,0.3)',
          }}>＋ Add subscription</div>
        </div>

        {/* list */}
        <div style={{ padding: '0 14px' }}>
          {!wallet.subs.length && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: T_sub.secondary }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📺</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                No subscriptions yet. Track Netflix, Disney+, Spotify, iCloud…
              </div>
            </div>
          )}
          {wallet.subs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {wallet.subs.map(s => {
                const share = s.price / s.members.length;
                const cycleInfo = computeCycleProgress(s);
                const color = s.color || SUB_COLORS[0];
                const splitMembers = s.members.map(id => wallet.members[id]).filter(Boolean);
                return (
                  <div key={s.id} style={{
                    background: '#fff', borderRadius: 14,
                    border: `1px solid ${T_sub.divider}`, overflow: 'hidden',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 14px 12px' }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 11,
                        background: color, color: '#fff', fontSize: 22,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>{s.emoji}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: T_sub.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                        <div style={{ fontSize: 11.5, color: T_sub.secondary, marginTop: 2 }}>
                          <b>{wallet.members[s.payer]?.name === user.name ? 'You' : (wallet.members[s.payer]?.name || '?').split(' ')[0]}</b> pays · split {s.members.length} {s.members.length === 1 ? 'way' : 'ways'} · {s.cycle || 'monthly'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: T_sub.text, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(share, s.ccy)}</div>
                        <div style={{ fontSize: 10.5, color: T_sub.muted, marginTop: 1 }}>of {fmtMoney(s.price, s.ccy)}</div>
                      </div>
                    </div>

                    {cycleInfo && (
                      <div style={{ padding: '0 14px 8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11, marginBottom: 5 }}>
                          <span style={{ color: T_sub.secondary }}>Renews {cycleInfo.formattedDate}</span>
                          <span style={{
                            fontWeight: 600,
                            color: cycleInfo.daysLeft <= 3 ? T_sub.negative : cycleInfo.daysLeft <= 7 ? '#d97706' : T_sub.secondary,
                          }}>
                            {cycleInfo.daysLeft <= 0 ? 'due today' :
                             cycleInfo.daysLeft === 1 ? 'tomorrow' :
                             `${cycleInfo.daysLeft} days`}
                          </span>
                        </div>
                        <div style={{ height: 4, background: '#eceef0', borderRadius: 100, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', width: `${Math.min(100, cycleInfo.progressPct)}%`,
                            background: color,
                            transition: 'width 300ms ease',
                          }} />
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: `1px solid ${T_sub.divider}`, background: '#fafbfc' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {splitMembers.slice(0, 4).map((m, i) => (
                          <div key={m.id} style={{ marginLeft: i === 0 ? 0 : -8, boxShadow: '0 0 0 2px #fafbfc', borderRadius: '50%' }}>
                            <Avatar name={m.name} emoji={m.avatarEmoji} size={22} />
                          </div>
                        ))}
                        {splitMembers.length > 4 && (
                          <div style={{
                            marginLeft: -8, width: 22, height: 22, borderRadius: '50%',
                            background: '#eceef0', color: T_sub.secondary,
                            fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 0 0 2px #fafbfc',
                          }}>+{splitMembers.length - 4}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 14 }}>
                        <div onClick={() => setEditing(s)} style={{
                          fontSize: 12.5, color: T_sub.primary, fontWeight: 600, cursor: 'pointer',
                        }}>Manage →</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showAdd && <AddSubSheet allMembers={allMembers} userId={userId} wallet={wallet} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); onChanged(); }} />}
      {editing && <AddSubSheet allMembers={allMembers} userId={userId} wallet={wallet} existing={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} onRemove={() => { remove(editing.id, editing.name); setEditing(null); }} />}
    </div>
  );
}

// Dot markers across a 30-day horizontal axis
function ChargesTimeline({ charges }) {
  return (
    <div style={{ position: 'relative', height: 24 }}>
      <div style={{ position: 'absolute', top: 11, left: 0, right: 0, height: 2, background: '#dbeafe', borderRadius: 100 }} />
      {charges.length === 0 && (
        <div style={{
          position: 'absolute', top: 8, left: 0,
          width: 8, height: 8, borderRadius: '50%',
          background: T_sub.primary, boxShadow: '0 0 0 3px #fff',
        }} />
      )}
      {charges.map((c, i) => {
        const pct = Math.min(100, Math.max(0, (c.daysLeft / 30) * 100));
        const color = c.sub.color || SUB_COLORS[i % SUB_COLORS.length];
        return (
          <div key={c.sub.id} title={`${c.sub.name} · ${c.daysLeft}d`} style={{
            position: 'absolute', top: 6, left: `${pct}%`, transform: 'translateX(-50%)',
            width: 12, height: 12, borderRadius: '50%',
            background: color, boxShadow: '0 0 0 3px #fff',
            cursor: 'help',
          }} />
        );
      })}
    </div>
  );
}

// Add/edit sheet — matches mockup with category color + icon picker
function AddSubSheet({ allMembers, userId, wallet, existing, onClose, onSaved, onRemove }) {
  const [name, setName] = React.useState(existing?.name || '');
  const [emoji, setEmoji] = React.useState(existing?.emoji || '📺');
  const [color, setColor] = React.useState(existing?.color || SUB_COLORS[0]);
  const [price, setPrice] = React.useState(existing?.price?.toString() || '');
  const [ccy, setCcy] = React.useState(existing?.ccy || wallet.defaultCcy || 'USD');
  const [cycle, setCycle] = React.useState(existing?.cycle || 'monthly');
  const [billDay, setBillDay] = React.useState(() => {
    if (existing?.nextCharge) return new Date(existing.nextCharge + 'T00:00:00').getDate();
    return new Date().getDate();
  });
  const [members, setMembers] = React.useState(new Set(existing?.members || [userId]));
  const [payer, setPayer] = React.useState(existing?.payer || userId);
  const [newName, setNewName] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const toggle = (id) => {
    const s = new Set(members);
    s.has(id) ? s.delete(id) : s.add(id);
    setMembers(s);
  };

  const addFriendInline = async () => {
    const n = newName.trim();
    if (!n) return;
    try {
      const { added } = await TallyAPI.friends.add([n]);
      if (added.length) {
        const f = added[0];
        wallet.members[f.id] = f;
        const s = new Set(members); s.add(f.id); setMembers(s);
      }
      setNewName('');
    } catch (e) { alert(e.message); }
  };

  // Compute next charge date from "billed on day X of month" + cycle
  const computeNextCharge = () => {
    const today = new Date();
    const target = new Date(today.getFullYear(), today.getMonth(), Math.max(1, Math.min(28, billDay)));
    if (target <= today) {
      if (cycle === 'yearly') {
        target.setFullYear(target.getFullYear() + 1);
      } else {
        target.setMonth(target.getMonth() + 1);
      }
    }
    return target.toISOString().slice(0, 10);
  };

  const save = async () => {
    if (!name.trim() || !parseFloat(price) || busy) return;
    setBusy(true);
    try {
      if (existing) {
        // Remove + re-add (simpler than PATCH since we don't have it)
        await TallyAPI.subs.remove(existing.id);
      }
      await TallyAPI.subs.add({
        name: name.trim(), emoji, color,
        price: parseFloat(price), ccy,
        cycle,
        nextCharge: computeNextCharge(),
        members: [...members], payer,
      });
      onSaved();
    } catch (e) { alert(e.message); setBusy(false); }
  };

  return (
    <Sheet open={true} onClose={onClose} title={existing ? 'Edit subscription' : 'Add recurring subscription'}>
      <div style={{ padding: '12px 16px 20px' }}>
        <label style={{ fontSize: 10.5, color: T_sub.secondary, letterSpacing: 0.5, fontWeight: 700, textTransform: 'uppercase' }}>Subscription name</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Netflix, Spotify, Dropbox…"
          style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, marginBottom: 14, border: `1px solid ${T_sub.divider}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, outline: 'none' }} />

        <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 10.5, color: T_sub.secondary, letterSpacing: 0.5, fontWeight: 700, textTransform: 'uppercase' }}>Cost ({ccy})</label>
            <input type="number" inputMode="decimal" placeholder="14.99" value={price} onChange={e => setPrice(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, border: `1px solid ${T_sub.divider}`, borderRadius: 10, padding: '10px 12px', fontSize: 16, fontWeight: 700, outline: 'none', fontVariantNumeric: 'tabular-nums' }} />
          </div>
          <div style={{ flex: '0 0 100px' }}>
            <label style={{ fontSize: 10.5, color: T_sub.secondary, letterSpacing: 0.5, fontWeight: 700, textTransform: 'uppercase' }}>Color</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
              {SUB_COLORS.slice(0, 5).map(c => (
                <div key={c} onClick={() => setColor(c)} style={{
                  width: 22, height: 22, borderRadius: '50%', background: c,
                  border: `2px solid ${color === c ? '#fff' : 'transparent'}`,
                  boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
                  cursor: 'pointer',
                }} />
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 10.5, color: T_sub.secondary, letterSpacing: 0.5, fontWeight: 700, textTransform: 'uppercase' }}>Billed on day</label>
            <select value={billDay} onChange={e => setBillDay(parseInt(e.target.value))} style={{
              width: '100%', marginTop: 6, border: `1px solid ${T_sub.divider}`, borderRadius: 10,
              padding: '10px 10px', fontSize: 13, background: '#fff', outline: 'none',
            }}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                <option key={d} value={d}>{d}{ordinalSuffix(d)} of month</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 10.5, color: T_sub.secondary, letterSpacing: 0.5, fontWeight: 700, textTransform: 'uppercase' }}>Billing cycle</label>
            <select value={cycle} onChange={e => setCycle(e.target.value)} style={{
              width: '100%', marginTop: 6, border: `1px solid ${T_sub.divider}`, borderRadius: 10,
              padding: '10px 10px', fontSize: 13, background: '#fff', outline: 'none', textTransform: 'capitalize',
            }}>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>

        <label style={{ fontSize: 10.5, color: T_sub.secondary, letterSpacing: 0.5, fontWeight: 700, textTransform: 'uppercase' }}>Icon</label>
        <div style={{ display: 'flex', gap: 6, marginTop: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {SUB_ICONS.map(e => (
            <div key={e} onClick={() => setEmoji(e)} style={{
              width: 38, height: 38, borderRadius: '50%',
              background: emoji === e ? T_sub.primarySoft : '#fff',
              border: `1.5px solid ${emoji === e ? T_sub.primary : T_sub.divider}`,
              fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>{e}</div>
          ))}
        </div>

        <label style={{ fontSize: 10.5, color: T_sub.secondary, letterSpacing: 0.5, fontWeight: 700, textTransform: 'uppercase' }}>Who pays?</label>
        <div style={{ display: 'flex', gap: 6, marginTop: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {allMembers.map(m => (
            <div key={m.id} onClick={() => setPayer(m.id)} style={{
              padding: '5px 12px 5px 5px', borderRadius: 100,
              background: m.id === payer ? T_sub.primarySoft : '#f4f5f7',
              border: `1.5px solid ${m.id === payer ? T_sub.primary : 'transparent'}`,
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', fontWeight: 500,
              color: m.id === payer ? T_sub.primary : T_sub.text,
            }}>
              <Avatar name={m.name} emoji={m.avatarEmoji} size={20} />
              {m.id === userId ? 'You' : m.name}
            </div>
          ))}
        </div>

        <label style={{ fontSize: 10.5, color: T_sub.secondary, letterSpacing: 0.5, fontWeight: 700, textTransform: 'uppercase' }}>Split with</label>
        <div style={{ background: '#f9fafb', borderRadius: 12, padding: 10, marginTop: 6, marginBottom: 14, border: `1px solid ${T_sub.divider}` }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFriendInline(); } }}
              placeholder="Type friend's name & press Enter…"
              style={{ flex: 1, border: `1px solid ${T_sub.divider}`, borderRadius: 8, padding: '7px 10px', fontSize: 12.5, outline: 'none', background: '#fff' }} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {allMembers.map(m => {
              const on = members.has(m.id);
              return (
                <div key={m.id} onClick={() => toggle(m.id)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 12px 4px 4px', borderRadius: 100,
                  background: on ? T_sub.primarySoft : '#fff',
                  border: `1.5px solid ${on ? T_sub.primary : T_sub.divider}`,
                  fontSize: 12, fontWeight: 600,
                  color: on ? T_sub.primary : T_sub.secondary, cursor: 'pointer',
                }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: 3,
                    background: on ? T_sub.primary : '#fff',
                    border: `1.5px solid ${on ? T_sub.primary : T_sub.muted}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {on && <svg width="9" height="9" viewBox="0 0 20 20"><path d="M4 10l4 4 8-9" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <Avatar name={m.name} emoji={m.avatarEmoji} size={18} />
                  {m.id === userId ? `${m.name} (You)` : m.name}
                </div>
              );
            })}
          </div>
        </div>

        <Button onClick={save} disabled={!name.trim() || !parseFloat(price) || busy} style={{ width: '100%' }}>
          {busy ? 'Saving…' : (existing ? 'Save changes' : 'Add recurring subscription')}
        </Button>

        {existing && onRemove && (
          <div onClick={onRemove} style={{
            marginTop: 12, padding: 10, textAlign: 'center',
            color: T_sub.negative, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Remove subscription</div>
        )}
      </div>
    </Sheet>
  );
}

function ordinalSuffix(n) {
  if (n >= 11 && n <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

window.SubsScreen = SubsScreen;
