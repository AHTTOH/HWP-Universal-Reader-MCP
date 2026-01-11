import { describe, expect, it } from 'vitest'
import { parseHtmlToDocx, generateDocxXml } from '../../src/parsers/docx-generator.js'

describe('docx generator', () => {
  it('maps basic formatting into WordprocessingML', () => {
    const html =
      '<p><strong>Bold</strong> <em>Italic</em> <u>Under</u></p><ul><li>Item</li></ul><table><tr><td>Cell</td></tr></table>'
    const doc = parseHtmlToDocx(html)
    const xml = generateDocxXml(doc, { title: 'Test' })
    expect(xml.document).toContain('<w:b/>')
    expect(xml.document).toContain('<w:i/>')
    expect(xml.document).toContain('<w:u w:val="single"/>')
    expect(xml.numbering).toContain('bullet')
    expect(xml.document).toContain('<w:tbl>')
  })
})
