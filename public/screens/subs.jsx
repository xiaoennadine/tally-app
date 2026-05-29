// Subscriptions — track recurring shared services. Brand-aware icons, a dated
// charges timeline, flexible billing days, and a "bill & split" action that
// turns a due charge into a real expense so it shows up in Settle Up.
const T_sub = window.TG_TOKENS;

const SUB_COLORS = ['#ef4444', '#10b981', '#3b82f6', '#06b6d4', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];
const SUB_EMOJIS = ['📺', '🎬', '🎵', '☁️', '🎮', '📰', '🛒', '📚', '💪', '🎨'];
// Popular brands surfaced as quick-pick chips in the icon picker.
const QUICK_BRANDS = ['netflix', 'spotify', 'disney', 'youtube', 'icloud', 'prime', 'hbomax', 'openai'];

// ── date helpers ────────────────────────────────────────────────────
function lastDayOfMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function clampDay(y, m, billDay) {
  const ml = lastDayOfMonth(y, m);
  const d = (billDay === 'last') ? ml : Math.min(parseInt(billDay, 10) || 1, ml);
  return new Date(y, m, d);
}
// Next charge on/after today for a given billing day + cycle.
function chargeDateFor(billDay, cycle, ref = new Date()) {
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  let y = today.getFullYear(), m = today.getMonth();
  let c = clampDay(y, m, billDay);
  if (c < today) {
    if (cycle === 'yearly') { c = clampDay(y + 1, m, billDay); }
    else { m += 1; if (m > 11) { m = 0; y += 1; } c = clampDay(y, m, billDay); }
  }
  return c.toISOString().slice(0, 10);
}
function advanceOneCycle(iso, cycle, billDay) {
  const d = new Date(iso + 'T00:00:00');
  let y = d.getFullYear(), m = d.getMonth();
  if (cycle === 'yearly') y += 1; else { m += 1; if (m > 11) { m = 0; y += 1; } }
  return clampDay(y, m, billDay || d.getDate()).toISOString().slice(0, 10);
}
function ordinalSuffix(n) {
  if (n >= 11 && n <= 13) return 'th';
  switch (n % 10) { case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th'; }
}

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
  const [billingId, setBillingId] = React.useState(null);

  const remove = async (id, name) => {
    if (!window.confirm(`Stop tracking ${name}?`)) return;
    try { await TallyAPI.subs.remove(id); onChanged(); } catch (e) { alert(e.message); }
  };

  // Create a real expense from a due charge, then roll the sub forward a cycle.
  const billAndSplit = async (s) => {
    setBillingId(s.id);
    try {
      const monthLabel = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      await TallyAPI.expenses.add({
        payer: s.payer, amount: s.price, ccy: s.ccy,
        splitWith: s.members, desc: `${s.name} — ${monthLabel}`, category: 'fun',
      });
      const billDay = s.billDay || new Date(s.nextCharge + 'T00:00:00').getDate();
      await TallyAPI.subs.remove(s.id);
      await TallyAPI.subs.add({ ...s, billDay, nextCharge: advanceOneCycle(s.nextCharge, s.cycle, billDay) });
      onChanged();
    } catch (e) { alert(e.message); }
    setBillingId(null);
  };

  const homeCcy = wallet.defaultCcy || 'USD';
  let yourMonthlyShare = 0, yourMonthlyIfSolo = 0;
  const upcoming = [];
  for (const s of wallet.subs) {
    if (!s.members.includes(userId)) continue;
    const div = (s.cycle === 'yearly') ? 12 : 1;
    yourMonthlyShare += (s.price / s.members.length) / div;
    yourMonthlyIfSolo += s.price / div;
    const c = computeCycleProgress(s);
    if (c && c.daysLeft >= 0 && c.daysLeft <= 30) upcoming.push({ sub: s, ...c });
  }
  upcoming.sort((a, b) => a.daysLeft - b.daysLeft);
  const savings = Math.max(0, yourMonthlyIfSolo - yourMonthlyShare);
  const nextCharge = upcoming[0];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T_sub.bg }}>
      <Header title="Subscriptions" subtitle={`${wallet.subs.length} active · split with friends`} onBack={onBack} />

      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 100 }} className="no-scroll">
        {/* Hero */}
        <div style={{ padding: 14 }}>
          <div style={{ background: 'linear-gradient(160deg,#f1edff,#eaf0ff)', borderRadius: 20, padding: 18, border: `1px solid ${T_sub.primarySoft}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, color: T_sub.secondary, letterSpacing: 0.8, fontWeight: 700, textTransform: 'uppercase' }}>Your monthly share</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: T_sub.text, letterSpacing: -1.2, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(yourMonthlyShare, homeCcy)}</div>
                {savings > 0.005 && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '3px 10px', background: '#fff', color: T_sub.primary, borderRadius: 100, fontSize: 11.5, fontWeight: 700 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: T_sub.primary }} />
                    {`Saving ${fmtMoney(savings, homeCcy)}/mo vs solo`}
                  </div>
                )}
              </div>
              {nextCharge && (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 10, color: T_sub.secondary, letterSpacing: 0.5, fontWeight: 700, textTransform: 'uppercase' }}>Next charge</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: nextCharge.daysLeft <= 1 ? T_sub.negative : T_sub.text, marginTop: 2 }}>
                    {nextCharge.daysLeft === 0 ? 'Today' : nextCharge.daysLeft === 1 ? 'Tomorrow' : `in ${nextCharge.daysLeft} days`}
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                    <BrandGlyph brand={nextCharge.sub.brand} name={nextCharge.sub.name} color={nextCharge.sub.color} emoji={nextCharge.sub.emoji} size={16} radius={0.3} />
                    <span style={{ fontSize: 11, color: T_sub.secondary }}>{fmtMoney(nextCharge.sub.price / nextCharge.sub.members.length, nextCharge.sub.ccy)}</span>
                  </div>
                </div>
              )}
            </div>
            <div style={{ marginTop: 16, padding: '12px 12px 10px', background: 'rgba(255,255,255,0.65)', borderRadius: 14 }}>
              <div style={{ fontSize: 10, color: T_sub.secondary, letterSpacing: 0.5, fontWeight: 700, textTransform: 'uppercase', marginBottom: 14 }}>Charges · next 30 days</div>
              <ChargesTimeline charges={upcoming} />
            </div>
          </div>
        </div>

        {/* list header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 18px 8px' }}>
          <div style={{ fontSize: 11, color: T_sub.secondary, letterSpacing: 0.8, fontWeight: 700, textTransform: 'uppercase' }}>Active subscriptions</div>
          <div onClick={() => setShowAdd(true)} style={{ background: T_sub.primary, color: '#fff', padding: '6px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, boxShadow: '0 4px 10px rgba(124,92,255,0.3)' }}>＋ Add subscription</div>
        </div>

        <div style={{ padding: '0 14px' }}>
          {!wallet.subs.length && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: T_sub.secondary }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📺</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>No subscriptions yet. Track Netflix, Disney+, Spotify, iCloud…</div>
            </div>
          )}
          {wallet.subs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {wallet.subs.map(s => {
                const share = s.price / s.members.length;
                const ci = computeCycleProgress(s);
                const splitMembers = s.members.map(id => wallet.members[id]).filter(Boolean);
                const due = ci && ci.daysLeft <= 0;
                const shares = s.members.includes(userId);
                return (
                  <div key={s.id} style={{ background: '#fff', borderRadius: 16, border: `1px solid ${due ? T_sub.primary : T_sub.divider}`, overflow: 'hidden', boxShadow: due ? '0 4px 16px rgba(124,92,255,0.14)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 14px 12px' }}>
                      <BrandGlyph brand={s.brand} name={s.name} color={s.color} emoji={s.emoji} size={46} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: T_sub.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                        <div style={{ fontSize: 11.5, color: T_sub.secondary, marginTop: 2 }}>
                          <b>{s.payer === userId ? 'You' : (wallet.members[s.payer]?.name || '?').split(' ')[0]}</b> pays · split {s.members.length} {s.members.length === 1 ? 'way' : 'ways'} · {s.cycle || 'monthly'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: T_sub.text, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(share, s.ccy)}</div>
                        <div style={{ fontSize: 10.5, color: T_sub.muted, marginTop: 1 }}>of {fmtMoney(s.price, s.ccy)}</div>
                      </div>
                    </div>

                    {ci && (
                      <div style={{ padding: '0 14px 10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11, marginBottom: 5 }}>
                          <span style={{ color: T_sub.secondary }}>{due ? 'Billed today' : `Renews ${ci.formattedDate}`}</span>
                          <span style={{ fontWeight: 700, color: ci.daysLeft <= 0 ? T_sub.primary : ci.daysLeft <= 3 ? T_sub.negative : ci.daysLeft <= 7 ? '#d97706' : T_sub.secondary }}>
                            {ci.daysLeft <= 0 ? 'due now' : ci.daysLeft === 1 ? 'tomorrow' : `${ci.daysLeft} days`}
                          </span>
                        </div>
                        <div style={{ height: 5, background: '#eceef0', borderRadius: 100, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(100, ci.progressPct)}%`, background: due ? T_sub.primary : (s.color || SUB_COLORS[0]), transition: 'width 300ms ease' }} />
                        </div>
                      </div>
                    )}

                    {/* Due → bill & split CTA (only when it creates a debt, i.e. >1 member) */}
                    {due && s.members.length > 1 && (
                      <div style={{ padding: '0 14px 12px' }}>
                        <button onClick={() => billAndSplit(s)} disabled={billingId === s.id} style={{
                          width: '100%', border: 0, background: T_sub.primary, color: '#fff', borderRadius: 12,
                          padding: '11px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', opacity: billingId === s.id ? 0.6 : 1,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 4px 12px rgba(124,92,255,0.3)',
                        }}>
                          {billingId === s.id ? 'Billing…' : `⚡ Bill & split — ${s.members.length - 1} ${s.members.length - 1 === 1 ? 'friend owes you' : 'friends owe you'}`}
                        </button>
                        <div style={{ fontSize: 10.5, color: T_sub.muted, textAlign: 'center', marginTop: 5 }}>Adds it to Settle Up, then rolls to next month</div>
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
                          <div style={{ marginLeft: -8, width: 22, height: 22, borderRadius: '50%', background: '#eceef0', color: T_sub.secondary, fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px #fafbfc' }}>+{splitMembers.length - 4}</div>
                        )}
                      </div>
                      <div onClick={() => setEditing(s)} style={{ fontSize: 12.5, color: T_sub.primary, fontWeight: 600, cursor: 'pointer' }}>Manage →</div>
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

// Dated timeline — each upcoming charge plotted by day, with its brand glyph.
function ChargesTimeline({ charges }) {
  return (
    <div style={{ position: 'relative', height: 40 }}>
      <div style={{ position: 'absolute', top: 14, left: 4, right: 4, height: 3, background: '#d9dcff', borderRadius: 100 }} />
      {/* today dot */}
      <div style={{ position: 'absolute', top: 9, left: 4, transform: 'translateX(-50%)', width: 13, height: 13, borderRadius: '50%', background: '#fff', border: `3px solid ${T_sub.primary}` }} />
      {charges.map((c) => {
        const pct = Math.min(96, Math.max(2, (c.daysLeft / 30) * 100));
        return (
          <div key={c.sub.id} title={`${c.sub.name} · ${c.daysLeft === 0 ? 'today' : c.daysLeft + 'd'}`} style={{ position: 'absolute', top: 0, left: `${pct}%`, transform: 'translateX(-50%)' }}>
            <div style={{ boxShadow: '0 0 0 2.5px #fff, 0 2px 5px rgba(0,0,0,0.18)', borderRadius: 7 }}>
              <BrandGlyph brand={c.sub.brand} name={c.sub.name} color={c.sub.color} emoji={c.sub.emoji} size={24} radius={0.3} />
            </div>
          </div>
        );
      })}
      <div style={{ position: 'absolute', bottom: -2, left: 0, fontSize: 10, color: T_sub.secondary, fontWeight: 600 }}>Today</div>
      <div style={{ position: 'absolute', bottom: -2, right: 0, fontSize: 10, color: T_sub.secondary }}>+30d</div>
    </div>
  );
}

// ── Add / edit sheet ────────────────────────────────────────────────
function AddSubSheet({ allMembers, userId, wallet, existing, onClose, onSaved, onRemove }) {
  const [name, setName] = React.useState(existing?.name || '');
  const [emoji, setEmoji] = React.useState(existing?.emoji || '📺');
  const [brand, setBrand] = React.useState(existing?.brand || null);
  const [brandTouched, setBrandTouched] = React.useState(!!existing);
  const [color, setColor] = React.useState(existing?.color || SUB_COLORS[0]);
  const [price, setPrice] = React.useState(existing?.price?.toString() || '');
  const [ccy] = React.useState(existing?.ccy || wallet.defaultCcy || 'USD');
  const [cycle, setCycle] = React.useState(existing?.cycle || 'monthly');
  const [billDay, setBillDay] = React.useState(() => {
    if (existing?.billDay) return existing.billDay;
    if (existing?.nextCharge) return new Date(existing.nextCharge + 'T00:00:00').getDate();
    return new Date().getDate();
  });
  const [members, setMembers] = React.useState(new Set(existing?.members || [userId]));
  const [payer, setPayer] = React.useState(existing?.payer || userId);
  const [newName, setNewName] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  // Auto-detect brand as the user types the name (unless they picked one manually).
  React.useEffect(() => {
    if (brandTouched) return;
    const det = window.detectBrand(name);
    if (det) setBrand(det); else setBrand(null);
  }, [name, brandTouched]);

  const pickBrand = (id) => { setBrandTouched(true); setBrand(id); };
  const pickEmoji = (e) => { setBrandTouched(true); setBrand(null); setEmoji(e); };

  const toggle = (id) => { const s = new Set(members); s.has(id) ? s.delete(id) : s.add(id); setMembers(s); };

  const addFriendInline = async () => {
    const n = newName.trim(); if (!n) return;
    try {
      const { added } = await TallyAPI.friends.add([n]);
      if (added.length) { const f = added[0]; wallet.members[f.id] = f; const s = new Set(members); s.add(f.id); setMembers(s); }
      setNewName('');
    } catch (e) { alert(e.message); }
  };

  const save = async () => {
    if (!name.trim() || !parseFloat(price) || busy) return;
    setBusy(true);
    try {
      if (existing) await TallyAPI.subs.remove(existing.id);
      await TallyAPI.subs.add({
        name: name.trim(), emoji, brand, color,
        price: parseFloat(price), ccy, cycle, billDay,
        nextCharge: chargeDateFor(billDay, cycle),
        members: [...members], payer,
      });
      onSaved();
    } catch (e) { alert(e.message); setBusy(false); }
  };

  const brandLabel = brand && window.SUB_BRANDS[brand]?.label;
  const labelCss = { fontSize: 10.5, color: T_sub.secondary, letterSpacing: 0.5, fontWeight: 700, textTransform: 'uppercase' };
  const dayOptions = [...Array.from({ length: 31 }, (_, i) => i + 1), 'last'];

  return (
    <Sheet open={true} onClose={onClose} title={existing ? 'Edit subscription' : 'Add recurring subscription'}>
      <div style={{ padding: '12px 16px 20px' }}>
        <label style={labelCss}>Subscription name</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Netflix, Spotify, Dropbox…"
          style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, border: `1px solid ${T_sub.divider}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, outline: 'none' }} />
        {brandLabel && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 8, padding: '5px 11px 5px 6px', background: T_sub.primarySoft, borderRadius: 100, fontSize: 12, color: T_sub.primary, fontWeight: 600 }}>
            <BrandGlyph brand={brand} name={name} size={18} radius={0.3} />
            Auto-applied <b>{brandLabel}</b> icon ✨
          </div>
        )}

        <div style={{ display: 'flex', gap: 14, margin: '14px 0' }}>
          <div style={{ flex: 1 }}>
            <label style={labelCss}>Monthly cost ({ccy})</label>
            <input type="number" inputMode="decimal" placeholder="14.99" value={price} onChange={e => setPrice(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, border: `1px solid ${T_sub.divider}`, borderRadius: 10, padding: '10px 12px', fontSize: 16, fontWeight: 700, outline: 'none', fontVariantNumeric: 'tabular-nums' }} />
          </div>
          <div style={{ flex: '0 0 116px' }}>
            <label style={labelCss}>Tile color</label>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
              {SUB_COLORS.slice(0, 5).map(c => (
                <div key={c} onClick={() => setColor(c)} style={{ width: 22, height: 22, borderRadius: '50%', background: c, boxShadow: color === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : 'none', cursor: 'pointer' }} />
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={labelCss}>Billed on day</label>
            <select value={billDay} onChange={e => setBillDay(e.target.value === 'last' ? 'last' : parseInt(e.target.value, 10))} style={{ width: '100%', marginTop: 6, border: `1px solid ${T_sub.divider}`, borderRadius: 10, padding: '10px', fontSize: 13, background: '#fff', outline: 'none' }}>
              {dayOptions.map(d => (
                <option key={d} value={d}>{d === 'last' ? 'Last day of month' : `${d}${ordinalSuffix(d)} of month`}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelCss}>Billing cycle</label>
            <select value={cycle} onChange={e => setCycle(e.target.value)} style={{ width: '100%', marginTop: 6, border: `1px solid ${T_sub.divider}`, borderRadius: 10, padding: '10px', fontSize: 13, background: '#fff', outline: 'none', textTransform: 'capitalize' }}>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>
        {typeof billDay === 'number' && billDay >= 29 && (
          <div style={{ fontSize: 11, color: T_sub.muted, marginTop: -8, marginBottom: 14 }}>
            Months without a {billDay}{ordinalSuffix(billDay)} will bill on their last day.
          </div>
        )}

        <label style={labelCss}>Icon</label>
        <div style={{ display: 'flex', gap: 7, marginTop: 7, marginBottom: 8, flexWrap: 'wrap' }}>
          {QUICK_BRANDS.map(id => {
            const on = brand === id;
            return (
              <div key={id} onClick={() => pickBrand(id)} style={{ borderRadius: 11, boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${T_sub.primary}` : 'none', cursor: 'pointer' }}>
                <BrandGlyph brand={id} name={id} size={38} />
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {SUB_EMOJIS.map(e => {
            const on = !brand && emoji === e;
            return (
              <div key={e} onClick={() => pickEmoji(e)} style={{ width: 34, height: 34, borderRadius: '50%', background: on ? T_sub.primarySoft : '#fff', border: `1.5px solid ${on ? T_sub.primary : T_sub.divider}`, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>{e}</div>
            );
          })}
        </div>

        <label style={labelCss}>Who pays?</label>
        <div style={{ display: 'flex', gap: 6, marginTop: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {allMembers.map(m => (
            <div key={m.id} onClick={() => setPayer(m.id)} style={{ padding: '5px 12px 5px 5px', borderRadius: 100, background: m.id === payer ? T_sub.primarySoft : '#f4f5f7', border: `1.5px solid ${m.id === payer ? T_sub.primary : 'transparent'}`, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', fontWeight: 500, color: m.id === payer ? T_sub.primary : T_sub.text }}>
              <Avatar name={m.name} emoji={m.avatarEmoji} size={20} />
              {m.id === userId ? 'You' : m.name.split(' ')[0]}
            </div>
          ))}
        </div>

        <label style={labelCss}>Split with</label>
        <div style={{ background: '#f9fafb', borderRadius: 12, padding: 10, marginTop: 6, marginBottom: 14, border: `1px solid ${T_sub.divider}` }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFriendInline(); } }} placeholder="Type friend's name & press Enter…"
            style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${T_sub.divider}`, borderRadius: 8, padding: '7px 10px', fontSize: 12.5, outline: 'none', background: '#fff', marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {allMembers.map(m => {
              const on = members.has(m.id);
              return (
                <div key={m.id} onClick={() => toggle(m.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px 4px 4px', borderRadius: 100, background: on ? T_sub.primarySoft : '#fff', border: `1.5px solid ${on ? T_sub.primary : T_sub.divider}`, fontSize: 12, fontWeight: 600, color: on ? T_sub.primary : T_sub.secondary, cursor: 'pointer' }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, background: on ? T_sub.primary : '#fff', border: `1.5px solid ${on ? T_sub.primary : T_sub.muted}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {on && <svg width="9" height="9" viewBox="0 0 20 20"><path d="M4 10l4 4 8-9" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <Avatar name={m.name} emoji={m.avatarEmoji} size={18} />
                  {m.id === userId ? `${m.name} (You)` : m.name.split(' ')[0]}
                </div>
              );
            })}
          </div>
        </div>

        <Button onClick={save} disabled={!name.trim() || !parseFloat(price) || busy} style={{ width: '100%' }}>
          {busy ? 'Saving…' : (existing ? 'Save changes' : 'Add recurring subscription')}
        </Button>
        {existing && onRemove && (
          <div onClick={onRemove} style={{ marginTop: 12, padding: 10, textAlign: 'center', color: T_sub.negative, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Remove subscription</div>
        )}
      </div>
    </Sheet>
  );
}

window.SubsScreen = SubsScreen;
