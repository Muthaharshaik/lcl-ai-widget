import { useState, useCallback } from 'react';

/**
 * Manages artifact panel state — matches reference app ArtifactContext exactly.
 *
 * States:
 *   isStreaming = true  → code is being generated (code view, "Generating" badge)
 *   isStreaming = false → generation complete (auto-switches to preview for html)
 *   isOpen = false      → panel closed, artifact cleared after slide-out animation
 */
export const useArtifact = () => {
  const [artifact,    setArtifact]   = useState(null);
  const [isOpen,      setIsOpen]     = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  // Open panel with complete artifact data (e.g. from message bubble)
  const openArtifact = useCallback((data) => {
    setArtifact(data);
    setIsOpen(true);
    setIsStreaming(false);
  }, []);

  // Called when streaming STARTS — opens panel in code view with empty code
  const startArtifactStream = useCallback((title) => {
    setArtifact({ title, code: '', type: 'html', language: 'html' });
    setIsOpen(true);
    setIsStreaming(true);
  }, []);

  // Called on each chunk — update code in real time
  const updateArtifact = useCallback((data) => {
    setArtifact((prev) => prev ? { ...prev, ...data } : data);
  }, []);

  // Called when streaming ENDS — set final artifact data, clear streaming flag
  const finishArtifactStream = useCallback((data) => {
    if (data) setArtifact(data);
    setIsStreaming(false);
  }, []);

  // Close panel and clear artifact after slide-out animation (matches reference app)
  const closeArtifact = useCallback(() => {
    setIsOpen(false);
    setIsStreaming(false);
    setTimeout(() => setArtifact(null), 300);
  }, []);

  return {
    artifact,
    isOpen,
    isStreaming,
    openArtifact,
    startArtifactStream,
    updateArtifact,
    finishArtifactStream,
    closeArtifact,
  };
};