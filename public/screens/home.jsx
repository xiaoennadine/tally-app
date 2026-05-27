// Home screen — net balance, recent activity, FAB to add expense.
const T_home = window.TG_TOKENS;

function HomeScreen({ data, onAdd, onScanReceipt, onSettle, onFriends, onSubs, onGroups, onSelectGroup, selectedGroupId, onRemoveExpense }) {
  const { user, wallet, summary } = data;
  const userId = user.id;
  const friends = Object.values(wallet.members).filter(m => m.ghost);
  const groups = wallet.groups || [];
  const visibleExpenses = selectedGroupId
    ? wallet.expenses.filter(e => e.groupId === selectedGroupId)
    : wallet.expenses;
  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  // Compute net balance per ccy from summary.balances[userId]
  const netByCcy = {};
  for (const ccy of Object.keys(summary)) {
    netByCcy[ccy] = summary[ccy].balances[userId] || 0;
  }
  const ccys = Object.keys(netByCcy).length ? Object.keys(netByCcy) : [wallet.defaultCcy];
  const primaryCcy = ccys[0];

  // Owed-to-you / you-owe (USD primary)
  let owedToYou = 0, youOwe = 0;
  if (summary[primaryCcy]) {
    for (const tx of summary[primaryCcy].transactions) {
      if (tx.to   === userId) owedToYou += tx.amount;
      if (tx.from === userId) youOwe    += tx.amount;
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T_home.bg }}>
      <Header
        title={`Hi, ${user.name.split(' ')[0]} 👋`}
        subtitle={friends.length ? `${friends.length} friend${friends.length>1?'s':''} · ${wallet.expenses.length} expenses` : 'Welcome to Tally'}
        trailing={
          <div onClick={onFriends} style={{ padding: 6, cursor: 'pointer' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="9"  cy="9" r="3.2" stroke={T_home.text} strokeWidth="1.8"/>
              <circle cx="16" cy="10" r="2.4" stroke={T_home.text} strokeWidth="1.8"/>
              <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5M16 14c2.5 0 5 1.5 5 4" stroke={T_home.text} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
            </svg>
          </div>
        }
      />

      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 90 }} className="no-scroll">
        {/* Hero balance card */}
        <div style={{ padding: 14 }}>
          <div style={{
            background: `linear-gradient(135deg, ${T_home.primary} 0%, #ff7ab3 100%)`,
            borderRadius: 20, padding: 18, color: '#fff', position: 'relative', overflow: 'hidden',
            boxShadow: '0 10px 30px rgba(124,92,255,0.3)',
          }}>
            <div style={{ position: 'absolute', right: -30, top: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
            <div style={{ fontSize: 12, opacity: 0.85, letterSpacing: 0.8, textTransform: 'uppercase', position: 'relative' }}>Net balance ({primaryCcy})</div>
            <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1, marginTop: 4, position: 'relative' }}>
              {netByCcy[primaryCcy] >= 0 ? '+' : '−'}{fmtMoney(Math.abs(netByCcy[primaryCcy] || 0), primaryCcy)}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12, position: 'relative' }}>
              <div>
                <div style={{ fontSize: 10.5, opacity: 0.8, letterSpacing: 0.5 }}>OWED TO YOU</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{fmtMoney(owedToYou, primaryCcy)}</div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.3)' }} />
              <div>
                <div style={{ fontSize: 10.5, opacity: 0.8, letterSpacing: 0.5 }}>YOU OWE</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{fmtMoney(youOwe, primaryCcy)}</div>
              </div>
            </div>
            {ccys.length > 1 && (
              <div style={{ marginTop: 10, position: 'relative', fontSize: 11, opacity: 0.9 }}>
                + {ccys.slice(1).map(c => `${fmtMoney(netByCcy[c], c)}`).join(' · ')}
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ padding: '0 14px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <ActionTile icon="📸" label="Scan receipt" sub="AI itemize" onClick={onScanReceipt} accent="#1fbf75" />
          <ActionTile icon="↔" label="Settle up" onClick={onSettle} accent={T_home.primary} />
          <ActionTile icon="👥" label="Friends" sub={friends.length + ' added'} onClick={onFriends} accent="#2AABEE" />
          <ActionTile icon="📺" label="Subs" sub={wallet.subs.length ? `${wallet.subs.length} active` : 'none'} onClick={onSubs} accent="#ff7ab3" />
        </div>

        {/* Groups */}
        <div style={{ padding: '4px 14px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T_home.secondary, letterSpacing: 0.3, textTransform: 'uppercase' }}>Groups</span>
            <span onClick={onGroups} style={{ fontSize: 13, color: T_home.primary, fontWeight: 500, cursor: 'pointer' }}>Manage</span>
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }} className="no-scroll">
            <div onClick={() => onSelectGroup(null)} style={{
              flexShrink: 0, padding: '10px 14px', borderRadius: 14, cursor: 'pointer',
              background: !selectedGroupId ? T_home.primary : '#fff',
              border: `1px solid ${!selectedGroupId ? T_home.primary : T_home.divider}`,
              color: !selectedGroupId ? '#fff' : T_home.text, fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6,
            }}><span style={{ fontSize: 16 }}>✨</span>All</div>
            {groups.map(g => {
              const on = g.id === selectedGroupId;
              return (
                <div key={g.id} onClick={() => onSelectGroup(g.id)} style={{
                  flexShrink: 0, padding: '10px 14px', borderRadius: 14, cursor: 'pointer',
                  background: on ? T_home.primary : '#fff',
                  border: `1px solid ${on ? T_home.primary : T_home.divider}`,
                  color: on ? '#fff' : T_home.text, fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                }}>
                  <span style={{ fontSize: 16 }}>{g.emoji}</span>{g.name}
                </div>
              );
            })}
            <div onClick={onGroups} style={{
              flexShrink: 0, padding: '10px 14px', borderRadius: 14, cursor: 'pointer',
              background: '#fff', border: `1px dashed ${T_home.muted}`,
              color: T_home.secondary, fontSize: 13, fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>+ New</div>
          </div>
        </div>

        {/* Activity */}
        <div style={{ padding: '0 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T_home.secondary, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 8 }}>
            {selectedGroup ? `${selectedGroup.emoji} ${selectedGroup.name} activity` : 'Activity'}
          </div>
          {!visibleExpenses.length && (
            <Empty
              icon="📝"
              title={selectedGroup ? `No expenses in ${selectedGroup.name} yet.` : `No expenses yet. Tap the + button below to log your first split.`}
            />
          )}
          {visibleExpenses.length > 0 && (
            <Card>
              {visibleExpenses.map((e, i) => {
                const payer = wallet.members[e.payer];
                const isYou = e.payer === userId;
                const share = e.splitWith.includes(userId) ? e.amount / e.splitWith.length : 0;
                const yourImpact = isYou ? (e.amount - share) : -share;
                const group = e.groupId ? groups.find(g => g.id === e.groupId) : null;
                return (
                  <Row key={e.id} last={i === visibleExpenses.length - 1}>
                    <Avatar name={payer?.name || '?'} size={38} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: T_home.text, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.desc}</div>
                      <div style={{ fontSize: 11.5, color: T_home.secondary }}>
                        {isYou ? 'You' : payer?.name || '?'} paid · {fmtMoney(e.amount, e.ccy)} · ÷{e.splitWith.length}
                        {group && <span style={{ marginLeft: 4 }}>· {group.emoji} {group.name}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: yourImpact >= 0 ? T_home.positive : T_home.negative, fontVariantNumeric: 'tabular-nums' }}>
                        {yourImpact >= 0 ? '+' : '−'}{fmtMoney(Math.abs(yourImpact), e.ccy)}
                      </div>
                      <div onClick={(ev) => {
                        ev.stopPropagation();
                        if (window.confirm(`Delete "${e.desc}"?`)) onRemoveExpense(e.id);
                      }} style={{ fontSize: 11, color: T_home.muted, cursor: 'pointer', marginTop: 2 }}>delete</div>
                    </div>
                  </Row>
                );
              })}
            </Card>
          )}
        </div>
      </div>

      {/* FAB */}
      <div onClick={onAdd} style={{
        position: 'absolute', right: 18, bottom: 80,
        width: 60, height: 60, borderRadius: '50%',
        background: `linear-gradient(135deg, ${T_home.primary} 0%, #ff7ab3 100%)`,
        boxShadow: '0 10px 24px rgba(124,92,255,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 30, fontWeight: 300, cursor: 'pointer',
        zIndex: 10,
      }}>＋</div>
    </div>
  );
}

function ActionTile({ icon, label, sub, onClick, accent }) {
  return (
    <div onClick={onClick} style={{
      background: '#fff', borderRadius: 14, padding: 12,
      border: `1px solid ${T_home.divider}`, cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: `${accent}22`, color: accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: T_home.text }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: T_home.secondary }}>{sub}</div>}
      </div>
    </div>
  );
}

window.HomeScreen = HomeScreen;
