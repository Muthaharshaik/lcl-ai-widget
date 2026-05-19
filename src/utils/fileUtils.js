import { BYTES_IN_MB } from '../constants';

/**
 * Validate an array of Files against type and size constraints.
 *
 * @param {File[]} files
 * @param {{ acceptedFileTypes: string, maxFileSizeMB: number }} opts
 * @returns {{ valid: File[], errors: string[] }}
 */
export const validateFiles = (files, { acceptedFileTypes, maxFileSizeMB }) => {
  const valid  = [];
  const errors = [];

  const accepted = acceptedFileTypes
    ? acceptedFileTypes.split(',').map((t) => t.trim().toLowerCase())
    : null;

  for (const file of files) {
    const ext = `.${file.name.split('.').pop().toLowerCase()}`;

    if (accepted && !accepted.includes(ext)) {
      errors.push(`"${file.name}" — unsupported file type.`);
      continue;
    }
    if (maxFileSizeMB && file.size > maxFileSizeMB * BYTES_IN_MB) {
      errors.push(`"${file.name}" exceeds the ${maxFileSizeMB} MB limit.`);
      continue;
    }
    valid.push(file);
  }

  return { valid, errors };
};

/** @param {number} bytes */
export const formatFileSize = (bytes) => {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < BYTES_IN_MB) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / BYTES_IN_MB).toFixed(1)} MB`;
};

/** Returns an emoji icon based on file extension */
export const getFileIcon = (fileName) => {
  const ext = fileName.split('.').pop().toLowerCase();
  const map = {
    pdf: '📄', doc: '📝', docx: '📝',
    xls: '📊', xlsx: '📊', csv: '📊',
    ppt: '📑', pptx: '📑',
    txt: '📃', md: '📃',
    png: '🖼', jpg: '🖼', jpeg: '🖼', gif: '🖼', webp: '🖼', svg: '🖼',
    zip: '🗜', rar: '🗜', '7z': '🗜',
    json: '📋', xml: '📋',
    mp4: '🎬', mp3: '🎵',
  };
  return map[ext] || '📎';
};

export const isImageFile = (file) => file.type.startsWith('image/');