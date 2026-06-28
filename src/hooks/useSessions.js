import { useState, useCallback, useRef, useEffect } from 'react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MAX_TITLE_LEN = 42;

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function makeSession() {
  return {
    id:        uuid(),
    title:     'New Chat',
    messages:  [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function titleFromMessage(text) {
  if (!text?.trim()) return 'New Chat';
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.length > MAX_TITLE_LEN
    ? clean.slice(0, MAX_TITLE_LEN) + '…'
    : clean;
}

function serializeMessage(m) {
  return {
    id:       m.id,
    role:     m.role,
    content:  typeof m.content === 'string' ? m.content : '',
    status:   m.status,
    timestamp: m.timestamp, 
    artifact: m.artifact
      ? {
          type:     m.artifact.type,
          title:    m.artifact.title,
          code:     m.artifact.code,
          language: m.artifact.language,
        }
      : null,
    files: Array.isArray(m.files)
      ? m.files
          .filter(f => f?.s3Key)  // only save S3 refs, not raw File objects
          .map(f => ({
            s3Key:    f.s3Key,
            fileName: f.fileName,
            mimeType: f.mimeType,
          }))
      : [],
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useSessions({ chatHistoryJson, onHistoryChange, showSidebar }) {
  const [sessions,          setSessions]          = useState([]);
  const [currentSessionId,  setCurrentSessionId]  = useState(null);
  const [isLoaded,          setIsLoaded]           = useState(false);
  const saveTimer = useRef(null);

  // ── Load from Mendix on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (!showSidebar) {
      // Sidebar disabled — single session, no persistence
      const s = makeSession();
      setSessions([s]);
      setCurrentSessionId(s.id);
      setIsLoaded(true);
      return;
    }

    let list = [];
    let currId = null;

    if (chatHistoryJson?.value) {
      try {
        const parsed = JSON.parse(chatHistoryJson.value);
        list   = Array.isArray(parsed.sessions) ? parsed.sessions : [];
        currId = parsed.currentSessionId || null;
      } catch { /* invalid JSON — start fresh */ }
    }

    if (list.length === 0) {
      const s = makeSession();
      list   = [s];
      currId = s.id;
    }

    setSessions(list);
    setCurrentSessionId(currId || list[0].id);
    setIsLoaded(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // ── Persist to Mendix (debounced 600 ms) ─────────────────────────────────
  const persist = useCallback((newSessions, newCurrentId) => {
    if (!showSidebar || !chatHistoryJson?.setValue) return;

    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        chatHistoryJson.setValue(
          JSON.stringify({ sessions: newSessions, currentSessionId: newCurrentId })
        );
        onHistoryChange?.execute();
      } catch (e) {
        console.warn('[AILCL] Failed to save sessions:', e);
      }
    }, 600);
  }, [showSidebar, chatHistoryJson, onHistoryChange]);

  // ── Derived current session ───────────────────────────────────────────────
  const currentSession = sessions.find(s => s.id === currentSessionId) ?? sessions[0] ?? null;

  // ── New chat ──────────────────────────────────────────────────────────────
  const newSession = useCallback(() => {
    const s = makeSession();
    setSessions(prev => {
      const next = [s, ...prev];
      persist(next, s.id);
      return next;
    });
    setCurrentSessionId(s.id);
    return s;
  }, [persist]);

  // ── Switch session ────────────────────────────────────────────────────────
  const selectSession = useCallback((id) => {
    setCurrentSessionId(id);
    persist(sessions, id);
  }, [sessions, persist]);

  // ── Update messages for a session (called from ChatContainer on change) ───
  const updateSessionMessages = useCallback((sessionId, messages) => {
    setSessions(prev => {
      const next = prev.map(s => {
        if (s.id !== sessionId) return s;

        // Auto-title from first user message
        let title = s.title;
        if (title === 'New Chat' || !title) {
          const firstUser = messages.find(m => m.role === 'user');
          if (firstUser) title = titleFromMessage(
            typeof firstUser.content === 'string' ? firstUser.content : ''
          );
        }

        return {
          ...s,
          title,
          messages:  messages.map(serializeMessage),
          updatedAt: new Date().toISOString(),
        };
      });

      persist(next, sessionId);
      return next;
    });
  }, [persist]);

  // ── Delete session ────────────────────────────────────────────────────────
  const deleteSession = useCallback((id) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);

      if (next.length === 0) {
        const fresh = makeSession();
        setCurrentSessionId(fresh.id);
        persist([fresh], fresh.id);
        return [fresh];
      }

      const newCurr = id === currentSessionId ? next[0].id : currentSessionId;
      setCurrentSessionId(newCurr);
      persist(next, newCurr);
      return next;
    });
  }, [currentSessionId, persist]);

  // ── Rename session ────────────────────────────────────────────────────────
  const renameSession = useCallback((id, newTitle) => {
    setSessions(prev => {
      const next = prev.map(s => s.id === id ? { ...s, title: newTitle.trim() || 'New Chat' } : s);
      persist(next, currentSessionId);
      return next;
    });
  }, [currentSessionId, persist]);

  return {
    sessions,
    currentSession,
    currentSessionId,
    isLoaded,
    newSession,
    selectSession,
    updateSessionMessages,
    deleteSession,
    renameSession,
  };
}