// ─── API ─────────────────────────────────────────────────────────────────────
export const API_TIMEOUT_MS       = 30_000;   // 30 second hard timeout
export const MAX_RETRY_ATTEMPTS   = 3;
export const RETRY_BASE_DELAY_MS  = 800;       // doubles each attempt (exponential backoff)

// ─── Chat ─────────────────────────────────────────────────────────────────────
export const MAX_HISTORY_LENGTH   = 20;        // max messages sent as history to API

// ─── Message roles ────────────────────────────────────────────────────────────
export const MESSAGE_ROLES = Object.freeze({
  USER:      'user',
  ASSISTANT: 'assistant',
});

// ─── Message status ──────────────────────────────────────────────────────────
export const MESSAGE_STATUS = Object.freeze({
  SENT:  'sent',
  ERROR: 'error',
});

// ─── Theme ────────────────────────────────────────────────────────────────────
export const THEME = Object.freeze({
  LIGHT: 'light',
  DARK:  'dark',
  AUTO:  'auto',
});

// ─── File upload ─────────────────────────────────────────────────────────────
export const BYTES_IN_MB = 1_048_576;