// Groups screen — list/add/delete groups, and a per-group detail view.
const T_g = window.TG_TOKENS;

const GROUP_EMOJIS = ['🏠','✈️','🍱','🎉','💍','🎬','🛒','🏝️','🎓','💼','🎁','☕'];

function GroupsScreen({ data, onBack, onChanged, onOpenGroup }) {
  const { wallet } = data;
  const groups = wallet.groups || [];
  const [showAdd, setShowAdd] = React.useState(false);

  // count expenses per group for the badge
  const counts = {};
  for (const e of wallet.expenses) {
    if (e.groupId) counts[e.groupId] = (counts[e.groupId] || 0) + 1;
  }

  const remove = async (id, name) => {
    if (!window.confirm(`Delete group "${name}"? Past expenses will become ungrouped.`)) return;
    try { await TallyAPI.groups.remove(id); onChanged(); }
    catch (e) { alert(e.message); }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T_g.bg }}>
      <Header title="Groups" subtitle={`${groups.length} group${groups.length===1?'':'s'}`} onBack={onBack} />
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 80 }} className="no-scroll">
        <div style={{ padding: 14 }}>
          {!groups.length && <Empty icon="📁" title="Group expenses by context — trip, apartment, wedding, etc." />}
          {groups.length > 0 && (
            <Card>
              {groups.map((g, i) => (
                <Row key={g.id} last={i === groups.length - 1} onClick={() => onOpenGroup && onOpenGroup(g.id)}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fef3c7', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{g.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T_g.text }}>{g.name}</div>
                    <div style={{ fontSize: 11.5, color: T_g.secondary }}>{counts[g.id] || 0} expense{(counts[g.id] || 0) === 1 ? '' : 's'}</div>
                  </div>
                  <div onClick={(ev) => { ev.stopPropagation(); remove(g.id, g.name); }} style={{ fontSize: 12, color: T_g.negative, cursor: 'pointer', padding: 6 }}>Remove</div>
                </Row>
              ))}
            </Card>
          )}
        </div>
      </div>
      <div onClick={() => setShowAdd(true)} style={{
        position: 'absolute', right: 18, bottom: 30, width: 56, height: 56, borderRadius: '50%',
        background: `linear-gradient(135deg, ${T_g.primary} 0%, #ff7ab3 100%)`,
        boxShadow: '0 10px 24px rgba(124,92,255,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 28, fontWeight: 300, cursor: 'pointer',
      }}>＋</div>
      {showAdd && <AddGroupSheet onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); onChanged(); }} />}
    </div>
  );
}

function AddGroupSheet({ onClose, onSaved }) {
  const [name, setName] = React.useState('');
  const [emoji, setEmoji] = React.useState('🏠');
  const [busy, setBusy] = React.useState(false);
  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try { await TallyAPI.groups.add({ name: name.trim(), emoji }); onSaved(); }
    catch (e) { alert(e.message); setBusy(false); }
  };
  return (
    <Sheet open={true} onClose={onClose} title="New group">
      <div style={{ padding: '12px 16px 20px' }}>
        <label style={{ fontSize: 11, color: T_g.secondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>Emoji</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, marginBottom: 14 }}>
          {GROUP_EMOJIS.map(e => (
            <div key={e} onClick={() => setEmoji(e)} style={{
              width: 40, height: 40, borderRadius: 10,
              background: emoji === e ? T_g.primarySoft : '#f4f5f7',
              border: `1.5px solid ${emoji === e ? T_g.primary : 'transparent'}`,
              fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>{e}</div>
          ))}
        </div>
        <label style={{ fontSize: 11, color: T_g.secondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>Name</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Tokyo Trip"
               autoFocus
               style={{ width: '100%', border: `1px solid ${T_g.divider}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, marginTop: 6, marginBottom: 14, outline: 'none' }} />
        <Button onClick={save} disabled={!name.trim() || busy} style={{ width: '100%' }}>
          {busy ? 'Saving…' : 'Create group'}
        </Button>
      </div>
    </Sheet>
  );
}

window.GroupsScreen = GroupsScreen;
