import { memo }               from 'react';
import MessageBubble          from '../MessageBubble/MessageBubble';
import TypingIndicator        from '../TypingIndicator/TypingIndicator';
import { useAutoScroll }      from '../../hooks/useAutoScroll';
import styles                 from './MessageList.module.css';

const MessageList = memo(({
  messages,
  isLoading,
  showCopyButton,
  allowMarkdown,
  enableTypingAnimation,
  autoScroll,
}) => {
  // Re-scroll whenever the message count or loading state changes
  const { containerRef } = useAutoScroll({
    enabled:    autoScroll,
    dependency: `${messages.length}-${isLoading}`,
  });

  return (
    <div
      ref={containerRef}
      className={styles.list}
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
    >
      {messages.length === 0 && !isLoading && <EmptyState />}

      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          showCopyButton={showCopyButton}
          allowMarkdown={allowMarkdown}
        />
      ))}

      {isLoading && enableTypingAnimation && <TypingIndicator />}

      {/* Scroll anchor */}
      <div aria-hidden="true" style={{ height: 1 }} />
    </div>
  );
});

MessageList.displayName = 'MessageList';

const EmptyState = () => (
  <div className={styles.empty}>
    <div className={styles.emptyIcon}>💬</div>
    <p className={styles.emptyTitle}>How can I help you today?</p>
    <p className={styles.emptySub}>Ask me anything to get started.</p>
  </div>
);

export default MessageList;