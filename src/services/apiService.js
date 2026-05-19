import { API_TIMEOUT_MS, MAX_RETRY_ATTEMPTS, RETRY_BASE_DELAY_MS } from '../constants';

// ─── Custom error class ───────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name   = 'ApiError';
    this.status = status;
    this.body   = body;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const mergeSignals = (signals) => {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal?.aborted) { controller.abort(); break; }
    signal?.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
};

const debugLog = (label, value) => {
  if (process.env.NODE_ENV !== 'production') {
    console.debug(`[AILCL] ${label}`, value);
  }
};

// ─── Content coercion ─────────────────────────────────────────────────────────
const contentToString = (content) => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === 'string')          return block;
        if (typeof block?.text    === 'string') return block.text;
        if (typeof block?.content === 'string') return block.content;
        return '';
      })
      .filter(Boolean)
      .join('');
  }
  if (content && typeof content === 'object') {
    for (const key of ['text', 'content', 'response', 'message', 'answer']) {
      if (typeof content[key] === 'string') return content[key];
    }
    return JSON.stringify(content);
  }
  return String(content ?? '');
};

// ─── History builder ──────────────────────────────────────────────────────────
const buildApiHistory = (messages) =>
  messages
    .filter((m) => m.status !== 'error')
    .map((m) => ({
      role:    m.role,
      content: [{ type: 'text', text: contentToString(m.content) }],
    }));

// ─── File utilities ───────────────────────────────────────────────────────────
const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });

/**
 * Converts File[] into a simple attachments array.
 * Your Lambda receives this and converts to Bedrock format internally.
 */
const buildAttachments = async (files) =>
  Promise.all(
    files.map(async (file) => ({
      name:     file.name,
      type:     file.type,
      size:     file.size,
      data:     await fileToBase64(file),
    }))
  );

// ─── Deduplication ────────────────────────────────────────────────────────────
/**
 * Detects if a string is exactly doubled and returns the single copy.
 * Handles: "abcabc" → "abc", "abc abc" → "abc", "abc\nabc" → "abc"
 *
 * This fixes Lambdas that send the full response twice in the SSE stream.
 */
const deduplicateResponse = (str) => {
  if (!str || str.length < 10) return str;

  // Check exact double (no separator): "abcabc"
  const half = str.length / 2;
  if (Number.isInteger(half) && str.slice(0, half) === str.slice(half)) {
    debugLog('Deduplicated exact-double response');
    return str.slice(0, half);
  }

  // Check with common separators: "abc abc", "abc\nabc", "abc\n\nabc"
  for (const sep of ['\n\n', '\n', ' ']) {
    const idx = str.indexOf(sep);
    if (idx > 0) {
      const first  = str.slice(0, idx);
      const second = str.slice(idx + sep.length);
      if (first === second && first.length > 20) {
        debugLog(`Deduplicated response split by "${sep.replace(/\n/g, '\\n')}"`);
        return first;
      }
    }
  }

  return str;
};

// ─── SSE parser ───────────────────────────────────────────────────────────────
const extractFirstString = (obj, depth = 0) => {
  if (depth > 6) return null;
  if (typeof obj === 'string' && obj.trim()) return obj;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = extractFirstString(item, depth + 1);
      if (found !== null) return found;
    }
  }
  if (obj && typeof obj === 'object') {
    const priority = [
      'response', 'content', 'text', 'token', 'answer',
      'message', 'output', 'result', 'reply', 'completion',
    ];
    for (const key of priority) {
      const val = obj[key];
      if (typeof val === 'string' && val.trim()) return val;
      if (Array.isArray(val)) {
        const found = extractFirstString(val, depth + 1);
        if (found !== null) return found;
      }
    }
    for (const val of Object.values(obj)) {
      const found = extractFirstString(val, depth + 1);
      if (found !== null) return found;
    }
  }
  return null;
};

const parseSSEText = (rawText) => {
  debugLog('Raw SSE body:', rawText);

  const lines      = rawText.split('\n');
  let fullContent  = '';

  /**
   * KEY FIX: Track every raw data: payload string we've already processed.
   * If the Lambda sends the same data: line twice, the second is silently skipped.
   */
  const seenPayloads = new Set();

  for (const line of lines) {
    const trimmed = line.trim();

    // Only process data: lines
    if (!trimmed.startsWith('data:')) continue;

    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;

    // ── DEDUP: skip if we've already processed this exact payload ────────────
    if (seenPayloads.has(payload)) {
      debugLog('SSE duplicate data: line skipped:', payload.slice(0, 60));
      continue;
    }
    seenPayloads.add(payload);

    try {
      const chunk = JSON.parse(payload);
      debugLog('SSE chunk:', chunk);

      // Named string fields
      const named =
        chunk?.response  ??
        chunk?.content   ??
        chunk?.text      ??
        chunk?.token     ??
        chunk?.answer    ??
        chunk?.message   ??
        chunk?.output    ??
        chunk?.result    ??
        chunk?.reply     ??
        chunk?.completion;

      if (typeof named === 'string') { fullContent += named; continue; }

      // Anthropic content array
      if (Array.isArray(chunk?.content)) {
        const str = contentToString(chunk.content);
        if (str) { fullContent += str; continue; }
      }

      // OpenAI chat delta
      const delta = chunk?.choices?.[0]?.delta?.content;
      if (typeof delta === 'string') { fullContent += delta; continue; }

      // OpenAI completions
      const choiceText = chunk?.choices?.[0]?.text;
      if (typeof choiceText === 'string') { fullContent += choiceText; continue; }

      // Anthropic streaming delta
      const anthropicDelta = chunk?.delta?.text ?? chunk?.delta?.content;
      if (typeof anthropicDelta === 'string') { fullContent += anthropicDelta; continue; }

      // Catch-all
      const fallback = extractFirstString(chunk);
      if (fallback !== null) {
        debugLog('SSE catch-all:', fallback);
        fullContent += fallback;
        continue;
      }

      debugLog('SSE chunk had no extractable string:', chunk);

    } catch {
      debugLog('SSE non-JSON data line (raw text):', payload);
      fullContent += payload;
    }
  }

  const finalContent = deduplicateResponse(fullContent.trim());

  if (finalContent) {
    return { response: finalContent };
  }

  throw new ApiError(
    'Received a streaming response but could not extract content. ' +
    'Check DevTools Console for "[AILCL] Raw SSE body" to inspect your API format.',
    0,
    rawText.slice(0, 500)
  );
};

// ─── JSON shape normaliser ────────────────────────────────────────────────────
const normaliseShape = (data) => {
  if (typeof data === 'string' && data.trim()) {
    return { response: deduplicateResponse(data) };
  }

  for (const key of ['response', 'message', 'answer', 'result', 'text']) {
    if (typeof data?.[key] === 'string' && data[key].trim()) {
      return { response: deduplicateResponse(data[key]) };
    }
  }

  if (data?.content !== undefined && data.content !== null) {
    const str = contentToString(data.content);
    if (str.trim()) return { response: deduplicateResponse(str) };
  }

  const oaiContent = data?.choices?.[0]?.message?.content;
  if (typeof oaiContent === 'string' && oaiContent.trim()) {
    return { response: deduplicateResponse(oaiContent) };
  }

  const fallback = extractFirstString(data);
  if (fallback !== null) return { response: deduplicateResponse(fallback) };

  throw new ApiError(
    'Could not extract a text response from the API reply.',
    0,
    JSON.stringify(data).slice(0, 300)
  );
};

// ─── Response format detector ─────────────────────────────────────────────────
const parseApiResponse = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  const text        = await response.text();

  debugLog('Content-Type:', contentType);
  debugLog('Response preview:', text.slice(0, 300));

  if (contentType.includes('application/json')) {
    try   { return normaliseShape(JSON.parse(text)); }
    catch { /* fall through */ }
  }

  if (contentType.includes('text/event-stream') || text.trimStart().startsWith('data:')) {
    return parseSSEText(text);
  }

  try   { return normaliseShape(JSON.parse(text)); }
  catch {
    try   { return parseSSEText(text); }
    catch {
      throw new ApiError(
        `Could not parse API response. Preview: ${text.slice(0, 200)}`,
        response.status,
        text
      );
    }
  }
};

// ─── Public API ───────────────────────────────────────────────────────────────
export const sendChatMessage = async ({
  apiUrl,
  message,
  history = [],
  files   = [],
  signal,
}) => {
  if (!apiUrl) {
    throw new Error('AILCL Widget: apiUrl property is not configured.');
  }

  const payload = {
    message,
    history: buildApiHistory(history),
  };

  /**
   * FILE UPLOAD — sent as a simple attachments[] array.
   *
   * Your Lambda receives this and is responsible for converting it to
   * Bedrock content blocks before calling the model. This matches the
   * original Lambda API contract.
   *
   * Each attachment: { name, type, size, data (base64 string) }
   */
  if (files.length > 0) {
    payload.attachments = await buildAttachments(files);

    debugLog('Attachments being sent:', payload.attachments.map((a) => ({
      name: a.name,
      type: a.type,
      size: a.size,
      dataLen: a.data?.length,
    })));
  }

  debugLog('Payload summary:', {
    message:        payload.message,
    historyLen:     payload.history.length,
    attachmentCount: payload.attachments?.length ?? 0,
  });

  let lastError;

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), API_TIMEOUT_MS);

    try {
      const combinedSignal = mergeSignals([signal, timeoutController.signal]);

      const response = await fetch(apiUrl, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept':       'application/json, text/event-stream',
        },
        body:   JSON.stringify(payload),
        signal: combinedSignal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new ApiError(
          `API error ${response.status}: ${response.statusText}`,
          response.status,
          errorBody
        );
      }

      return await parseApiResponse(response);

    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') throw err;
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) throw err;
      lastError = err;
      if (attempt < MAX_RETRY_ATTEMPTS - 1) {
        await delay(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
      }
    }
  }

  throw lastError;
};