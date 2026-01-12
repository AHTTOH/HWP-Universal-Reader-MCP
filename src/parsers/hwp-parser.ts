import fs from 'node:fs/promises'
import { parse } from 'hwp.js'
const makeCtrlID = (first: string, second: string, third: string, fourth: string): number => {
  const firstCode = first.charCodeAt(0)
  const secondCode = second.charCodeAt(0)
  const thirdCode = third.charCodeAt(0)
  const fourthCode = fourth.charCodeAt(0)
  return (firstCode << 24) | (secondCode << 16) | (thirdCode << 8) | fourthCode
}

const CommonCtrlID = {
  Table: makeCtrlID('t', 'b', 'l', ' '),
} as const

const OtherCtrlID = {
  Header: makeCtrlID('h', 'e', 'a', 'd'),
  Footer: makeCtrlID('f', 'o', 'o', 't'),
  Footnote: makeCtrlID('f', 'n', ' ', ' '),
  Endnote: makeCtrlID('e', 'n', ' ', ' '),
} as const
import { read, find } from 'cfb'
import iconv from 'iconv-lite'
import { ErrorCode } from '../types/index.js'
import type {
  DocxDocument,
  DocxMetadata,
  ParagraphBlock,
  TableBlock,
  TableCellBlock,
  TableRow,
  TextRun,
  HwpMetadata,
} from '../types/index.js'
import { HwpError } from '../utils/error-handler.js'
import { checkMemory } from '../utils/memory.js'

type HwpChar = { value: number | string; type: number }
type HwpParagraph = { content: HwpChar[]; controls?: Array<{ id?: number; content?: unknown }> }
type HwpSection = { content: HwpParagraph[] }
type HwpDocument = {
  header?: { version?: { toString(): string }; properties?: { encrypted?: boolean } }
  sections?: HwpSection[]
}

const PID_TITLE = 0x00000002
const PID_AUTHOR = 0x00000004
const PID_LASTAUTHOR = 0x00000008
const PID_PAGECOUNT = 0x0000000e
const PID_CODEPAGE = 0x00000001

const VT_I2 = 0x0002
const VT_I4 = 0x0003
const VT_UI4 = 0x0013
const VT_LPSTR = 0x001e
const VT_LPWSTR = 0x001f

const decodeAnsiString = (input: Buffer, codepage?: number): string => {
  if (codepage === 65001) {
    return input.toString('utf8').replace(/\0+$/, '')
  }
  if (codepage === 1200) {
    return input.toString('utf16le').replace(/\0+$/, '')
  }
  const utf8 = input.toString('utf8')
  if (!utf8.includes('\ufffd')) {
    return utf8.replace(/\0+$/, '')
  }
  return iconv.decode(input, 'cp949').replace(/\0+$/, '')
}

const parsePropertySet = (buffer: Buffer): Map<number, { type: number; value: unknown }> => {
  const result = new Map<number, { type: number; value: unknown }>()
  if (buffer.length < 28) {
    return result
  }
  const byteOrder = buffer.readUInt16LE(0)
  if (byteOrder !== 0xfffe) {
    return result
  }
  const sectionCount = buffer.readUInt32LE(24)
  let cursor = 28
  for (let i = 0; i < sectionCount; i += 1) {
    const sectionOffset = buffer.readUInt32LE(cursor + 16)
    cursor += 20
    if (sectionOffset + 8 > buffer.length) {
      continue
    }
    const propertyCount = buffer.readUInt32LE(sectionOffset + 4)
    for (let j = 0; j < propertyCount; j += 1) {
      const propId = buffer.readUInt32LE(sectionOffset + 8 + j * 8)
      const propOffset = buffer.readUInt32LE(sectionOffset + 12 + j * 8)
      const valueOffset = sectionOffset + propOffset
      if (valueOffset + 4 > buffer.length) {
        continue
      }
      const type = buffer.readUInt32LE(valueOffset) & 0xffff
      const valueStart = valueOffset + 4
      let value: unknown
      if (type === VT_I2 && valueStart + 2 <= buffer.length) {
        value = buffer.readUInt16LE(valueStart)
      } else if ((type === VT_I4 || type === VT_UI4) && valueStart + 4 <= buffer.length) {
        value = buffer.readUInt32LE(valueStart)
      } else if (type === VT_LPSTR && valueStart + 4 <= buffer.length) {
        const size = buffer.readUInt32LE(valueStart)
        const textBytes = buffer.subarray(valueStart + 4, valueStart + 4 + size)
        value = textBytes
      } else if (type === VT_LPWSTR && valueStart + 4 <= buffer.length) {
        const size = buffer.readUInt32LE(valueStart)
        const byteLen = size * 2
        const textBytes = buffer.subarray(valueStart + 4, valueStart + 4 + byteLen)
        value = textBytes
      }
      if (value !== undefined) {
        result.set(propId, { type, value })
      }
    }
  }
  return result
}

const extractSummaryInfo = (buffer: Buffer): Partial<HwpMetadata> => {
  let title: string | undefined
  let author: string | undefined
  let pages: number | undefined
  try {
    const container = read(buffer)
    const summary = find(container, '\u0005SummaryInformation')
    const docSummary = find(container, '\u0005DocumentSummaryInformation')
    const summaryProps = summary?.content ? parsePropertySet(Buffer.from(summary.content as Uint8Array)) : null
    const docSummaryProps = docSummary?.content
      ? parsePropertySet(Buffer.from(docSummary.content as Uint8Array))
      : null
    const codepageProp =
      summaryProps?.get(PID_CODEPAGE)?.value ??
      docSummaryProps?.get(PID_CODEPAGE)?.value ??
      undefined
    const codepage = typeof codepageProp === 'number' ? codepageProp : undefined
    const getText = (props: Map<number, { type: number; value: unknown }> | null, id: number) => {
      if (!props) {
        return undefined
      }
      const entry = props.get(id)
      if (!entry) {
        return undefined
      }
      if (typeof entry.value === 'string') {
        return entry.value
      }
      if (Buffer.isBuffer(entry.value)) {
        if (entry.type === VT_LPWSTR) {
          return entry.value.toString('utf16le').replace(/\0+$/, '')
        }
        return decodeAnsiString(entry.value, codepage)
      }
      return undefined
    }
    const getNumber = (props: Map<number, { type: number; value: unknown }> | null, id: number) => {
      if (!props) {
        return undefined
      }
      const entry = props.get(id)
      if (!entry) {
        return undefined
      }
      if (typeof entry.value === 'number') {
        return entry.value
      }
      return undefined
    }
    title = getText(summaryProps, PID_TITLE) ?? getText(docSummaryProps, PID_TITLE)
    author =
      getText(summaryProps, PID_AUTHOR) ??
      getText(summaryProps, PID_LASTAUTHOR) ??
      getText(docSummaryProps, PID_AUTHOR) ??
      getText(docSummaryProps, PID_LASTAUTHOR)
    pages =
      getNumber(summaryProps, PID_PAGECOUNT) ??
      getNumber(docSummaryProps, PID_PAGECOUNT) ??
      undefined
  } catch {
    return {}
  }
  return { title, author, pages }
}

const extractParagraphText = (paragraph: HwpParagraph): string => {
  if (!paragraph.content || paragraph.content.length === 0) {
    return ''
  }
  let text = ''
  for (const char of paragraph.content) {
    if (typeof char.value === 'string') {
      text += normalizeHwpText(char.value)
      continue
    }
    if (typeof char.value === 'number') {
      if (char.value === 10 || char.value === 13) {
        text += '\n'
      }
    }
  }
  return text
}

const normalizeHwpText = (value: string): string => {
  return value.replace(/\u20de/g, '□')
}

const buildRunsFromParagraph = (paragraph: HwpParagraph): TextRun[] => {
  const runs: TextRun[] = []
  if (!paragraph.content || paragraph.content.length === 0) {
    return [{ text: '' }]
  }
  let buffer = ''
  for (const char of paragraph.content) {
    if (typeof char.value === 'string') {
      buffer += normalizeHwpText(char.value)
      continue
    }
    if (typeof char.value === 'number' && (char.value === 10 || char.value === 13)) {
      if (buffer.length > 0) {
        runs.push({ text: buffer })
        buffer = ''
      }
      runs.push({ break: true })
    }
  }
  if (buffer.length > 0) {
    runs.push({ text: buffer })
  }
  return runs.length > 0 ? runs : [{ text: '' }]
}

const buildParagraphBlock = (paragraph: HwpParagraph): ParagraphBlock => {
  return {
    type: 'paragraph',
    runs: buildRunsFromParagraph(paragraph),
  }
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

const toTwips = (value?: number): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined
  }
  return Math.max(1, Math.round(value / 5))
}

const buildTableFromControl = (control: { content?: unknown }): TableBlock => {
  const table = control as {
    content?: Array<
      Array<{
        items?: HwpParagraph[]
        attribute?: { colSpan?: number; rowSpan?: number; column?: number; row?: number; width?: number }
      }>
    >
    columnCount?: number
  }
  const rows: TableRow[] = []
  const columnCount = Number.isFinite(table.columnCount) ? (table.columnCount as number) : undefined
  const columnWidths = columnCount ? new Array(columnCount).fill(0) : []
  for (const row of table.content ?? []) {
    const cells: TableCellBlock[] = []
    let columnIndex = 0
    for (const cell of row ?? []) {
      const items = cell?.items ?? []
      const blocks = items.map(buildParagraphBlock)
      const colSpanValue = cell?.attribute?.colSpan
      const rowSpanValue = cell?.attribute?.rowSpan
      const colSpan = colSpanValue && colSpanValue > 1 ? colSpanValue : undefined
      const rowSpan = rowSpanValue && rowSpanValue > 1 ? rowSpanValue : undefined
      const widthTwips = toTwips(cell?.attribute?.width)
      const explicitColumn =
        typeof cell?.attribute?.column === 'number' && cell.attribute.column >= 0
          ? cell.attribute.column
          : undefined
      const effectiveCol = explicitColumn ?? columnIndex
      if (widthTwips && columnWidths.length > 0) {
        const span = colSpan ?? 1
        const perCol = Math.max(1, Math.round(widthTwips / span))
        for (let i = 0; i < span; i += 1) {
          const target = effectiveCol + i
          if (target >= 0 && target < columnWidths.length) {
            columnWidths[target] = Math.max(columnWidths[target], perCol)
          }
        }
      }
      cells.push({
        blocks: blocks.length > 0 ? blocks : [{ type: 'paragraph', runs: [{ text: '' }] }],
        colSpan,
        rowSpan,
        widthTwips,
      })
      columnIndex = effectiveCol + (colSpan ?? 1)
    }
    rows.push({ cells })
  }
  const hasWidths = columnWidths.some((width) => width > 0)
  if (hasWidths) {
    const maxWidth = Math.max(...columnWidths)
    for (let i = 0; i < columnWidths.length; i += 1) {
      if (!columnWidths[i] || columnWidths[i] <= 0) {
        columnWidths[i] = maxWidth
      }
    }
  }
  return {
    type: 'table',
    rows: normalizeTableRows(rows),
    columnWidths: hasWidths ? columnWidths : undefined,
    hasBorders: true,
  }
}

const buildBlocksFromParagraphs = (paragraphs: HwpParagraph[]): Array<ParagraphBlock> => {
  return paragraphs.map(buildParagraphBlock)
}

const extractTableText = (control: { content?: unknown }): string => {
  const table = control as {
    content?: Array<Array<{ items?: HwpParagraph[] }>>
  }
  if (!table.content) {
    return ''
  }
  const rows: string[] = []
  for (const row of table.content) {
    if (!row) {
      continue
    }
    const cells: string[] = []
    for (const cell of row) {
      const items = cell?.items ?? []
      const cellText = items.map(extractParagraphText).join('\n').trim()
      cells.push(cellText)
    }
    rows.push(cells.join('\t'))
  }
  return rows.join('\n')
}

const collectParagraphs = (node: unknown, out: HwpParagraph[]) => {
  if (!node) {
    return
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      collectParagraphs(item, out)
    }
    return
  }
  if (typeof node !== 'object') {
    return
  }
  const candidate = node as { content?: unknown; items?: unknown }
  if (Array.isArray(candidate.content)) {
    const content = candidate.content as unknown[]
    if (content.length > 0 && typeof content[0] === 'object' && content[0] !== null) {
      const maybeChar = content[0] as { value?: unknown }
      if ('value' in maybeChar) {
        out.push(candidate as HwpParagraph)
      } else {
        collectParagraphs(content, out)
      }
    }
  }
  if (Array.isArray(candidate.items)) {
    collectParagraphs(candidate.items, out)
  }
}

const extractControlText = (control: unknown): string => {
  const paragraphs: HwpParagraph[] = []
  collectParagraphs(control, paragraphs)
  return paragraphs.map(extractParagraphText).filter((text) => text.length > 0).join('\n')
}

const extractText = (document: HwpDocument): string => {
  const parts: string[] = []
  for (const section of document.sections ?? []) {
    for (const paragraph of section.content ?? []) {
      const paragraphText = extractParagraphText(paragraph).trimEnd()
      if (paragraphText.length > 0) {
        parts.push(paragraphText)
      }
      for (const control of paragraph.controls ?? []) {
        if (control?.id === CommonCtrlID.Table) {
          const tableText = extractTableText(control)
          if (tableText.length > 0) {
            parts.push(tableText)
          }
          continue
        }
        if (
          control?.id === OtherCtrlID.Header ||
          control?.id === OtherCtrlID.Footer ||
          control?.id === OtherCtrlID.Footnote ||
          control?.id === OtherCtrlID.Endnote
        ) {
          const controlText = extractControlText(control)
          if (controlText.length > 0) {
            parts.push(controlText)
          }
        }
      }
    }
  }
  return parts.join('\n')
}

const extractSectionText = (section: HwpSection): string => {
  const parts: string[] = []
  for (const paragraph of section.content ?? []) {
    const paragraphText = extractParagraphText(paragraph).trimEnd()
    if (paragraphText.length > 0) {
      parts.push(paragraphText)
    }
    for (const control of paragraph.controls ?? []) {
      if (control?.id === CommonCtrlID.Table) {
        const tableText = extractTableText(control)
        if (tableText.length > 0) {
          parts.push(tableText)
        }
        continue
      }
      if (
        control?.id === OtherCtrlID.Header ||
        control?.id === OtherCtrlID.Footer ||
        control?.id === OtherCtrlID.Footnote ||
        control?.id === OtherCtrlID.Endnote
      ) {
        const controlText = extractControlText(control)
        if (controlText.length > 0) {
          parts.push(controlText)
        }
      }
    }
  }
  return parts.join('\n')
}

const mapHwpParseError = (error: Error): HwpError => {
  const message = error.message.toLowerCase()
  if (message.includes('only support') || message.includes('compatible')) {
    return new HwpError(ErrorCode.UNSUPPORTED_VERSION, 'Unsupported HWP version', {
      cause: error.message,
    })
  }
  if (message.includes('signature') || message.includes('fileheader') || message.includes('section not exist')) {
    return new HwpError(ErrorCode.CORRUPTED, 'Corrupted HWP file', { cause: error.message })
  }
  return new HwpError(ErrorCode.PARSE_ERROR, 'Failed to parse HWP file', { cause: error.message })
}

export const parseHwpFile = async (
  filePath: string,
): Promise<{ text: string; metadata: HwpMetadata }> => {
  checkMemory()
  const buffer = await fs.readFile(filePath)
  checkMemory()
  let document: HwpDocument
  try {
    document = parse(buffer, { type: 'buffer' }) as unknown as HwpDocument
  } catch (error) {
    throw mapHwpParseError(error as Error)
  }
  if (document.header?.properties?.encrypted) {
    throw new HwpError(ErrorCode.ENCRYPTED, 'Encrypted HWP files are not supported')
  }
  const summary = extractSummaryInfo(buffer)
  const metadata: HwpMetadata = {
    version: document.header?.version?.toString() ?? '5.0.0.0',
    title: summary.title,
    author: summary.author,
    pages: summary.pages,
  }
  const text = extractText(document)
  return { text, metadata }
}

export const streamHwpText = async function* (
  filePath: string,
): AsyncGenerator<string> {
  checkMemory()
  const buffer = await fs.readFile(filePath)
  checkMemory()
  const document = parse(buffer, { type: 'buffer' }) as unknown as HwpDocument
  if (document.header?.properties?.encrypted) {
    throw new HwpError(ErrorCode.ENCRYPTED, 'Encrypted HWP files are not supported')
  }
  for (const section of document.sections ?? []) {
    const sectionText = extractSectionText(section)
    if (sectionText.length > 0) {
      yield sectionText
    }
  }
}

export const parseHwpToDocx = async (
  filePath: string,
): Promise<{ doc: DocxDocument; metadata: DocxMetadata }> => {
  checkMemory()
  const buffer = await fs.readFile(filePath)
  checkMemory()
  let document: HwpDocument
  try {
    document = parse(buffer, { type: 'buffer' }) as unknown as HwpDocument
  } catch (error) {
    throw mapHwpParseError(error as Error)
  }
  if (document.header?.properties?.encrypted) {
    throw new HwpError(ErrorCode.ENCRYPTED, 'Encrypted HWP files are not supported')
  }
  const summary = extractSummaryInfo(buffer)
  const metadata: DocxMetadata = {
    title: summary.title,
    author: summary.author,
    pages: summary.pages,
  }
  const blocks: Array<ParagraphBlock | TableBlock> = []
  for (const section of document.sections ?? []) {
    for (const paragraph of section.content ?? []) {
      blocks.push(buildParagraphBlock(paragraph))
      for (const control of paragraph.controls ?? []) {
        if (control?.id === CommonCtrlID.Table) {
          blocks.push(buildTableFromControl(control))
          continue
        }
        if (
          control?.id === OtherCtrlID.Header ||
          control?.id === OtherCtrlID.Footer ||
          control?.id === OtherCtrlID.Footnote ||
          control?.id === OtherCtrlID.Endnote
        ) {
          const paragraphs: HwpParagraph[] = []
          collectParagraphs(control, paragraphs)
          blocks.push(...buildBlocksFromParagraphs(paragraphs))
        }
      }
    }
  }
  return {
    doc: { blocks },
    metadata,
  }
}
