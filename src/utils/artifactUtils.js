/**
 * Detects if an AI response contains a code block that should be
 * shown as an artifact in the side panel.
 *
 * Returns null if no artifact, or { type, title, code, language } if found.
 */
export const detectArtifact = (responseText) => {
  if (!responseText) return null;

  // Match fenced code blocks: ```language\n...code...\n```
  const fenceRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks     = [];
  let match;

  while ((match = fenceRegex.exec(responseText)) !== null) {
    blocks.push({
      language: match[1]?.toLowerCase() || 'text',
      code:     match[2].trim(),
    });
  }

  if (blocks.length === 0) return null;

  // Pick the largest block as the primary artifact
  const primary = blocks.reduce(
    (best, b) => (b.code.length > best.code.length ? b : best),
    blocks[0]
  );

  const { language, code } = primary;

  // Only show artifact panel for meaningful code blocks
  if (code.split('\n').length < 3) return null;

  // Determine artifact type from language tag
  const typeMap = {
    html:       'html',
    jsx:        'jsx',
    tsx:        'tsx',
    javascript: 'javascript',
    js:         'javascript',
    typescript: 'typescript',
    ts:         'typescript',
    python:     'python',
    py:         'python',
    css:        'css',
    sql:        'sql',
    json:       'json',
    yaml:       'yaml',
    yml:        'yaml',
    bash:       'bash',
    sh:         'bash',
    markdown:   'markdown',
    md:         'markdown',
  };

  const type  = typeMap[language] || 'code';
  const title = generateTitle(responseText, type);

  return { type, title, code, language: language || 'text' };
};

/**
 * Extracts a title for the artifact from the response text.
 * Looks for a markdown heading near the code block.
 */
const generateTitle = (text, type) => {
  // Try first markdown heading
  const headingMatch = text.match(/^#{1,3}\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();

  // Fallback titles by type
  const defaults = {
    html:       'HTML App',
    jsx:        'React Component',
    javascript: 'JavaScript',
    python:     'Python Script',
    css:        'Stylesheet',
    sql:        'SQL Query',
    json:       'JSON',
    code:       'Code',
  };

  return defaults[type] || 'Code';
};

/**
 * Strips code blocks from a response so the chat bubble
 * only shows the explanation text, not the raw code.
 */
export const stripCodeBlocks = (text) => {
  return text.replace(/```[\s\S]*?```/g, '').trim();
};

/**
 * Downloads content as a file.
 */
export const downloadAsFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};