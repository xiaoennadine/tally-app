// Home screen — net balance, recent activity, FAB to add expense.
const T_home = window.TG_TOKENS;

function relativeTime(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60)   return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60)   return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24)   return h + 'h ago';
  const d = Math.floor(h / 24);
  if (d < 7)    return d + 'd ago';
  if (d < 30)   return Math.floor(d / 7) + 'w ago';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function HomeScreen({ data, onAdd, onScanReceipt, onSettle, onFriends, onSubs, onGroups, onSettings, onSelectGroup, selectedGroupId, onRemoveExpense }) {
  const { user, wallet, summary } = data;
  const userId = user.id;
  const friends = Object.values(wallet.members).filter(m => m.ghost);
  const groups = wallet.groups || [];
  const visibleExpenses = selectedGroupId
    ? wallet.expenses.filter(e => e.groupId === selectedGroupId)
    : wallet.expenses;
  const selectedGroup = groups.find(g => g.id === selectedGroupId);
  const homeCcy = wallet.defaultCcy || 'USD';
  const { rates, ready: fxReady } = window.useFx();

  // Compute net balance per ccy from summary.balances[userId]
  const netByCcy = {};
  for (const ccy of Object.keys(summary)) {
    netByCcy[ccy] = summary[ccy].balances[userId] || 0;
  }
  const ccys = Object.keys(netByCcy).length ? Object.keys(netByCcy) : [homeCcy];

  // Hero displays the user's HOME currency, summing converted balances.
  // If FX isn't ready yet, fall back to showing the home-ccy bucket alone.
  let netInHome = 0;
  let allConverted = true;
  for (const ccy of ccys) {
    if (ccy === homeCcy) {
      netInHome += netByCcy[ccy];
    } else if (fxReady) {
      const conv = window.convertMoney(netByCcy[ccy], ccy, homeCcy, rates);
      if (conv === null) allConverted = false;
      else netInHome += conv;
    } else {
      allConverted = false;
    }
  }
  // List of non-home currencies that still have a non-zero balance — shown as a small caption.
  const foreignCcys = ccys.filter(c => c !== homeCcy && Math.abs(netByCcy[c]) > 0.005);

  // Owed-to-you / you-owe across all ccys, converted to home.
  let owedToYou = 0, youOwe = 0;
  for (const ccy of Object.keys(summary)) {
    for (const tx of summary[ccy].transactions) {
      const inHome = (ccy === homeCcy)
        ? tx.amount
        : (fxReady ? (window.convertMoney(tx.amount, ccy, homeCcy, rates) || 0) : 0);
      if (tx.to   === userId) owedToYou += inHome;
      if (tx.from === userId) youOwe    += inHome;
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T_home.bg }}>
      <Header
        title={`Hi, ${user.name.split(' ')[0]} 👋`}
        subtitle={friends.length ? `${friends.length} friend${friends.length>1?'s':''} · ${wallet.expenses.length} expenses` : 'Welcome to Tally'}
        trailing={
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div onClick={onFriends} style={{ padding: 6, cursor: 'pointer' }} title="Friends">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="9"  cy="9" r="3.2" stroke={T_home.text} strokeWidth="1.8"/>
                <circle cx="16" cy="10" r="2.4" stroke={T_home.text} strokeWidth="1.8"/>
                <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5M16 14c2.5 0 5 1.5 5 4" stroke={T_home.text} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
              </svg>
            </div>
            <div onClick={onSettings} style={{ padding: 6, cursor: 'pointer' }} title="Settings">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" stroke={T_home.text} strokeWidth="1.8"/>
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" stroke={T_home.text} strokeWidth="1.6" fill="none" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        }
      />

      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 160 }} className="no-scroll">
        {/* Hero balance card */}
        <div style={{ padding: 14 }}>
          <div style={{
            background: `linear-gradient(135deg, ${T_home.primary} 0%, #ff7ab3 100%)`,
            borderRadius: 20, padding: 18, color: '#fff', position: 'relative', overflow: 'hidden',
            boxShadow: '0 10px 30px rgba(124,92,255,0.3)',
          }}>
            <div style={{ position: 'absolute', right: -30, top: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
            <div style={{ fontSize: 12, opacity: 0.85, letterSpacing: 0.8, textTransform: 'uppercase', position: 'relative' }}>
              Net balance ({homeCcy}){!allConverted && fxReady && <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>· est.</span>}
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1, marginTop: 4, position: 'relative' }}>
              {netInHome >= 0 ? '+' : '−'}{fmtMoney(Math.abs(netInHome), homeCcy)}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12, position: 'relative' }}>
              <div>
                <div style={{ fontSize: 10.5, opacity: 0.8, letterSpacing: 0.5 }}>OWED TO YOU</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{fmtMoney(owedToYou, homeCcy)}</div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.3)' }} />
              <div>
                <div style={{ fontSize: 10.5, opacity: 0.8, letterSpacing: 0.5 }}>YOU OWE</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{fmtMoney(youOwe, homeCcy)}</div>
              </div>
            </div>
            {foreignCcys.length > 0 && (
              <div style={{ marginTop: 10, position: 'relative', fontSize: 11, opacity: 0.9 }}>
                {foreignCcys.map(c => `${netByCcy[c] >= 0 ? '+' : '−'}${fmtMoney(Math.abs(netByCcy[c]), c)}`).join(' · ')}
                <span style={{ marginLeft: 6, opacity: 0.65 }}>(original)</span>
              </div>
            )}
          </div>
        </div>

        {/* Scan receipt — primary CTA. Other destinations are in the bottom nav. */}
        <div style={{ padding: '0 14px 14px' }}>
          <div onClick={onScanReceipt} style={{
            background: '#fff', borderRadius: 14, padding: '14px 16px',
            border: `1px solid ${T_home.divider}`, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: '#1fbf7522', color: '#1fbf75',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
            }}>📸</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: T_home.text }}>Scan a receipt</div>
              <div style={{ fontSize: 12, color: T_home.secondary, marginTop: 1 }}>Snap a photo · AI splits it line by line</div>
            </div>
            <svg width="18" height="18" viewBox="0 0 20 20" style={{ flexShrink: 0, color: T_home.muted }}>
              <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
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
                const isForeign = e.ccy !== homeCcy;
                const impactInHome = isForeign && fxReady
                  ? window.convertMoney(yourImpact, e.ccy, homeCcy, rates)
                  : null;
                return (
                  <Row key={e.id} last={i === visibleExpenses.length - 1}>
                    <Avatar name={payer?.name || '?'} size={38} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: T_home.text, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.desc}</div>
                      <div style={{ fontSize: 11.5, color: T_home.secondary }}>
                        {isYou ? 'You' : payer?.name || '?'} paid · {fmtMoney(e.amount, e.ccy)} · ÷{e.splitWith.length}
                        {group && <span style={{ marginLeft: 4 }}>· {group.emoji} {group.name}</span>}
                      </div>
                      <div style={{ fontSize: 10.5, color: T_home.muted, marginTop: 1 }}>{relativeTime(e.date)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: yourImpact >= 0 ? T_home.positive : T_home.negative, fontVariantNumeric: 'tabular-nums' }}>
                        {yourImpact >= 0 ? '+' : '−'}{fmtMoney(Math.abs(yourImpact), e.ccy)}
                      </div>
                      {impactInHome !== null && (
                        <div style={{ fontSize: 10.5, color: T_home.muted, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
                          ≈ {fmtMoney(Math.abs(impactInHome), homeCcy)}
                        </div>
                      )}
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

      {/* FAB — sits above the bottom nav */}
      <div onClick={onAdd} style={{
        position: 'absolute', right: 18, bottom: 90,
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
