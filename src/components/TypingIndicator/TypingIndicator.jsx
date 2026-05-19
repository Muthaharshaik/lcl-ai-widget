import styles from './TypingIndicator.module.css';

const TypingIndicator = () => (
  <div className={styles.wrapper} role="status" aria-label="AI is thinking">
    <div className={styles.avatar} aria-hidden="true">AI</div>
    <div className={styles.bubble}>
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
    </div>
  </div>
);

export default TypingIndicator;