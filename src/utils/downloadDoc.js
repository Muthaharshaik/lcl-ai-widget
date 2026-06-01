import { Document, Paragraph, TextRun, HeadingLevel, Packer } from 'docx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'

export async function downloadAsWord(content, filename = 'LCL-AI-Document') {
  const lines = content.split('\n').filter(Boolean)

  const children = lines.map(line => {
    if (line.startsWith('# ')) {
      return new Paragraph({
        text: line.replace('# ', ''),
        heading: HeadingLevel.HEADING_1,
      })
    }
    if (line.startsWith('## ')) {
      return new Paragraph({
        text: line.replace('## ', ''),
        heading: HeadingLevel.HEADING_2,
      })
    }
    if (line.startsWith('### ')) {
      return new Paragraph({
        text: line.replace('### ', ''),
        heading: HeadingLevel.HEADING_3,
      })
    }
    return new Paragraph({
      children: [new TextRun({ text: line, size: 24 })],
    })
  })

  const doc = new Document({
    sections: [{ children }],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `${filename}.docx`)
}

export function downloadAsPDF(content, filename = 'LCL-AI-Document') {
  const doc = new jsPDF()
  const lines = doc.splitTextToSize(content, 180)
  let y = 15

  lines.forEach(line => {
    if (y > 280) {
      doc.addPage()
      y = 15
    }
    doc.setFontSize(11)
    doc.text(line, 15, y)
    y += 7
  })

  doc.save(`${filename}.pdf`)
}