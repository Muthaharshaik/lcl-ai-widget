import { memo }                                    from 'react';
import ReactMarkdown                               from 'react-markdown';
import remarkGfm                                   from 'remark-gfm';
import { Highlight, themes }                       from 'prism-react-renderer';
import CopyButton                                  from '../CopyButton/CopyButton';
import FilePreview                                 from '../FilePreview/FilePreview';
import { formatTimestamp, isUserMessage }          from '../../utils/messageUtils';
import { MESSAGE_STATUS }                          from '../../constants';
import { extractChatText }                         from '../../services/apiService';
import styles                                      from './MessageBubble.module.css';

const MessageBubble = memo(({ message, showCopyButton, allowMarkdown, onOpenArtifact }) => {
  const isUser  = isUserMessage(message);
  const isError = message.status === MESSAGE_STATUS.ERROR;

  // Artifact stored in message by useChat on FINISH_STREAM
  const artifact = message.artifact || null;

  // Strip artifact markers from display content
  const displayContent = artifact
    ? extractChatText(message.content)
    : message.content;

  return (
    <div
      className={[
        styles.wrapper,
        isUser  ? styles.userWrapper  : styles.assistantWrapper,
        isError ? styles.errorWrapper : '',
      ].join(' ')}
    >
      {!isUser && (
        <div className={styles.avatar} aria-hidden="true"><AiAvatar /></div>
      )}

      <div className={styles.group}>
        {message.files?.length > 0 && <FilePreview files={message.files} readOnly />}

        <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.aiBubble}`}>
          {allowMarkdown && !isUser ? (
            <MarkdownContent content={displayContent || ''} />
          ) : (
            <p className={styles.text}>{displayContent}</p>
          )}
        </div>

        {/* ── Artifact open button — always visible, prominent ─────────── */}
        {artifact && !isError && (
          <button
            className={styles.artifactBtn}
            onClick={() => {
              if (onOpenArtifact) {
                onOpenArtifact(artifact);
              }
            }}
            type="button"
            aria-label={`Open ${artifact.title || 'artifact'}`}
          >
            <EyeIcon />
            <span>Open {artifact.title || 'Artifact'}</span>
            <span className={styles.artifactLangBadge}>
              {artifact.language || artifact.type || 'html'}
            </span>
          </button>
        )}

        {isError && (
          <span className={styles.errorBadge}>⚠ Failed to send — check your connection</span>
        )}

        <div className={styles.meta}>
          <time className={styles.timestamp} dateTime={message.timestamp}>
            {formatTimestamp(message.timestamp)}
          </time>
          {showCopyButton && !isUser && !isError && (
            <CopyButton text={message.content} />
          )}
        </div>
      </div>

      {isUser && (
        <div className={styles.avatar} aria-hidden="true"><UserAvatar /></div>
      )}
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';

// ─── Markdown ─────────────────────────────────────────────────────────────────
const MarkdownContent = ({ content }) => (
  <div className={styles.markdown}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const code  = String(children).replace(/\n$/, '');

          if (!inline && match) {
            return (
              <div className={styles.codeBlock}>
                <div className={styles.codeHeader}>
                  <span className={styles.codeLang}>{match[1]}</span>
                  <CopyButton text={code} />
                </div>
                <Highlight theme={themes.oneDark} code={code} language={match[1]}>
                  {({ className: hlClass, style, tokens, getLineProps, getTokenProps }) => (
                    <pre className={hlClass} style={{ ...style, margin: 0, padding: '12px 14px', fontSize: 13, lineHeight: 1.6, borderRadius: '0 0 8px 8px', overflowX: 'auto', fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace' }}>
                      {tokens.map((line, i) => (
                        <div key={i} {...getLineProps({ line })}>
                          {line.map((token, key) => <span key={key} {...getTokenProps({ token })} />)}
                        </div>
                      ))}
                    </pre>
                  )}
                </Highlight>
              </div>
            );
          }

          if (!inline && !match) {
            return (
              <div className={styles.codeBlock}>
                <div className={styles.codeHeader}>
                  <span className={styles.codeLang}>code</span>
                  <CopyButton text={code} />
                </div>
                <pre style={{ margin: 0, padding: '12px 14px', fontSize: 13, lineHeight: 1.6, background: '#282c34', color: '#abb2bf', borderRadius: '0 0 8px 8px', overflowX: 'auto', fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace' }}>
                  {code}
                </pre>
              </div>
            );
          }

          return <code className={styles.inlineCode} {...props}>{children}</code>;
        },
        a({ href, children }) {
          return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);

// ─── Avatars + Icons ──────────────────────────────────────────────────────────
const AiAvatar = () => (
  <div className={styles.avatarAi} title="AI Assistant">
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
  </div>
);

const UserAvatar = () => <div className={styles.avatarUser}>U</div>;

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

export default MessageBubble;