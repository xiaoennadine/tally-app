// Friends — add, list, remove ghost friends.
const T_fr = window.TG_TOKENS;

function FriendsScreen({ data, onBack, onChanged }) {
  const { wallet } = data;
  const friends = Object.values(wallet.members).filter(m => m.ghost);
  const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');

  const add = async () => {
    const names = name.split(/\s*,\s*|\s+and\s+|\s+/i).map(s => s.trim()).filter(Boolean);
    if (!names.length) return;
    setBusy(true); setErr('');
    try {
      await TallyAPI.friends.add(names);
      setName('');
      onChanged();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };

  const remove = async (id, name) => {
    if (!window.confirm(`Remove ${name}?`)) return;
    try {
      await TallyAPI.friends.remove(id);
      onChanged();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T_fr.bg }}>
      <Header title="Friends" subtitle={`${friends.length} friend${friends.length===1?'':'s'}`} onBack={onBack} />

      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 30 }} className="no-scroll">
        <div style={{ padding: 14 }}>
          <label style={{ fontSize: 11, color: T_fr.secondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>Add friends</label>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <input
              type="text" placeholder="Alice Bob Charlie"
              value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
              style={{
                flex: 1, border: `1px solid ${T_fr.divider}`, borderRadius: 10,
                padding: '10px 12px', fontSize: 14, outline: 'none',
              }}
            />
            <Button onClick={add} disabled={busy || !name.trim()} style={{ padding: '10px 16px', fontSize: 14 }}>
              {busy ? '…' : 'Add'}
            </Button>
          </div>
          <div style={{ fontSize: 11, color: T_fr.muted, marginTop: 6 }}>Separate multiple with spaces or commas.</div>
          {err && <div style={{ color: '#b91c1c', fontSize: 12, marginTop: 6 }}>{err}</div>}
        </div>

        <div style={{ padding: '0 14px' }}>
          {!friends.length && <Empty icon="👥" title="No friends yet — add some above to start splitting." />}
          {friends.length > 0 && (
            <Card>
              {friends.map((f, i) => (
                <Row key={f.id} last={i === friends.length - 1}>
                  <Avatar name={f.name} size={36} />
                  <div style={{ flex: 1, fontSize: 14, color: T_fr.text }}>{f.name}</div>
                  <div onClick={() => remove(f.id, f.name)} style={{ fontSize: 12, color: T_fr.negative, cursor: 'pointer', padding: 6 }}>Remove</div>
                </Row>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

window.FriendsScreen = FriendsScreen;
