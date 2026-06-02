import { memo }           from 'react';
import MessageBubble      from '../MessageBubble/MessageBubble';
import TypingIndicator    from '../TypingIndicator/TypingIndicator';
import styles             from './MessageList.module.css';

const SUGGESTIONS = [
  { icon: '🏗️', text: 'What are the best practices in Mendix development?', color: '#2e3192' },
  { icon: '📖', text: 'Explain Mendix to me',                              color: '#7c3aed' },
  { icon: '🐛', text: 'Help me fix a bug in Mendix',                       color: '#0891b2' },
  { icon: '✉️', text: 'Help me write an email',                            color: '#b45309' },
];

const MessageList = memo(({
  messages,
  isLoading,
  showCopyButton,
  allowMarkdown,
  enableTypingAnimation,
  onSuggestion,
  onOpenArtifact,
}) => {
  return (
    <div
      className={styles.list}
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
    >
      {messages.length === 0 && !isLoading && (
        <EmptyState onSuggestion={onSuggestion} />
      )}

      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          showCopyButton={showCopyButton}
          allowMarkdown={allowMarkdown}
          onOpenArtifact={onOpenArtifact}   // ← passes down to each bubble
        />
      ))}

      {isLoading && enableTypingAnimation && <TypingIndicator />}
      <div aria-hidden="true" style={{ height: 4 }} />
    </div>
  );
});

MessageList.displayName = 'MessageList';

const EmptyState = ({ onSuggestion }) => (
  <div className={styles.empty}>
    <div className={styles.emptyIcon} aria-hidden="true">
      <div className={styles.iconRing}>
        <svg viewBox="0 0 80 80" fill="none">
          <circle cx="40" cy="40" r="36" stroke="var(--ailcl-primary)"
            strokeWidth="1.5" strokeDasharray="5 4" opacity="0.35"/>
        </svg>
      </div>
      <div className={styles.iconBot}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
          strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="8" width="18" height="12" rx="3" />
          <circle cx="9"  cy="14" r="1.8" fill="currentColor" stroke="none" />
          <circle cx="15" cy="14" r="1.8" fill="currentColor" stroke="none" />
          <path d="M9 17.5h6" strokeWidth="1.5" />
          <line x1="12" y1="8" x2="12" y2="5" />
          <circle cx="12" cy="4" r="1.2" fill="currentColor" stroke="none" />
          <path d="M3 13H1.5M22.5 13H21" strokeWidth="1.5" />
        </svg>
      </div>
    </div>

    <div className={styles.emptyText}>
      <h3 className={styles.emptyTitle}>What can I help with?</h3>
      <p className={styles.emptySub}>
        Ask a question, upload a file, or pick a suggestion below.
      </p>
    </div>

    <div className={styles.chips}>
      {SUGGESTIONS.map((s) => (
        <button
          key={s.text}
          className={styles.chip}
          onClick={() => onSuggestion?.(s.text)}
          type="button"
        >
          <span className={styles.chipIcon}>{s.icon}</span>
          <span className={styles.chipText}>{s.text}</span>
          <span className={styles.chipArrow} aria-hidden="true">↗</span>
        </button>
      ))}
    </div>
  </div>
);

export default MessageList;