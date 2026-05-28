// Settings — home currency picker, FX info, app preferences.
const T_st = window.TG_TOKENS;

function SettingsScreen({ data, onBack, onChanged }) {
  const { user, wallet } = data;
  const [homeCcy, setHomeCcy] = React.useState(wallet.defaultCcy || 'USD');
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState(null);
  const { rates, ready: fxReady, error: fxError } = window.useFx();

  const save = async (newCcy) => {
    setHomeCcy(newCcy);
    setSaving(true);
    try {
      await TallyAPI.settings({ defaultCcy: newCcy });
      setSavedAt(Date.now());
      onChanged();
    } catch (e) {
      alert('Could not save: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // For the "1 USD = X" preview list
  const previewCcys = window.SUPPORTED_CCYS.filter(c => c !== homeCcy);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T_st.bg }}>
      <Header title="Settings" onBack={onBack} />

      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 100 }} className="no-scroll">
        {/* Profile */}
        <div style={{ padding: 14 }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px' }}>
              <Avatar name={user.name} size={48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: T_st.text }}>{user.name}</div>
                {user.username && <div style={{ fontSize: 12, color: T_st.secondary }}>@{user.username}</div>}
              </div>
            </div>
          </Card>
        </div>

        {/* Home currency */}
        <div style={{ padding: '0 14px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T_st.secondary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>
            Home currency
          </div>
          <Card>
            <div style={{ padding: '12px 14px 4px', fontSize: 12, color: T_st.secondary, lineHeight: 1.4 }}>
              Foreign expenses will show their original amount, with a converted estimate in your home currency.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, padding: '8px 12px 14px' }}>
              {window.SUPPORTED_CCYS.map(c => {
                const on = c === homeCcy;
                return (
                  <div key={c} onClick={() => !saving && save(c)} style={{
                    padding: '10px 0', borderRadius: 10, textAlign: 'center',
                    background: on ? T_st.primarySoft : '#f4f5f7',
                    border: `1.5px solid ${on ? T_st.primary : 'transparent'}`,
                    fontSize: 13, fontWeight: 600,
                    color: on ? T_st.primary : T_st.text,
                    cursor: saving ? 'wait' : 'pointer',
                    transition: 'all 100ms',
                  }}>{c}</div>
                );
              })}
            </div>
            {savedAt && (Date.now() - savedAt < 2500) && (
              <div style={{ padding: '0 14px 12px', fontSize: 11.5, color: T_st.positive, display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="13" height="13" viewBox="0 0 20 20"><path d="M4 10l4 4 8-9" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Saved
              </div>
            )}
          </Card>
        </div>

        {/* FX rates preview */}
        <div style={{ padding: '0 14px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T_st.secondary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>
            Live exchange rates
          </div>
          <Card>
            {!fxReady && !fxError && (
              <div style={{ padding: '20px 14px', fontSize: 13, color: T_st.secondary, textAlign: 'center' }}>
                Loading rates…
              </div>
            )}
            {fxError && (
              <div style={{ padding: '14px', fontSize: 12.5, color: T_st.negative }}>
                Couldn't load rates: {fxError}
              </div>
            )}
            {fxReady && rates && previewCcys.map((c, i) => {
              const rate = window.convertMoney(1, homeCcy, c, rates);
              return (
                <Row key={c} last={i === previewCcys.length - 1}>
                  <div style={{ flex: 1, fontSize: 14, color: T_st.text }}>
                    1 {homeCcy} {' → '} {c}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T_st.text, fontVariantNumeric: 'tabular-nums' }}>
                    {rate ? rate.toFixed(c === 'JPY' ? 2 : 4) : '—'}
                  </div>
                </Row>
              );
            })}
            <div style={{ padding: '8px 14px 12px', fontSize: 10.5, color: T_st.muted, borderTop: fxReady ? `1px solid ${T_st.divider}` : 'none' }}>
              Source: open.er-api.com · cached 6h · used for display only
            </div>
          </Card>
        </div>

        {/* About */}
        <div style={{ padding: '0 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T_st.secondary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>
            About
          </div>
          <Card>
            <Row>
              <div style={{ flex: 1, fontSize: 14, color: T_st.text }}>Tally</div>
              <div style={{ fontSize: 12, color: T_st.muted }}>Splitwise for Telegram</div>
            </Row>
            <Row last>
              <div style={{ flex: 1, fontSize: 14, color: T_st.text }}>Friends</div>
              <div style={{ fontSize: 12, color: T_st.muted }}>{Object.values(wallet.members).filter(m => m.ghost).length}</div>
            </Row>
          </Card>
        </div>
      </div>
    </div>
  );
}

window.SettingsScreen = SettingsScreen;
