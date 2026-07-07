import * as docxLib from 'docx'
import { saveAs } from 'file-saver'
import * as mammoth from 'mammoth'
 
export function extractDocxCode(fullContent) {
  const match = fullContent.match(/%%DOCX_CODE_START%%([\s\S]*?)%%DOCX_CODE_END%%/)
  return match ? match[1].trim() : null
}
 
function adaptCodeForBrowser(code) {
  if (!code) return ''
 
  // ── 1. Strip end marker and anything after it ─────────────────────────────
  // The artifact code sometimes includes %%DOCX_CODE_END%% and description text.
  // Strip everything from the marker onwards before execution.
  const endMarkerIdx = code.indexOf('%%DOCX_CODE_END%%')
  if (endMarkerIdx !== -1) code = code.slice(0, endMarkerIdx)
 
  // ── 2. Reference app fixes (exact copy) ──────────────────────────────────
  code = code.replace(
    /const\s*\{[^}]*\}\s*=\s*require\(['"]docx['"]\);?/gs,
    '// docx injected'
  )
  code = code.replace(/module\.exports\s*=\s*\{[^}]*\};?/g, '')
  code = code.replace(/const\s+fs\s*=\s*require\(['"]fs['"]\);?/g, '')
  code = code.replace(/fs\.writeFileSync\([^)]*\);?/g, '')
  code = code.replace(/Packer\.toBuffer\([\s\S]*?\}\);?/g, '')
 
  // ── 3. Fix unescaped apostrophes in single-quoted strings ─────────────────
  // "it's" → "it\'s"  (same fix as generatePptx.js)
  code = code.replace(/(\w)'(\w)/g, "$1\\'$2")
 
  return code.trim()
}
 
export async function executeDocxCode(code) {
  const adaptedCode = adaptCodeForBrowser(code)
  const context = { ...docxLib }
  const contextKeys = Object.keys(context)
  const contextValues = Object.values(context)
 
  const wrappedCode = `
    ${adaptedCode}
    return typeof doc !== 'undefined' ? doc : null;
  `
 
  const executeDoc = new Function(...contextKeys, wrappedCode)
  const doc = executeDoc(...contextValues)
 
  if (!doc) throw new Error('No doc object returned')
 
  return doc
}
 
// ── NEW: returns the raw .docx blob for real Word-like preview ──────────────
// Used by DocxPreview.jsx (docx-preview library renders this blob as Word pages)
export async function generateDocxBlob(code) {
  try {
    const doc = await executeDocxCode(code)
    const blob = await docxLib.Packer.toBlob(doc)
    return { success: true, blob }
  } catch (error) {
    console.error('generateDocxBlob error:', error)
    return { success: false, error: error.message }
  }
}
 
// ── KEPT (no longer used for docx preview, but preserved in case other
//    files import it). Old mammoth → HTML conversion path. ──────────────────
export async function generatePreviewHtml(code) {
  try {
    const doc = await executeDocxCode(code)
 
    const blob = await docxLib.Packer.toBlob(doc)
    const arrayBuffer = await blob.arrayBuffer()
 
    const result = await mammoth.convertToHtml(
      { arrayBuffer },
      {
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
        ]
      }
    )
 
    const styledHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12pt; color: #374151; background: #f9f9f9; }
  .page { background: white; max-width: 850px; margin: 24px auto; padding: 72px 80px; box-shadow: 0 2px 16px rgba(0,0,0,0.10); min-height: 1100px; border-radius: 4px; }
  h1 { font-size: 20pt; font-weight: 700; color: #1F1235; margin-top: 28px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #7C3AED; }
  h2 { font-size: 15pt; font-weight: 700; color: #7C3AED; margin-top: 20px; margin-bottom: 8px; }
  h3 { font-size: 12pt; font-weight: 700; color: #374151; margin-top: 14px; margin-bottom: 6px; }
  p { line-height: 1.7; margin-bottom: 8px; text-align: justify; }
  ul, ol { padding-left: 24px; margin: 8px 0; }
  li { margin: 4px 0; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  thead tr { background: #7C3AED; color: white; }
  th { padding: 9px 12px; text-align: left; font-weight: 600; color: white; }
  td { padding: 8px 12px; border-bottom: 1px solid #E5E7EB; }
  tr:nth-child(even) td { background: #F5F3FF; }
  strong { color: #1F1235; font-weight: 600; }
</style>
</head>
<body>
<div class="page">${result.value}</div>
</body>
</html>`
 
    return { success: true, html: styledHtml }
 
  } catch (error) {
    console.error('generatePreviewHtml error:', error)
    return { success: false, error: error.message }
  }
}
 
export async function generateAndDownloadDocx(code, filename = 'LCL-AI-Document') {
  try {
    const doc = await executeDocxCode(code)
    const blob = await docxLib.Packer.toBlob(doc)
    saveAs(blob, `${filename}.docx`)
    return { success: true }
  } catch (error) {
    console.error('generateDocx error:', error)
    return { success: false, error: error.message }
  }
}
 