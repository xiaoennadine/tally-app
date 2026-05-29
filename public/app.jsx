// Root component — fetches /api/me on mount, routes between screens.

function App() {
  const [data, setData]   = React.useState(null);
  const [error, setError] = React.useState(null);
  const [route, setRoute] = React.useState('home'); // home | settle | friends | subs | groups | settings | group-detail | expense-detail
  const [selectedGroupId, setSelectedGroupId] = React.useState(null);
  const [selectedExpenseId, setSelectedExpenseId] = React.useState(null);
  const [openGroupId, setOpenGroupId] = React.useState(null);
  const [showAdd, setShowAdd] = React.useState(false);
  const [showReceipt, setShowReceipt] = React.useState(false);

  const refresh = React.useCallback(async () => {
    try {
      const d = await TallyAPI.me();
      setData(d);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  React.useEffect(() => { refresh(); }, [refresh]);

  if (error) {
    return (
      <div style={{ padding: 24, fontSize: 14, color: '#7f1d1d', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Couldn't connect to Tally</div>
        <div style={{ fontSize: 12, marginBottom: 16 }}>{error}</div>
        <button onClick={refresh} style={{
          background: '#7c5cff', color: '#fff', border: 0,
          padding: '10px 18px', borderRadius: 12, fontSize: 14, fontWeight: 600,
        }}>Try again</button>
        <div style={{ fontSize: 11, color: '#65676b', marginTop: 16 }}>
          If this keeps happening, open Tally via the menu button inside Telegram.
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="ld">Loading Tally…</div>;
  }

  const onRemoveExpense = async (id) => {
    try {
      await TallyAPI.expenses.remove(id);
      await refresh();
    } catch (e) {
      alert('Could not delete: ' + e.message);
    }
  };

  return (
    <>
      {route === 'home' && (
        <HomeScreen
          data={data}
          onAdd={() => setShowAdd(true)}
          onScanReceipt={() => setShowReceipt(true)}
          onSettle={() => setRoute('settle')}
          onFriends={() => setRoute('friends')}
          onSubs={() => setRoute('subs')}
          onGroups={() => setRoute('groups')}
          onSettings={() => setRoute('settings')}
          onSelectGroup={setSelectedGroupId}
          selectedGroupId={selectedGroupId}
          onRemoveExpense={onRemoveExpense}
          onOpenExpense={(id) => { setSelectedExpenseId(id); setRoute('expense-detail'); }}
        />
      )}
      {route === 'groups' && (
        <GroupsScreen
          data={data}
          onBack={() => setRoute('home')}
          onChanged={refresh}
          onOpenGroup={(id) => { setOpenGroupId(id); setRoute('group-detail'); }}
        />
      )}
      {route === 'group-detail' && (
        <GroupDetailScreen
          data={data}
          groupId={openGroupId}
          onBack={() => setRoute('groups')}
          onChanged={refresh}
          onSelectExpense={(id) => { setSelectedExpenseId(id); setRoute('expense-detail'); }}
        />
      )}
      {route === 'expense-detail' && (
        <ExpenseDetailScreen
          data={data}
          expenseId={selectedExpenseId}
          onBack={() => setRoute(openGroupId ? 'group-detail' : 'home')}
          onChanged={refresh}
        />
      )}
      {route === 'settle' && (
        <SettleScreen data={data} onBack={() => setRoute('home')} onSettled={refresh} />
      )}
      {route === 'friends' && (
        <FriendsScreen data={data} onBack={() => setRoute('home')} onChanged={refresh} />
      )}
      {route === 'subs' && (
        <SubsScreen data={data} onBack={() => setRoute('home')} onChanged={refresh} />
      )}
      {route === 'settings' && (
        <SettingsScreen data={data} onBack={() => setRoute('home')} onChanged={refresh} />
      )}
      {/* Persistent bottom nav across the 4 main routes. Hidden on Friends (deep modal-style screen). */}
      {['home', 'groups', 'settle', 'subs'].includes(route) && (
        <BottomNav active={route} onNavigate={setRoute} />
      )}
      {showAdd && (
        <AddExpenseScreen
          data={data}
          defaultGroupId={selectedGroupId}
          onClose={() => setShowAdd(false)}
          onSaved={async () => { setShowAdd(false); await refresh(); }}
        />
      )}
      {showReceipt && (
        <ReceiptScreen
          data={data}
          onClose={() => setShowReceipt(false)}
          onRefresh={refresh}
          onSaved={async () => { setShowReceipt(false); await refresh(); }}
        />
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
