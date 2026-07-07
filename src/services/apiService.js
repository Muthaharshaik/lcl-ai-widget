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

const delay    = (ms) => new Promise((res) => setTimeout(res, ms));
const debugLog = (label, value) => {
  if (process.env.NODE_ENV !== 'production') {
    console.debug(`[AILCL] ${label}`, value);
  }
};

const mergeSignals = (signals) => {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal?.aborted) { controller.abort(); break; }
    signal?.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
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
// When an assistant message has an artifact, we re-attach the code (with its
// original markers) so the Lambda can see and modify it on follow-up requests.
// Without this, asking "add more slides" loses all context of the previous PPT.
const ARTIFACT_MARKERS = {
  pptx:     (code, title) =>
    `[EXISTING PRESENTATION — MODIFY THIS CODE, do not generate a new one]\n` +
    `%%PPT_CODE_START%%\n${code}\n%%PPT_CODE_END%%`,
  docx:     (code, title) =>
    `[EXISTING WORD DOCUMENT — MODIFY THIS CODE, do not generate a new one]\n` +
    `%%DOCX_CODE_START%%\n${code}\n%%DOCX_CODE_END%%`,
  document: (code, title) =>
    `[EXISTING HTML DOCUMENT — MODIFY THIS CODE, do not generate a new one]\n` +
    `%%DOC_START%%\n${code}\n%%DOC_END%%`,
  html:     (code, title) =>
    `[EXISTING CODE ARTIFACT — MODIFY THIS CODE, do not generate a new one]\n` +
    `%%ARTIFACT_START%%\n${JSON.stringify({ type: 'html', title: title || 'Artifact' })}\n${code}\n%%ARTIFACT_END%%`,
};

const buildApiHistory = (messages) =>
  messages
    .filter((m) => m.status !== 'error')
    .map((m) => {
      let text = contentToString(m.content);

      // Re-attach artifact code for assistant messages so the Lambda
      // can reference and modify previously generated artifacts
      if (m.role === 'assistant' && m.artifact?.code) {
        const type    = m.artifact.type || 'html';
        const marker  = ARTIFACT_MARKERS[type] || ARTIFACT_MARKERS.html;
        const block   = marker(m.artifact.code, m.artifact.title);
        text = text ? `${text}\n\n${block}` : block;
      }

      return {
        role:    m.role,
        content: [{ type: 'text', text }],
      };
    })
    .filter((m) => m.content[0]?.text?.trim().length > 0); // ← ADD THIS LINE

// ─── AWS SigV4 helpers ────────────────────────────────────────────────────────
async function sha256hex(message) {
  const msgBuffer  = typeof message === 'string' ? new TextEncoder().encode(message) : message;
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(keyData, message) {
  const keyMaterial = typeof keyData === 'string' ? new TextEncoder().encode(keyData) : keyData;
  const key = await crypto.subtle.importKey('raw', keyMaterial, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const msgBuffer = typeof message === 'string' ? new TextEncoder().encode(message) : message;
  return crypto.subtle.sign('HMAC', key, msgBuffer);
}

async function getSigningKey(secretKey, dateStamp, region, service) {
  const kDate    = await hmacSha256('AWS4' + secretKey, dateStamp);
  const kRegion  = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

async function hmacSha256hex(keyData, message) {
  const sig = await hmacSha256(keyData, message);
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function sanitizeFileName(fileName) {
  // ← ADD THESE TWO LINES: decode %20, %2D etc. before anything else
  try { fileName = decodeURIComponent(fileName); }
  catch { /* malformed encoding — proceed with original */ }

  const lastDot = fileName.lastIndexOf('.');
  const ext     = lastDot > 0 ? fileName.slice(lastDot).toLowerCase() : '';
  let baseName  = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;

  baseName = baseName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[._]+/g, '-')
    .replace(/[^a-zA-Z0-9\-\[\]() ]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .trim()
    .replace(/^[-\s]+|[-\s]+$/g, '');

  if (!baseName) baseName = 'file';   // ← guard against fully-nuked names

  return baseName + ext;
}

function sigV4EncodeUri(s3Key) {
  return s3Key.split('/').map(segment =>
    encodeURIComponent(segment)
      .replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
  ).join('/');
}

async function uploadFileToS3(file, s3Config) {
  const { bucket, region, keyPrefix, accessKey, secretKey } = s3Config;
  if (!bucket || !accessKey || !secretKey) {
    throw new ApiError('S3 not configured — set s3Bucket, awsAccessKey, awsSecretKey in widget properties', 0, '');
  }

  const safeFileName = sanitizeFileName(file.name);
  const s3Key        = `${keyPrefix || 'attachements-input'}/${Date.now()}_${safeFileName}`;
  const host         = `${bucket}.s3.${region}.amazonaws.com`;
  const url          = `https://${host}/${s3Key}`;

  const now         = new Date();
  const amzDate     = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateStamp   = amzDate.slice(0, 8);
  const fileBuffer  = await file.arrayBuffer();
  const payloadHash = await sha256hex(fileBuffer);

  const canonicalUri     = '/' + sigV4EncodeUri(s3Key);
  const canonicalHeaders =
    `content-type:${file.type}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders    = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = ['PUT', canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const credentialScope  = `${dateStamp}/${region}/s3/aws4_request`;
  const canonicalReqHash = await sha256hex(canonicalRequest);
  const stringToSign     = ['AWS4-HMAC-SHA256', amzDate, credentialScope, canonicalReqHash].join('\n');
  const signingKey       = await getSigningKey(secretKey, dateStamp, region, 's3');
  const signature        = await hmacSha256hex(signingKey, stringToSign);
  const authorization    =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type',          file.type);
    xhr.setRequestHeader('x-amz-date',            amzDate);
    xhr.setRequestHeader('x-amz-content-sha256',  payloadHash);
    xhr.setRequestHeader('Authorization',         authorization);
    xhr.onload  = () =>
      (xhr.status >= 200 && xhr.status < 300)
        ? resolve()
        : reject(new ApiError(`S3 upload failed: ${xhr.status}`, xhr.status, xhr.responseText));
    xhr.onerror = () => reject(new ApiError('S3 upload — network error', 0, ''));
    xhr.send(fileBuffer);
  });

  debugLog('S3 upload success:', s3Key);
  return { s3Key, safeFileName };
}

async function uploadAllFilesToS3(files, s3Config) {
  const attachments = [];
  for (const file of files) {
    const { s3Key, safeFileName } = await uploadFileToS3(file, s3Config);

    // ← derive safeFileName here the same way uploadFileToS3 does
    attachments.push({
      s3Key,
      fileName:     safeFileName,   // ← Bedrock gets the clean name
      originalName: file.name,      // ← UI shows what the user picked
      mimeType:     file.type,
    });
  }
  return attachments;
}

// ─── Artifact stream parser ───────────────────────────────────────────────────
class ArtifactStreamParser {
  constructor({ onChatToken, onArtifactStart, onArtifactCode, onArtifactDone }) {
    this.onChatToken     = onChatToken     || (() => {});
    this.onArtifactStart = onArtifactStart || (() => {});
    this.onArtifactCode  = onArtifactCode  || (() => {});
    this.onArtifactDone  = onArtifactDone  || (() => {});

    this.buf          = '';
    this.inArtifact   = false;
    this.artifactCode = '';
    this.artifactMeta = null;
    this.started      = false;
    this.markerType   = null;
  }

  push(text) {
    this.buf += text;
    this._process();
  }

  // ── Called when stream ends — finalise any open artifact ─────────────────
  flush() {
    if (this.inArtifact && this.artifactCode) {
      // Stream ended without %%ARTIFACT_END%% — finalise what we have
      if (!this.started) {
        this.onArtifactStart(this.artifactMeta?.title || 'Artifact');
      }
      this.onArtifactDone({
        type:     this.artifactMeta?.type     || 'html',
        title:    this.artifactMeta?.title    || 'Artifact',
        code:     this.artifactCode.trim(),
        language: this.artifactMeta?.type     || 'html',
      });
      this.inArtifact = false;
    } else if (this.buf.trim()) {
      // Any leftover chat text
      this.onChatToken(this.buf);
      this.buf = '';
    }
  }

  _process() {
    const MARKERS = {
      artifact: { start: '%%ARTIFACT_START%%',  end: '%%ARTIFACT_END%%',   hasMeta: true                                      },
      docx:     { start: '%%DOCX_CODE_START%%',  end: '%%DOCX_CODE_END%%', hasMeta: false, title: 'Word Document', type: 'docx'     },
      ppt:      { start: '%%PPT_CODE_START%%',   end: '%%PPT_CODE_END%%',  hasMeta: false, title: 'Presentation',  type: 'pptx'     },
      doc:      { start: '%%DOC_START%%',         end: '%%DOC_END%%',       hasMeta: false, title: 'HTML Document', type: 'document' },
    };

    // ── Not inside an artifact yet — scan for a start marker ─────────────────
    if (!this.inArtifact) {
      let earliest  = -1;
      let foundType = null;

      for (const [type, m] of Object.entries(MARKERS)) {
        const idx = this.buf.indexOf(m.start);
        if (idx !== -1 && (earliest === -1 || idx < earliest)) {
          earliest  = idx;
          foundType = type;
        }
      }

      if (earliest === -1) {
        // No marker found — but tail of buffer might be a partial marker, hold it back
        let safeEnd = this.buf.length;
        for (const m of Object.values(MARKERS)) {
          for (let i = m.start.length - 1; i > 0; i--) {
            if (this.buf.endsWith(m.start.slice(0, i))) {
              safeEnd = Math.min(safeEnd, this.buf.length - i);
              break;
            }
          }
        }
        if (safeEnd > 0) {
          this.onChatToken(this.buf.slice(0, safeEnd));
          this.buf = this.buf.slice(safeEnd);
        }
        return;
      }

      // Send any chat text that appears before the marker
      if (earliest > 0) this.onChatToken(this.buf.slice(0, earliest));

      const marker      = MARKERS[foundType];
      this.markerType   = foundType;
      const afterMarker = this.buf.slice(earliest + marker.start.length);

      if (marker.hasMeta) {
        // ── Lambda format:
        //   %%ARTIFACT_START%%
        //   {"type":"html","title":"Modern Calculator"}
        //   <!DOCTYPE html>...
        //   %%ARTIFACT_END%%
        //
        // afterMarker begins with '\n' THEN the JSON line THEN '\n' THEN code.
        // We MUST skip the leading newline first, otherwise we'd parse an empty
        // string as the meta and include the JSON line in the artifact code.

        const withoutLeadingNl = afterMarker.startsWith('\n')
          ? afterMarker.slice(1)
          : afterMarker;

        const nl = withoutLeadingNl.indexOf('\n');
        if (nl === -1) {
          // Meta line not yet complete — wait for more data
          this.buf = this.buf.slice(earliest);
          return;
        }

        const metaStr = withoutLeadingNl.slice(0, nl).trim();
        try   { this.artifactMeta = JSON.parse(metaStr); }
        catch { this.artifactMeta = { type: 'html', title: 'Artifact' }; }

        this.inArtifact   = true;
        this.artifactCode = '';
        this.started      = false;
        // Everything after the meta line is the actual code
        this.buf = withoutLeadingNl.slice(nl + 1);

      } else {
        // Non-meta markers (docx, ppt, doc) — code starts immediately
        this.artifactMeta = { type: marker.type, title: marker.title };
        this.inArtifact   = true;
        this.artifactCode = '';
        this.started      = false;
        this.buf          = afterMarker;
      }

      this._process(); // Continue processing whatever is left in buf
      return;
    }

    // ── Already inside an artifact — scan for the end marker ─────────────────
    const endMarker = MARKERS[this.markerType]?.end || '%%ARTIFACT_END%%';
    const ei        = this.buf.indexOf(endMarker);

    if (ei === -1) {
      // Still streaming — accumulate and emit progress
      this.artifactCode += this.buf;
      if (!this.started) {
        this.started = true;
        this.onArtifactStart(this.artifactMeta?.title || 'Artifact');
      }
      this.onArtifactCode(this.artifactCode);
      this.buf = '';
      return;
    }

    // End marker found — finalise artifact
    this.artifactCode += this.buf.slice(0, ei);
    if (!this.started) {
      this.started = true;
      this.onArtifactStart(this.artifactMeta?.title || 'Artifact');
    }
    this.onArtifactCode(this.artifactCode);
    this.onArtifactDone({
      type:     this.artifactMeta?.type     || 'html',
      title:    this.artifactMeta?.title    || 'Artifact',
      code:     this.artifactCode.trim(),
      language: this.artifactMeta?.type     || 'html',
    });

    this.inArtifact = false;
    this.markerType = null;
    this.buf        = this.buf.slice(ei + endMarker.length);
    if (this.buf) this._process(); // Process anything after the end marker
  }
}

// ─── Main streaming function ──────────────────────────────────────────────────
export const streamChatMessage = async ({
  apiUrl,
  s3Config = {},
  userEmail = '',
  message,
  history     = [],
  files       = [],
  commandType = null,
  signal,
  onToken,
  onArtifactStart,
  onArtifactChunk,
  onArtifactDone,
  onDone,
  onError,
}) => {
  if (!apiUrl) {
    onError?.(new Error('AILCL Widget: apiUrl not configured.'));
    return;
  }

  // Upload files to S3 first
  let s3Attachments = [];
  if (files.length > 0) {
    try {
      s3Attachments = await uploadAllFilesToS3(files, s3Config);
    } catch (err) {
      onError?.(new ApiError(`File upload failed: ${err.message}`, 0, ''));
      return;
    }
  }

  const payload = {
    message,
    history:     buildApiHistory(history),
    commandType: commandType || null,
    ...(userEmail && { userEmail: userEmail }),
    ...(s3Attachments.length > 0 && { attachments: s3Attachments }),
  };

  debugLog('Sending:', { message, historyLen: payload.history.length, commandType });
  console.info('Payload being sent:', JSON.stringify(payload));

  let response;
  try {
    response = await fetch(apiUrl, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'text/event-stream, application/json',
      },
      body:   JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') return;
    onError?.(err);
    return;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    onError?.(new ApiError(`API error ${response.status}`, response.status, body));
    return;
  }

  let artifactResult = null;
  let chatTextAccum  = '';

  const parser = new ArtifactStreamParser({
    onChatToken: (text) => {
      chatTextAccum += text;
      onToken?.(text);
    },
    onArtifactStart: (title) => {
      onArtifactStart?.(title);
    },
    onArtifactCode: (code) => {
      onArtifactChunk?.(code);
    },
    onArtifactDone: (artifact) => {
      artifactResult = artifact;
      onArtifactDone?.(artifact);
    },
  });

  const reader   = response.body.getReader();
  const decoder  = new TextDecoder();
  let   lineBuf  = '';
  let   fullMsg  = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      lineBuf += decoder.decode(value, { stream: true });
      const lines = lineBuf.split('\n');
      lineBuf     = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;

        const raw = trimmed.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;

        try {
          const chunk = JSON.parse(raw);

          if (chunk.token !== undefined) {
            fullMsg += chunk.token;
            parser.push(chunk.token);

          } else if (chunk.done === true) {
            // Lambda final event — flush parser first, then call onDone
            parser.flush();
            const finalMsg  = chunk.fullMessage || fullMsg;
            const cleanChat = extractChatText(finalMsg) || chatTextAccum.trim();

            // Re-extract artifact from the COMPLETE fullMessage (mirrors reference app).
            // The stream-based artifactResult may be incomplete for large responses
            // where the SSE stream was truncated before %%PPT_CODE_END%% arrived.
            // chunk.fullMessage always has the full Lambda response.
            const finalArtifact = extractArtifactFromMessage(finalMsg) || artifactResult;
            const metrics = chunk.metrics || null;

            onDone?.(cleanChat, finalArtifact, s3Attachments, metrics);
            return;

          } else if (chunk.error) {
            onError?.(new Error(chunk.error));
            return;
          }

        } catch {
          // Non-JSON SSE line — treat as raw text token
          fullMsg += raw;
          parser.push(raw);
        }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') onError?.(err);
    return;
  } finally {
    try { reader.releaseLock(); } catch {}
  }

  // Stream ended without a done event — flush and call onDone
  parser.flush();
  const cleanChat = extractChatText(fullMsg) || chatTextAccum.trim();
  onDone?.(cleanChat, artifactResult, s3Attachments, null);
};

// ─── Strip artifact markers from chat text ────────────────────────────────────
const ARTIFACT_STRIP_PATTERNS = [
  /%%ARTIFACT_START%%[\s\S]*?%%ARTIFACT_END%%/g,
  /%%DOCX_CODE_START%%[\s\S]*?%%DOCX_CODE_END%%/g,
  /%%PPT_CODE_START%%[\s\S]*?%%PPT_CODE_END%%/g,
  /%%DOC_START%%[\s\S]*?%%DOC_END%%/g,
];

export const extractChatText = (text) => {
  if (!text) return '';
  let result = text;
  for (const pattern of ARTIFACT_STRIP_PATTERNS) {
    result = result.replace(pattern, '');
  }
  return result.trim();
};

// ─── Extract final artifact from complete fullMessage ─────────────────────────
// Mirrors the reference app's onDone logic: use the COMPLETE message (not the
// incremental stream) to get the artifact code. This is critical for large
// presentations where the SSE stream may be truncated — chunk.fullMessage
// always contains the full response from the Lambda.
export const extractArtifactFromMessage = (fullMessage) => {
  if (!fullMessage) return null;

  // HTML artifact with JSON metadata header
  const artifactMatch = fullMessage.match(
    /%%ARTIFACT_START%%\n?({.*?})\n([\s\S]*?)%%ARTIFACT_END%%/
  );
  if (artifactMatch) {
    try {
      const meta = JSON.parse(artifactMatch[1]);
      return {
        type:     meta.type     || 'html',
        title:    meta.title    || 'Artifact',
        code:     artifactMatch[2].trim(),
        language: meta.type     || 'html',
      };
    } catch { /* fall through */ }
  }

  // DOCX
  if (fullMessage.includes('%%DOCX_CODE_START%%') && fullMessage.includes('%%DOCX_CODE_END%%')) {
    const m = fullMessage.match(/%%DOCX_CODE_START%%([\s\S]*?)%%DOCX_CODE_END%%/);
    if (m) return { type: 'docx', title: 'Word Document', code: m[1].trim(), language: 'docx' };
  }

  // PPT
  if (fullMessage.includes('%%PPT_CODE_START%%') && fullMessage.includes('%%PPT_CODE_END%%')) {
    const m = fullMessage.match(/%%PPT_CODE_START%%([\s\S]*?)%%PPT_CODE_END%%/);
    if (m) return { type: 'pptx', title: 'Presentation', code: m[1].trim(), language: 'pptx' };
  }

  // HTML document
  if (fullMessage.includes('%%DOC_START%%') && fullMessage.includes('%%DOC_END%%')) {
    const m = fullMessage.match(/%%DOC_START%%([\s\S]*?)%%DOC_END%%/);
    if (m) return { type: 'document', title: 'HTML Document', code: m[1].trim(), language: 'document' };
  }

  return null;
};