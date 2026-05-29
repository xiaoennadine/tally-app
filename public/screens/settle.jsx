// Settle Up — simplified pay-down plan, visualised as a flow graph, then
// split into "You owe" / "You're owed" / "Between friends". Tap to settle.
const T_set = window.TG_TOKENS;

// Direct debts: who literally owes whom, WITHOUT the greedy simplification that
// re-routes balances through hub people. Each debtor owes the payer their share
// of every expense; opposing pairs net off; settlements reduce the debt.
function directTransfers(wallet) {
  const byCcy = {};
  for (const e of wallet.expenses) (byCcy[e.ccy] ||= []).push(e);
  for (const s of (wallet.settlements || [])) byCcy[s.ccy] ||= [];
  const result = [];
  for (const ccy of Object.keys(byCcy)) {
    const pair = {}; // pair[from][to] = amount `from` owes `to`
    const add = (from, to, amt) => {
      if (from === to) return;
      (pair[from] ||= {});
      pair[from][to] = (pair[from][to] || 0) + amt;
    };
    for (const e of byCcy[ccy]) {
      const share = e.amount / Math.max(1, e.splitWith.length);
      for (const id of e.splitWith) {
        if (id === e.payer) continue;
        add(id, e.payer, share);
      }
    }
    for (const s of (wallet.settlements || []).filter(x => x.ccy === ccy)) {
      add(s.from, s.to, -s.amount); // paying down reduces what from owes to
    }
    const seen = new Set();
    for (const a of Object.keys(pair)) {
      for (const b of Object.keys(pair[a])) {
        const key = [a, b].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const net = (pair[a]?.[b] || 0) - (pair[b]?.[a] || 0);
        if (net > 0.01) result.push({ from: a, to: b, amount: net, ccy });
        else if (net < -0.01) result.push({ from: b, to: a, amount: -net, ccy });
      }
    }
  }
  return result;
}

function SettleScreen({ data, onBack, onSettled }) {
  const { user, wallet, summary } = data;
  const userId = user.id;
  const homeCcy = wallet.defaultCcy || 'USD';
  const { rates, ready: fxReady } = window.useFx();
  const [busyAll, setBusyAll] = React.useState(false);
  // 'direct' = who literally owes whom (default, no confusing re-routing)
  // 'simplified' = fewest possible transfers (may route through a hub person)
  const [mode, setMode] = React.useState('direct');

  const allTx = React.useMemo(() => {
    if (mode === 'simplified') {
      const out = [];
      for (const ccy of Object.keys(summary)) {
        for (const tx of summary[ccy].transactions) out.push({ ...tx, ccy });
      }
      return out;
    }
    return directTransfers(wallet);
  }, [mode, summary, wallet]);
  const youOwe   = allTx.filter(t => t.from === userId);
  const youOwed  = allTx.filter(t => t.to === userId);
  const between  = allTx.filter(t => t.from !== userId && t.to !== userId);
  const mine = [...youOwe, ...youOwed];

  const toHome = (amt, ccy) => ccy === homeCcy ? amt : (fxReady ? (window.convertMoney(amt, ccy, homeCcy, rates) || 0) : 0);

  const markAllMine = async () => {
    if (busyAll || !mine.length) return;
    if (!window.confirm(`Mark all ${mine.length} of your transfers as settled?`)) return;
    setBusyAll(true);
    try {
      for (const t of mine) await TallyAPI.settled({ fromId: t.from, toId: t.to, amount: t.amount, ccy: t.ccy });
      onSettled();
    } catch (e) { alert('Could not save: ' + e.message); setBusyAll(false); }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T_set.bg }}>
      <Header
        title="Settle up"
        subtitle={allTx.length ? `${mode === 'simplified' ? 'Simplified' : 'Direct'} ledger · ${allTx.length} transfer${allTx.length === 1 ? '' : 's'}` : 'All clear'}
        onBack={onBack}
        trailing={mine.length ? (
          <div onClick={markAllMine} style={{
            background: T_set.positive, color: '#fff', padding: '7px 12px', borderRadius: 100,
            fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            display: 'inline-flex', alignItems: 'center', gap: 5, boxShadow: '0 3px 10px rgba(31,191,117,0.3)',
          }}>
            <svg width="13" height="13" viewBox="0 0 20 20"><path d="M4 10l4 4 8-9" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {busyAll ? '…' : 'Mark all settled'}
          </div>
        ) : null}
      />

      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 110 }} className="no-scroll">
        {allTx.length > 0 && (
          <div style={{ padding: '12px 14px 0' }}>
            <div style={{ display: 'flex', background: '#eceef0', borderRadius: 10, padding: 3 }}>
              {[['direct', 'By person'], ['simplified', 'Simplified']].map(([m, label]) => (
                <div key={m} onClick={() => setMode(m)} style={{
                  flex: 1, textAlign: 'center', padding: '7px 0', borderRadius: 8,
                  fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  background: mode === m ? '#fff' : 'transparent',
                  color: mode === m ? T_set.primary : T_set.secondary,
                  boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                  transition: 'all 120ms',
                }}>{label}</div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: T_set.muted, marginTop: 6, lineHeight: 1.4, textAlign: 'center' }}>
              {mode === 'direct'
                ? 'Exactly who owes whom from your shared expenses.'
                : 'Fewest transfers — may route a payment through someone else.'}
            </div>
          </div>
        )}
        {!allTx.length && (
          <div style={{ padding: 14 }}>
            <PerfectSlate title="All settled up!" subtitle="Every balance nets to zero. Nothing to transfer." big />
          </div>
        )}

        {allTx.length > 0 && (
          <>
            {/* ── Flow graph ── */}
            <div style={{ padding: 14 }}>
              <div style={{ fontSize: 11, color: T_set.secondary, letterSpacing: 0.8, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>
                {mode === 'simplified' ? 'The simplified flow' : 'Who owes whom'}
              </div>
              <div style={{ background: '#fff', borderRadius: 18, border: `1px solid ${T_set.divider}`, padding: '8px 6px 4px' }}>
                <FlowGraph allTx={allTx} userId={userId} wallet={wallet} toHome={toHome} homeCcy={homeCcy} />
              </div>
            </div>

            {/* ── How to read (only relevant when simplified re-routes) ── */}
            {mode === 'simplified' && <Explainer />}

            {/* ── You owe ── */}
            <Section title="You owe">
              {youOwe.length === 0 ? (
                <PerfectSlate title="Perfect slate!" subtitle="You don't owe anyone right now." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {youOwe.map((t, i) => (
                    <SettleCard key={i} tx={t} userId={userId} wallet={wallet} onSettled={onSettled} direction="owe" toHome={toHome} homeCcy={homeCcy} />
                  ))}
                </div>
              )}
            </Section>

            {/* ── You're owed ── */}
            {youOwed.length > 0 && (
              <Section title="You're owed">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {youOwed.map((t, i) => (
                    <SettleCard key={i} tx={t} userId={userId} wallet={wallet} onSettled={onSettled} direction="owed" toHome={toHome} homeCcy={homeCcy} />
                  ))}
                </div>
              </Section>
            )}

            {/* ── Between friends ── */}
            {between.length > 0 && (
              <Section title="Between friends">
                <Card>
                  {between.map((t, i) => (
                    <BetweenRow key={i} tx={t} wallet={wallet} onSettled={onSettled} last={i === between.length - 1} toHome={toHome} homeCcy={homeCcy} />
                  ))}
                </Card>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Radial flow graph centred on You ────────────────────────────────
function FlowGraph({ allTx, userId, wallet, toHome, homeCcy }) {
  const edges = allTx.filter(t => t.from === userId || t.to === userId);
  // Fall back to graphing the biggest hub if you're not involved at all.
  const useEdges = edges.length ? edges : allTx;
  const center = edges.length ? userId : (allTx[0]?.to || userId);

  // unique counterpart nodes
  const nodes = [];
  const seen = new Set();
  for (const t of useEdges) {
    const other = t.from === center ? t.to : t.from;
    if (seen.has(other)) continue;
    seen.add(other);
    nodes.push(other);
  }

  const W = 320, H = 290;
  const cx = W / 2, cy = H / 2;
  const R = 112;
  const n = nodes.length;
  const pos = {};
  nodes.forEach((id, idx) => {
    // distribute around the circle, starting at top
    const ang = (-Math.PI / 2) + (idx / Math.max(1, n)) * Math.PI * 2;
    pos[id] = { x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang) };
  });

  const centerMember = wallet.members[center];

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <marker id="arrowIn" markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto">
            <path d="M0 0L6 3L0 6z" fill={T_set.positive} />
          </marker>
          <marker id="arrowOut" markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto">
            <path d="M0 0L6 3L0 6z" fill={T_set.primary} />
          </marker>
        </defs>
        {useEdges.map((t, i) => {
          const other = t.from === center ? t.to : t.from;
          const p = pos[other];
          const incoming = t.to === center; // money flows into center
          const color = incoming ? T_set.positive : T_set.primary;
          // trim line endpoints to node edges
          const dx = p.x - cx, dy = p.y - cy, len = Math.hypot(dx, dy) || 1;
          const ux = dx / len, uy = dy / len;
          const start = incoming ? { x: p.x - ux * 20, y: p.y - uy * 20 } : { x: cx + ux * 24, y: cy + uy * 24 };
          const end   = incoming ? { x: cx + ux * 26, y: cy + uy * 26 } : { x: p.x - ux * 22, y: p.y - uy * 22 };
          // push the amount pill out toward the node so labels fan apart
          const f = 0.6;
          const mx = cx + (p.x - cx) * f, my = cy + (p.y - cy) * f;
          return (
            <g key={i}>
              <line x1={start.x} y1={start.y} x2={end.x} y2={end.y}
                stroke={color} strokeWidth="2" strokeLinecap="round"
                markerEnd={incoming ? 'url(#arrowIn)' : 'url(#arrowOut)'} opacity="0.85" />
              <g>
                <rect x={mx - 25} y={my - 9} width="50" height="18" rx="9" fill={color} stroke="#fff" strokeWidth="1.5" />
                <text x={mx} y={my + 3.6} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">
                  {fmtMoney(t.amount, t.ccy)}
                </text>
              </g>
            </g>
          );
        })}
      </svg>

      {/* HTML avatar nodes on top of the SVG */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <GraphNode x={cx} y={cy} W={W} H={H} member={centerMember} label={center === userId ? 'You' : (centerMember?.name || '?')} highlight />
        {nodes.map(id => (
          <GraphNode key={id} x={pos[id].x} y={pos[id].y} W={W} H={H} member={wallet.members[id]} label={(wallet.members[id]?.name || '?').split(' ')[0]} />
        ))}
      </div>
    </div>
  );
}

function GraphNode({ x, y, W, H, member, label, highlight }) {
  return (
    <div style={{
      position: 'absolute', left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`,
      transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      width: 64, pointerEvents: 'none',
    }}>
      <div style={{ borderRadius: '50%', boxShadow: highlight ? `0 0 0 3px ${T_set.primary}, 0 2px 8px rgba(124,92,255,0.4)` : '0 1px 4px rgba(0,0,0,0.12)' }}>
        <Avatar name={member?.name || '?'} emoji={member?.avatarEmoji} size={highlight ? 40 : 34} />
      </div>
      <div style={{ fontSize: 10.5, fontWeight: highlight ? 700 : 600, color: T_set.text, whiteSpace: 'nowrap', textShadow: '0 1px 2px #fff' }}>{label}</div>
    </div>
  );
}

function Explainer() {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ padding: '0 14px 4px' }}>
      <div onClick={() => setOpen(v => !v)} style={{
        background: T_set.primarySoft, borderRadius: 14, padding: '11px 13px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 9,
      }}>
        <span style={{ fontSize: 15 }}>✨</span>
        <div style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: T_set.primary }}>How to read this flow</div>
        <svg width="13" height="13" viewBox="0 0 20 20" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms', color: T_set.primary }}>
          <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      {open && (
        <div style={{ padding: '10px 13px 2px', fontSize: 12.5, color: T_set.secondary, lineHeight: 1.55 }}>
          Splitting lots of items across lots of people usually means a tangle of back-and-forth
          transfers. Tally <b>merges and simplifies</b> every balance so you make the fewest possible
          payments. That's why someone you never split with directly can still show up here — the math
          routes through them to cancel the most debt in one move.
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ padding: '16px 14px 0' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T_set.secondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 9 }}>{title}</div>
      {children}
    </div>
  );
}

function PerfectSlate({ title, subtitle, big }) {
  return (
    <div style={{
      background: '#eafaf2', border: '1px solid #c7eed9', borderRadius: 16,
      padding: big ? '32px 20px' : '22px 18px', textAlign: 'center',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%', background: '#1fbf75', margin: '0 auto 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(31,191,117,0.35)',
      }}>
        <svg width="22" height="22" viewBox="0 0 20 20"><path d="M4 10l4 4 8-9" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#0f7a4d' }}>{title}</div>
      <div style={{ fontSize: 12.5, color: '#3a9b6f', marginTop: 3 }}>{subtitle}</div>
    </div>
  );
}

// Related expenses connecting two members in one currency.
function useRelated(wallet, payerId, debtorId, ccy) {
  return React.useMemo(() => (
    (wallet.expenses || [])
      .filter(e => e.ccy === ccy && e.payer === payerId && e.splitWith?.includes(debtorId))
      .map(e => ({ ...e, share: e.amount / Math.max(1, e.splitWith.length) }))
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  ), [wallet.expenses, payerId, debtorId, ccy]);
}

// Card for transfers involving You (owe / owed).
function SettleCard({ tx, userId, wallet, onSettled, direction, toHome, homeCcy }) {
  const other = wallet.members[direction === 'owe' ? tx.to : tx.from];
  const [busy, setBusy] = React.useState(false);
  const [nudged, setNudged] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  // owe: other paid, you're in splitWith. owed: you paid, other is in splitWith.
  const related = useRelated(wallet, direction === 'owe' ? tx.to : userId, direction === 'owe' ? userId : tx.from, tx.ccy);
  const isForeign = tx.ccy !== homeCcy;
  const homeAmt = isForeign ? toHome(tx.amount, tx.ccy) : null;

  const settle = async () => {
    if (busy) return; setBusy(true);
    try { await TallyAPI.settled({ fromId: tx.from, toId: tx.to, amount: tx.amount, ccy: tx.ccy }); onSettled(); }
    catch (e) { alert('Could not save: ' + e.message); setBusy(false); }
  };

  const owe = direction === 'owe';
  const accent = owe ? T_set.primary : T_set.positive;

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${T_set.divider}`, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px' }}>
        <Avatar name={other?.name || '?'} emoji={other?.avatarEmoji} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: T_set.text }}>
            {owe ? <>You owe <b>{other?.name || '?'}</b></> : <><b>{other?.name || '?'}</b> owes you</>}
          </div>
          <div style={{ fontSize: 11.5, color: T_set.secondary, marginTop: 1 }}>
            {related.length ? `from ${related.length} shared expense${related.length === 1 ? '' : 's'}` : 'simplified balance'}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: accent, fontVariantNumeric: 'tabular-nums' }}>
            {owe ? '−' : '+'}{fmtMoney(tx.amount, tx.ccy)}
          </div>
          {homeAmt !== null && <div style={{ fontSize: 10.5, color: T_set.muted }}>≈ {fmtMoney(homeAmt, homeCcy)}</div>}
        </div>
      </div>

      {related.length > 0 && (
        <div style={{ padding: '0 14px 10px' }}>
          <div onClick={() => setOpen(v => !v)} style={{ fontSize: 11.5, color: T_set.secondary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="11" height="11" viewBox="0 0 20 20" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}>
              <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {open ? 'Hide breakdown' : (owe ? 'What this is for' : 'Shares they split with you')}
          </div>
          {open && (
            <div style={{ marginTop: 8, padding: 10, background: '#f6f7f9', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {related.map(e => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: T_set.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.desc}</div>
                    <div style={{ fontSize: 10.5, color: T_set.muted }}>{fmtMoney(e.amount, e.ccy)} ÷ {e.splitWith.length}</div>
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: accent, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmtMoney(e.share, e.ccy)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, padding: '0 14px 13px' }}>
        {!owe && (
          <button onClick={() => setNudged(true)} style={{
            flex: '0 0 auto', border: `1.5px solid ${T_set.divider}`, background: nudged ? '#eafaf2' : '#fff',
            color: nudged ? T_set.positive : T_set.secondary, borderRadius: 11, padding: '9px 16px',
            fontSize: 13, fontWeight: 600, cursor: nudged ? 'default' : 'pointer',
          }}>{nudged ? 'Nudged ✓' : 'Nudge'}</button>
        )}
        <button onClick={settle} disabled={busy} style={{
          flex: 1, border: 0, background: accent, color: '#fff', borderRadius: 11, padding: '9px 16px',
          fontSize: 13, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
          boxShadow: `0 3px 10px ${accent}40`,
        }}>{busy ? '…' : (owe ? 'Mark paid' : 'Mark settled')}</button>
      </div>
    </div>
  );
}

function BetweenRow({ tx, wallet, onSettled, last, toHome, homeCcy }) {
  const from = wallet.members[tx.from];
  const to = wallet.members[tx.to];
  const [busy, setBusy] = React.useState(false);
  const isForeign = tx.ccy !== homeCcy;
  const homeAmt = isForeign ? toHome(tx.amount, tx.ccy) : null;
  const settle = async () => {
    if (busy) return; setBusy(true);
    try { await TallyAPI.settled({ fromId: tx.from, toId: tx.to, amount: tx.amount, ccy: tx.ccy }); onSettled(); }
    catch (e) { alert('Could not save: ' + e.message); setBusy(false); }
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: last ? 'none' : `1px solid ${T_set.divider}` }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Avatar name={from?.name || '?'} emoji={from?.avatarEmoji} size={30} />
        <div style={{ margin: '0 5px', color: T_set.muted }}>
          <svg width="16" height="16" viewBox="0 0 20 20"><path d="M4 10h11M11 5l5 5-5 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <Avatar name={to?.name || '?'} emoji={to?.avatarEmoji} size={30} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: T_set.text }}><b>{from?.name || '?'}</b> → <b>{to?.name || '?'}</b></div>
        <div style={{ fontSize: 11.5, color: T_set.secondary, fontVariantNumeric: 'tabular-nums' }}>
          {fmtMoney(tx.amount, tx.ccy)}{homeAmt !== null && <span style={{ color: T_set.muted }}> · ≈ {fmtMoney(homeAmt, homeCcy)}</span>}
        </div>
      </div>
      <button onClick={settle} disabled={busy} style={{
        border: `1.5px solid ${T_set.primary}`, background: '#fff', color: T_set.primary, borderRadius: 100,
        padding: '7px 14px', fontSize: 12.5, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, flexShrink: 0,
      }}>{busy ? '…' : 'Settle'}</button>
    </div>
  );
}

window.SettleScreen = SettleScreen;
