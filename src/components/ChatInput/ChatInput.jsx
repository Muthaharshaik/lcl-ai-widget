import { useState, useRef, useCallback } from 'react';
import FilePreview       from '../FilePreview/FilePreview';
import { useFileUpload } from '../../hooks/useFileUpload';
import styles            from './ChatInput.module.css';
import { useVoiceInput } from '../../hooks/useVoiceInput';

const MAX_TEXTAREA_HEIGHT = 180;

// ── Auto-detect commandType from message text ─────────────────────────────────
//
// PRIORITY ORDER — first match wins:
//   1. PPT  — explicit presentation keywords
//   2. Word — explicit document keywords
//   3. Doc  — HTML page/document keywords
//   4. Code — everything code-related (widest net, goes last so it doesn't
//              accidentally absorb PPT/Word/Doc requests)
//
// CODE detection covers:
//   • Creation:  "build a React component", "write a Python function"
//   • Operations: "fix/debug/refactor/review/optimise this code"
//   • Language mentions: JavaScript, TypeScript, Python, React, JSX…
//   • File-type mentions: .jsx, .tsx, .js, .ts, .py, .css, .html, .json…
//   • Pasted code signals: backtick blocks, import/export/const/function keywords
//   • Compound phrases: "my code", "this code", "the function", "this component"
// ─────────────────────────────────────────────────────────────────────────────
const COMMAND_DETECTORS = [
  // ── 1. PPT ──────────────────────────────────────────────────────────────────
  {
    pattern: /\b(powerpoint|presentation|slide\s*deck|pptx?|slides)\b/i,
    commandType: 'ppt',
  },
  // Modification follow-ups for PPT
  {
    pattern: /\b(fix|update|change|modify|add|remove|edit|correct|adjust)\b.{0,50}\b(slide|ppt|presentation|layout|alignment|kpi|dashboard)\b/i,
    commandType: 'ppt',
  },

  // ── 2. Word document ────────────────────────────────────────────────────────
  {
    pattern: /\b(word\s*doc(ument)?|docx?|\.docx|ms\s*word|word\s*file)\b/i,
    commandType: 'word',
  },

  // ── 3. HTML page / web document ─────────────────────────────────────────────
  {
    pattern: /\b(html\s*(page|document|file)|web\s*page|webpage|website)\b/i,
    commandType: 'doc',
  },

  // ── 4a. Code — explicit creation verbs + code nouns ─────────────────────────
  {
    pattern: /\b(build|create|make|write|generate|develop|implement|code)\b.{0,60}\b(app|tool|game|component|function|class|module|script|hook|api|endpoint|algorithm|snippet|program|feature|page|form|button|modal|navbar|sidebar|table|chart|graph|animation|effect|utility|helper|service|handler|middleware|schema|query|mutation|resolver|route|controller|model|interface|type)\b/i,
    commandType: 'code',
  },

  // ── 4b. Code — fix/debug/review/refactor operations ─────────────────────────
  {
    pattern: /\b(fix|debug|refactor|review|optimis[ez]|improve|clean\s*up|update|rewrite|convert|migrate|test|add\s*(a\s+)?(feature|functionality|support|test|types?|prop|method|handler|logic|validation|error\s*handling|loading|state|effect|hook|class|style))\b.{0,60}\b(code|function|component|class|script|hook|module|file|snippet|bug|error|issue|problem|test|type|prop|method|logic|style|import|export|variable|constant|array|object|interface|enum|decorator)\b/i,
    commandType: 'code',
  },

  // ── 4c. Code — "fix this / fix my / fix the" (short follow-ups) ─────────────
  {
    pattern: /\b(fix|debug|check|review|help\s+with|look\s+at|explain|understand|what('?s|\s+is)\s+wrong\s+with)\b.{0,30}\b(this|my|the|above|following)\b.{0,30}\b(code|function|component|class|script|hook|file|snippet|error|bug|issue)\b/i,
    commandType: 'code',
  },

  // ── 4d. Code — programming language / framework mentions ────────────────────
  {
    pattern: /\b(javascript|typescript|python|java|c#|c\+\+|rust|go\b|ruby|php|swift|kotlin|dart|scala|r\b|matlab|bash|shell|sql|graphql|react|vue|angular|svelte|next\.?js|nuxt|express|fastapi|django|flask|spring|node\.?js|deno|bun|tailwind|css|sass|scss|less|html5?|jsx|tsx|json|yaml|toml|xml)\b/i,
    commandType: 'code',
  },

  // ── 4e. Code — file extension mentions ──────────────────────────────────────
  {
    pattern: /\.(jsx?|tsx?|py|cs|cpp|java|rb|php|swift|kt|dart|go|rs|sh|bash|sql|graphql|html|css|scss|sass|less|json|yaml|yml|toml|env|config|test|spec)\b/i,
    commandType: 'code',
  },

  // ── 4f. Code — pasted code signals (backtick blocks, code-like keywords) ────
  //   Detects when the message itself contains actual code being pasted
  {
    pattern: /(`{1,3}[\s\S]*`{1,3}|^\s*(import|export|const|let|var|function|class|async|await|return|if\s*\(|for\s*\(|while\s*\(|switch\s*\(|=>|@|#include|def\s+\w|public\s+(class|void|static)|package\s+\w))/m,
    commandType: 'code',
  },

  // ── 4g. Code — "add X to my/the code/component" short follow-ups ────────────
  {
    pattern: /\b(add|remove|change|update|rename|move|replace|delete)\b.{0,40}\b(to|in|from|inside|the|my|this)\b.{0,40}\b(code|component|function|class|file|hook|module|page|form|button|style|type|interface|prop|state|variable|import|export|dependency|package)\b/i,
    commandType: 'code',
  },

  // ── 4h. Code — general "this code / my code / the code" references ───────────
  {
    pattern: /\b(this|my|the|above|following|given|provided)\b.{0,20}\b(code|component|function|class|script|hook|snippet|implementation|solution)\b/i,
    commandType: 'code',
  },
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

  const { isListening, startListening, stopListening } = useVoiceInput({
    onTranscript: (text) => setInputValue(text),
  })

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, []);


const handlePaste = useCallback((e) => {
    if (!allowFileUpload) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles = [];

    for (const item of items) {
        if (!item.type.startsWith("image/")) continue;

        const file = item.getAsFile();
        if (!file) continue;

        const extension = file.type.split("/")[1] || "png";

        const timestamp = new Date()
            .toISOString()
            .replace(/[:.]/g, "-");

        const renamedFile = new File(
            [file],
            `pasted-image-${timestamp}.${extension}`,
            {
                type: file.type,
                lastModified: Date.now()
            }
        );

        imageFiles.push(renamedFile);
    }

    if (imageFiles.length === 0) return;

    // Prevent the browser from inserting the image into the textarea.
    e.preventDefault();

    addFiles(imageFiles);

    // Keep focus in the textarea so the user can continue typing.
    textareaRef.current?.focus();
}, [allowFileUpload, addFiles]);

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
      className={`${styles.area} ${disabled ? styles.areaDisabled : ''}`}
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

        {/* Mic button */}
        <button
          className={`${styles.micBtn} ${isListening ? styles.micBtnActive : ''}`}
          onClick={isListening ? stopListening : startListening}
          title={isListening ? 'Stop recording' : 'Voice input'}
          type="button"
          disabled={isDisabled}
        >
          {isListening ? <MicOffIcon /> : <MicIcon />}
        </button>

        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); autoResize(); }}
          onKeyDown={handleKeyDown}
          onInput={autoResize}
          onPaste={handlePaste} 
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
const MicIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);
const MicOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor"
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="currentColor" strokeWidth="2"/>
    <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2"/>
    <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

export default ChatInput;