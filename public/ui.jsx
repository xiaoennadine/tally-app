// Shared UI primitives — Avatar, Header, ListRow, Sheet, Empty, Button.
const T = window.TG_TOKENS;

// Deterministic color from a name → hue
function colorFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  const hue = h % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

function Avatar({ name, size = 36 }) {
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

Object.assign(window, { Avatar, Header, Button, Sheet, Empty, Card, Row, CcyPicker, Toast, colorFor });
