import { useReducer, useCallback, useRef } from 'react';
import { sendChatMessage }                  from '../services/apiService';
import { createMessage }                    from '../utils/messageUtils';
import { MESSAGE_ROLES, MESSAGE_STATUS, MAX_HISTORY_LENGTH } from '../constants';

// ─── Action types ─────────────────────────────────────────────────────────────
const A = {
  ADD_USER_MSG:       'ADD_USER_MSG',
  SET_LOADING:        'SET_LOADING',
  ADD_ASSISTANT_MSG:  'ADD_ASSISTANT_MSG',
  SET_ERROR:          'SET_ERROR',
  CLEAR_ERROR:        'CLEAR_ERROR',
  CLEAR_CHAT:         'CLEAR_CHAT',
};

// ─── Reducer ─────────────────────────────────────────────────────────────────
const initialState = {
  messages:  [],
  isLoading: false,
  error:     null,
};

const chatReducer = (state, { type, payload }) => {
  switch (type) {
    case A.ADD_USER_MSG:
      return { ...state, messages: [...state.messages, payload], error: null };

    case A.SET_LOADING:
      return { ...state, isLoading: payload };

    case A.ADD_ASSISTANT_MSG:
      return { ...state, messages: [...state.messages, payload], isLoading: false, error: null };

    case A.SET_ERROR:
      return {
        ...state,
        isLoading: false,
        error: payload.errorMsg,
        // Mark the offending user message as errored
        messages: state.messages.map((m) =>
          m.id === payload.messageId ? { ...m, status: MESSAGE_STATUS.ERROR } : m
        ),
      };

    case A.CLEAR_ERROR:
      return { ...state, error: null };

    case A.CLEAR_CHAT:
      return { ...initialState };

    default:
      return state;
  }
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
/**
 * Central hook — owns all chat state and side effects.
 *
 * @param {{ apiUrl: string }} options
 */
export const useChat = ({ apiUrl }) => {
  const [state, dispatch]    = useReducer(chatReducer, initialState);
  const abortControllerRef   = useRef(null);

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async ({ text, files = [] }) => {
    const trimmed = text?.trim() ?? '';
    if ((!trimmed && files.length === 0) || state.isLoading) return;

    // Cancel any in-flight request before starting a new one
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    const userMsg = createMessage({
      role:    MESSAGE_ROLES.USER,
      content: trimmed,
      files,
    });

    dispatch({ type: A.ADD_USER_MSG,  payload: userMsg });
    dispatch({ type: A.SET_LOADING,   payload: true });

    try {
      // Send only the last N messages to avoid token overflow
      const historySlice = state.messages.slice(-MAX_HISTORY_LENGTH);

      const { response } = await sendChatMessage({
        apiUrl,
        message: trimmed,
        history: historySlice,
        files,
        signal: abortControllerRef.current.signal,
      });

      const assistantMsg = createMessage({
        role:    MESSAGE_ROLES.ASSISTANT,
        content: response,
      });

      dispatch({ type: A.ADD_ASSISTANT_MSG, payload: assistantMsg });

    } catch (err) {
      if (err.name === 'AbortError') {
        // User cancelled — just stop loading, keep messages as-is
        dispatch({ type: A.SET_LOADING, payload: false });
        return;
      }
      dispatch({
        type:    A.SET_ERROR,
        payload: {
          errorMsg:  err.message || 'Failed to get a response. Please try again.',
          messageId: userMsg.id,
        },
      });
    }
  }, [apiUrl, state.messages, state.isLoading]);

  // ── Cancel ──────────────────────────────────────────────────────────────────
  const cancelRequest = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  // ── Clear ───────────────────────────────────────────────────────────────────
  const clearChat  = useCallback(() => dispatch({ type: A.CLEAR_CHAT }),  []);
  const clearError = useCallback(() => dispatch({ type: A.CLEAR_ERROR }), []);

  return {
    messages:  state.messages,
    isLoading: state.isLoading,
    error:     state.error,
    sendMessage,
    cancelRequest,
    clearChat,
    clearError,
  };
};