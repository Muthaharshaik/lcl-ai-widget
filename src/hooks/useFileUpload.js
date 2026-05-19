import { useState, useCallback } from 'react';
import { validateFiles }          from '../utils/fileUtils';

/**
 * Manages staged (pending) file attachments before a message is sent.
 *
 * @param {{ acceptedFileTypes: string, maxFileSizeMB: number }} options
 */
export const useFileUpload = ({ acceptedFileTypes, maxFileSizeMB }) => {
  const [stagedFiles, setStagedFiles] = useState([]);
  const [fileErrors,  setFileErrors]  = useState([]);

  const addFiles = useCallback((rawFiles) => {
    const incoming = Array.from(rawFiles);
    const { valid, errors } = validateFiles(incoming, { acceptedFileTypes, maxFileSizeMB });

    setFileErrors(errors);

    if (valid.length > 0) {
      setStagedFiles((prev) => {
        const existingNames = new Set(prev.map((f) => f.name));
        // Deduplicate by filename
        return [...prev, ...valid.filter((f) => !existingNames.has(f.name))];
      });
    }
  }, [acceptedFileTypes, maxFileSizeMB]);

  const removeFile  = useCallback((name) => {
    setStagedFiles((prev) => prev.filter((f) => f.name !== name));
  }, []);

  const clearFiles  = useCallback(() => {
    setStagedFiles([]);
    setFileErrors([]);
  }, []);

  const clearErrors = useCallback(() => setFileErrors([]), []);

  return { stagedFiles, fileErrors, addFiles, removeFile, clearFiles, clearErrors };
};