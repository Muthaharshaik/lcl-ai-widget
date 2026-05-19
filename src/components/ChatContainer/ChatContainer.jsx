import MessageList   from '../MessageList/MessageList';
import ChatInput     from '../ChatInput/ChatInput';
import { useChat }   from '../../hooks/useChat';
import styles        from './ChatContainer.module.css';

/**
 * Top-level orchestrator component.
 * Receives all widget props, delegates state to useChat(), renders layout.
 */
const ChatContainer = ({
  apiUrl, title, placeholder, maxHeight, theme,
  disabled, allowMarkdown, showCopyButton,
  enableTypingAnimation, allowFileUpload,
  acceptedFileTypes, maxFileSizeMB, autoScroll,
}) => {
  const {
    messages, isLoading, error,
    sendMessage, cancelRequest, clearChat, clearError,
  } = useChat({ apiUrl });

  return (
    <div
      className={`${styles.container} ailcl-theme-${theme}`}
      style={{ '--chat-max-height': maxHeight }}
      data-widget="ailcl"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.onlineDot} title="Online" aria-hidden="true" />
          <h2 className={styles.title}>{title}</h2>
        </div>
        <button
          className={styles.clearBtn}
          onClick={clearChat}
          disabled={messages.length === 0 && !error}
          title="Clear conversation"
          aria-label="Clear conversation"
          type="button"
        >
          <TrashIcon />
        </button>
      </header>

      {/* ── Error banner ──────────────────────────────────────────────── */}
      {error && (
        <div className={styles.errorBanner} role="alert" aria-live="assertive">
          <span>⚠ {error}</span>
          <button onClick={clearError} aria-label="Dismiss error" type="button">×</button>
        </div>
      )}

      {/* ── Message area ──────────────────────────────────────────────── */}
      <main className={styles.messages}>
        <MessageList
          messages={messages}
          isLoading={isLoading}
          showCopyButton={showCopyButton}
          allowMarkdown={allowMarkdown}
          enableTypingAnimation={enableTypingAnimation}
          autoScroll={autoScroll}
        />
      </main>

      {/* ── Input ─────────────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <ChatInput
          onSend={sendMessage}
          onCancel={cancelRequest}
          isLoading={isLoading}
          disabled={disabled}
          placeholder={placeholder}
          allowFileUpload={allowFileUpload}
          acceptedFileTypes={acceptedFileTypes}
          maxFileSizeMB={maxFileSizeMB}
        />
      </footer>
    </div>
  );
};

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

export default ChatContainer;