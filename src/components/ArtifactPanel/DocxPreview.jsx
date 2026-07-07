import { useRef, useEffect, useState } from 'react';
import { renderAsync } from 'docx-preview';
import styles from './ArtifactPanel.module.css';
 
/**
 * Renders a .docx blob as real Word-like pages using docx-preview.
 * Reads the actual Word layout (page size, margins, styles, fonts,
 * tables, headers/footers, page breaks) from inside the .docx file.
 */
const DocxPreview = ({ blob }) => {
  const containerRef = useRef(null);
  const [rendering, setRendering] = useState(true);
  const [error, setError] = useState(null);
 
  useEffect(() => {
    if (!containerRef.current || !blob) return;
    setRendering(true);
    setError(null);
    containerRef.current.innerHTML = '';
 
    renderAsync(blob, containerRef.current, undefined, {
      inWrapper: true,        // white page "sheets" with shadow, like Word
      ignoreWidth: false,     // respect real page width
      ignoreHeight: false,    // respect real page height
      breakPages: true,       // show actual page breaks
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
    })
      .then(() => setRendering(false))
      .catch(err => {
        console.error('docx-preview render error:', err);
        setError(err.message || 'Failed to render document');
        setRendering(false);
      });
  }, [blob]);
 
  return (
    <div
      className={styles.previewContainer}
      style={{ overflow: 'auto', background: '#ececec', height: '100%' }}
    >
      {rendering && (
        <div className={styles.previewLoading}>
          <div className={styles.previewSpinner} />
          <span>Rendering document…</span>
        </div>
      )}
      {error && (
        <div style={{ padding: 16, color: '#b91c1c' }}>⚠ {error}</div>
      )}
      <div ref={containerRef} />
    </div>
  );
};
 
export default DocxPreview;