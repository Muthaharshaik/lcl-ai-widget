import { useRef, useCallback }   from 'react';
import FilePreview               from '../FilePreview/FilePreview';
import { useFileUpload }         from '../../hooks/useFileUpload';
import styles                    from './ChatInput.module.css';

const MAX_TEXTAREA_HEIGHT = 180; // px

const ChatInput = ({
  onSend,
  onCancel,
  isLoading,
  disabled,
  placeholder,
  allowFileUpload,
  acceptedFileTypes,
  maxFileSizeMB,
}) => {
  const textareaRef  = useRef(null);
  const fileInputRef = useRef(null);

  const {
    stagedFiles, fileErrors,
    addFiles, removeFile, clearFiles, clearErrors,
  } = useFileUpload({ acceptedFileTypes, maxFileSizeMB });

  // ── Auto-resize textarea ───────────────────────────────────────────────────
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, []);

  // ── Send ──────────────────────────────────────────────────────────────────
  const doSend = useCallback(() => {
    const text = textareaRef.current?.value?.trim() ?? '';
    if ((!text && stagedFiles.length === 0) || isLoading || disabled) return;

    onSend({ text, files: stagedFiles });

    // Reset textarea
    if (textareaRef.current) {
      textareaRef.current.value  = '';
      textareaRef.current.style.height = 'auto';
    }
    clearFiles();
  }, [onSend, stagedFiles, isLoading, disabled, clearFiles]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  }, [doSend]);

  // ── File handling ─────────────────────────────────────────────────────────
  const handleFileChange = useCallback((e) => {
    if (e.target.files?.length) {
      addFiles(e.target.files);
      e.target.value = ''; // reset so same file can be selected again
    }
  }, [addFiles]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const isDisabled = disabled || isLoading;
  const sendLabel  = isLoading ? 'Waiting for response…' : placeholder;

  return (
    <div
      className={`${styles.area} ${isDisabled ? styles.areaDisabled : ''}`}
      onDrop={allowFileUpload ? handleDrop : undefined}
      onDragOver={allowFileUpload ? (e) => e.preventDefault() : undefined}
    >
      {/* File validation errors */}
      {fileErrors.length > 0 && (
        <div className={styles.errors} role="alert">
          {fileErrors.map((err, i) => (
            <span key={i} className={styles.errorMsg}>⚠ {err}</span>
          ))}
          <button className={styles.dismissBtn} onClick={clearErrors} type="button"
            aria-label="Dismiss file errors">×</button>
        </div>
      )}

      {/* Staged file chips */}
      {stagedFiles.length > 0 && (
        <div className={styles.stagedFiles}>
          <FilePreview files={stagedFiles} onRemove={removeFile} />
        </div>
      )}

      {/* Input row */}
      <div className={styles.row}>
        {/* Attach button */}
        {allowFileUpload && (
          <>
            <button
              className={styles.attachBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={isDisabled}
              title="Attach file"
              aria-label="Attach file"
              type="button"
            >
              <AttachIcon />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={acceptedFileTypes}
              onChange={handleFileChange}
              className={styles.hiddenInput}
              aria-hidden="true"
              tabIndex={-1}
            />
          </>
        )}

        {/* Message textarea */}
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder={sendLabel}
          disabled={isDisabled}
          onInput={autoResize}
          onKeyDown={handleKeyDown}
          rows={1}
          aria-label="Chat message input"
          aria-multiline="true"
          aria-disabled={isDisabled}
        />

        {/* Send or Cancel */}
        {isLoading ? (
          <button
            className={`${styles.sendBtn} ${styles.cancelBtn}`}
            onClick={onCancel}
            title="Stop generation"
            aria-label="Cancel response"
            type="button"
          >
            <StopIcon />
          </button>
        ) : (
          <button
            className={styles.sendBtn}
            onClick={doSend}
            disabled={isDisabled}
            title="Send message (Enter)"
            aria-label="Send message"
            type="button"
          >
            <SendIcon />
          </button>
        )}
      </div>

      {/* Keyboard hint */}
      <p className={styles.hint} aria-hidden="true">
        <kbd>Enter</kbd> send · <kbd>Shift+Enter</kbd> new line
        {allowFileUpload && ' · drag & drop to attach'}
      </p>
    </div>
  );
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const StopIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

const AttachIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

export default ChatInput;