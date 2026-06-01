import { useState, useRef, useCallback } from 'react';
import FilePreview       from '../FilePreview/FilePreview';
import { useFileUpload } from '../../hooks/useFileUpload';
import styles            from './ChatInput.module.css';

const MAX_TEXTAREA_HEIGHT = 180;

// ── Auto-detect commandType from message text ─────────────────────────────────
// Slash commands are removed — users describe what they want naturally.
// These patterns map plain-language requests to the Lambda's commandType.
const COMMAND_DETECTORS = [
  { pattern: /\b(powerpoint|presentation|slide deck|pptx?|slides)\b/i,            commandType: 'ppt'  },
  { pattern: /\b(word document|docx?|\.docx|ms word|word file|word doc)\b/i,       commandType: 'word' },
  { pattern: /\b(html (page|document|file)|web page|webpage|website)\b/i,          commandType: 'doc'  },
  { pattern: /\b(build|create|make|write|generate)\s.*(app|tool|game|component|calculator|dashboard|widget|chart)\b/i, commandType: 'code' },
];

function detectCommandType(text) {
  for (const { pattern, commandType } of COMMAND_DETECTORS) {
    if (pattern.test(text)) return commandType;
  }
  return null;
}

const ChatInput = ({
  onSend, onCancel, isLoading, disabled,
  placeholder, allowFileUpload,
  acceptedFileTypes, maxFileSizeMB,
}) => {
  const [inputValue, setInputValue] = useState('');

  const textareaRef  = useRef(null);
  const fileInputRef = useRef(null);

  const {
    stagedFiles, fileErrors,
    addFiles, removeFile, clearFiles, clearErrors,
  } = useFileUpload({ acceptedFileTypes, maxFileSizeMB });

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, []);

  const doSend = useCallback(() => {
    const text = inputValue.trim();
    const hasContent = text.length > 0 || stagedFiles.length > 0;
    if (!hasContent || isLoading || disabled) return;

    const commandType = detectCommandType(text);
    onSend({ text, files: stagedFiles, commandType });

    setInputValue('');
    clearFiles();
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [inputValue, stagedFiles, isLoading, disabled, onSend, clearFiles]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
  }, [doSend]);

  const handleFileChange = useCallback((e) => {
    if (e.target.files?.length) { addFiles(e.target.files); e.target.value = ''; }
  }, [addFiles]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const isDisabled = disabled || isLoading;

  return (
    <div
      className={`${styles.area} ${isDisabled ? styles.areaDisabled : ''}`}
      onDrop={allowFileUpload ? handleDrop : undefined}
      onDragOver={allowFileUpload ? (e) => e.preventDefault() : undefined}
    >
      {fileErrors.length > 0 && (
        <div className={styles.errors} role="alert">
          {fileErrors.map((err, i) => <span key={i} className={styles.errorMsg}>⚠ {err}</span>)}
          <button className={styles.dismissBtn} onClick={clearErrors} type="button">×</button>
        </div>
      )}

      {stagedFiles.length > 0 && (
        <div className={styles.stagedFiles}>
          <FilePreview files={stagedFiles} onRemove={removeFile} />
        </div>
      )}

      <div className={styles.row}>
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
              style={{ display: 'none' }}
              aria-hidden="true"
              tabIndex={-1}
            />
          </>
        )}

        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); autoResize(); }}
          onKeyDown={handleKeyDown}
          onInput={autoResize}
          className={styles.textarea}
          placeholder={isLoading ? 'Waiting for response…' : placeholder}
          disabled={isDisabled}
          rows={1}
          aria-label="Chat message input"
          aria-multiline="true"
          aria-disabled={isDisabled}
        />

        {isLoading ? (
          <button
            className={`${styles.sendBtn} ${styles.cancelBtn}`}
            onClick={onCancel}
            title="Stop"
            aria-label="Cancel"
            type="button"
          >
            <StopIcon />
          </button>
        ) : (
          <button
            className={styles.sendBtn}
            onClick={doSend}
            disabled={isDisabled}
            title="Send (Enter)"
            aria-label="Send message"
            type="button"
          >
            <SendIcon />
          </button>
        )}
      </div>

      <p className={styles.hint} aria-hidden="true">
        <kbd>Enter</kbd> send · <kbd>Shift+Enter</kbd> new line
        {allowFileUpload && ' · drag & drop to attach'}
      </p>
    </div>
  );
};

const SendIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const StopIcon   = () => <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>;
const AttachIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>;

export default ChatInput;