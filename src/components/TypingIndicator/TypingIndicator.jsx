import styles from './TypingIndicator.module.css';

const TypingIndicator = () => (
  <div className={styles.wrapper} role="status" aria-label="AI is thinking">
    <div className={styles.avatar} aria-hidden="true">
      <BotIcon />
    </div>
    <div className={styles.bubble}>
      <div className={styles.dotsRow}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </div>
      <span className={styles.thinkingText}>AI is thinking…</span>
    </div>
  </div>
);

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

export default TypingIndicator;