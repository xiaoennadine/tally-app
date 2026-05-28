// Receipt Scan flow — capture/upload, OCR via /api/receipt-parse, assign items to people, save.
const T_r = window.TG_TOKENS;

function ReceiptScreen({ data, onClose, onSaved, onRefresh }) {
  const { user, wallet } = data;
  const userId = user.id;
  const allMembers = Object.values(wallet.members);

  // step: capture | parsing | review | summary | success | error
  const [step, setStep] = React.useState('capture');
  const [error, setError] = React.useState(null);
  const [imagePreview, setImagePreview] = React.useState(null);
  const [receipt, setReceipt] = React.useState(null);
  // assignment: item.id -> Set(memberId)
  const [assigned, setAssigned] = React.useState({});
  const [splitSet, setSplitSet] = React.useState(new Set([userId])); // who was present overall
  const [payerId, setPayerId] = React.useState(userId);
  const [newName, setNewName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [groupId, setGroupId] = React.useState(null);
  const [category, setCategory] = React.useState('food');
  const [showNewGroup, setShowNewGroup] = React.useState(false);
  const [newGroupName, setNewGroupName] = React.useState('');
  const [newGroupEmoji, setNewGroupEmoji] = React.useState('🍱');

  const fileInputRef = React.useRef(null);

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError('Image too big (max ~8MB). Try a photo, not a screenshot.');
      setStep('error');
      return;
    }
    const dataUrl = await fileToDataURL(file);
    setImagePreview(dataUrl);
    setStep('parsing');
    setError(null);
    try {
      const r = await fetch('/api/receipt-parse', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-tg-init-data': window.Telegram?.WebApp?.initData || '' },
        body: JSON.stringify({ imageBase64: dataUrl }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      const parsed = await r.json();
      // give each item an id; default everyone present is assigned
      const items = (parsed.items || []).map((it, i) => ({
        id: `i${i}`,
        name: it.name || 'Item',
        qty: Number(it.qty) || 1,
        price: Number(it.price) || 0,
      }));
      setReceipt({ ...parsed, items });
      // default: everyone present gets every item (you'll edit)
      const a = {};
      for (const it of items) a[it.id] = new Set([userId]);
      setAssigned(a);
      setStep('review');
    } catch (e) {
      setError(e.message);
      setStep('error');
    }
  };

  const toggleAssign = (itemId, memberId) => {
    setAssigned(prev => {
      const s = new Set(prev[itemId] || []);
      s.has(memberId) ? s.delete(memberId) : s.add(memberId);
      return { ...prev, [itemId]: s };
    });
  };

  const addFriendInline = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const { added } = await TallyAPI.friends.add([name]);
      if (added.length) {
        const f = added[0];
        wallet.members[f.id] = f;
        const s = new Set(splitSet); s.add(f.id);
        setSplitSet(s);
      }
      setNewName('');
    } catch (e) {
      alert(e.message);
    }
  };

  const createGroupInline = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    try {
      const { group } = await TallyAPI.groups.add({
        name, emoji: newGroupEmoji,
        memberIds: [...splitSet],
      });
      // Mutate the local wallet so the new group appears in the picker without a refetch
      wallet.groups = [...(wallet.groups || []), group];
      setGroupId(group.id);
      setShowNewGroup(false);
      setNewGroupName('');
    } catch (e) {
      alert(e.message);
    }
  };

  const togglePresence = (memberId) => {
    const s = new Set(splitSet);
    if (s.has(memberId)) {
      s.delete(memberId);
      // also remove from any item assignments
      const a = { ...assigned };
      for (const k of Object.keys(a)) {
        const set = new Set(a[k]); set.delete(memberId); a[k] = set;
      }
      setAssigned(a);
    } else {
      s.add(memberId);
    }
    setSplitSet(s);
  };

  // Compute per-person totals (apportion tax/service proportionally to subtotal share)
  const perPerson = React.useMemo(() => {
    if (!receipt) return {};
    const totals = {};
    for (const id of splitSet) totals[id] = 0;
    let subSum = 0;
    for (const it of receipt.items) {
      const who = [...(assigned[it.id] || [])].filter(id => splitSet.has(id));
      if (!who.length) continue;
      const lineTotal = it.price * it.qty;
      const each = lineTotal / who.length;
      for (const id of who) totals[id] = (totals[id] || 0) + each;
      subSum += lineTotal;
    }
    const extras = (receipt.tax || 0) + (receipt.service || 0);
    if (subSum > 0 && extras > 0) {
      for (const id of Object.keys(totals)) {
        totals[id] += (totals[id] / subSum) * extras;
      }
    }
    return totals;
  }, [receipt, assigned, splitSet]);

  // Grand total = sum of per-person shares. OCR's `receipt.total` is shown
  // as a reference but isn't trusted as the source of truth — OCR sometimes
  // misses a line, so its `total` ≠ sum(items × assignments). The per-person
  // numbers always reflect what the user actually assigned, so we sum those.
  const computedTotal = receipt ? Object.values(perPerson).reduce((a,b) => a+b, 0) : 0;
  const grandTotal = computedTotal;
  const ocrTotal = receipt?.total || 0;
  const totalMismatch = ocrTotal > 0 && Math.abs(ocrTotal - computedTotal) > 0.05;

  const save = async () => {
    if (!receipt || busy) return;
    setBusy(true);
    try {
      // Save as ONE expense with the apportioned splitWith list.
      // Description: "Vendor — items (n)". Splits proportionally via splitWith.
      const recipients = Object.entries(perPerson).filter(([id, v]) => v > 0.001);
      // Convert into a single expense: paid by payerId, splitWith = recipients.
      // BUT — equal split won't reflect itemized math. So we'll log ONE expense per assignment "bucket"
      // OR cheat by using an "unequal" representation. Simplest correct approach: one expense per item.
      // Group items by their assignment set so we keep the expense list short.
      const groups = {};
      for (const it of receipt.items) {
        const who = [...(assigned[it.id] || [])].filter(id => splitSet.has(id));
        if (!who.length) continue;
        const k = who.slice().sort().join('|');
        groups[k] = (groups[k] || { who, total: 0, names: [] });
        groups[k].total += it.price * it.qty;
        groups[k].names.push(`${it.qty > 1 ? it.qty + '× ' : ''}${it.name}`);
      }
      // Apportion tax+service proportionally to each group
      const subSum = Object.values(groups).reduce((a, g) => a + g.total, 0) || 1;
      const extras = (receipt.tax || 0) + (receipt.service || 0);
      const vendor = receipt.vendor || 'Receipt';
      const ccy = receipt.currency || wallet.defaultCcy || 'USD';
      const receiptId = 'r:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      for (const k of Object.keys(groups)) {
        const g = groups[k];
        const amt = g.total + (g.total / subSum) * extras;
        const desc = `${vendor} — ${g.names.slice(0, 3).join(', ')}${g.names.length > 3 ? `, +${g.names.length - 3}` : ''}`;
        await TallyAPI.expenses.add({
          amount: Number(amt.toFixed(2)),
          ccy,
          description: desc.slice(0, 180),
          payerId,
          splitWith: g.who,
          groupId: groupId || undefined,
          category,
          receiptId,
          vendor,
        });
      }
      // Refresh the underlying data so the success screen reflects the new state,
      // but keep the modal open so the user sees the success confirmation.
      if (onRefresh) await onRefresh();
      setStep('success');
    } catch (e) {
      alert('Could not save: ' + e.message);
      setBusy(false);
    }
  };

  // ─── render ──────────────────────────────────────────────────
  if (step === 'capture') {
    return (
      <Sheet open={true} onClose={onClose} title="Scan receipt">
        <div style={{ padding: '20px 16px 30px', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>📸</div>
          <div style={{ fontSize: 14, color: T_r.secondary, marginBottom: 22, padding: '0 20px', lineHeight: 1.5 }}>
            Take a photo of your receipt. I'll read the items and you tap who had what.
          </div>
          <input
            ref={fileInputRef} type="file" accept="image/*" capture="environment"
            style={{ display: 'none' }} onChange={onPickFile}
          />
          <Button onClick={() => fileInputRef.current?.click()} style={{ width: '100%', padding: '14px' }}>
            📷 Take photo
          </Button>
          <div style={{ marginTop: 10 }}>
            <input
              type="file" accept="image/*" id="upload-receipt" style={{ display: 'none' }}
              onChange={onPickFile}
            />
            <label htmlFor="upload-receipt" style={{
              display: 'inline-block', fontSize: 13, color: T_r.primary, fontWeight: 600,
              padding: '8px 16px', cursor: 'pointer',
            }}>or upload from photos</label>
          </div>
        </div>
      </Sheet>
    );
  }

  if (step === 'parsing') {
    return (
      <Sheet open={true} onClose={onClose} title="Reading receipt…">
        <div style={{ padding: '24px 16px', textAlign: 'center' }}>
          {imagePreview && (
            <img src={imagePreview} alt="receipt" style={{
              maxWidth: 200, maxHeight: 260, borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)', marginBottom: 16,
            }} />
          )}
          <div style={{ fontSize: 14, color: T_r.text, fontWeight: 600 }}>
            <span className="dot-anim">Parsing items…</span>
          </div>
          <div style={{ fontSize: 12, color: T_r.secondary, marginTop: 6 }}>This takes 5–10 seconds.</div>
          <style>{`
            @keyframes dotpulse { 0%, 80%, 100% { opacity: 0.3; } 40% { opacity: 1; } }
            .dot-anim::after { content: '...'; display: inline-block; animation: dotpulse 1.4s infinite; }
          `}</style>
        </div>
      </Sheet>
    );
  }

  if (step === 'error') {
    return (
      <Sheet open={true} onClose={onClose} title="Something went wrong">
        <div style={{ padding: '24px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>😕</div>
          <div style={{ fontSize: 14, color: T_r.text, marginBottom: 14 }}>{error || 'Could not read the receipt.'}</div>
          <Button onClick={() => { setStep('capture'); setError(null); }} style={{ width: '100%' }}>Try again</Button>
        </div>
      </Sheet>
    );
  }

  if (step === 'success') {
    return (
      <Sheet open={true} onClose={onClose} title=" ">
        <div style={{ padding: '32px 24px 28px', textAlign: 'center' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: '#1fbf75', margin: '0 auto 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'pop-in 320ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            boxShadow: '0 8px 24px rgba(31,191,117,0.35)',
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <path d="M5 12l5 5 9-10" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, color: T_r.text }}>Bill split logged!</div>
          <div style={{ fontSize: 13, color: T_r.secondary, marginTop: 8, lineHeight: 1.5, padding: '0 14px' }}>
            Each person's share has been added to your ledger. Settle up anytime from the Settle tab.
          </div>
          <Button onClick={onClose} style={{ width: '100%', marginTop: 22 }}>
            Back to dashboard
          </Button>
          <style>{`@keyframes pop-in { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
        </div>
      </Sheet>
    );
  }

  if (step === 'summary') {
    return (
      <SummaryStep
        receipt={receipt}
        wallet={wallet}
        userId={userId}
        payerId={payerId}
        perPerson={perPerson}
        grandTotal={grandTotal}
        groupId={groupId}
        category={category}
        busy={busy}
        onBack={() => setStep('review')}
        onConfirm={save}
      />
    );
  }

  // step === 'review'
  return (
    <Sheet open={true} onClose={onClose} title="Review split">
      <div style={{ padding: '4px 16px 24px' }}>
        {/* Vendor + total */}
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: T_r.text }}>{receipt.vendor || 'Receipt'}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: T_r.text, marginTop: 2, letterSpacing: -0.5 }}>
            {fmtMoney(grandTotal, receipt.currency || 'USD')}
          </div>
          {totalMismatch && (
            <div style={{ fontSize: 11, color: '#d97706', marginTop: 2 }}>
              ⚠ Receipt says {fmtMoney(ocrTotal, receipt.currency || 'USD')} — items may be miscounted
            </div>
          )}
          {receipt.tax || receipt.service ? (
            <div style={{ fontSize: 11, color: T_r.secondary, marginTop: 2 }}>
              incl. {receipt.tax ? `tax ${fmtMoney(receipt.tax, receipt.currency)}` : ''}{receipt.tax && receipt.service ? ' · ' : ''}{receipt.service ? `service ${fmtMoney(receipt.service, receipt.currency)}` : ''}
            </div>
          ) : null}
        </div>

        {/* Group */}
        <label style={{ fontSize: 11, color: T_r.secondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>Group (optional)</label>
        <div style={{ display: 'flex', gap: 6, marginTop: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }} className="no-scroll">
          <div onClick={() => setGroupId(null)} style={{
            flexShrink: 0, padding: '6px 12px', borderRadius: 100, cursor: 'pointer',
            background: !groupId ? T_r.primarySoft : '#f4f5f7',
            border: `1.5px solid ${!groupId ? T_r.primary : 'transparent'}`,
            fontSize: 12, fontWeight: 600,
            color: !groupId ? T_r.primary : T_r.secondary,
            whiteSpace: 'nowrap',
          }}>No group</div>
          {(wallet.groups || []).map(g => {
            const on = g.id === groupId;
            return (
              <div key={g.id} onClick={() => setGroupId(g.id)} style={{
                flexShrink: 0, padding: '6px 12px', borderRadius: 100, cursor: 'pointer',
                background: on ? T_r.primarySoft : '#f4f5f7',
                border: `1.5px solid ${on ? T_r.primary : 'transparent'}`,
                fontSize: 12, fontWeight: 600,
                color: on ? T_r.primary : T_r.text,
                display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
              }}>
                <span style={{ fontSize: 14 }}>{g.emoji}</span>{g.name}
              </div>
            );
          })}
          <div onClick={() => setShowNewGroup(v => !v)} style={{
            flexShrink: 0, padding: '6px 12px', borderRadius: 100, cursor: 'pointer',
            background: '#fff', border: `1px dashed ${T_r.muted}`,
            fontSize: 12, fontWeight: 500, color: T_r.secondary,
            whiteSpace: 'nowrap',
          }}>{showNewGroup ? '✕ Cancel' : '+ New group'}</div>
        </div>

        {/* Inline new-group form */}
        {showNewGroup && (
          <div style={{
            background: '#f4f5f7', borderRadius: 12, padding: 12, marginBottom: 14,
          }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input value={newGroupEmoji} onChange={e => setNewGroupEmoji(e.target.value.slice(0, 4))} maxLength={4}
                     style={{ width: 50, fontSize: 22, textAlign: 'center', border: `1px solid ${T_r.divider}`, borderRadius: 10, outline: 'none', background: '#fff' }} />
              <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                     placeholder="Tokyo Trip"
                     onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createGroupInline(); } }}
                     style={{ flex: 1, border: `1px solid ${T_r.divider}`, borderRadius: 10, padding: '8px 10px', fontSize: 14, outline: 'none', background: '#fff' }} />
            </div>
            <div style={{ fontSize: 11, color: T_r.secondary, marginBottom: 8 }}>
              People you mark below will be added to this group automatically.
            </div>
            <Button onClick={createGroupInline} disabled={!newGroupName.trim()} style={{ width: '100%', padding: '8px', fontSize: 13 }}>
              Create group
            </Button>
          </div>
        )}

        {/* Category pills */}
        <label style={{ fontSize: 11, color: T_r.secondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>Category</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 6, marginBottom: 14 }}>
          {window.EXPENSE_CATEGORIES.map(c => {
            const on = c.id === category;
            return (
              <div key={c.id} onClick={() => setCategory(c.id)} style={{
                padding: '8px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                background: on ? T_r.primarySoft : '#f4f5f7',
                border: `1.5px solid ${on ? T_r.primary : 'transparent'}`,
                color: on ? T_r.primary : T_r.text,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}>
                <span style={{ fontSize: 14 }}>{c.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{c.label}</span>
              </div>
            );
          })}
        </div>

        {/* Who was here */}
        <label style={{ fontSize: 11, color: T_r.secondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>Who was here?</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, marginBottom: 8 }}>
          {allMembers.map(m => {
            const on = splitSet.has(m.id);
            return (
              <div key={m.id} onClick={() => togglePresence(m.id)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 10px 4px 4px', borderRadius: 100,
                background: on ? T_r.primarySoft : '#f4f5f7',
                border: `1.5px solid ${on ? T_r.primary : 'transparent'}`,
                fontSize: 12, fontWeight: 600,
                color: on ? T_r.primary : T_r.secondary, cursor: 'pointer',
              }}>
                <Avatar name={m.name} size={20} />
                {m.id === userId ? 'You' : m.name}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          <input
            type="text" placeholder="+ Add friend"
            value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFriendInline(); } }}
            style={{
              flex: 1, border: `1px solid ${T_r.divider}`, borderRadius: 8,
              padding: '6px 10px', fontSize: 12, outline: 'none',
            }}
          />
          <Button onClick={addFriendInline} variant="ghost" disabled={!newName.trim()} style={{ padding: '6px 10px', fontSize: 12 }}>Add</Button>
        </div>

        {/* Who paid */}
        <label style={{ fontSize: 11, color: T_r.secondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>Who paid the bill?</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, marginBottom: 14 }}>
          {[...splitSet].map(id => {
            const m = wallet.members[id];
            if (!m) return null;
            const on = id === payerId;
            return (
              <div key={id} onClick={() => setPayerId(id)} style={{
                padding: '5px 12px 5px 5px', borderRadius: 100,
                background: on ? T_r.primarySoft : '#f4f5f7',
                border: `1.5px solid ${on ? T_r.primary : 'transparent'}`,
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}>
                <Avatar name={m.name} size={20} />
                {m.id === userId ? 'You' : m.name}
              </div>
            );
          })}
        </div>

        {/* Items list */}
        <label style={{ fontSize: 11, color: T_r.secondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>Items — tap who had each</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6, marginBottom: 14 }}>
          {receipt.items.map(it => {
            const who = assigned[it.id] || new Set();
            const total = it.price * it.qty;
            return (
              <div key={it.id} style={{
                background: '#fff', border: `1px solid ${T_r.divider}`, borderRadius: 12,
                padding: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: T_r.text, fontWeight: 500 }}>
                      {it.qty > 1 && <span style={{ color: T_r.secondary, fontWeight: 400, marginRight: 4 }}>{it.qty}×</span>}
                      {it.name}
                    </div>
                    <div style={{ fontSize: 11, color: T_r.secondary, marginTop: 1 }}>
                      {fmtMoney(total, receipt.currency || 'USD')}
                      {who.size > 0 && ` · ${fmtMoney(total / who.size, receipt.currency || 'USD')} ea`}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                  {[...splitSet].map(id => {
                    const m = wallet.members[id];
                    if (!m) return null;
                    const on = who.has(id);
                    return (
                      <div key={id} onClick={() => toggleAssign(it.id, id)} style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '3px 8px 3px 3px', borderRadius: 100,
                        background: on ? T_r.primarySoft : '#f4f5f7',
                        border: `1.5px solid ${on ? T_r.primary : 'transparent'}`,
                        fontSize: 11, fontWeight: 600,
                        color: on ? T_r.primary : T_r.secondary, cursor: 'pointer',
                      }}>
                        <Avatar name={m.name} size={16} />
                        {m.id === userId ? 'You' : m.name.split(' ')[0]}
                      </div>
                    );
                  })}
                  <div onClick={() => {
                    setAssigned(prev => ({ ...prev, [it.id]: new Set(splitSet) }));
                  }} style={{
                    padding: '3px 8px', borderRadius: 100, background: '#f4f5f7',
                    fontSize: 11, fontWeight: 600, color: T_r.secondary, cursor: 'pointer',
                  }}>Everyone</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Per-person preview */}
        <label style={{ fontSize: 11, color: T_r.secondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>Per person</label>
        <Card style={{ marginTop: 6, marginBottom: 14 }}>
          {Object.entries(perPerson).map(([id, amt], i, arr) => (
            <Row key={id} last={i === arr.length - 1}>
              <Avatar name={wallet.members[id]?.name || '?'} size={28} />
              <div style={{ flex: 1, fontSize: 13, color: T_r.text }}>
                {id === userId ? 'You' : wallet.members[id]?.name || '?'}
                {id === payerId && <span style={{ fontSize: 10, color: T_r.primary, marginLeft: 6, background: T_r.primarySoft, padding: '1px 5px', borderRadius: 5 }}>PAID</span>}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T_r.text, fontVariantNumeric: 'tabular-nums' }}>
                {fmtMoney(amt, receipt.currency || 'USD')}
              </div>
            </Row>
          ))}
        </Card>

        <Button onClick={() => setStep('summary')} disabled={busy} style={{ width: '100%' }}>
          Review summary →
        </Button>
      </div>
    </Sheet>
  );
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// ─── Summary step ─────────────────────────────────────────────────
// Final check before logging. Shows every share in the receipt's currency,
// with a live conversion to the viewer's home currency right below.
function SummaryStep({ receipt, wallet, userId, payerId, perPerson, grandTotal, groupId, category, busy, onBack, onConfirm }) {
  const homeCcy = wallet.defaultCcy || 'USD';
  const ccy = receipt.currency || 'USD';
  const isForeign = ccy !== homeCcy;
  const { rates, ready: fxReady, error: fxError } = window.useFx();

  const totalInHome = isForeign && fxReady
    ? window.convertMoney(grandTotal, ccy, homeCcy, rates)
    : null;

  const group = groupId ? (wallet.groups || []).find(g => g.id === groupId) : null;
  const cat = window.getCategory(category);
  const recipients = Object.entries(perPerson).filter(([, v]) => v > 0.001);

  return (
    <Sheet open={true} onClose={onBack} title="Review summary">
      <div style={{ padding: '4px 16px 24px' }}>
        {/* Vendor + group tag */}
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: T_r.text }}>{receipt.vendor || 'Receipt'}</div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 6, flexWrap: 'wrap' }}>
            {group && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 10px', background: T_r.primarySoft, color: T_r.primary,
                borderRadius: 100, fontSize: 11, fontWeight: 600,
              }}>
                <span style={{ fontSize: 12 }}>{group.emoji}</span>{group.name}
              </div>
            )}
            {cat && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 10px', background: `${cat.color}22`, color: cat.color,
                borderRadius: 100, fontSize: 11, fontWeight: 600,
              }}>
                <span style={{ fontSize: 12 }}>{cat.icon}</span>{cat.label}
              </div>
            )}
          </div>
        </div>

        {/* Total card */}
        <div style={{
          background: T_r.primarySoft, borderRadius: 14,
          padding: '16px', textAlign: 'center', marginBottom: 18,
        }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: T_r.primary, textTransform: 'uppercase' }}>
            Total split
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: T_r.text, marginTop: 4, letterSpacing: -1, fontVariantNumeric: 'tabular-nums' }}>
            {fmtMoney(grandTotal, ccy)}
          </div>
          {isForeign && totalInHome !== null && (
            <div style={{ fontSize: 12, color: T_r.secondary, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
              ≈ {fmtMoney(totalInHome, homeCcy)} <span style={{ color: T_r.muted }}>at today's rate</span>
            </div>
          )}
          {isForeign && !fxReady && !fxError && (
            <div style={{ fontSize: 11, color: T_r.muted, marginTop: 4 }}>fetching conversion…</div>
          )}
          {(receipt.tax || receipt.service) ? (
            <div style={{ fontSize: 11, color: T_r.secondary, marginTop: 6 }}>
              incl. {receipt.tax ? `tax ${fmtMoney(receipt.tax, ccy)}` : ''}{receipt.tax && receipt.service ? ' · ' : ''}{receipt.service ? `service ${fmtMoney(receipt.service, ccy)}` : ''}
            </div>
          ) : null}
        </div>

        {/* Per-person shares */}
        <div style={{ fontSize: 11, fontWeight: 600, color: T_r.secondary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>
          Each person's share
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
          {recipients.map(([id, amt]) => {
            const m = wallet.members[id];
            if (!m) return null;
            const isPayer = id === payerId;
            const isYou   = id === userId;
            const inHome = isForeign && fxReady ? window.convertMoney(amt, ccy, homeCcy, rates) : null;
            return (
              <div key={id} style={{
                background: '#fff', border: `1px solid ${T_r.divider}`, borderRadius: 12,
                padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <Avatar name={m.name} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T_r.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isYou ? 'You' : m.name}
                    {isPayer && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                        color: T_r.primary, background: T_r.primarySoft,
                        padding: '2px 6px', borderRadius: 4,
                      }}>PAID</span>
                    )}
                  </div>
                  <div style={{ fontSize: 10.5, color: T_r.muted, marginTop: 1, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    Their share
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T_r.text, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtMoney(amt, ccy)}
                  </div>
                  {inHome !== null && (
                    <div style={{ fontSize: 11, color: T_r.muted, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
                      ≈ {fmtMoney(inHome, homeCcy)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Net effect note */}
        {(() => {
          const yourShare = perPerson[userId] || 0;
          const youArePayer = payerId === userId;
          const net = youArePayer ? (grandTotal - yourShare) : -yourShare;
          if (Math.abs(net) < 0.01) return null;
          const netInHome = isForeign && fxReady ? window.convertMoney(net, ccy, homeCcy, rates) : null;
          return (
            <div style={{
              background: '#f4f5f7', borderRadius: 10, padding: 12, marginBottom: 18,
              fontSize: 13, color: T_r.text, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            }}>
              <span>
                {net > 0 ? 'Others will owe you' : 'You\'ll owe others'}
              </span>
              <span style={{ fontWeight: 700, color: net > 0 ? T_r.positive : T_r.negative, fontVariantNumeric: 'tabular-nums' }}>
                {fmtMoney(Math.abs(net), ccy)}
                {netInHome !== null && <span style={{ color: T_r.muted, fontWeight: 500, marginLeft: 4 }}>· ≈ {fmtMoney(Math.abs(netInHome), homeCcy)}</span>}
              </span>
            </div>
          );
        })()}

        <div style={{ display: 'flex', gap: 10 }}>
          <Button onClick={onBack} variant="ghost" style={{ flex: '0 0 90px' }}>Back</Button>
          <Button onClick={onConfirm} disabled={busy} style={{ flex: 1 }}>
            {busy ? 'Logging…' : 'Confirm & log split'}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

window.ReceiptScreen = ReceiptScreen;
