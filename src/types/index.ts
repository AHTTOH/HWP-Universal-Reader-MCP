export enum ErrorCode {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  UNSUPPORTED_VERSION = 'UNSUPPORTED_VERSION',
  ENCRYPTED = 'ENCRYPTED',
  CORRUPTED = 'CORRUPTED',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  PARSE_ERROR = 'PARSE_ERROR',
  CONVERSION_ERROR = 'CONVERSION_ERROR',
  OUT_OF_MEMORY = 'OUT_OF_MEMORY',
}

export interface HwpMetadata {
  version: string
  author?: string
  title?: string
  pages?: number
}

export interface ReadResult {
  text: string
  metadata?: HwpMetadata
}

export interface ConvertResult {
  success: boolean
  docxPath: string
  originalSize: number
  convertedSize: number
}

export type ParagraphAlign = 'left' | 'center' | 'right' | 'justify'

export interface ListInfo {
  type: 'bullet' | 'number'
  level: number
}

export interface TextRun {
  text?: string
  break?: boolean
  bold?: boolean
  italic?: boolean
  underline?: boolean
  font?: string
  size?: number
}

export interface ParagraphBlock {
  type: 'paragraph'
  runs: TextRun[]
  align?: ParagraphAlign
  list?: ListInfo
}

export interface TableCellBlock {
  blocks: Block[]
  colSpan?: number
  rowSpan?: number
}

export interface TableRow {
  cells: TableCellBlock[]
}

export interface TableBlock {
  type: 'table'
  rows: TableRow[]
}

export type Block = ParagraphBlock | TableBlock

export interface DocxDocument {
  blocks: Block[]
}

export interface DocxMetadata {
  title?: string
  author?: string
  pages?: number
}
