import { createElement, useRef, useEffect } from 'react';
import ChatContainer  from './components/ChatContainer/ChatContainer';
import ErrorBoundary  from './components/ErrorBoundary/ErrorBoundary';
import './ui/AILCL.css';
 
const AILCL = (props) => {
  const {
    // API — now a Mendix attribute (not a hardcoded string)
    apiUrl,
 
    // S3 upload config — all Mendix attributes (never hardcoded)
    s3Bucket, s3Region, s3KeyPrefix, awsAccessKey, awsSecretKey,
 
    // UI
    title                 = 'LCL-AI Assistant',
    placeholder           = 'Ask me anything…',
    maxHeight             = '600px',
    defaultDark           = false,
    disabled              = false,
    allowMarkdown         = true,
    showCopyButton        = true,
    enableTypingAnimation = true,
    allowFileUpload       = false,
    acceptedFileTypes     = '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.csv,.xlsx',
    maxFileSizeMB         = 10,
    autoScroll            = true,
 
    // Session history
    showSidebar           = false,
    chatHistoryJson,
    onHistoryChange,
    onShareSession,
    sharedSessionId,
    userEmail,
    inputTokens, outputTokens, totalCost, onApiUsage,
  } = props;
 
  // Read the API URL from the Mendix attribute value
  const resolvedApiUrl = apiUrl?.value ?? '';
 
  if (!resolvedApiUrl) {
    return (
      <div className="ailcl-config-warning">
        ⚙ <strong>AILCL Widget:</strong> Please set the <em>API URL</em> attribute property.
      </div>
    );
  }
 
  // Read S3 config values from Mendix attributes
  const s3Config = {
    bucket:    s3Bucket?.value    ?? '',
    region:    s3Region?.value    ?? '',
    keyPrefix: s3KeyPrefix?.value ?? 'attachements-input',
    accessKey: awsAccessKey?.value ?? '',
    secretKey: awsSecretKey?.value ?? '',
  };

  const currentUserEmail = userEmail?.value ?? '';
 
  const pendingShareRef = useRef(null);

  const handleShareSession = (sessionId) => {
    pendingShareRef.current = sessionId; // always overwrite, even if same id

    if (sharedSessionId?.status === 'available') {
      // Force a change — clear first, then set
      sharedSessionId.setValue('');
      setTimeout(() => {
        sharedSessionId.setValue(sessionId);
      }, 50);
    }
  };

  useEffect(() => {
    if (!pendingShareRef.current) return;
    if (sharedSessionId?.status !== 'available') return;
    if (sharedSessionId.value === pendingShareRef.current) {
      pendingShareRef.current = null;
      if (onShareSession?.canExecute && !onShareSession.isExecuting) {
        onShareSession.execute();
      }
    }
  }, [sharedSessionId?.value]);
 
  return (
    <ErrorBoundary>
      <ChatContainer
        apiUrl={resolvedApiUrl}
        s3Config={s3Config}
        title={title}
        placeholder={placeholder}
        maxHeight={maxHeight}
        defaultDark={defaultDark}
        disabled={disabled}
        allowMarkdown={allowMarkdown}
        showCopyButton={showCopyButton}
        enableTypingAnimation={enableTypingAnimation}
        allowFileUpload={allowFileUpload}
        acceptedFileTypes={acceptedFileTypes}
        maxFileSizeMB={maxFileSizeMB}
        autoScroll={autoScroll}
        showSidebar={showSidebar}
        chatHistoryJson={chatHistoryJson}
        onHistoryChange={onHistoryChange}
        onShareSession={handleShareSession}
        userEmail={currentUserEmail}
        inputTokens={inputTokens}
        outputTokens={outputTokens}
        totalCost={totalCost}
        onApiUsage={onApiUsage}
      />
    </ErrorBoundary>
  );
};
 
export default AILCL;