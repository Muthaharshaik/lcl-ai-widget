import { useState, useRef, useEffect, memo } from 'react';
import styles from './Sidebar.module.css';

// ─── Date grouping helpers ────────────────────────────────────────────────────
function getGroup(isoDate) {
  if (!isoDate) return 'Earlier';
  const d     = new Date(isoDate);
  const now   = new Date();
  const diffMs = now - d;
  const days  = diffMs / 86_400_000;

  if (days < 1)   return 'Today';
  if (days < 2)   return 'Yesterday';
  if (days < 7)   return 'Last 7 Days';
  if (days < 30)  return 'Last 30 Days';
  return 'Earlier';
}

const GROUP_ORDER = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Earlier'];

function groupSessions(sessions) {
  const groups = {};
  for (const s of sessions) {
    const g = getGroup(s.updatedAt);
    if (!groups[g]) groups[g] = [];
    groups[g].push(s);
  }
  return groups;
}

// ─── Session item ─────────────────────────────────────────────────────────────
const SessionItem = memo(function SessionItem({
  session, isActive, onSelect, onDelete, onRename,
}) {
  const [editing,   setEditing]   = useState(false);
  const [editTitle, setEditTitle] = useState(session.title);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commitRename = () => {
    setEditing(false);
    onRename(session.id, editTitle || session.title);
  };

  return (
    <div
      className={`${styles.sessionItem} ${isActive ? styles.sessionItemActive : ''}`}
      onClick={() => !editing && onSelect(session.id)}
      title={session.title}
    >
      <span className={styles.sessionIcon}>
        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 2.5A.5.5 0 012.5 2h11a.5.5 0 01.5.5v8a.5.5 0 01-.5.5H8.707l-2.853 2.854A.5.5 0 015 13.5V11H2.5a.5.5 0 01-.5-.5v-8z"
            fill="currentColor" opacity="0.7"/>
        </svg>
      </span>

      {editing ? (
        <input
          ref={inputRef}
          className={styles.renameInput}
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') { setEditing(false); setEditTitle(session.title); }
          }}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span className={styles.sessionTitle}>{session.title || 'New Chat'}</span>
      )}

      <div className={styles.sessionActions} onClick={e => e.stopPropagation()}>
        <button
          className={styles.sessionBtn}
          title="Rename"
          onClick={() => { setEditTitle(session.title); setEditing(true); }}
        >
          <svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.146.146a.5.5 0 01.708 0l3 3a.5.5 0 010 .708l-10 10a.5.5 0 01-.168.11l-5 2a.5.5 0 01-.65-.65l2-5a.5.5 0 01.11-.168l10-10zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 01.5.5v.5h.5a.5.5 0 01.5.5v.5h.293l6.5-6.5z"/>
          </svg>
        </button>
        <button
          className={`${styles.sessionBtn} ${styles.sessionBtnDelete}`}
          title="Delete"
          onClick={() => onDelete(session.id)}
        >
          <svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>
            <path fillRule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
          </svg>
        </button>
      </div>
    </div>
  );
});

// ─── Sidebar ──────────────────────────────────────────────────────────────────
export default function Sidebar({
  sessions        = [],
  currentSessionId,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  collapsed,
  onToggleCollapse,
  theme,
}) {
  const groups = groupSessions(sessions);

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>

      {/* ── Top bar ── */}
      <div className={styles.sidebarTop}>
        {!collapsed && (
          <span className={styles.sidebarBrand}>Chats</span>
        )}
        <button
          className={styles.collapseBtn}
          onClick={onToggleCollapse}
          title={collapsed ? 'Open sidebar' : 'Close sidebar'}
        >
          {collapsed ? (
            <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/></svg>
          ) : (
            <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/></svg>
          )}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* ── New chat button ── */}
          <button className={styles.newChatBtn} onClick={onNewSession}>
            <svg viewBox="0 0 20 20" fill="currentColor" className={styles.newChatIcon}>
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
            </svg>
            New Chat
          </button>

          {/* ── Session list ── */}
          <div className={styles.sessionList}>
            {sessions.length === 0 ? (
              <p className={styles.emptyMsg}>No chats yet. Start one!</p>
            ) : (
              GROUP_ORDER.filter(g => groups[g]?.length > 0).map(group => (
                <div key={group} className={styles.group}>
                  <span className={styles.groupLabel}>{group}</span>
                  {groups[group].map(session => (
                    <SessionItem
                      key={session.id}
                      session={session}
                      isActive={session.id === currentSessionId}
                      onSelect={onSelectSession}
                      onDelete={onDeleteSession}
                      onRename={onRenameSession}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </aside>
  );
}