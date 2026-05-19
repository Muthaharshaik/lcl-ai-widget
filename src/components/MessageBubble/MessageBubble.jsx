import { memo }           from 'react';
import ReactMarkdown      from 'react-markdown';
import remarkGfm          from 'remark-gfm';
import { Highlight, themes } from 'prism-react-renderer';
import CopyButton         from '../CopyButton/CopyButton';
import FilePreview        from '../FilePreview/FilePreview';
import { formatTimestamp, isUserMessage } from '../../utils/messageUtils';
import { MESSAGE_STATUS } from '../../constants';
import styles             from './MessageBubble.module.css';

const MessageBubble = memo(({ message, showCopyButton, allowMarkdown }) => {
  const isUser  = isUserMessage(message);
  const isError = message.status === MESSAGE_STATUS.ERROR;

  return (
    <div
      className={[
        styles.wrapper,
        isUser  ? styles.userWrapper      : styles.assistantWrapper,
        isError ? styles.errorWrapper     : '',
      ].join(' ')}
    >
      {/* AI avatar — left side */}
      {!isUser && (
        <div className={styles.avatar} aria-hidden="true">
          <AiAvatar />
        </div>
      )}

      <div className={styles.group}>
        {/* File attachments (shown above the text bubble) */}
        {message.files?.length > 0 && (
          <FilePreview files={message.files} readOnly />
        )}

        {/* Text bubble */}
        <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.aiBubble}`}>
          {allowMarkdown && !isUser ? (
            <MarkdownContent content={message.content} />
          ) : (
            <p className={styles.text}>{message.content}</p>
          )}
        </div>

        {/* Error badge */}
        {isError && (
          <span className={styles.errorBadge}>⚠ Failed to send — check your connection</span>
        )}

        {/* Meta row: timestamp + copy */}
        <div className={styles.meta}>
          <time className={styles.timestamp} dateTime={message.timestamp}>
            {formatTimestamp(message.timestamp)}
          </time>
          {showCopyButton && !isUser && !isError && (
            <CopyButton text={message.content} />
          )}
        </div>
      </div>

      {/* User avatar — right side */}
      {isUser && (
        <div className={styles.avatar} aria-hidden="true">
          <UserAvatar />
        </div>
      )}
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';

// ─── Markdown renderer ────────────────────────────────────────────────────────
const MarkdownContent = ({ content }) => (
  <div className={styles.markdown}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // ── Code blocks with syntax highlighting ──────────────────────────
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const code  = String(children).replace(/\n$/, '');

          // Fenced code block with a language tag  e.g. ```python
          if (!inline && match) {
            return (
              <div className={styles.codeBlock}>
                {/* Header: language label + copy button */}
                <div className={styles.codeHeader}>
                  <span className={styles.codeLang}>{match[1]}</span>
                  <CopyButton text={code} />
                </div>

                {/* Syntax-highlighted body */}
                <Highlight
                  theme={themes.oneDark}
                  code={code}
                  language={match[1]}
                >
                  {({ className: hlClass, style, tokens, getLineProps, getTokenProps }) => (
                    <pre
                      className={hlClass}
                      style={{
                        ...style,
                        margin:        0,
                        padding:       '12px 14px',
                        fontSize:      13,
                        lineHeight:    1.6,
                        borderRadius:  '0 0 8px 8px',
                        overflowX:     'auto',
                        fontFamily:    'JetBrains Mono, Fira Code, Consolas, monospace',
                      }}
                    >
                      {tokens.map((line, i) => (
                        <div key={i} {...getLineProps({ line })}>
                          {line.map((token, key) => (
                            <span key={key} {...getTokenProps({ token })} />
                          ))}
                        </div>
                      ))}
                    </pre>
                  )}
                </Highlight>
              </div>
            );
          }

          // Fenced block with NO language tag  e.g. ``` plain text ```
          if (!inline && !match) {
            return (
              <div className={styles.codeBlock}>
                <div className={styles.codeHeader}>
                  <span className={styles.codeLang}>code</span>
                  <CopyButton text={code} />
                </div>
                <pre
                  style={{
                    margin:       0,
                    padding:      '12px 14px',
                    fontSize:     13,
                    lineHeight:   1.6,
                    background:   '#282c34',
                    color:        '#abb2bf',
                    borderRadius: '0 0 8px 8px',
                    overflowX:    'auto',
                    fontFamily:   'JetBrains Mono, Fira Code, Consolas, monospace',
                  }}
                >
                  {code}
                </pre>
              </div>
            );
          }

          // Inline code  e.g. `variable`
          return (
            <code className={styles.inlineCode} {...props}>
              {children}
            </code>
          );
        },

        // ── Links open in a new tab safely ────────────────────────────────
        a({ href, children }) {
          return (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);

// ─── Avatars ──────────────────────────────────────────────────────────────────
const AiAvatar = () => (
  <div className={styles.avatarAi}>
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
    </svg>
  </div>
);

const UserAvatar = () => (
  <div className={styles.avatarUser}>U</div>
);

export default MessageBubble;