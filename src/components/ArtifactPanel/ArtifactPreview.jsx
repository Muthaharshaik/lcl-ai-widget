import { useRef, useEffect, useState } from 'react';
import styles from './ArtifactPanel.module.css';

/**
 * Renders HTML content in a sandboxed iframe.
 * Used for HTML artifacts and documents.
 */
const ArtifactPreview = ({ code, refreshKey }) => {
  const iframeRef  = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!iframeRef.current || !code) return;
    setLoading(true);

    try {
      const doc = iframeRef.current.contentDocument
               || iframeRef.current.contentWindow?.document;

      if (doc) {
        doc.open();
        doc.write(code);
        doc.close();
        setLoading(false);
      } else {
        // Fallback: blob URL
        const blob = new Blob([code], { type: 'text/html' });
        const url  = URL.createObjectURL(blob);
        iframeRef.current.src = url;
        iframeRef.current.onload = () => {
          setLoading(false);
          URL.revokeObjectURL(url);
        };
      }
    } catch {
      const blob = new Blob([code], { type: 'text/html' });
      const url  = URL.createObjectURL(blob);
      if (iframeRef.current) {
        iframeRef.current.src = url;
        iframeRef.current.onload = () => {
          setLoading(false);
          URL.revokeObjectURL(url);
        };
      }
    }
  }, [code, refreshKey]);

  return (
    <div className={styles.previewContainer}>
      {loading && (
        <div className={styles.previewLoading}>
          <div className={styles.previewSpinner} />
          <span>Rendering…</span>
        </div>
      )}
      <iframe
        ref={iframeRef}
        className={styles.previewFrame}
        sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
        title="Artifact Preview"
      />
    </div>
  );
};

export default ArtifactPreview;