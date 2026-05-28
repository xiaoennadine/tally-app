// Groups screen — list with tap-to-edit detail sheet.
const T_g = window.TG_TOKENS;

const GROUP_EMOJIS = ['🏠','✈️','🍱','🎉','💍','🎬','🛒','🏝️','🎓','💼','🎁','☕','🏝️','🍷','🎮','🎵'];

function GroupsScreen({ data, onBack, onChanged }) {
  const { user, wallet } = data;
  const userId = user.id;
  const groups = wallet.groups || [];
  const [showAdd, setShowAdd] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);

  // count expenses per group + spend totals for the badge
  const stats = {};
  for (const e of wallet.expenses) {
    if (!e.groupId) continue;
    const s = stats[e.groupId] || (stats[e.groupId] = { count: 0, byCcy: {} });
    s.count += 1;
    s.byCcy[e.ccy] = (s.byCcy[e.ccy] || 0) + e.amount;
  }

  const editing = editingId ? groups.find(g => g.id === editingId) : null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T_g.bg }}>
      <Header title="Groups" subtitle={`${groups.length} group${groups.length===1?'':'s'}`} onBack={onBack} />

      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 100 }} className="no-scroll">
        <div style={{ padding: 14 }}>
          {!groups.length && <Empty icon="📁" title="Group expenses by context — trip, apartment, wedding, etc." />}
          {groups.length > 0 && (
            <Card>
              {groups.map((g, i) => {
                const s = stats[g.id] || { count: 0, byCcy: {} };
                const ccyKeys = Object.keys(s.byCcy);
                const totalText = ccyKeys.length === 0
                  ? `${s.count} expense${s.count === 1 ? '' : 's'}`
                  : ccyKeys.map(c => fmtMoney(s.byCcy[c], c)).join(' · ');
                const members = (g.memberIds || []).map(id => wallet.members[id]).filter(Boolean);
                return (
                  <Row key={g.id} last={i === groups.length - 1} onClick={() => setEditingId(g.id)}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fef3c7', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{g.emoji}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T_g.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</div>
                      <div style={{ fontSize: 11.5, color: T_g.secondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {members.length > 0 ? `${members.length} member${members.length === 1 ? '' : 's'} · ` : ''}{totalText}
                      </div>
                    </div>
                    {members.length > 0 && <StackedAvatars members={members} userId={userId} max={3} />}
                    <svg width="14" height="14" viewBox="0 0 20 20" style={{ color: T_g.muted, flexShrink: 0 }}>
                      <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Row>
                );
              })}
            </Card>
          )}
        </div>
      </div>

      <div onClick={() => setShowAdd(true)} style={{
        position: 'absolute', right: 18, bottom: 80, width: 56, height: 56, borderRadius: '50%',
        background: `linear-gradient(135deg, ${T_g.primary} 0%, #ff7ab3 100%)`,
        boxShadow: '0 10px 24px rgba(124,92,255,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 28, fontWeight: 300, cursor: 'pointer',
      }}>＋</div>

      {showAdd && <GroupSheet wallet={wallet} userId={userId} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); onChanged(); }} />}

      {editing && (
        <GroupSheet
          wallet={wallet} userId={userId}
          existing={editing} stats={stats[editing.id]}
          onClose={() => setEditingId(null)}
          onSaved={() => { setEditingId(null); onChanged(); }}
        />
      )}
    </div>
  );
}

// Small stacked avatar cluster
function StackedAvatars({ members, userId, max = 3 }) {
  const shown = members.slice(0, max);
  const overflow = members.length - shown.length;
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      {shown.map((m, i) => (
        <div key={m.id} style={{ marginLeft: i === 0 ? 0 : -8, borderRadius: '50%', boxShadow: '0 0 0 2px #fff' }}>
          <Avatar name={m.name} size={22} />
        </div>
      ))}
      {overflow > 0 && (
        <div style={{
          marginLeft: -8, width: 22, height: 22, borderRadius: '50%',
          background: '#eceef0', color: T_g.secondary,
          fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 0 2px #fff',
        }}>+{overflow}</div>
      )}
    </div>
  );
}

// Create OR edit a group — single sheet, same UI. `existing` toggles edit mode.
function GroupSheet({ wallet, userId, existing, stats, onClose, onSaved }) {
  const allMembers = Object.values(wallet.members);
  const [name, setName] = React.useState(existing?.name || '');
  const [emoji, setEmoji] = React.useState(existing?.emoji || '🏠');
  const [memberIds, setMemberIds] = React.useState(() => new Set(existing?.memberIds || [userId]));
  const [newName, setNewName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = React.useState(false);

  const isEdit = !!existing;

  const toggle = (id) => {
    if (id === userId) return; // owner is always a member
    const s = new Set(memberIds);
    s.has(id) ? s.delete(id) : s.add(id);
    setMemberIds(s);
  };

  const addFriendInline = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      const { added } = await TallyAPI.friends.add([trimmed]);
      if (added.length) {
        const f = added[0];
        wallet.members[f.id] = f;
        const s = new Set(memberIds); s.add(f.id); setMemberIds(s);
      }
      setNewName('');
    } catch (e) { alert(e.message); }
  };

  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      if (isEdit) {
        await TallyAPI.groups.update(existing.id, { name: name.trim(), emoji, memberIds: [...memberIds] });
      } else {
        await TallyAPI.groups.add({ name: name.trim(), emoji, memberIds: [...memberIds] });
      }
      onSaved();
    } catch (e) { alert(e.message); setBusy(false); }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try { await TallyAPI.groups.remove(existing.id); onSaved(); }
    catch (e) { alert(e.message); setBusy(false); }
  };

  return (
    <Sheet open={true} onClose={onClose} title={isEdit ? 'Edit group' : 'New group'}>
      <div style={{ padding: '12px 16px 20px' }}>
        {/* Emoji + name */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <input value={emoji} onChange={e => setEmoji(e.target.value.slice(0, 4))} maxLength={4}
                 style={{ width: 60, fontSize: 28, textAlign: 'center', border: `1px solid ${T_g.divider}`, borderRadius: 10, outline: 'none' }} />
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Tokyo Trip" autoFocus={!isEdit}
                 style={{ flex: 1, border: `1px solid ${T_g.divider}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, outline: 'none' }} />
        </div>

        {/* Quick emoji picks */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {GROUP_EMOJIS.map(e => (
            <div key={e} onClick={() => setEmoji(e)} style={{
              width: 36, height: 36, borderRadius: 9,
              background: emoji === e ? T_g.primarySoft : '#f4f5f7',
              border: `1.5px solid ${emoji === e ? T_g.primary : 'transparent'}`,
              fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>{e}</div>
          ))}
        </div>

        {/* Members */}
        <label style={{ fontSize: 11, color: T_g.secondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>Members</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 6, marginBottom: 10 }}>
          {allMembers.map(m => {
            const on = memberIds.has(m.id);
            const isOwner = m.id === userId;
            return (
              <div key={m.id} onClick={() => toggle(m.id)} style={{
                padding: '10px 6px', borderRadius: 12, textAlign: 'center',
                background: on ? T_g.primarySoft : '#f4f5f7',
                border: `1.5px solid ${on ? T_g.primary : 'transparent'}`,
                cursor: isOwner ? 'default' : 'pointer',
                opacity: isOwner ? 0.95 : 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}><Avatar name={m.name} size={32} /></div>
                <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: T_g.text }}>
                  {isOwner ? 'You' : m.name}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add friend inline */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          <input type="text" placeholder="+ Add a friend by name" value={newName}
                 onChange={e => setNewName(e.target.value)}
                 onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFriendInline(); } }}
                 style={{
                   flex: 1, border: `1px solid ${T_g.divider}`, borderRadius: 10,
                   padding: '8px 12px', fontSize: 13, outline: 'none',
                 }} />
          <Button onClick={addFriendInline} variant="ghost" disabled={!newName.trim()}
                  style={{ padding: '8px 14px', fontSize: 13 }}>Add</Button>
        </div>

        {/* Stats (edit mode) */}
        {isEdit && stats && stats.count > 0 && (
          <div style={{
            background: '#f4f5f7', borderRadius: 10, padding: 12, marginBottom: 16,
            fontSize: 12, color: T_g.secondary,
          }}>
            <div>{stats.count} expense{stats.count === 1 ? '' : 's'} tracked in this group</div>
            <div style={{ color: T_g.text, fontWeight: 600, marginTop: 2 }}>
              {Object.keys(stats.byCcy).map(c => fmtMoney(stats.byCcy[c], c)).join(' · ')}
            </div>
          </div>
        )}

        <Button onClick={save} disabled={!name.trim() || busy} style={{ width: '100%' }}>
          {busy ? 'Saving…' : (isEdit ? 'Save changes' : 'Create group')}
        </Button>

        {isEdit && (
          <div style={{ marginTop: 14, textAlign: 'center' }}>
            {!showRemoveConfirm ? (
              <div onClick={() => setShowRemoveConfirm(true)} style={{
                fontSize: 13, color: T_g.negative, cursor: 'pointer', padding: 8, display: 'inline-block',
              }}>Delete group</div>
            ) : (
              <div style={{ background: '#fee2e2', borderRadius: 10, padding: 12, color: '#7f1d1d' }}>
                <div style={{ fontSize: 12.5, marginBottom: 8 }}>
                  Past expenses stay; they'll become ungrouped. This can't be undone.
                </div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                  <Button onClick={() => setShowRemoveConfirm(false)} variant="ghost" style={{ padding: '7px 14px', fontSize: 12.5 }}>Cancel</Button>
                  <Button onClick={remove} disabled={busy} variant="danger" style={{ padding: '7px 14px', fontSize: 12.5 }}>
                    {busy ? '…' : 'Delete'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

window.GroupsScreen = GroupsScreen;
