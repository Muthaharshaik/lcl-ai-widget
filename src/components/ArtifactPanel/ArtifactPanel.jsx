import { useState, useEffect }                          from 'react';
import ArtifactToolbar                                  from './ArtifactToolbar';
import ArtifactPreview                                  from './ArtifactPreview';
import ArtifactCodeView                                 from './ArtifactCodeView';
import { generateAndDownloadDocx, generatePreviewHtml } from '../../utils/generateDocx';
import { generateAndDownloadPptx }                      from '../../utils/generatePptx';
import styles                                           from './ArtifactPanel.module.css';

/**
 * Artifact panel — mirrors reference app behavior exactly:
 *
 *  While streaming    → code view, "Generating" badge in toolbar, no preview
 *  Streaming ends     → html/document auto-switch to preview
 *                       docx → auto-generate preview via mammoth
 *                       pptx → stay on code, user downloads
 *  User clicks toggle → manually switch between code and preview
 *  User closes        → panel hides, artifact kept in state for reopen
 */
const ArtifactPanel = ({ artifact, isStreaming, isLoading, onClose, onRegenerate }) => {
  const [view,           setView]           = useState('code');
  const [refreshKey,     setRefreshKey]     = useState(0);
  const [downloading,    setDownloading]    = useState(false);
  const [downloadError,  setDownloadError]  = useState(null);
  const [previewHtml,    setPreviewHtml]    = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError,   setPreviewError]   = useState(null);

  const isDocx     = artifact?.type === 'docx';
  const isPptx     = artifact?.type === 'pptx';
  const isDocument = artifact?.type === 'document';
  const isHtml     = !isDocx && !isPptx;

  // While streaming: always show code
  useEffect(() => {
    if (isStreaming) setView('code');
  }, [isStreaming]);

  // When streaming finishes: auto-switch view
  useEffect(() => {
    if (isStreaming || !artifact?.code) return;

    if (isDocx) {
      // Auto-generate word preview
      generateDocxPreview(artifact.code);
      return;
    }
    if (isPptx) {
      // Stay on code — user must download
      setView('code');
      return;
    }
    // HTML / document — switch to preview after short delay
    const timer = setTimeout(() => {
      setView('preview');
      setRefreshKey(k => k + 1);
    }, 400);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming, artifact?.code, artifact?.type]);

  // Reset preview state when artifact changes
  useEffect(() => {
    setPreviewHtml(null);
    setPreviewError(null);
    setPreviewLoading(false);
    setDownloadError(null);
  }, [artifact?.code]);

  // Documents always open straight to preview (matches reference app)
  useEffect(() => {
    if (artifact?.type === 'document') {
      // If the user asked for code (e.g. "fix my JSX") but Lambda wrapped it
      // in an HTML document, default to code view so they see the raw code.
      // Only use preview when they explicitly asked for an HTML page/document.
      if (artifact?.requestedAs === 'code') {
        setView('code');
      } else {
        setView('preview');
        setRefreshKey(k => k + 1);
      }
    }
  }, [artifact]);

  // ── Generate Word preview via mammoth ───────────────────────────────────────
  const generateDocxPreview = async (code) => {
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewHtml(null);
    const result = await generatePreviewHtml(code);
    setPreviewLoading(false);
    if (result.success) {
      setPreviewHtml(result.html);
      setView('preview');
    } else {
      setPreviewError(result.error || 'Preview failed');
      setView('code');
    }
  };

  // ── View toggle handler ─────────────────────────────────────────────────────
  const handleViewChange = (v) => {
    setView(v);
    if (v === 'preview') {
      if (isDocx && !previewHtml && !previewLoading) {
        generateDocxPreview(artifact.code);
      } else if (!isDocx) {
        setRefreshKey(k => k + 1);
      }
    }
  };

  // ── Download handlers ───────────────────────────────────────────────────────
  const handleDownloadDocx = async () => {
    setDownloading(true);
    setDownloadError(null);
    const result = await generateAndDownloadDocx(artifact.code, artifact.title || 'Document');
    setDownloading(false);
    if (!result.success) setDownloadError(result.error);
  };

  const handleDownloadPptx = async () => {
    setDownloading(true);
    const result = await generateAndDownloadPptx(artifact.code, artifact.title || 'Presentation');
    setDownloading(false);
    if (!result.success) setDownloadError(result.error);
  };

  const handleRefresh = () => {
    // Re-send the last user message to regenerate the artifact from scratch
    onRegenerate?.();
  };

  if (!artifact) return null;

  return (
    <div className={styles.panel}>

      {/* Toolbar */}
      <ArtifactToolbar
        view={view}
        setView={handleViewChange}
        onRefresh={handleRefresh}
        onClose={onClose}
        isLoading={isLoading}
        code={artifact.code}
        title={artifact.title}
        language={artifact.language || artifact.type || 'html'}
        isStreaming={isStreaming}
        isDocx={isDocx}
        isPptx={isPptx}
        isDocument={isDocument}
        onDownloadDocx={handleDownloadDocx}
        onDownloadPptx={handleDownloadPptx}
        downloading={downloading}
      />

      {/* Error bar */}
      {(downloadError || previewError) && (
        <div className={styles.errorBar}>
          ⚠ {downloadError || previewError}
          <button onClick={() => { setDownloadError(null); setPreviewError(null); }}>×</button>
        </div>
      )}

      <div className={styles.panelBody}>

        {/* ── DOCX: preview loading ────────────────────────────────────────── */}
        {isDocx && previewLoading && (
          <div className={styles.previewLoadingState}>
            <div className={styles.previewSpinner} />
            <p>Rendering document preview…</p>
          </div>
        )}

        {/* ── DOCX: preview (mammoth-rendered HTML) ───────────────────────── */}
        {isDocx && previewHtml && !previewLoading && view === 'preview' && (
          <ArtifactPreview code={previewHtml} refreshKey={refreshKey} />
        )}

        {/* ── DOCX: code view ─────────────────────────────────────────────── */}
        {isDocx && view === 'code' && !previewLoading && (
          <ArtifactCodeView code={artifact.code} language="javascript" isStreaming={isStreaming} />
        )}

        {/* ── PPTX: download note + code view ─────────────────────────────── */}
        {isPptx && (
          <>
            {view === 'preview' ? (
              <div className={styles.pptxPreviewNote}>
                <span>📊</span>
                <p>PowerPoint preview is not available in the browser.</p>
                <button className={styles.switchBtn} onClick={() => setView('code')}>
                  View Generated Code
                </button>
                <button className={styles.downloadBtnLarge} onClick={handleDownloadPptx} disabled={downloading}>
                  {downloading ? 'Generating…' : '⬇ Download .pptx'}
                </button>
              </div>
            ) : (
              <ArtifactCodeView code={artifact.code} language="javascript" isStreaming={isStreaming} />
            )}
          </>
        )}

        {/* ── HTML app / HTML document ─────────────────────────────────────── */}
        {isHtml && !isPptx && !isDocx && (
          view === 'preview' && !isStreaming
            ? <ArtifactPreview code={artifact.code} refreshKey={refreshKey} />
            : <ArtifactCodeView
                code={artifact.code}
                language={artifact.language || 'html'}
                isStreaming={isStreaming}
              />
        )}
      </div>
    </div>
  );
};

export default ArtifactPanel;