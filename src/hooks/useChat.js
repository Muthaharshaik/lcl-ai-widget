import { useReducer, useCallback, useRef } from 'react';
import { streamChatMessage, extractChatText } from '../services/apiService';
import { createMessage }                       from '../utils/messageUtils';
import { MESSAGE_ROLES, MESSAGE_STATUS, MAX_HISTORY_LENGTH } from '../constants';

// ─── Action types ─────────────────────────────────────────────────────────────
const A = {
  ADD_USER_MSG:    'ADD_USER_MSG',
  START_STREAM:    'START_STREAM',   // creates empty assistant message
  APPEND_TOKEN:    'APPEND_TOKEN',   // appends text to streaming message
  FINISH_STREAM:   'FINISH_STREAM',  // finalises with clean content + artifact ref
  SET_ERROR:       'SET_ERROR',
  CLEAR_ERROR:     'CLEAR_ERROR',
  CLEAR_CHAT:      'CLEAR_CHAT',
  LOAD_HISTORY:    'LOAD_HISTORY',   // replace messages when switching sessions
};

// ─── Reducer ──────────────────────────────────────────────────────────────────
const initialState = {
  messages:    [],
  isLoading:   false,
  error:       null,
  streamingId: null,   // ID of the currently streaming assistant message
};

const chatReducer = (state, { type, payload }) => {
  switch (type) {

    case A.ADD_USER_MSG:
      return { ...state, messages: [...state.messages, payload], error: null };

    case A.START_STREAM:
      return {
        ...state,
        isLoading:   true,
        streamingId: payload.id,
        messages:    [...state.messages, payload],
      };

    case A.APPEND_TOKEN: {
      if (!state.streamingId) return state;
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === state.streamingId
            ? { ...m, content: m.content + payload }
            : m
        ),
      };
    }

    case A.FINISH_STREAM: {
      // payload: { finalContent?: string, artifact?: object }
      return {
        ...state,
        isLoading:   false,
        streamingId: null,
        messages: state.messages.map((m) =>
          m.id === state.streamingId
            ? {
                ...m,
                // Use finalContent if provided, otherwise keep what was streamed
                content:  payload.finalContent !== undefined ? payload.finalContent : m.content,
                status:   MESSAGE_STATUS.SENT,
                artifact: payload.artifact || null,
              }
            : m
        ),
      };
    }

    case A.SET_ERROR:
      return {
        ...state,
        isLoading:   false,
        streamingId: null,
        error:       payload.errorMsg,
        messages:    state.messages.map((m) =>
          m.id === payload.messageId ? { ...m, status: MESSAGE_STATUS.ERROR } : m
        ),
      };

    case A.CLEAR_ERROR:
      return { ...state, error: null };

    case A.CLEAR_CHAT:
      return { ...initialState };

    case A.LOAD_HISTORY:
      return { ...initialState, messages: payload || [] };

    default:
      return state;
  }
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
/**
 * @param {{ apiUrl: string }} options
 */
export const useChat = ({ apiUrl, s3Config = {} }) => {
  const [state, dispatch]    = useReducer(chatReducer, initialState);
  const abortControllerRef   = useRef(null);
  const streamingIdRef       = useRef(null);
  const userCancelledRef     = useRef(false); // flag-based stop (matches reference app) // mirror of state.streamingId for closures

  const sendMessage = useCallback(async ({
    text,
    files        = [],
    commandType  = null,
    onArtifactEvent,            // (event: {type, title?, code?, artifact?}) => void
  }) => {
    const trimmed = text?.trim() ?? '';
    if ((!trimmed && files.length === 0 && !commandType) || state.isLoading) return;

    // Cancel any in-flight request
    userCancelledRef.current = false;   // reset on new message
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    // Add user message
    const userMsg = createMessage({ role: MESSAGE_ROLES.USER, content: trimmed, files });
    dispatch({ type: A.ADD_USER_MSG, payload: userMsg });

    // Create empty streaming assistant message
    const streamMsg = createMessage({ role: MESSAGE_ROLES.ASSISTANT, content: '' });
    streamingIdRef.current = streamMsg.id;
    dispatch({ type: A.START_STREAM, payload: streamMsg });

    const historySlice = state.messages.slice(-MAX_HISTORY_LENGTH);
    let   artifactData = null;

    await streamChatMessage({
      apiUrl,
      s3Config,
      message:     trimmed,
      history:     historySlice,
      files,
      commandType,
      signal:      abortControllerRef.current.signal,

      // Each chat token gets appended to the streaming message
      onToken: (token) => {
        if (userCancelledRef.current) return; // stop button was clicked — ignore token
        dispatch({ type: A.APPEND_TOKEN, payload: token });
      },

      // Artifact panel events — forwarded to ChatContainer via callback
      onArtifactStart: (title) => {
        onArtifactEvent?.({ type: 'start', title });
      },

      onArtifactChunk: (code) => {
        onArtifactEvent?.({ type: 'chunk', code });
      },

      onArtifactDone: (artifact) => {
        artifactData = artifact;
        onArtifactEvent?.({ type: 'done', artifact });
      },

      // Stream complete
      onDone: (cleanChatText, finalArtifact) => {
        // If user cancelled, discard the response silently
        if (userCancelledRef.current) { userCancelledRef.current = false; return; }
        dispatch({
          type:    A.FINISH_STREAM,
          payload: {
            finalContent: cleanChatText || undefined,
            artifact:     finalArtifact || artifactData,
          },
        });
        streamingIdRef.current = null;
      },

      // Error
      onError: (err) => {
        if (err?.name === 'AbortError') {
          dispatch({ type: A.FINISH_STREAM, payload: {} });
          streamingIdRef.current = null;
          return;
        }
        dispatch({
          type:    A.SET_ERROR,
          payload: {
            errorMsg:  err?.message || 'Failed to get a response. Please try again.',
            messageId: userMsg.id,
          },
        });
        streamingIdRef.current = null;
      },
    });

  }, [apiUrl, state.messages, state.isLoading]);

  const cancelRequest = useCallback(() => {
    // Flag-based stop (matches reference app pattern):
    // 1. Set flag so onToken/onDone callbacks are ignored immediately
    // 2. Dispatch FINISH_STREAM right now so isLoading resets instantly
    // 3. Also abort the fetch to cancel the network request
    userCancelledRef.current = true;
    dispatch({ type: A.FINISH_STREAM, payload: {} });
    streamingIdRef.current = null;
    abortControllerRef.current?.abort();
  }, []);

  const clearChat   = useCallback(() => dispatch({ type: A.CLEAR_CHAT }),  []);
  const clearError  = useCallback(() => dispatch({ type: A.CLEAR_ERROR }), []);
  const loadHistory = useCallback((msgs) =>
    dispatch({ type: A.LOAD_HISTORY, payload: msgs }),
  []);

  return {
    messages:    state.messages,
    isLoading:   state.isLoading,
    error:       state.error,
    sendMessage,
    cancelRequest,
    clearChat,
    clearError,
    loadHistory,
  };
};