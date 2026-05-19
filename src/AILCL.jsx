import { createElement } from 'react';
import ChatContainer  from './components/ChatContainer/ChatContainer';
import ErrorBoundary  from './components/ErrorBoundary/ErrorBoundary';
import './ui/AILCL.css';

/**
 * AILCL — Mendix Pluggable Widget Entry Point
 *
 * Mendix calls this component with the properties defined in AILCL.xml.
 * All props are plain values (string, boolean, number) for simple property types.
 *
 * Property naming: Mendix converts camelCase XML keys directly to JS props.
 * e.g. XML key="apiUrl" → props.apiUrl
 */
const AILCL = (props) => {
  const {
    apiUrl,
    title              = 'AI Assistant',
    placeholder        = 'Type your message…',
    maxHeight          = '600px',
    theme              = 'light',
    disabled           = false,
    allowMarkdown      = true,
    showCopyButton     = true,
    enableTypingAnimation = true,
    allowFileUpload    = false,
    acceptedFileTypes  = '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.csv,.xlsx',
    maxFileSizeMB      = 10,
    autoScroll         = true,
  } = props;

  // Guard: warn in Mendix Studio Pro if API URL is missing
  if (!apiUrl) {
    return (
      <div className="ailcl-config-warning">
        ⚙ <strong>AILCL Widget:</strong> Please set the <em>API URL</em> property in widget configuration.
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ChatContainer
        apiUrl={apiUrl}
        title={title}
        placeholder={placeholder}
        maxHeight={maxHeight}
        theme={theme}
        disabled={disabled}
        allowMarkdown={allowMarkdown}
        showCopyButton={showCopyButton}
        enableTypingAnimation={enableTypingAnimation}
        allowFileUpload={allowFileUpload}
        acceptedFileTypes={acceptedFileTypes}
        maxFileSizeMB={maxFileSizeMB}
        autoScroll={autoScroll}
      />
    </ErrorBoundary>
  );
};

export default AILCL;