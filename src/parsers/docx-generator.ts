import { XMLParser } from 'fast-xml-parser'
import AdmZip from 'adm-zip'
import path from 'node:path'
import type {
  Block,
  DocxDocument,
  DocxMetadata,
  ParagraphAlign,
  ParagraphBlock,
  TableBlock,
  TableCellBlock,
  TableRow,
  TextRun,
} from '../types/index.js'

type HtmlTextNode = { type: 'text'; content: string }
type HtmlElementNode = {
  type: 'element'
  tag: string
  attributes: Record<string, string>
  children: HtmlNode[]
}
type HtmlNode = HtmlTextNode | HtmlElementNode

interface TextStyle {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  font?: string
  size?: number
}


interface DocxStructure {
  document: string
  styles: string
  numbering: string
  contentTypes: string
  rels: string
  docRels: string
  core: string
  app: string
}

const sanitizeHtml = (html: string): string => {
  let out = html.replace(/<!DOCTYPE[^>]*>/gi, '')
  out = out.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  out = out.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  out = out.replace(/<meta[^>]*>/gi, '')
  out = out.replace(/<link[^>]*>/gi, '')
  return out
}

const decodeHtmlEntities = (input: string): string => {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
}

const parseAttributes = (raw: Record<string, string>): Record<string, string> => {
  const attrs: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    const normalized = key.startsWith('@_') ? key.slice(2) : key
    attrs[normalized.toLowerCase()] = String(value)
  }
  return attrs
}

const convertPreserveNodes = (nodes: unknown[]): HtmlNode[] => {
  const result: HtmlNode[] = []
  for (const node of nodes) {
    if (node === null || node === undefined) {
      continue
    }
    if (typeof node === 'string') {
      result.push({ type: 'text', content: decodeHtmlEntities(node) })
      continue
    }
    if (typeof node !== 'object') {
      continue
    }
    const entries = Object.entries(node as Record<string, unknown>)
    for (const [key, value] of entries) {
      if (key === '#text') {
        result.push({ type: 'text', content: decodeHtmlEntities(String(value)) })
        continue
      }
      if (key === ':@') {
        continue
      }
      const attributes = parseAttributes((node as Record<string, Record<string, string>>)[':@'] ?? {})
      const children = Array.isArray(value) ? convertPreserveNodes(value) : []
      result.push({
        type: 'element',
        tag: key.toLowerCase(),
        attributes,
        children,
      })
    }
  }
  return result
}

const parseHtml = (html: string): HtmlNode[] => {
  const parser = new XMLParser({
    ignoreAttributes: false,
    preserveOrder: true,
    attributeNamePrefix: '@_',
    trimValues: false,
  })
  const wrapped = `<root>${sanitizeHtml(html)}</root>`
  const parsed = parser.parse(wrapped)
  if (Array.isArray(parsed)) {
    const rootNode = parsed.find((node) => typeof node === 'object' && node !== null && 'root' in node)
    const rootChildren = rootNode && typeof rootNode === 'object' ? (rootNode as { root: unknown[] }).root : []
    return convertPreserveNodes(Array.isArray(rootChildren) ? rootChildren : [])
  }
  if (parsed && typeof parsed === 'object' && 'root' in parsed) {
    const rootChildren = (parsed as { root: unknown[] }).root
    return convertPreserveNodes(Array.isArray(rootChildren) ? rootChildren : [])
  }
  return []
}

const mergeStyle = (base: TextStyle, next: TextStyle): TextStyle => {
  return {
    bold: next.bold ?? base.bold,
    italic: next.italic ?? base.italic,
    underline: next.underline ?? base.underline,
    font: next.font ?? base.font,
    size: next.size ?? base.size,
  }
}

const parseStyleAttribute = (style: string): TextStyle => {
  const next: TextStyle = {}
  const parts = style.split(';').map((part) => part.trim())
  for (const part of parts) {
    if (!part) {
      continue
    }
    const [rawKey, rawValue] = part.split(':').map((segment) => segment.trim())
    if (!rawKey || !rawValue) {
      continue
    }
    const key = rawKey.toLowerCase()
    const value = rawValue.toLowerCase()
    if (key === 'font-weight') {
      if (value === 'bold' || Number(value) >= 600) {
        next.bold = true
      }
    }
    if (key === 'font-style' && value.includes('italic')) {
      next.italic = true
    }
    if (key === 'text-decoration' && value.includes('underline')) {
      next.underline = true
    }
    if (key === 'font-family') {
      const family = rawValue.split(',')[0]?.trim().replace(/["']/g, '')
      if (family) {
        next.font = family
      }
    }
    if (key === 'font-size') {
      const size = parseFloat(rawValue)
      if (!Number.isNaN(size)) {
        if (rawValue.endsWith('px')) {
          next.size = Math.round(size * 0.75 * 10) / 10
        } else {
          next.size = size
        }
      }
    }
  }
  return next
}

const getParagraphAlign = (attributes: Record<string, string>): ParagraphAlign | undefined => {
  const style = attributes.style
  if (!style) {
    return undefined
  }
  const match = /text-align\s*:\s*(left|center|right|justify)/i.exec(style)
  if (!match) {
    return undefined
  }
  return match[1].toLowerCase() as ParagraphAlign
}

const collectRuns = (nodes: HtmlNode[], style: TextStyle): TextRun[] => {
  const runs: TextRun[] = []
  for (const node of nodes) {
    if (node.type === 'text') {
      const parts = node.content.split(/\r?\n/)
      parts.forEach((part, index) => {
        if (index > 0) {
          runs.push({ break: true, ...style })
        }
        if (part.length > 0) {
          runs.push({ text: part, ...style })
        }
      })
      continue
    }
    const tag = node.tag
    if (tag === 'br') {
      runs.push({ break: true, ...style })
      continue
    }
    if (tag === 'strong' || tag === 'b') {
      runs.push(...collectRuns(node.children, mergeStyle(style, { bold: true })))
      continue
    }
    if (tag === 'em' || tag === 'i') {
      runs.push(...collectRuns(node.children, mergeStyle(style, { italic: true })))
      continue
    }
    if (tag === 'u') {
      runs.push(...collectRuns(node.children, mergeStyle(style, { underline: true })))
      continue
    }
    if (tag === 'span') {
      const styleAttr = node.attributes.style
      const next = styleAttr ? mergeStyle(style, parseStyleAttribute(styleAttr)) : style
      runs.push(...collectRuns(node.children, next))
      continue
    }
    runs.push(...collectRuns(node.children, style))
  }
  return runs
}

const buildParagraph = (
  nodes: HtmlNode[],
  attributes: Record<string, string>,
  list?: { type: 'bullet' | 'number'; level: number },
): ParagraphBlock => {
  const baseStyle: TextStyle = {}
  const paragraphStyle = attributes.style ? parseStyleAttribute(attributes.style) : {}
  const runs = collectRuns(nodes, mergeStyle(baseStyle, paragraphStyle))
  return {
    type: 'paragraph',
    runs: runs.length > 0 ? runs : [{ text: '' }],
    align: getParagraphAlign(attributes),
    list,
  }
}

const splitListChildren = (nodes: HtmlNode[]) => {
  const inline: HtmlNode[] = []
  const lists: HtmlNode[] = []
  for (const node of nodes) {
    if (node.type === 'element' && (node.tag === 'ul' || node.tag === 'ol')) {
      lists.push(node)
    } else {
      inline.push(node)
    }
  }
  return { inline, lists }
}

const buildListBlocks = (
  listNode: HtmlElementNode,
  type: 'bullet' | 'number',
  level: number,
): Block[] => {
  const blocks: Block[] = []
  const items = listNode.children.filter(
    (child): child is HtmlElementNode => child.type === 'element' && child.tag === 'li',
  )
  for (const item of items) {
    const { inline, lists } = splitListChildren(item.children)
    blocks.push(buildParagraph(inline, item.attributes, { type, level }))
    for (const nested of lists) {
      if (nested.type === 'element') {
        const nestedType = nested.tag === 'ol' ? 'number' : 'bullet'
        blocks.push(...buildListBlocks(nested, nestedType, Math.min(level + 1, 8)))
      }
    }
  }
  return blocks
}

const buildTable = (node: HtmlElementNode): TableBlock => {
  const rows: TableRow[] = []
  const trNodes = node.children.filter(
    (child): child is HtmlElementNode => child.type === 'element' && child.tag === 'tr',
  )
  for (const tr of trNodes) {
    const cells: TableCellBlock[] = []
    const cellNodes = tr.children.filter(
      (child): child is HtmlElementNode =>
        child.type === 'element' && (child.tag === 'td' || child.tag === 'th'),
    )
    for (const cell of cellNodes) {
      const colSpan = Number(cell.attributes.colspan)
      const rowSpan = Number(cell.attributes.rowspan)
      const cellBlocks = buildBlocks(cell.children)
      cells.push({
        blocks: cellBlocks.length > 0 ? cellBlocks : [{ type: 'paragraph', runs: [{ text: '' }] }],
        colSpan: Number.isFinite(colSpan) && colSpan > 1 ? colSpan : undefined,
        rowSpan: Number.isFinite(rowSpan) && rowSpan > 1 ? rowSpan : undefined,
      })
    }
    rows.push({ cells })
  }
  return { type: 'table', rows: normalizeTableRows(rows) }
}

type GridSlot =
  | { kind: 'cell'; cell: TableCellBlock; colSpan: number; rowSpan: number }
  | { kind: 'vmerge'; colSpan: number }
  | { kind: 'skip' }

const normalizeTableRows = (rows: TableRow[]): TableRow[] => {
  const grid: GridSlot[][] = []
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]
    if (!grid[rowIndex]) {
      grid[rowIndex] = []
    }
    let colIndex = 0
    for (const cell of row.cells) {
      while (grid[rowIndex][colIndex]) {
        colIndex += 1
      }
      const colSpan = cell.colSpan ?? 1
      const rowSpan = cell.rowSpan ?? 1
      grid[rowIndex][colIndex] = { kind: 'cell', cell, colSpan, rowSpan }
      for (let c = 1; c < colSpan; c += 1) {
        grid[rowIndex][colIndex + c] = { kind: 'skip' }
      }
      for (let r = 1; r < rowSpan; r += 1) {
        if (!grid[rowIndex + r]) {
          grid[rowIndex + r] = []
        }
        for (let c = 0; c < colSpan; c += 1) {
          grid[rowIndex + r][colIndex + c] = { kind: 'vmerge', colSpan }
        }
      }
      colIndex += colSpan
    }
  }
  const normalized: TableRow[] = []
  for (const rowSlots of grid) {
    const cells: TableCellBlock[] = []
    for (const slot of rowSlots) {
      if (!slot || slot.kind === 'skip') {
        continue
      }
      if (slot.kind === 'vmerge') {
        cells.push({
          blocks: [],
          colSpan: slot.colSpan > 1 ? slot.colSpan : undefined,
          rowSpan: 0,
        })
      } else if (slot.kind === 'cell') {
        cells.push({
          blocks: slot.cell.blocks,
          colSpan: slot.colSpan > 1 ? slot.colSpan : undefined,
          rowSpan: slot.rowSpan > 1 ? slot.rowSpan : undefined,
        })
      }
    }
    normalized.push({ cells })
  }
  return normalized
}

const buildBlocks = (nodes: HtmlNode[]): Block[] => {
  const blocks: Block[] = []
  for (const node of nodes) {
    if (node.type === 'text') {
      const text = node.content.trim()
      if (text.length > 0) {
        blocks.push({
          type: 'paragraph',
          runs: [{ text }],
        })
      }
      continue
    }
    if (node.type === 'element' && (node.tag === 'p' || node.tag === 'div')) {
      blocks.push(buildParagraph(node.children, node.attributes))
      continue
    }
    if (node.type === 'element' && node.tag === 'table') {
      blocks.push(buildTable(node))
      continue
    }
    if (node.type === 'element' && (node.tag === 'ul' || node.tag === 'ol')) {
      const listType = node.tag === 'ol' ? 'number' : 'bullet'
      blocks.push(...buildListBlocks(node, listType, 0))
      continue
    }
    if (node.type === 'element' && node.tag === 'br') {
      blocks.push({
        type: 'paragraph',
        runs: [{ break: true }],
      })
      continue
    }
    if (node.type === 'element') {
      blocks.push(...buildBlocks(node.children))
    }
  }
  return blocks
}

export const parseHtmlToDocx = (html: string): DocxDocument => {
  const nodes = parseHtml(html)
  const blocks = buildBlocks(nodes)
  if (blocks.length === 0) {
    throw new Error('No content extracted from HTML - empty document')
  }
  return {
    blocks,
  }
}

const escapeXml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const textNeedsPreserve = (text: string): boolean => {
  return /^\s|\s$/.test(text) || text.includes('  ')
}

const buildRunXml = (run: TextRun): string => {
  if (run.break) {
    return '<w:r><w:br/></w:r>'
  }
  const text = run.text ?? ''
  const props: string[] = []
  if (run.bold) {
    props.push('<w:b/>')
  }
  if (run.italic) {
    props.push('<w:i/>')
  }
  if (run.underline) {
    props.push('<w:u w:val="single"/>')
  }
  if (run.font) {
    const font = escapeXml(run.font)
    props.push(
      `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${font}" w:cs="${font}"/>`,
    )
  }
  if (run.size && Number.isFinite(run.size)) {
    const size = Math.max(1, Math.round(run.size * 2))
    props.push(`<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`)
  }
  const rPr = props.length > 0 ? `<w:rPr>${props.join('')}</w:rPr>` : ''
  const space = textNeedsPreserve(text) ? ' xml:space="preserve"' : ''
  return `<w:r>${rPr}<w:t${space}>${escapeXml(text)}</w:t></w:r>`
}

const buildParagraphXml = (paragraph: ParagraphBlock): string => {
  const props: string[] = []
  if (paragraph.align) {
    props.push(`<w:jc w:val="${paragraph.align}"/>`)
  }
  if (paragraph.list) {
    const numId = paragraph.list.type === 'bullet' ? 1 : 2
    const level = Math.max(0, Math.min(paragraph.list.level, 8))
    props.push(
      `<w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${numId}"/></w:numPr>`,
    )
  }
  const pPr = props.length > 0 ? `<w:pPr>${props.join('')}</w:pPr>` : ''
  const runs = paragraph.runs.length > 0 ? paragraph.runs : [{ text: '' }]
  const runXml = runs.map(buildRunXml).join('')
  return `<w:p>${pPr}${runXml}</w:p>`
}

const buildTableXml = (table: TableBlock): string => {
  const tblPrParts: string[] = []
  if (table.columnWidths && table.columnWidths.length > 0) {
    tblPrParts.push('<w:tblLayout w:type="fixed"/>')
  }
  if (table.hasBorders) {
    tblPrParts.push(
      '<w:tblBorders>' +
        '<w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
        '<w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
        '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
        '<w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
        '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
        '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
        '</w:tblBorders>',
    )
  }
  if (tblPrParts.length > 0) {
    tblPrParts.unshift('<w:tblW w:w="0" w:type="auto"/>')
  }
  const tblPr = tblPrParts.length > 0 ? `<w:tblPr>${tblPrParts.join('')}</w:tblPr>` : ''
  const tblGrid =
    table.columnWidths && table.columnWidths.length > 0
      ? `<w:tblGrid>${table.columnWidths
          .map((width) => `<w:gridCol w:w="${Math.max(1, Math.round(width))}"/>`)
          .join('')}</w:tblGrid>`
      : ''
  const rowsXml = table.rows
    .map((row) => {
      const cellsXml = row.cells
        .map((cell) => {
          const props: string[] = []
          if (cell.colSpan) {
            props.push(`<w:gridSpan w:val="${cell.colSpan}"/>`)
          }
          if (cell.rowSpan !== undefined) {
            if (cell.rowSpan > 1) {
              props.push('<w:vMerge w:val="restart"/>')
            } else if (cell.rowSpan === 0) {
              props.push('<w:vMerge/>')
            }
          }
          if (cell.widthTwips && Number.isFinite(cell.widthTwips)) {
            props.push(`<w:tcW w:w="${Math.max(1, Math.round(cell.widthTwips))}" w:type="dxa"/>`)
          }
          const tcPr = props.length > 0 ? `<w:tcPr>${props.join('')}</w:tcPr>` : ''
          if (cell.blocks.length === 0) {
            throw new Error('Empty table cell - no content')
          }
          const blocks = cell.blocks
          const inner = blocks
            .map((block) => {
              if (block.type === 'paragraph') {
                return buildParagraphXml(block)
              }
              if (block.type === 'table') {
                return buildTableXml(block)
              }
              return ''
            })
            .join('')
          return `<w:tc>${tcPr}${inner}</w:tc>`
        })
        .join('')
      return `<w:tr>${cellsXml}</w:tr>`
    })
    .join('')
  return `<w:tbl>${tblPr}${tblGrid}${rowsXml}</w:tbl>`
}

const buildDocumentXml = (doc: DocxDocument): string => {
  const body = doc.blocks
    .map((block) => {
      if (block.type === 'paragraph') {
        return buildParagraphXml(block)
      }
      if (block.type === 'table') {
        return buildTableXml(block)
      }
      return ''
    })
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`
}

const buildStylesXml = (): string => {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Malgun Gothic" w:cs="Calibri"/>
        <w:lang w:val="en-US" w:eastAsia="ko-KR"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
</w:styles>`
}

const buildNumberingXml = (): string => {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="•"/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:ind w:left="720" w:hanging="360"/>
      </w:pPr>
      <w:rPr>
        <w:rFonts w:ascii="Symbol" w:hAnsi="Symbol"/>
      </w:rPr>
    </w:lvl>
    <w:lvl w:ilvl="1">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="•"/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:ind w:left="1440" w:hanging="360"/>
      </w:pPr>
    </w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="2">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%1."/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:ind w:left="720" w:hanging="360"/>
      </w:pPr>
    </w:lvl>
    <w:lvl w:ilvl="1">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%2."/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:ind w:left="1440" w:hanging="360"/>
      </w:pPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1">
    <w:abstractNumId w:val="1"/>
  </w:num>
  <w:num w:numId="2">
    <w:abstractNumId w:val="2"/>
  </w:num>
</w:numbering>`
}

const buildContentTypesXml = (): string => {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`
}

const buildRootRelsXml = (): string => {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`
}

const buildDocumentRelsXml = (): string => {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`
}

const buildCoreXml = (metadata: DocxMetadata): string => {
  const now = new Date().toISOString()
  const title = metadata.title ? `<dc:title>${escapeXml(metadata.title)}</dc:title>` : ''
  const creator = metadata.author
    ? `<dc:creator>${escapeXml(metadata.author)}</dc:creator>`
    : ''
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:dcmitype="http://purl.org/dc/dcmitype/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  ${title}
  ${creator}
  <cp:lastModifiedBy>HWP MCP</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`
}

const buildAppXml = (metadata: DocxMetadata): string => {
  const pagesTag =
    metadata.pages && metadata.pages > 0 ? `<Pages>${metadata.pages}</Pages>` : ''
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
  xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>HWP MCP</Application>
  ${pagesTag}
</Properties>`
}

export const generateDocxXml = (
  doc: DocxDocument,
  metadata: DocxMetadata,
): DocxStructure => {
  return {
    document: buildDocumentXml(doc),
    styles: buildStylesXml(),
    numbering: buildNumberingXml(),
    contentTypes: buildContentTypesXml(),
    rels: buildRootRelsXml(),
    docRels: buildDocumentRelsXml(),
    core: buildCoreXml(metadata),
    app: buildAppXml(metadata),
  }
}

export const writeDocxFile = async (
  outputPath: string,
  doc: DocxDocument,
  metadata: DocxMetadata,
): Promise<string> => {
  const structure = generateDocxXml(doc, metadata)
  const zip = new AdmZip()
  zip.addFile('[Content_Types].xml', Buffer.from(structure.contentTypes, 'utf8'))
  zip.addFile('_rels/.rels', Buffer.from(structure.rels, 'utf8'))
  zip.addFile('word/document.xml', Buffer.from(structure.document, 'utf8'))
  zip.addFile('word/styles.xml', Buffer.from(structure.styles, 'utf8'))
  zip.addFile('word/numbering.xml', Buffer.from(structure.numbering, 'utf8'))
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(structure.docRels, 'utf8'))
  zip.addFile('docProps/core.xml', Buffer.from(structure.core, 'utf8'))
  zip.addFile('docProps/app.xml', Buffer.from(structure.app, 'utf8'))
  const normalized = outputPath.endsWith('.docx') ? outputPath : `${outputPath}.docx`
  const resolved = path.resolve(normalized)
  zip.writeZip(resolved)
  return resolved
}
