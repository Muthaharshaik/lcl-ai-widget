import { useRef, useEffect } from 'react';
import { Highlight, themes } from 'prism-react-renderer';
import styles from './ArtifactPanel.module.css';

const MAX_LINES = 500; // skip syntax highlight above this

const ArtifactCodeView = ({ code, language = 'html', isStreaming }) => {
  const bottomRef = useRef(null);
  const lineCount = (code || '').split('\n').length;
  const tooLarge  = lineCount > MAX_LINES;

  // Auto-scroll to bottom while code is streaming (mirrors reference app)
  useEffect(() => {
    if (isStreaming) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [code, isStreaming]);

  // Map our language names to prism-react-renderer supported names
  const prismLang = {
    javascript: 'javascript',
    js:         'javascript',
    jsx:        'jsx',
    typescript: 'typescript',
    ts:         'typescript',
    tsx:        'tsx',
    html:       'markup',
    css:        'css',
    python:     'python',
    py:         'python',
    sql:        'sql',
    json:       'json',
    bash:       'bash',
    sh:         'bash',
    yaml:       'yaml',
    markdown:   'markdown',
  }[language] || 'markup';

  return (
    <div className={styles.codeViewContainer}>
      {tooLarge ? (
        <pre className={styles.plainCode}>{code || ''}</pre>
      ) : (
        <Highlight theme={themes.oneDark} code={code || ''} language={prismLang}>
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre
              className={`${styles.codeHighlight} ${className}`}
              style={style}
            >
              {tokens.map((line, i) => (
                <div key={i} className={styles.codeLine} {...getLineProps({ line })}>
                  <span className={styles.lineNumber}>{i + 1}</span>
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      )}
      <div ref={bottomRef} />
    </div>
  );
};

export default ArtifactCodeView;