// Group Detail — full-screen view showing balances, breakdown chart, members.
const T_gd = window.TG_TOKENS;

function GroupDetailScreen({ data, groupId, onBack, onChanged, onSelectExpense }) {
  const { user, wallet } = data;
  const userId = user.id;
  const group = (wallet.groups || []).find(g => g.id === groupId);
  const homeCcy = wallet.defaultCcy || 'USD';
  const { rates, ready: fxReady } = window.useFx();
  const [editing, setEditing] = React.useState(false);
  const [showAdd, setShowAdd] = React.useState('');

  if (!group) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T_gd.bg }}>
        <Header title="Group" onBack={onBack} />
        <Empty icon="🔍" title="Group not found" />
      </div>
    );
  }

  const groupExpenses = wallet.expenses.filter(e => e.groupId === group.id);
  const members = (group.memberIds || [userId]).map(id => wallet.members[id]).filter(Boolean);

  // Per-member net balance within this group (in original ccys, then converted to home)
  const balances = {};
  for (const m of members) balances[m.id] = 0;
  for (const e of groupExpenses) {
    const inHome = (e.ccy === homeCcy)
      ? e.amount
      : (fxReady ? (window.convertMoney(e.amount, e.ccy, homeCcy, rates) || 0) : 0);
    balances[e.payer] = (balances[e.payer] || 0) + inHome;
    const share = inHome / Math.max(1, e.splitWith.length);
    for (const id of e.splitWith) {
      balances[id] = (balances[id] || 0) - share;
    }
  }
  // Apply group-scoped settlements
  for (const s of wallet.settlements || []) {
    // Settlements aren't group-scoped today; only count if both parties are in this group
    if (!balances.hasOwnProperty(s.from) || !balances.hasOwnProperty(s.to)) continue;
    // Skip — keeping group-detail balances purely from groupExpenses for clarity
  }

  // Category breakdown (in home currency)
  const byCat = {};
  let totalSpent = 0;
  for (const e of groupExpenses) {
    const inHome = (e.ccy === homeCcy)
      ? e.amount
      : (fxReady ? (window.convertMoney(e.amount, e.ccy, homeCcy, rates) || 0) : 0);
    const cat = e.category || 'other';
    byCat[cat] = (byCat[cat] || 0) + inHome;
    totalSpent += inHome;
  }
  const catRows = Object.entries(byCat)
    .map(([id, v]) => ({ ...window.getCategory(id), id, value: v }))
    .sort((a, b) => b.value - a.value);

  // Recent expenses, newest first
  const recent = groupExpenses.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);

  // Inline friend add
  const addFriend = async () => {
    const name = showAdd.trim();
    if (!name) return;
    try {
      const { added } = await TallyAPI.friends.add([name]);
      if (added.length) {
        const f = added[0];
        wallet.members[f.id] = f;
        const memberIds = [...(group.memberIds || [userId]), f.id];
        await TallyAPI.groups.update(group.id, { memberIds });
        await onChanged();
      }
      setShowAdd('');
    } catch (e) { alert(e.message); }
  };

  const toggleMember = async (id) => {
    if (id === userId) return;
    const current = new Set(group.memberIds || [userId]);
    current.has(id) ? current.delete(id) : current.add(id);
    try {
      await TallyAPI.groups.update(group.id, { memberIds: [...current] });
      await onChanged();
    } catch (e) { alert(e.message); }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T_gd.bg }}>
      <Header
        title={group.name}
        subtitle={`${members.length} member${members.length === 1 ? '' : 's'} · ${recent.length} expense${recent.length === 1 ? '' : 's'}`}
        onBack={onBack}
        trailing={
          <div onClick={() => setEditing(true)} style={{ padding: 6, cursor: 'pointer' }} title="Edit">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M16 4l4 4-11 11H5v-4L16 4z" stroke={T_gd.text} strokeWidth="1.8" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
        }
      />

      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 100 }} className="no-scroll">
        <div style={{ padding: '14px 14px 0' }}>
          {/* Header card with emoji + name */}
          <div style={{
            background: '#fff', borderRadius: 14, padding: 14,
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
            border: `1px solid ${T_gd.divider}`,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14, background: '#fef3c7',
              fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{group.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: T_gd.text }}>{group.name}</div>
              <div style={{ fontSize: 11.5, color: T_gd.secondary, marginTop: 2 }}>
                Total: <b style={{ color: T_gd.text }}>{fmtMoney(totalSpent, homeCcy)}</b>
                {!fxReady && groupExpenses.some(e => e.ccy !== homeCcy) && <span style={{ opacity: 0.7 }}> · loading FX…</span>}
              </div>
            </div>
          </div>

          {/* Members balances */}
          {members.length > 1 && (
            <div style={{ background: '#fff', border: `1px solid ${T_gd.divider}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: T_gd.secondary, textTransform: 'uppercase' }}>Members balances</div>
                <div style={{ fontSize: 10, color: T_gd.muted }}>Owes | Owed</div>
              </div>
              <BalancesBar balances={balances} members={members} userId={userId} homeCcy={homeCcy} />
            </div>
          )}

          {/* Category breakdown */}
          {catRows.length > 0 && (
            <div style={{ background: '#fff', border: `1px solid ${T_gd.divider}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: T_gd.secondary, textTransform: 'uppercase', marginBottom: 8 }}>
                Spending breakdown
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: T_gd.text, letterSpacing: -0.5 }}>
                {fmtMoney(totalSpent, homeCcy)}
              </div>
              <CategoryBar rows={catRows} total={totalSpent} />
            </div>
          )}

          {/* Manage members */}
          <div style={{ background: '#fff', border: `1px solid ${T_gd.divider}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: T_gd.secondary, textTransform: 'uppercase', marginBottom: 8 }}>
              <span>Invite / manage members</span>
              <span style={{ color: T_gd.primary, marginLeft: 6, fontSize: 10 }}>Tap to toggle</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {Object.values(wallet.members).map(m => {
                const on = (group.memberIds || []).includes(m.id);
                const isYou = m.id === userId;
                return (
                  <div key={m.id} onClick={() => toggleMember(m.id)} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '5px 12px 5px 5px', borderRadius: 100,
                    background: on ? T_gd.primarySoft : '#f4f5f7',
                    border: `1.5px solid ${on ? T_gd.primary : 'transparent'}`,
                    fontSize: 12.5, fontWeight: 600, color: on ? T_gd.primary : T_gd.secondary,
                    cursor: isYou ? 'default' : 'pointer',
                  }}>
                    <Avatar name={m.name} size={20} emoji={m.avatarEmoji} />
                    {isYou ? `${m.name} (You)` : m.name}
                    {on && <svg width="11" height="11" viewBox="0 0 20 20"><path d="M4 10l4 4 8-9" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={showAdd} onChange={e => setShowAdd(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFriend(); } }}
                placeholder="Type and add a brand new friend..."
                style={{
                  flex: 1, border: `1px solid ${T_gd.divider}`, borderRadius: 10,
                  padding: '8px 12px', fontSize: 12.5, outline: 'none', background: '#fff',
                }} />
              <Button onClick={addFriend} disabled={!showAdd.trim()} style={{ padding: '8px 14px', fontSize: 12.5 }}>+ Add</Button>
            </div>
            <div style={{ fontSize: 10.5, color: T_gd.muted, marginTop: 8, lineHeight: 1.4 }}>
              Press Enter to register a new friend instantly and add them to this group.
            </div>
          </div>

          {/* Recent expenses */}
          {recent.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: T_gd.secondary, textTransform: 'uppercase', marginBottom: 8, padding: '0 4px' }}>
                Recent activity
              </div>
              <Card>
                {recent.map((e, i) => {
                  const payer = wallet.members[e.payer];
                  const isYou = e.payer === userId;
                  const cat = window.getCategory(e.category || 'other');
                  return (
                    <Row key={e.id} last={i === recent.length - 1} onClick={() => onSelectExpense && onSelectExpense(e.id)}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 9,
                        background: `${cat.color}22`, color: cat.color,
                        fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{cat.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, color: T_gd.text, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.desc}</div>
                        <div style={{ fontSize: 11, color: T_gd.secondary }}>
                          {isYou ? 'You' : payer?.name} paid · ÷{e.splitWith.length}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T_gd.text, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtMoney(e.amount, e.ccy)}
                      </div>
                    </Row>
                  );
                })}
              </Card>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <GroupSheet
          wallet={wallet} userId={userId}
          existing={group} stats={{ count: groupExpenses.length, byCcy: {} }}
          onClose={() => setEditing(false)}
          onSaved={async () => { setEditing(false); await onChanged(); }}
        />
      )}
    </div>
  );
}

// Horizontal balance bars — negative = owes (red), positive = owed (green)
function BalancesBar({ balances, members, userId, homeCcy }) {
  const maxAbs = Math.max(0.01, ...Object.values(balances).map(v => Math.abs(v)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {members.map(m => {
        const v = balances[m.id] || 0;
        const pct = Math.min(100, Math.abs(v) / maxAbs * 100);
        const isOwed = v > 0.01;
        const owes = v < -0.01;
        const color = isOwed ? '#1fbf75' : owes ? '#ef4444' : '#9ca3af';
        const isYou = m.id === userId;
        return (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar name={m.name} size={26} emoji={m.avatarEmoji} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontSize: 12.5, color: T_gd.text, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {isYou ? `${m.name} (You)` : m.name.split(' ')[0]}
                </div>
                <div style={{ fontSize: 12.5, color, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginLeft: 8 }}>
                  {v >= 0 ? '+' : '−'}{fmtMoney(Math.abs(v), homeCcy)}
                </div>
              </div>
              <div style={{
                marginTop: 4, height: 6, borderRadius: 100, background: '#eceef0', overflow: 'hidden',
                position: 'relative',
              }}>
                <div style={{
                  height: '100%', width: `${pct}%`, background: color,
                  transition: 'width 300ms ease',
                }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Horizontal stacked bar + legend
function CategoryBar({ rows, total }) {
  const visible = rows.filter(r => r.value > 0);
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', height: 10, borderRadius: 100, overflow: 'hidden', background: '#eceef0' }}>
        {visible.map(r => (
          <div key={r.id} style={{
            width: `${(r.value / total) * 100}%`, background: r.color,
            minWidth: r.value > 0 ? 4 : 0,
          }} title={`${r.label}: ${r.value}`} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginTop: 10 }}>
        {visible.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: 100, background: r.color }} />
            <span style={{ color: T_gd.secondary, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.icon} {r.label}</span>
            <span style={{ color: T_gd.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(r.value, 'USD').replace('$', '')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

window.GroupDetailScreen = GroupDetailScreen;
