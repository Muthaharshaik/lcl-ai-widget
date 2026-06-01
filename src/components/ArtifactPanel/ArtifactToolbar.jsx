import { useState, useCallback }  from 'react';
import { downloadAsPDF }          from '../../utils/downloadDoc';
import styles                     from './ArtifactPanel.module.css';

const ArtifactToolbar = ({
  view, setView, onRefresh, onClose,
  code, title, language,
  isStreaming,
  isDocx, isPptx, isDocument,
  onDownloadDocx, onDownloadPptx, downloading,
}) => {
  const [copied,       setCopied]       = useState(false);
  const [showDownload, setShowDownload] = useState(false);

  const isHtml = !isDocx && !isPptx;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code || '');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = code || '';
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const downloadHTML = useCallback(() => {
    const blob = new Blob([code], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `${title || 'artifact'}.html`;
    a.click();
    URL.revokeObjectURL(url);
    setShowDownload(false);
  }, [code, title]);

  const downloadPDF = useCallback(() => {
    const win = window.open('', '_blank');
    win.document.write(code);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
    setShowDownload(false);
  }, [code]);

  const openExternal = useCallback(() => {
    const blob = new Blob([code], { type: 'text/html' });
    window.open(URL.createObjectURL(blob), '_blank');
  }, [code]);

  return (
    <div className={styles.toolbar}>

      {/* ── Left: title + streaming badge ─────────────────────────────── */}
      <div className={styles.toolbarTitle}>
        <span className={styles.titleText}>{title || 'Artifact'}</span>

        {isStreaming ? (
          <span className={styles.streamingBadge}>
            <span className={styles.streamingDot} />
            Generating
          </span>
        ) : (
          <>
            {isDocx && <span className={styles.langBadge} style={{ background: '#3b82f620', color: '#3b82f6' }}>📝 docx</span>}
            {isPptx && <span className={styles.langBadge} style={{ background: '#f9731620', color: '#f97316' }}>📊 pptx</span>}
            {!isDocx && !isPptx && <span className={styles.langBadge}>{language}</span>}
          </>
        )}
      </div>

      {/* ── Right: action buttons ─────────────────────────────────────── */}
      <div className={styles.toolbarActions}>

        {/* Preview / Code toggle — always show both, disable during streaming */}
        <div className={styles.viewToggle}>
          <button
            className={`${styles.toggleBtn} ${view === 'preview' ? styles.toggleActive : ''}`}
            onClick={() => setView('preview')}
            disabled={isStreaming}
            title={isStreaming ? 'Generating…' : 'Preview'}
          >
            <EyeIcon /> Preview
          </button>
          <button
            className={`${styles.toggleBtn} ${view === 'code' ? styles.toggleActive : ''}`}
            onClick={() => setView('code')}
            title="View code"
          >
            <CodeIcon /> Code
          </button>
        </div>

        <div className={styles.divider} />

        {/* Refresh */}
        <button
          className={styles.iconBtn}
          onClick={onRefresh}
          disabled={isStreaming}
          title="Refresh"
        >
          <RefreshIcon />
        </button>

        {/* Open in new tab — HTML only */}
        {isHtml && !isDocx && (
          <button
            className={styles.iconBtn}
            onClick={openExternal}
            disabled={isStreaming}
            title="Open in new tab"
          >
            <ExternalIcon />
          </button>
        )}

        {/* Copy */}
        <button
          className={`${styles.iconBtn} ${copied ? styles.iconBtnSuccess : ''}`}
          onClick={handleCopy}
          title={copied ? 'Copied!' : 'Copy code'}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>

        {/* ── DOCX download ────────────────────────────────────────────── */}
        {isDocx && (
          <button
            className={styles.downloadDocxBtn}
            onClick={onDownloadDocx}
            disabled={downloading || isStreaming}
            title="Download Word document"
          >
            {downloading ? <><SpinnerIcon /> Generating…</> : <><DownloadIcon /> Download .docx</>}
          </button>
        )}

        {/* ── PPTX download ────────────────────────────────────────────── */}
        {isPptx && (
          <button
            className={styles.downloadPptxBtn}
            onClick={onDownloadPptx}
            disabled={downloading || isStreaming}
            title="Download PowerPoint"
          >
            {downloading ? <><SpinnerIcon /> Generating…</> : <><DownloadIcon /> Download .pptx</>}
          </button>
        )}

        {/* ── HTML/doc download dropdown ───────────────────────────────── */}
        {!isDocx && !isPptx && (
          <div style={{ position: 'relative' }}>
            <button
              className={styles.iconBtn}
              onClick={() => setShowDownload(p => !p)}
              disabled={isStreaming}
              title="Download"
            >
              <DownloadIcon />
            </button>

            {showDownload && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                  onClick={() => setShowDownload(false)}
                />
                <div className={styles.downloadMenu}>
                  <div className={styles.downloadMenuHeader}>Save as</div>

                  {isDocument && (
                    <button className={styles.downloadMenuItem} onClick={() => {
                      const wordHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office'
                        xmlns:w='urn:schemas-microsoft-com:office:word'
                        xmlns='http://www.w3.org/TR/REC-html40'>
                        <head><meta charset="UTF-8">
                        ${code.match(/<style[\s\S]*?<\/style>/)?.[0] || ''}
                        </head><body>
                        ${code.match(/<body[^>]*>([\s\S]*?)<\/body>/)?.[1] || code}
                        </body></html>`;
                      const blob = new Blob(['\ufeff', wordHtml], { type: 'application/msword;charset=utf-8' });
                      const url  = URL.createObjectURL(blob);
                      const a    = document.createElement('a');
                      a.href = url; a.download = `${title || 'document'}.doc`; a.click();
                      URL.revokeObjectURL(url); setShowDownload(false);
                    }}>
                      <span className={styles.downloadIcon}>📝</span>
                      <div><div>Word (.doc)</div><div className={styles.downloadSubtext}>Open in MS Word</div></div>
                    </button>
                  )}

                  <button className={styles.downloadMenuItem} onClick={downloadPDF}>
                    <span className={styles.downloadIcon}>📄</span>
                    <div><div>PDF</div><div className={styles.downloadSubtext}>Print → Save as PDF</div></div>
                  </button>

                  <button className={styles.downloadMenuItem} onClick={downloadHTML}>
                    <span className={styles.downloadIcon}>🌐</span>
                    <div><div>HTML file</div><div className={styles.downloadSubtext}>Open in browser</div></div>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <div className={styles.divider} />

        {/* Close */}
        <button
          className={`${styles.iconBtn} ${styles.iconBtnClose}`}
          onClick={onClose}
          title="Close panel (reopen via header button)"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const EyeIcon      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const CodeIcon     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>;
const RefreshIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
const ExternalIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>;
const CopyIcon     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
const CheckIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const DownloadIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const CloseIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const SpinnerIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 0.8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>;

export default ArtifactToolbar;