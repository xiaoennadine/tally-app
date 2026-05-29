// Subscription brand registry + branded glyphs.
// Original stylized marks (a letter or simple shape) on the brand's colour —
// recognisable at a glance without shipping any copyrighted logo files.

// mark can be a string (rendered as a bold letter) or a function(size,fg)=>JSX.
const SUB_BRANDS = {
  netflix:   { label: 'Netflix',        bg: '#e50914', fg: '#fff', mark: 'N', radius: 0.24 },
  spotify:   { label: 'Spotify',        bg: '#1db954', fg: '#fff', radius: 0.5,
    mark: (s, fg) => (
      <svg width={s * 0.62} height={s * 0.62} viewBox="0 0 24 24" fill="none">
        <path d="M5 9c5-1.6 10-1 14 1.2" stroke={fg} strokeWidth="2.2" strokeLinecap="round"/>
        <path d="M6 13c4-1.2 8-.7 11 1" stroke={fg} strokeWidth="2" strokeLinecap="round"/>
        <path d="M7 16.5c3-.9 6-.5 8 .7" stroke={fg} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ) },
  disney:    { label: 'Disney+',        bg: 'linear-gradient(135deg,#1a3fd6,#0b1a5c)', fg: '#fff', mark: 'D+', radius: 0.24 },
  icloud:    { label: 'iCloud',         bg: 'linear-gradient(135deg,#3db8f5,#2a7de1)', fg: '#fff', radius: 0.24,
    mark: (s, fg) => (
      <svg width={s * 0.62} height={s * 0.62} viewBox="0 0 24 24" fill={fg}>
        <path d="M7.5 18h9.2a3.3 3.3 0 0 0 .3-6.6 4.6 4.6 0 0 0-8.7-1.3A3.6 3.6 0 0 0 7.5 18z"/>
      </svg>
    ) },
  apple:     { label: 'Apple',          bg: '#1c1c1e', fg: '#fff', mark: '', radius: 0.24,
    mark2: true },
  appletv:   { label: 'Apple TV+',      bg: '#1c1c1e', fg: '#fff', mark: 'TV', radius: 0.24 },
  youtube:   { label: 'YouTube',        bg: '#ff0000', fg: '#fff', radius: 0.28,
    mark: (s, fg) => (
      <svg width={s * 0.5} height={s * 0.5} viewBox="0 0 24 24" fill={fg}><path d="M8 6l11 6-11 6z"/></svg>
    ) },
  prime:     { label: 'Prime Video',    bg: '#0f1a2b', fg: '#1ba8e0', radius: 0.24,
    mark: (s, fg) => (
      <svg width={s * 0.6} height={s * 0.6} viewBox="0 0 24 24" fill="none">
        <path d="M4 14c5 3.5 11 3.5 16 0" stroke={fg} strokeWidth="2.4" strokeLinecap="round"/>
        <path d="M16 13.2l3 .8-1 3" stroke={fg} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    ) },
  amazon:    { label: 'Amazon',         bg: '#ff9900', fg: '#111', mark: 'a', radius: 0.24 },
  hbomax:    { label: 'Max',            bg: 'linear-gradient(135deg,#2e0eb8,#0a0a3c)', fg: '#fff', mark: 'M', radius: 0.24 },
  hulu:      { label: 'Hulu',           bg: '#1ce783', fg: '#0b3', radius: 0.24, mark: 'h' },
  paramount: { label: 'Paramount+',     bg: '#0064ff', fg: '#fff', mark: 'P+', radius: 0.24 },
  peacock:   { label: 'Peacock',        bg: '#05030d', fg: '#fff', mark: 'P', radius: 0.24 },
  crunchyroll:{ label: 'Crunchyroll',   bg: '#f47521', fg: '#fff', mark: 'C', radius: 0.24 },
  openai:    { label: 'ChatGPT',        bg: '#10a37f', fg: '#fff', radius: 0.5,
    mark: (s, fg) => (
      <svg width={s * 0.56} height={s * 0.56} viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="1.8">
        <path d="M12 4l6 3.5v7L12 18l-6-3.5v-7z"/><path d="M12 4v7l6 3.5M12 18v-7L6 7.5"/>
      </svg>
    ) },
  notion:    { label: 'Notion',         bg: '#111', fg: '#fff', mark: 'N', radius: 0.24 },
  dropbox:   { label: 'Dropbox',        bg: '#0061ff', fg: '#fff', radius: 0.24,
    mark: (s, fg) => (
      <svg width={s * 0.62} height={s * 0.62} viewBox="0 0 24 24" fill={fg}>
        <path d="M7 4l5 3-5 3-5-3zM17 4l5 3-5 3-5-3zM2 13l5 3 5-3-5-3zM17 10l5 3-5 3-5-3zM7 17.5l5-3 5 3-5 3z"/>
      </svg>
    ) },
  adobe:     { label: 'Adobe',          bg: '#ed2224', fg: '#fff', mark: 'A', radius: 0.24 },
  canva:     { label: 'Canva',          bg: 'linear-gradient(135deg,#00c4cc,#7d2ae8)', fg: '#fff', mark: 'C', radius: 0.5 },
  figma:     { label: 'Figma',          bg: '#1e1e1e', fg: '#fff', mark: 'F', radius: 0.24 },
  github:    { label: 'GitHub',         bg: '#1c2128', fg: '#fff', mark: 'G', radius: 0.5 },
  audible:   { label: 'Audible',        bg: '#f8991c', fg: '#1a1a1a', mark: 'a', radius: 0.24 },
  nyt:       { label: 'NYTimes',        bg: '#111', fg: '#fff', mark: 'T', radius: 0.24, serif: true },
  patreon:   { label: 'Patreon',        bg: '#ff424d', fg: '#fff', mark: 'P', radius: 0.5 },
  twitch:    { label: 'Twitch',         bg: '#9146ff', fg: '#fff', mark: 'T', radius: 0.24 },
  nintendo:  { label: 'Nintendo',       bg: '#e60012', fg: '#fff', mark: 'N', radius: 0.24 },
  playstation:{ label: 'PS Plus',       bg: '#003791', fg: '#fff', mark: 'P', radius: 0.24 },
  xbox:      { label: 'Game Pass',      bg: '#107c10', fg: '#fff', mark: 'X', radius: 0.5 },
  googleone: { label: 'Google One',     bg: '#1a73e8', fg: '#fff', mark: 'G', radius: 0.24 },
  microsoft: { label: 'Microsoft 365',  bg: '#0067b8', fg: '#fff', mark: 'M', radius: 0.24 },
  deezer:    { label: 'Deezer',         bg: '#111', fg: '#ef5466', mark: 'd', radius: 0.24 },
  tidal:     { label: 'Tidal',          bg: '#0a0a0a', fg: '#fff', mark: 'T', radius: 0.24 },
  slack:     { label: 'Slack',          bg: '#4a154b', fg: '#fff', mark: 'S', radius: 0.24 },
  zoom:      { label: 'Zoom',           bg: '#2d8cff', fg: '#fff', mark: 'Z', radius: 0.24 },
  dazn:      { label: 'DAZN',           bg: '#0b0b0b', fg: '#f8f800', mark: 'D', radius: 0.24 },
  duolingo:  { label: 'Duolingo',       bg: '#58cc02', fg: '#fff', mark: 'D', radius: 0.24 },
  audiblego: { label: 'Headspace',      bg: '#f47d31', fg: '#fff', mark: 'H', radius: 0.5 },
};

// keyword → brand id (checked as substrings of the lowercased name)
const BRAND_KEYWORDS = [
  ['netflix', 'netflix'], ['spotify', 'spotify'], ['disney', 'disney'],
  ['icloud', 'icloud'], ['apple tv', 'appletv'], ['apple', 'apple'],
  ['youtube', 'youtube'], ['yt ', 'youtube'], ['prime', 'prime'], ['amazon', 'amazon'],
  ['hbo', 'hbomax'], ['max', 'hbomax'], ['hulu', 'hulu'], ['paramount', 'paramount'],
  ['peacock', 'peacock'], ['crunchyroll', 'crunchyroll'], ['chatgpt', 'openai'],
  ['openai', 'openai'], ['gpt', 'openai'], ['notion', 'notion'], ['dropbox', 'dropbox'],
  ['adobe', 'adobe'], ['photoshop', 'adobe'], ['creative cloud', 'adobe'], ['canva', 'canva'],
  ['figma', 'figma'], ['github', 'github'], ['audible', 'audible'], ['nyt', 'nyt'],
  ['new york times', 'nyt'], ['patreon', 'patreon'], ['twitch', 'twitch'], ['nintendo', 'nintendo'],
  ['playstation', 'playstation'], ['ps plus', 'playstation'], ['ps+', 'playstation'],
  ['game pass', 'xbox'], ['xbox', 'xbox'], ['google one', 'googleone'], ['google', 'googleone'],
  ['microsoft', 'microsoft'], ['office 365', 'microsoft'], ['365', 'microsoft'],
  ['deezer', 'deezer'], ['tidal', 'tidal'], ['slack', 'slack'], ['zoom', 'zoom'],
  ['dazn', 'dazn'], ['duolingo', 'duolingo'], ['headspace', 'audiblego'],
];

function detectBrand(name) {
  const n = (name || '').toLowerCase().trim();
  if (!n) return null;
  for (const [kw, id] of BRAND_KEYWORDS) {
    if (n.includes(kw)) return id;
  }
  return null;
}

// Renders the branded mark. Falls back to a coloured initial when brand unknown.
function BrandGlyph({ brand, name, color, emoji, size = 44, radius }) {
  const b = brand && SUB_BRANDS[brand];
  if (b) {
    const rad = (radius != null ? radius : b.radius) * size;
    return (
      <div style={{
        width: size, height: size, borderRadius: rad,
        background: b.bg, color: b.fg, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.12)',
        overflow: 'hidden',
      }}>
        {b.mark2 ? (
          <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill={b.fg}>
            <path d="M16.4 12.6c0-2.1 1.7-3.1 1.8-3.2-1-1.5-2.5-1.7-3.1-1.7-1.3-.1-2.6.8-3.2.8-.7 0-1.7-.8-2.8-.7-1.4 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.4 1.1 8.5.7 1 1.5 2.2 2.6 2.1 1-.04 1.5-.7 2.8-.7s1.7.7 2.8.66c1.2-.02 1.9-1 2.6-2 .8-1.2 1.1-2.3 1.2-2.4-.03-.01-2.3-.9-2.3-3.5z"/>
            <path d="M14.3 6.3c.6-.7 1-1.7.9-2.7-.85.03-1.9.57-2.5 1.27-.55.62-1 1.6-.9 2.56.95.07 1.9-.48 2.5-1.1z"/>
          </svg>
        ) : typeof b.mark === 'function' ? b.mark(size, b.fg) : (
          <span style={{ fontSize: size * (b.mark.length > 1 ? 0.4 : 0.5), fontWeight: 800, letterSpacing: -0.5, fontFamily: b.serif ? 'Georgia, "Times New Roman", serif' : 'inherit' }}>{b.mark}</span>
        )}
      </div>
    );
  }
  // Unknown brand → coloured tile with emoji, or initial.
  const rad = (radius != null ? radius : 0.24) * size;
  return (
    <div style={{
      width: size, height: size, borderRadius: rad,
      background: color || '#7c5cff', color: '#fff', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: emoji ? size * 0.5 : size * 0.42, fontWeight: 700,
      boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.12)',
    }}>{emoji || (name || '?').trim().charAt(0).toUpperCase()}</div>
  );
}

Object.assign(window, { SUB_BRANDS, detectBrand, BrandGlyph });
