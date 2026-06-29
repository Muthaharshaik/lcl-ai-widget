import { useState, useCallback, useRef, useEffect } from 'react';
import { useAutoScroll } from '../../hooks/useAutoScroll';
import MessageList                from '../MessageList/MessageList';
import ChatInput                  from '../ChatInput/ChatInput';
import ArtifactPanel              from '../ArtifactPanel/ArtifactPanel';
import Sidebar                    from '../Sidebar/Sidebar';
import { useChat }                from '../../hooks/useChat';
import { useArtifact }            from '../../hooks/useArtifact';
import { useSessions }            from '../../hooks/useSessions';
import styles                     from './ChatContainer.module.css';
 
const ChatContainer = ({
  apiUrl, title, placeholder, maxHeight, defaultDark,
  disabled, allowMarkdown, showCopyButton,
  enableTypingAnimation, allowFileUpload,
  acceptedFileTypes, maxFileSizeMB, autoScroll,
  // ── Session / history props ──────────────────────────────────────
  chatHistoryJson, onHistoryChange, showSidebar = false,  onShareSession,
  // ── S3 upload config (from Mendix attributes) ────────────────────
  s3Config = {},
  userEmail = '',
}) => {
 
  // ── Theme ────────────────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem('ailcl-theme') === 'dark' || defaultDark; }
    catch { return defaultDark; }
  });
  const theme = isDark ? 'dark' : 'light';
 
  // ── Fullscreen ────────────────────────────────────────────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);
 
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.()
    } else {
      document.exitFullscreen?.();
    }
  }, []);
 
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);
 
  // ── Sidebar collapsed state ───────────────────────────────────────────────
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
 
  // ── Sessions (Mendix-persisted chat history) ──────────────────────────────
  const sessions = useSessions({ chatHistoryJson, onHistoryChange, showSidebar });
  const isReadOnly = String(sessions.currentSession?.isShared) === "true";
 
  // ── Chat ──────────────────────────────────────────────────────────────────
  const {
    messages, isLoading, error,
    sendMessage, cancelRequest, clearChat, clearError, loadHistory,
  } = useChat({ apiUrl, s3Config, userEmail });
 
  // ── Auto scroll ─────────────────────────────────────────────────────────
  const lastMsg   = messages[messages.length - 1];
  const scrollDep = `${messages.length}-${lastMsg?.content?.length ?? 0}-${isLoading}`;
  const { containerRef: messagesRef } = useAutoScroll({
    enabled:    autoScroll,
    dependency: scrollDep,
  });
 
  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      try { localStorage.setItem('ailcl-theme', next ? 'dark' : 'light'); }
      catch {}
      return next;
    });
  }, []);
 
  // ── Artifact ─────────────────────────────────────────────────────────────────
  const {
    artifact, isOpen, isStreaming,
    openArtifact, startArtifactStream, updateArtifact,
    finishArtifactStream, closeArtifact,
  } = useArtifact();
 
  // ── Sync messages → sessions (save on every change) ──────────────────────
  const prevMessagesRef = useRef(messages);
  useEffect(() => {
    if (messages === prevMessagesRef.current) return;
    prevMessagesRef.current = messages;
    if (showSidebar && sessions.currentSessionId && messages.length > 0 && !isReadOnly) {
      sessions.updateSessionMessages(sessions.currentSessionId, messages);
    }
  }, [messages, showSidebar, sessions]);
 
  // ── Load messages when session switches ──────────────────────────────────
  const prevSessionIdRef = useRef(null);
  useEffect(() => {
    if (!showSidebar || !sessions.isLoaded) return;
    if (sessions.currentSessionId === prevSessionIdRef.current) return;
    prevSessionIdRef.current = sessions.currentSessionId;
 
    const msgs = sessions.currentSession?.messages || [];
    loadHistory(msgs);
    closeArtifact();
  }, [sessions.currentSessionId, sessions.isLoaded, showSidebar]);
 
  // ── New session handler ───────────────────────────────────────────────────
  const handleNewSession = useCallback(() => {
    sessions.newSession();
    loadHistory([]);
    closeArtifact();
  }, [sessions, loadHistory, closeArtifact]);
 
  // ── Pending command type ──────────────────────────────────────────────────────
  const [pendingCommandType, setPendingCommandType] = useState(null);
 
  // Track the last successfully generated artifact type so follow-up messages
  // like "change the colors" or "add more slides" get the correct commandType.
  const lastArtifactCommandType = useRef(null);
 
  // ── Wire artifact streaming events ───────────────────────────────────────────
  const handleArtifactEvent = useCallback((event) => {
    if (event.type === 'start') {
      startArtifactStream(event.title || 'Building…');
    } else if (event.type === 'chunk') {
      updateArtifact({ code: event.code });
    } else if (event.type === 'done') {
      // Capture what commandType was used BEFORE clearing pendingCommandType
      const usedCommandType = pendingCommandType || lastArtifactCommandType.current;
 
      if (event.artifact?.type) {
        const typeToCommand = { pptx: 'ppt', docx: 'word', document: 'doc', html: 'code' };
        lastArtifactCommandType.current = typeToCommand[event.artifact.type] || null;
      }
      setPendingCommandType(null);
 
      // ── Derive a meaningful filename from the last user message ───────────
      const lastUserMsg  = messages.filter((m) => m.role === 'user').pop();
      const rawText      = typeof lastUserMsg?.content === 'string'
        ? lastUserMsg.content : '';
      const derivedTitle = rawText
        .slice(0, 60)
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        || event.artifact?.title
        || 'Document';
 
      finishArtifactStream({
        ...event.artifact,
        title:       derivedTitle,
        requestedAs: usedCommandType,
      });
    }
  }, [startArtifactStream, updateArtifact, finishArtifactStream, pendingCommandType, messages]);
 
  // ── Send ─────────────────────────────────────────────────────────────────────
  const handleSend = useCallback(({ text, files, commandType }) => {
    const lastCmd      = lastArtifactCommandType.current;
    const codeFollowUp = lastCmd === 'code' ? 'code' : null;
    const effectiveCommandType = commandType || pendingCommandType || codeFollowUp || null;
 
    if (commandType) {
      setPendingCommandType(commandType);
      lastArtifactCommandType.current = null;
    }
 
    sendMessage({ text, files, commandType: effectiveCommandType, onArtifactEvent: handleArtifactEvent });
  }, [sendMessage, handleArtifactEvent, pendingCommandType]);
 
  const handleSuggestion = useCallback((text) => {
    sendMessage({ text, files: [], commandType: null, onArtifactEvent: handleArtifactEvent });
  }, [sendMessage, handleArtifactEvent]);
 
  // ── Cancel ───────────────────────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    cancelRequest();
    setPendingCommandType(null);
    lastArtifactCommandType.current = null;
  }, [cancelRequest]);
 
  // ── Regenerate ───────────────────────────────────────────────────────────────
  const handleRegenerate = useCallback(() => {
    if (isLoading) return;
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;
    const text = typeof lastUserMsg.content === 'string' ? lastUserMsg.content : '';
    const commandType = lastArtifactCommandType.current || null;
    sendMessage({ text, files: lastUserMsg.files || [], commandType, onArtifactEvent: handleArtifactEvent });
  }, [isLoading, messages, sendMessage, handleArtifactEvent]);
 
  // ── Reopen artifact from message bubble ───────────────────────────────────────
  const handleOpenArtifact = useCallback((artifactData) => {
    openArtifact(artifactData);
  }, [openArtifact]);
 
  return (
    <div
      ref={containerRef}
      className={`${styles.container} ailcl-theme-${theme}`}
      style={{ '--chat-max-height': maxHeight }}
      data-widget="ailcl"
    >
      <div className={styles.layout}>
 
        {/* ── Sidebar (chat history) ───────────────────────────────────────── */}
        {showSidebar && (
          <Sidebar
            sessions={sessions.sessions}
            currentSessionId={sessions.currentSessionId}
            onNewSession={handleNewSession}
            onSelectSession={sessions.selectSession}
            onDeleteSession={sessions.deleteSession}
            onRenameSession={sessions.renameSession}
            onShareSession={onShareSession}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(p => !p)}
            theme={theme}
          />
        )}
 
        {/* ── Chat column ─────────────────────────────────────────────────── */}
        <div className={styles.chatColumn}>
 
          {/* Header */}
          <header className={styles.header}>
            <div className={styles.headerLeft}>
              <div className={styles.brandMark} aria-hidden="true"><BotIcon /></div>
              <div className={styles.titleGroup}>
                <h2 className={styles.title}>{title}</h2>
                <div className={styles.statusRow}>
                  <span className={styles.onlineDot} aria-hidden="true" />
                  <span className={styles.statusText}>Online</span>
                </div>
              </div>
            </div>
 
            <div className={styles.headerRight}>
              {/* Fullscreen toggle */}
              <button
                className={styles.themeToggle}
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                type="button"
              >
                {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
              </button>
 
              {/* Theme toggle */}
              <button
                className={styles.themeToggle}
                onClick={toggleTheme}
                title={isDark ? 'Light mode' : 'Dark mode'}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                type="button"
              >
                <span className={`${styles.themeIcon} ${isDark ? styles.moonActive : styles.sunActive}`}>
                  {isDark ? <MoonIcon /> : <SunIcon />}
                </span>
              </button>
            </div>
          </header>
 
          {/* Error banner */}
          {error && (
            <div className={styles.errorBanner} role="alert" aria-live="assertive">
              <span className={styles.errorText}>⚠ {error}</span>
              <button className={styles.errorDismiss} onClick={clearError} type="button">×</button>
            </div>
          )}
 
          {/* Messages */}
          <main ref={messagesRef} className={styles.messages}>
            <MessageList
              messages={messages}
              isLoading={isLoading}
              showCopyButton={showCopyButton}
              allowMarkdown={allowMarkdown}
              enableTypingAnimation={enableTypingAnimation}
              onSuggestion={handleSuggestion}
              onOpenArtifact={handleOpenArtifact}
            />
          </main>
 
          {/* Input */}
          {!isReadOnly && (
          <footer className={styles.footer}>
            <ChatInput
              onSend={handleSend}
              onCancel={handleCancel}
              isLoading={isLoading}
              disabled={disabled}
              placeholder={placeholder}
              allowFileUpload={allowFileUpload}
              acceptedFileTypes={acceptedFileTypes}
              maxFileSizeMB={maxFileSizeMB}
            />
          </footer>
          )}
        </div>
 
        {/* ── Artifact panel ───────────────────────────────────────────────── */}
        {isOpen && artifact && (
          <ArtifactPanel
            artifact={artifact}
            isStreaming={isStreaming}
            isLoading={isLoading}
            onClose={closeArtifact}
            onRegenerate={handleRegenerate}
          />
        )}
      </div>
    </div>
  );
};
 
// ─── Icons ────────────────────────────────────────────────────────────────────
const BotIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="8" width="18" height="12" rx="3" />
    <circle cx="9"  cy="14" r="1.8" fill="currentColor" stroke="none" />
    <circle cx="15" cy="14" r="1.8" fill="currentColor" stroke="none" />
    <path d="M9 17.5h6" strokeWidth="1.5" />
    <line x1="12" y1="8" x2="12" y2="5" />
    <circle cx="12" cy="4" r="1.2" fill="currentColor" stroke="none" />
    <path d="M3 13H1.5M22.5 13H21" strokeWidth="1.5" />
  </svg>
);
 
const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);
 
const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);
 
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);
 
const FullscreenIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
    <path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
    <path d="M3 16v3a2 2 0 0 0 2 2h3"/>
    <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
  </svg>
);
 
const ExitFullscreenIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 3v3a2 2 0 0 1-2 2H3"/>
    <path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
    <path d="M3 16h3a2 2 0 0 1 2 2v3"/>
    <path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
  </svg>
);
 
export default ChatContainer;