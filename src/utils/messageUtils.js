import { MESSAGE_ROLES, MESSAGE_STATUS } from '../constants';

let _counter = 0;

/**
 * Generates a stable unique message ID.
 * Using a counter + timestamp avoids crypto.randomUUID() browser support concerns.
 */
const generateId = () => `msg_${Date.now()}_${++_counter}`;

/**
 * Creates a normalised message object ready to be stored in state.
 *
 * @param {{ role: string, content: string, files?: File[], status?: string }} params
 * @returns {object} ChatMessage
 */
export const createMessage = ({
  role,
  content,
  files  = [],
  status = MESSAGE_STATUS.SENT,
}) => ({
  id:        generateId(),
  role,
  content,
  files,
  status,
  timestamp: new Date().toISOString(),
});

/** @param {string} isoString */
export const formatTimestamp = (isoString) =>
  new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const isUserMessage      = (msg) => msg.role === MESSAGE_ROLES.USER;
export const isAssistantMessage = (msg) => msg.role === MESSAGE_ROLES.ASSISTANT;