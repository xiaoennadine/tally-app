// Add Expense — the core flow. Modal that lets user enter amount, description,
// payer, split-with. Auto-creates new friends inline.

const T_add = window.TG_TOKENS;

function AddExpenseScreen({ data, onClose, onSaved, onScanReceipt, defaultGroupId }) {
  const { user, wallet } = data;
  const userId = user.id;
  const allMembers = Object.values(wallet.members);
  const groups = wallet.groups || [];
  const homeCcy = wallet.defaultCcy || 'USD';

  const [amount, setAmount] = React.useState('');
  const [ccy, setCcy] = React.useState(homeCcy);
  const [ccyMode, setCcyMode] = React.useState('home'); // 'home' | 'foreign'
  const [desc, setDesc] = React.useState('');
  const [category, setCategory] = React.useState('food');
  const [payerId, setPayerId] = React.useState(userId);
  const [splitSet, setSplitSet] = React.useState(new Set([userId])); // member ids
  const [groupId, setGroupId] = React.useState(defaultGroupId || null);
  const [newName, setNewName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');

  const toggleSplit = (id) => {
    const s = new Set(splitSet);
    s.has(id) ? s.delete(id) : s.add(id);
    setSplitSet(s);
  };
  const selectAll = () => setSplitSet(new Set(allMembers.map(m => m.id)));
  const clearAll = () => setSplitSet(new Set([userId]));

  const addNew = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const { added } = await TallyAPI.friends.add([name]);
      if (added.length) {
        const f = added[0];
        wallet.members[f.id] = f;
        const s = new Set(splitSet);
        s.add(f.id);
        setSplitSet(s);
      }
      setNewName('');
    } catch (e) {
      setErr(e.message);
    }
  };

  const canSave = parseFloat(amount) > 0 && desc.trim().length > 0 && splitSet.size >= 1;

  const save = async () => {
    if (!canSave || busy) return;
    setBusy(true); setErr('');
    try {
      await TallyAPI.expenses.add({
        amount: parseFloat(amount),
        ccy, description: desc.trim(),
        payerId, splitWith: [...splitSet],
        groupId, category,
      });
      onSaved();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  const perPerson = splitSet.size ? parseFloat(amount || 0) / splitSet.size : 0;

  return (
    <Sheet open={true} onClose={onClose} title="Add expense">
      <div style={{ padding: '12px 16px 20px' }}>
        {/* Receipt scan banner */}
        {onScanReceipt && (
          <div onClick={onScanReceipt} style={{
            display: 'flex', alignItems: 'center', gap: 11,
            background: T_add.primarySoft, borderRadius: 12, padding: '11px 13px',
            marginBottom: 16, cursor: 'pointer',
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, background: T_add.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="6" width="18" height="13" rx="2.5" stroke="#fff" strokeWidth="1.8"/>
                <circle cx="12" cy="12.5" r="3.2" stroke="#fff" strokeWidth="1.8"/>
                <path d="M8 6l1.2-2h5.6L16 6" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: T_add.text }}>Too lazy to type a list? 🧾</div>
              <div style={{ fontSize: 11.5, color: T_add.primary, fontWeight: 600 }}>Tap to snap a photo of the receipt</div>
            </div>
            <div style={{
              fontSize: 9, fontWeight: 800, letterSpacing: 0.6, color: '#fff',
              background: T_add.primary, padding: '3px 7px', borderRadius: 5, flexShrink: 0,
            }}>✨ AI SPLIT</div>
          </div>
        )}

        {/* Amount + currency */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: T_add.secondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>Amount ({ccy})</label>
            <input
              type="number" inputMode="decimal" placeholder="0.00"
              value={amount} onChange={e => setAmount(e.target.value)}
              autoFocus
              style={{
                width: '100%', border: 'none', outline: 'none',
                fontSize: 32, fontWeight: 700, color: T_add.text, padding: '4px 0',
                background: 'transparent', fontVariantNumeric: 'tabular-nums',
              }}
            />
          </div>
          {ccyMode === 'foreign' && (
            <select value={ccy} onChange={e => setCcy(e.target.value)} style={{
              border: `1px solid ${T_add.divider}`, borderRadius: 10, padding: '8px 10px',
              background: '#fff', fontSize: 14, fontWeight: 600, color: T_add.text,
            }}>
              {window.SUPPORTED_CCYS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>

        {/* Currency mode */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, background: '#f4f5f7', borderRadius: 10, padding: '8px 12px' }}>
          <span style={{ fontSize: 11, color: T_add.secondary, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>Currency</span>
          <div style={{ display: 'flex', background: '#e7e9ec', borderRadius: 8, padding: 2 }}>
            {[['home', `${homeCcy} (home)`], ['foreign', 'Foreign 🌍']].map(([m, label]) => (
              <div key={m} onClick={() => { setCcyMode(m); if (m === 'home') setCcy(homeCcy); }} style={{
                padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                background: ccyMode === m ? '#fff' : 'transparent',
                color: ccyMode === m ? T_add.primary : T_add.secondary,
                boxShadow: ccyMode === m ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
              }}>{label}</div>
            ))}
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: T_add.secondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>What's it for?</label>
          <input
            type="text" placeholder="Lunch, taxi, groceries…"
            value={desc} onChange={e => setDesc(e.target.value)}
            style={{
              width: '100%', border: `1px solid ${T_add.divider}`, borderRadius: 10,
              padding: '10px 12px', fontSize: 15, marginTop: 4, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Group + category */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          {groups.length > 0 && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={{ fontSize: 11, color: T_add.secondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>Group</label>
              <select value={groupId || ''} onChange={e => setGroupId(e.target.value || null)} style={{
                width: '100%', marginTop: 4, border: `1px solid ${T_add.divider}`, borderRadius: 10,
                padding: '9px 10px', fontSize: 13, background: '#fff', outline: 'none',
              }}>
                <option value="">None</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>)}
              </select>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={{ fontSize: 11, color: T_add.secondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} style={{
              width: '100%', marginTop: 4, border: `1px solid ${T_add.divider}`, borderRadius: 10,
              padding: '9px 10px', fontSize: 13, background: '#fff', outline: 'none',
            }}>
              {window.EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
            </select>
          </div>
        </div>

        {/* Payer */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: T_add.secondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>Who paid?</label>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {allMembers.map(m => {
              const on = m.id === payerId;
              return (
                <div key={m.id} onClick={() => setPayerId(m.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px 5px 5px', borderRadius: 100,
                  background: on ? T_add.primarySoft : '#f4f5f7',
                  border: `1.5px solid ${on ? T_add.primary : 'transparent'}`,
                  fontSize: 13, color: on ? T_add.primary : T_add.text, fontWeight: 500,
                  cursor: 'pointer',
                }}>
                  <Avatar name={m.name} emoji={m.avatarEmoji} size={22} />
                  {m.id === userId ? 'You' : m.name}
                </div>
              );
            })}
          </div>
        </div>

        {/* Split with */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: 11, color: T_add.secondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>Split with</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {splitSet.size > 0 && amount && (
                <span style={{ fontSize: 12, color: T_add.secondary, fontWeight: 600 }}>
                  {fmtMoney(perPerson, ccy)} each
                </span>
              )}
              <span onClick={splitSet.size === allMembers.length ? clearAll : selectAll} style={{
                fontSize: 12, color: T_add.primary, fontWeight: 700, cursor: 'pointer',
              }}>
                {splitSet.size === allMembers.length ? 'Clear' : 'Select all'}
              </span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 6 }}>
            {allMembers.map(m => {
              const on = splitSet.has(m.id);
              return (
                <div key={m.id} onClick={() => toggleSplit(m.id)} style={{
                  padding: '10px 6px', borderRadius: 12, textAlign: 'center',
                  background: on ? T_add.primarySoft : '#f4f5f7',
                  border: `1.5px solid ${on ? T_add.primary : 'transparent'}`,
                  cursor: 'pointer', position: 'relative',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
                    <Avatar name={m.name} emoji={m.avatarEmoji} size={36} />
                    {on && (
                      <div style={{
                        position: 'absolute', bottom: -2, right: 'calc(50% - 22px)',
                        width: 16, height: 16, borderRadius: '50%', background: T_add.primary,
                        border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="8" height="6" viewBox="0 0 8 6"><path d="M1 3l2 2 4-4" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T_add.text, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.id === userId ? 'You' : m.name}
                  </div>
                </div>
              );
            })}
          </div>

          {/* add friend inline */}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input
              type="text" placeholder="+ Add new friend"
              value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNew(); } }}
              style={{
                flex: 1, border: `1px solid ${T_add.divider}`, borderRadius: 10,
                padding: '8px 12px', fontSize: 13, outline: 'none',
              }}
            />
            <Button onClick={addNew} variant="ghost" disabled={!newName.trim()} style={{ padding: '8px 14px', fontSize: 13 }}>Add</Button>
          </div>
        </div>

        {err && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>{err}</div>}

        <Button onClick={save} disabled={!canSave || busy} style={{ width: '100%' }}>
          {busy ? 'Saving…' : `Save${amount && splitSet.size ? ` · ${fmtMoney(parseFloat(amount), ccy)}` : ''}`}
        </Button>
      </div>
    </Sheet>
  );
}

window.AddExpenseScreen = AddExpenseScreen;
