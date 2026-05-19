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
      {files.map((file) => (
        <FileChip key={file.name} file={file} onRemove={onRemove} readOnly={readOnly} />
      ))}
    </div>
  );
};

const FileChip = ({ file, onRemove, readOnly }) => {
  // Blob URL for image thumbnails — cleaned up on unmount by browser GC
  const thumbUrl = useMemo(
    () => (isImageFile(file) ? URL.createObjectURL(file) : null),
    [file]
  );

  return (
    <div className={styles.chip}>
      {thumbUrl ? (
        <img src={thumbUrl} alt={file.name} className={styles.thumb} />
      ) : (
        <span className={styles.icon} aria-hidden="true">{getFileIcon(file.name)}</span>
      )}
      <div className={styles.info}>
        <span className={styles.name} title={file.name}>
          {file.name.length > 22 ? `${file.name.slice(0, 19)}…` : file.name}
        </span>
        <span className={styles.size}>{formatFileSize(file.size)}</span>
      </div>
      {!readOnly && (
        <button
          className={styles.remove}
          onClick={() => onRemove(file.name)}
          aria-label={`Remove ${file.name}`}
          type="button"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default FilePreview;