/**
 * Shown in Mendix Studio Pro canvas (design-time preview).
 * Keep lightweight — no hooks, no API calls.
 */
const AILCLeditorPreview = ({ title, placeholder, theme, maxHeight }) => {
  const bg     = theme === 'dark' ? '#0e1016' : '#ffffff';
  const border = theme === 'dark' ? '#2a3050' : '#e2e5ef';
  const text   = theme === 'dark' ? '#e8eaf6' : '#111827';
  const muted  = theme === 'dark' ? '#6b708a' : '#9ca3af';
  const primary = '#5b6af0';

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      height:        maxHeight || '400px',
      maxHeight:     maxHeight || '400px',
      border:        `1px solid ${border}`,
      borderRadius:  '16px',
      background:    bg,
      fontFamily:    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      overflow:      'hidden',
    }}>
      {/* Header */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        gap:            '10px',
        padding:        '14px 18px',
        borderBottom:   `1px solid ${border}`,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
        <strong style={{ fontSize: 15, color: text }}>{title || 'AI Assistant'}</strong>
      </div>

      {/* Chat area placeholder */}
      <div style={{ flex: 1, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Simulated AI message */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e8eaff', flexShrink: 0 }} />
          <div style={{ background: '#f0f2f8', padding: '10px 14px', borderRadius: '10px 10px 10px 4px',
            fontSize: 13, color: text, maxWidth: '70%', lineHeight: 1.5 }}>
            Hello! I'm your AI assistant. How can I help you today?
          </div>
        </div>
        {/* Simulated user message */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexDirection: 'row-reverse' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: primary, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 13, fontWeight: 700 }}>U</div>
          <div style={{ background: primary, color: '#fff', padding: '10px 14px',
            borderRadius: '10px 10px 4px 10px', fontSize: 13, maxWidth: '60%' }}>
            What can you help me with?
          </div>
        </div>
      </div>

      {/* Input area */}
      <div style={{ padding: '10px 14px 12px', borderTop: `1px solid ${border}` }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: theme === 'dark' ? '#161b27' : '#f8f9fc',
          border: `1.5px solid ${border}`, borderRadius: 10, padding: '6px 8px' }}>
          <span style={{ flex: 1, fontSize: 13, color: muted, padding: '4px 0' }}>
            {placeholder || 'Type your message…'}
          </span>
          <div style={{ width: 34, height: 34, borderRadius: 6, background: primary,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"
              style={{ width: 16, height: 16 }}>
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AILCLeditorPreview;