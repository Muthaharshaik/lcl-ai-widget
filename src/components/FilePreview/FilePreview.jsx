import { useMemo }          from 'react';
import { formatFileSize, getFileIcon, isImageFile } from '../../utils/fileUtils';
import styles               from './FilePreview.module.css';

/**
 * Renders a row of file chips.
 * In "read-only" mode (inside a sent message), the remove button is hidden.
 */
const FilePreview = ({ files, onRemove, readOnly = false }) => {
  if (!files?.length) return null;

  return (
    <div className={styles.row}>
      {files.map((file, index) => (
        <FileChip key={file.name || file.fileName || index} file={file} onRemove={onRemove} readOnly={readOnly} />
      ))}
    </div>
  );
};

const FileChip = ({ file, onRemove, readOnly }) => {
  // Handle both raw File object and S3 ref
  const fileName = file.fileName || file.name || 'Unknown file';
  const fileSize = file.size ? formatFileSize(file.size) : null;
  const isImage  = file.type?.startsWith('image/') || file.mimeType?.startsWith('image/');

  // Blob URL only works for raw File objects, not S3 refs
  const thumbUrl = useMemo(
    () => (isImage && file instanceof File ? URL.createObjectURL(file) : null),
    [file, isImage]
  );

  return (
    <div className={styles.chip}>
      {thumbUrl ? (
        <img src={thumbUrl} alt={fileName} className={styles.thumb} />
      ) : (
        <span className={styles.icon} aria-hidden="true">{getFileIcon(fileName)}</span>
      )}
      <div className={styles.info}>
        <span className={styles.name} title={fileName}>
          {fileName.length > 22 ? `${fileName.slice(0, 19)}…` : fileName}
        </span>
        {fileSize && <span className={styles.size}>{fileSize}</span>}
      </div>
      {!readOnly && (
        <button
          className={styles.remove}
          onClick={() => onRemove(fileName)}
          aria-label={`Remove ${fileName}`}
          type="button"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default FilePreview;