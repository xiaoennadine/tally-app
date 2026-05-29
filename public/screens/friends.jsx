// Friends — add, list, remove, and give each friend an avatar.
// Auto-suggests a generated face from the name; tap to pick an emoji instead.
const T_fr = window.TG_TOKENS;

const FRIEND_EMOJIS = ['', '😀', '😎', '🦊', '🐱', '🐼', '🦄', '🐯', '🦁', '🐸', '🐙', '🦖', '🌟', '🌸', '🌈', '⚡', '🍀', '🔥', '💎', '🎨'];

function FriendsScreen({ data, onBack, onChanged }) {
  const { wallet } = data;
  const friends = Object.values(wallet.members).filter(m => m.ghost);
  const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [editingId, setEditingId] = React.useState(null);
  const [savingAvatar, setSavingAvatar] = React.useState(false);

  const add = async () => {
    const names = name.split(/\s*,\s*|\s+and\s+|\s+/i).map(s => s.trim()).filter(Boolean);
    if (!names.length) return;
    setBusy(true); setErr('');
    try { await TallyAPI.friends.add(names); setName(''); onChanged(); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const remove = async (id, nm) => {
    if (!window.confirm(`Remove ${nm}?`)) return;
    try { await TallyAPI.friends.remove(id); onChanged(); } catch (e) { alert(e.message); }
  };

  const setAvatar = async (id, avatarEmoji) => {
    setSavingAvatar(true);
    // optimistic
    if (wallet.members[id]) wallet.members[id].avatarEmoji = avatarEmoji;
    try { await TallyAPI.friends.patch(id, { avatarEmoji }); await onChanged(); }
    catch (e) { alert(e.message); }
    setSavingAvatar(false);
    setEditingId(null);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T_fr.bg }}>
      <Header title="Friends" subtitle={`${friends.length} friend${friends.length === 1 ? '' : 's'}`} onBack={onBack} />

      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 30 }} className="no-scroll">
        <div style={{ padding: 14 }}>
          <label style={{ fontSize: 11, color: T_fr.secondary, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>Add friends</label>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <input type="text" placeholder="Alice Bob Charlie" value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
              style={{ flex: 1, border: `1px solid ${T_fr.divider}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, outline: 'none' }} />
            <Button onClick={add} disabled={busy || !name.trim()} style={{ padding: '10px 16px', fontSize: 14 }}>{busy ? '…' : 'Add'}</Button>
          </div>
          <div style={{ fontSize: 11, color: T_fr.muted, marginTop: 6 }}>Separate multiple with spaces or commas. Each gets a generated avatar you can change.</div>
          {err && <div style={{ color: '#b91c1c', fontSize: 12, marginTop: 6 }}>{err}</div>}
        </div>

        <div style={{ padding: '0 14px' }}>
          {!friends.length && <Empty icon="👥" title="No friends yet — add some above to start splitting." />}
          {friends.length > 0 && (
            <Card>
              {friends.map((f, i) => (
                <div key={f.id} style={{ borderBottom: i === friends.length - 1 ? 'none' : `1px solid ${T_fr.divider}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px' }}>
                    <div onClick={() => setEditingId(editingId === f.id ? null : f.id)} style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
                      <Avatar name={f.name} emoji={f.avatarEmoji} size={40} />
                      <div style={{ position: 'absolute', right: -2, bottom: -2, width: 16, height: 16, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
                        <svg width="9" height="9" viewBox="0 0 20 20"><path d="M4 13.5V16h2.5l8-8L12 5.5l-8 8z" fill={T_fr.primary}/><path d="M13.2 4.3l1.5-1.5a1 1 0 0 1 1.4 0l1.1 1.1a1 1 0 0 1 0 1.4l-1.5 1.5z" fill={T_fr.primary}/></svg>
                      </div>
                    </div>
                    <div style={{ flex: 1, fontSize: 14, color: T_fr.text, fontWeight: 500 }}>{f.name}</div>
                    <div onClick={() => remove(f.id, f.name)} style={{ fontSize: 12, color: T_fr.negative, cursor: 'pointer', padding: 6 }}>Remove</div>
                  </div>
                  {editingId === f.id && (
                    <div style={{ padding: '0 14px 14px' }}>
                      <div style={{ fontSize: 10.5, color: T_fr.muted, marginBottom: 7, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>
                        Pick an avatar {savingAvatar && '· saving…'}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 5 }}>
                        {FRIEND_EMOJIS.map((emo, k) => {
                          const on = (emo || '') === (f.avatarEmoji || '');
                          return (
                            <div key={k} onClick={() => setAvatar(f.id, emo)} style={{ aspectRatio: '1 / 1', borderRadius: '50%', background: on ? T_fr.primarySoft : '#f4f5f7', border: `1.5px solid ${on ? T_fr.primary : 'transparent'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}>
                              {emo === '' ? <div style={{ transform: 'scale(0.78)' }}><GenAvatar name={f.name} size={26} /></div> : <span style={{ fontSize: 17 }}>{emo}</span>}
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ fontSize: 10.5, color: T_fr.muted, marginTop: 6 }}>First option = auto-generated from their name.</div>
                    </div>
                  )}
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

window.FriendsScreen = FriendsScreen;
