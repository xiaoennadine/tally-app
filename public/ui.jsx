// Shared UI primitives — Avatar, Header, ListRow, Sheet, Empty, Button.
const T = window.TG_TOKENS;

// Deterministic color from a name → hue
function colorFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  const hue = h % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

// Stable 32-bit-ish hash → used to pick generated-avatar features.
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return h >>> 0;
}

// Generated character avatar — a friendly face built from simple shapes,
// fully deterministic from the name. Original (not memoji), scales down cleanly.
const GEN_PALETTE = [
  ['#FFB4A2', '#E5707E'], ['#A0E7E5', '#3BB4B0'], ['#B5EAD7', '#52B788'],
  ['#C7CEEA', '#7C5CFF'], ['#FFDAC1', '#F4A261'], ['#FBC4AB', '#E76F51'],
  ['#BDE0FE', '#3B82F6'], ['#FFC8DD', '#EC4899'], ['#CDB4DB', '#9D4EDD'],
  ['#FDE68A', '#F59E0B'], ['#B9FBC0', '#10B981'], ['#A2D2FF', '#2563EB'],
];
function GenAvatar({ name = '?', size = 36 }) {
  const h = hashStr(name || '?');
  const [bg, ring] = GEN_PALETTE[h % GEN_PALETTE.length];
  const eye = (h >> 4) % 3;     // eye style
  const mouth = (h >> 6) % 4;   // mouth style
  const blush = (h >> 9) & 1;
  const cx = 12, cy = 12;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: bg }}>
      <svg width={size} height={size} viewBox="0 0 24 24">
        <defs>
          <radialGradient id={`g${h}`} cx="50%" cy="35%" r="75%">
            <stop offset="0%" stopColor={bg} />
            <stop offset="100%" stopColor={ring} />
          </radialGradient>
        </defs>
        <rect width="24" height="24" fill={`url(#g${h})`} />
        {blush ? <><circle cx="7.5" cy="14" r="1.5" fill="#fff" opacity="0.35" /><circle cx="16.5" cy="14" r="1.5" fill="#fff" opacity="0.35" /></> : null}
        {/* eyes */}
        {eye === 0 && <><circle cx={cx - 3} cy={cy - 1} r="1.4" fill="#22202b" /><circle cx={cx + 3} cy={cy - 1} r="1.4" fill="#22202b" /></>}
        {eye === 1 && <><rect x={cx - 4.2} y={cy - 2.4} width="2.4" height="2.4" rx="1.2" fill="#22202b" /><rect x={cx + 1.8} y={cy - 2.4} width="2.4" height="2.4" rx="1.2" fill="#22202b" /></>}
        {eye === 2 && <><path d={`M${cx - 4.4} ${cy - 1}q1.4 -1.8 2.8 0`} stroke="#22202b" strokeWidth="1.2" fill="none" strokeLinecap="round" /><path d={`M${cx + 1.6} ${cy - 1}q1.4 -1.8 2.8 0`} stroke="#22202b" strokeWidth="1.2" fill="none" strokeLinecap="round" /></>}
        {/* mouth */}
        {mouth === 0 && <path d={`M${cx - 2.6} ${cy + 3}q2.6 2.4 5.2 0`} stroke="#22202b" strokeWidth="1.2" fill="none" strokeLinecap="round" />}
        {mouth === 1 && <circle cx={cx} cy={cy + 3.6} r="1.4" fill="#22202b" />}
        {mouth === 2 && <path d={`M${cx - 2.2} ${cy + 3.4}h4.4`} stroke="#22202b" strokeWidth="1.2" fill="none" strokeLinecap="round" />}
        {mouth === 3 && <path d={`M${cx - 2.4} ${cy + 2.6}q2.4 3.2 4.8 0`} stroke="#22202b" strokeWidth="1.2" fill="#22202b" strokeLinejoin="round" />}
      </svg>
    </div>
  );
}

function Avatar({ name, size = 36, emoji, gen = true }) {
  if (emoji && emoji.trim()) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: '#f4f5f7',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.55, flexShrink: 0,
      }}>{emoji}</div>
    );
  }
  if (gen) {
    return <GenAvatar name={name || '?'} size={size} />;
  }
  const initials = name ? name.split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase() : '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: colorFor(name || '?'), color: '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 600, fontSize: size * 0.4, flexShrink: 0,
    }}>{initials}</div>
  );
}

// Top header — back chevron + title (+ trailing action)
function Header({ title, subtitle, onBack, trailing }) {
  return (
    <div style={{
      background: '#fff', borderBottom: `1px solid ${T.divider}`,
      padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
      flexShrink: 0,
    }}>
      {onBack && (
        <div onClick={onBack} style={{ padding: 4, marginLeft: -4, cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 20 20"><path d="M13 4l-7 6 7 6" stroke={T.primary} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11.5, color: T.secondary }}>{subtitle}</div>}
      </div>
      {trailing}
    </div>
  );
}

// Primary button (also used as MainButton-style)
function Button({ children, onClick, disabled, style = {}, variant = 'primary' }) {
  const styles = {
    primary: { background: T.primary, color: '#fff', shadow: `0 4px 14px ${T.primary}33` },
    ghost:   { background: '#fff',    color: T.primary, border: `1.5px solid ${T.primary}`, shadow: 'none' },
    danger:  { background: '#fee2e2', color: '#b91c1c', shadow: 'none' },
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      border: styles.border || 0, padding: '13px 18px', borderRadius: 14,
      fontSize: 15, fontWeight: 600,
      background: styles.background, color: styles.color,
      boxShadow: styles.shadow, opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'default' : 'pointer', ...style,
    }}>{children}</button>
  );
}

// Bottom sheet modal
function Sheet({ open, onClose, children, title }) {
  if (!open) return null;
  return (
    <div className="scrim" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }} onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        maxHeight: '90vh', overflow: 'auto', position: 'relative',
        paddingBottom: 'env(safe-area-inset-bottom, 12px)',
      }}>
        <div style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1, padding: '8px 16px 0' }}>
          <div style={{ width: 36, height: 4, background: '#d0d3d8', borderRadius: 2, margin: '0 auto 10px' }} />
          {title && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              paddingBottom: 8, borderBottom: `1px solid ${T.divider}`,
            }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{title}</div>
              <div onClick={onClose} style={{ fontSize: 14, color: T.primary, fontWeight: 500, cursor: 'pointer' }}>Cancel</div>
            </div>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

// Empty state
function Empty({ icon = '🌿', title, action }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '60px 24px', textAlign: 'center', gap: 12,
    }}>
      <div style={{ fontSize: 48, opacity: 0.6 }}>{icon}</div>
      <div style={{ fontSize: 14, color: T.secondary, maxWidth: 280, lineHeight: 1.5 }}>{title}</div>
      {action}
    </div>
  );
}

// Card container
function Card({ children, style = {} }) {
  return (
    <div style={{
      background: T.card, borderRadius: 14, overflow: 'hidden',
      border: `1px solid ${T.divider}`, ...style,
    }}>{children}</div>
  );
}

function Row({ children, onClick, last }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 14px',
      borderBottom: last ? 'none' : `1px solid ${T.divider}`,
      cursor: onClick ? 'pointer' : 'default',
    }}>{children}</div>
  );
}

// Currency picker (segmented control)
function CcyPicker({ value, onChange, options = window.SUPPORTED_CCYS }) {
  return (
    <div style={{ display: 'inline-flex', background: '#f4f5f7', borderRadius: 100, padding: 3 }}>
      {options.map(c => (
        <div key={c} onClick={() => onChange(c)} style={{
          padding: '6px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600,
          background: c === value ? T.primary : 'transparent',
          color: c === value ? '#fff' : T.secondary,
          cursor: 'pointer',
        }}>{c}</div>
      ))}
    </div>
  );
}

// Toast / inline error
function Toast({ message }) {
  if (!message) return null;
  return (
    <div style={{
      position: 'fixed', top: 20, left: 16, right: 16, zIndex: 300,
      background: '#fee2e2', color: '#7f1d1d', padding: '10px 14px',
      borderRadius: 12, fontSize: 13, fontWeight: 500, boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
    }}>{message}</div>
  );
}

// Bottom tab bar — persistent across the 4 main routes.
function BottomNav({ active, onNavigate }) {
  const tabs = [
    { id: 'home',    label: 'Home',      icon: HomeIcon },
    { id: 'groups',  label: 'Groups',    icon: GroupsIcon },
    { id: 'settle',  label: 'Settle',    icon: SettleIcon },
    { id: 'subs',    label: 'Split sub', icon: SubsIcon },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      background: '#fff', borderTop: `1px solid ${T.divider}`,
      display: 'flex', justifyContent: 'space-around', alignItems: 'stretch',
      paddingTop: 6,
      paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6px)',
      zIndex: 50,
      boxShadow: '0 -4px 16px rgba(0,0,0,0.04)',
    }}>
      {tabs.map(t => {
        const on = t.id === active;
        const color = on ? T.primary : T.secondary;
        const Icon = t.icon;
        return (
          <div key={t.id} onClick={() => onNavigate(t.id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 3, padding: '4px 0',
            cursor: 'pointer', color,
            transition: 'color 120ms ease',
          }}>
            <Icon color={color} filled={on} />
            <div style={{ fontSize: 11, fontWeight: on ? 600 : 500, letterSpacing: 0.1 }}>
              {t.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HomeIcon({ color, filled }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M3.5 11L12 4l8.5 7v8.2a1.3 1.3 0 0 1-1.3 1.3h-4.2v-6.5h-6V20.5H4.8a1.3 1.3 0 0 1-1.3-1.3V11z"
        stroke={color} strokeWidth="1.8" strokeLinejoin="round"
        fill={filled ? `${color}22` : 'none'} />
    </svg>
  );
}

function GroupsIcon({ color }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="9" r="3.3" stroke={color} strokeWidth="1.8"/>
      <circle cx="16.5" cy="10" r="2.5" stroke={color} strokeWidth="1.8"/>
      <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5M16.5 14.5c2.6 0 4.5 1.5 4.5 4"
        stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

function SettleIcon({ color }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="3.5" width="14" height="17" rx="2.2" stroke={color} strokeWidth="1.8"/>
      <rect x="7.5" y="6" width="9" height="3" rx="0.8" stroke={color} strokeWidth="1.6"/>
      <circle cx="8.5" cy="12" r="0.9" fill={color}/>
      <circle cx="12" cy="12" r="0.9" fill={color}/>
      <circle cx="15.5" cy="12" r="0.9" fill={color}/>
      <circle cx="8.5" cy="15.5" r="0.9" fill={color}/>
      <circle cx="12" cy="15.5" r="0.9" fill={color}/>
      <circle cx="15.5" cy="15.5" r="0.9" fill={color}/>
    </svg>
  );
}

function SubsIcon({ color }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="18" height="12.5" rx="2.2" stroke={color} strokeWidth="1.8"/>
      <path d="M3 10.5h18" stroke={color} strokeWidth="1.8"/>
      <path d="M6.5 15h4" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

Object.assign(window, { Avatar, GenAvatar, Header, Button, Sheet, Empty, Card, Row, CcyPicker, Toast, BottomNav, colorFor });
