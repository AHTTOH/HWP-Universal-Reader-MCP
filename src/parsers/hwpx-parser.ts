import fs from 'node:fs/promises'
import { XMLParser } from 'fast-xml-parser'
import {
  HwpxReader,
  HwpxEncryptedDocumentError,
  InvalidHwpxFormatError,
} from '@ssabrojs/hwpxjs'
import { ErrorCode } from '../types/index.js'
import type { HwpMetadata } from '../types/index.js'
import { HwpError } from '../utils/error-handler.js'
import { checkMemory } from '../utils/memory.js'

const bufferToArrayBuffer = (buffer: Buffer): ArrayBuffer => {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer
}

export const parseHwpxFile = async (
  filePath: string,
): Promise<{ text: string; metadata: HwpMetadata }> => {
  checkMemory()
  const buffer = await fs.readFile(filePath)
  const reader = new HwpxReader()
  try {
    await reader.loadFromArrayBuffer(bufferToArrayBuffer(buffer))
  } catch (error) {
    if (error instanceof InvalidHwpxFormatError) {
      throw new HwpError(ErrorCode.CORRUPTED, 'Invalid HWPX format', { cause: error.message })
    }
    throw new HwpError(ErrorCode.PARSE_ERROR, 'Failed to load HWPX file', {
      cause: (error as Error).message,
    })
  }
  try {
    const [text, info] = await Promise.all([reader.extractText(), reader.getDocumentInfo()])
    const pages = info.summary.contentsFiles.length > 0 ? info.summary.contentsFiles.length : undefined
    const metadata: HwpMetadata = {
      version: info.metadata.version ?? 'HWPX',
      title: info.metadata.title,
      author: info.metadata.creator,
      pages,
    }
    return { text, metadata }
  } catch (error) {
    if (error instanceof HwpxEncryptedDocumentError) {
      throw new HwpError(ErrorCode.ENCRYPTED, 'Encrypted HWPX files are not supported')
    }
    if (error instanceof InvalidHwpxFormatError) {
      throw new HwpError(ErrorCode.CORRUPTED, 'Invalid HWPX format', { cause: error.message })
    }
    throw new HwpError(ErrorCode.PARSE_ERROR, 'Failed to parse HWPX file', {
      cause: (error as Error).message,
    })
  }
}

const collectXmlText = (node: unknown, out: string[]): void => {
  if (node === null || node === undefined) {
    return
  }
  if (typeof node === 'string') {
    const trimmed = decodeXmlEntities(node).trim()
    if (trimmed.length > 0) {
      out.push(trimmed)
    }
    return
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      collectXmlText(item, out)
    }
    return
  }
  if (typeof node === 'object') {
    const entries = Object.entries(node as Record<string, unknown>)
    for (const [key, value] of entries) {
      if (key === '#text') {
        collectXmlText(value, out)
        continue
      }
      if (key.toLowerCase() === 't' || key.toLowerCase() === 'text') {
        collectXmlText(value, out)
        continue
      }
      collectXmlText(value, out)
    }
  }
}

const decodeXmlEntities = (value: string): string => {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, num) =>
      String.fromCodePoint(Number.parseInt(num, 10)),
    )
}

const ensureArray = <T>(value: T | T[] | undefined | null): T[] => {
  if (!value) {
    return []
  }
  return Array.isArray(value) ? value : [value]
}

const collectHwpmlChars = (node: unknown, out: string[]): void => {
  if (node === null || node === undefined) {
    return
  }
  if (typeof node === 'string') {
    const decoded = decodeXmlEntities(node)
    if (decoded.trim().length > 0) {
      out.push(decoded)
    }
    return
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      collectHwpmlChars(item, out)
    }
    return
  }
  if (typeof node === 'object') {
    const entries = Object.entries(node as Record<string, unknown>)
    for (const [key, value] of entries) {
      if (key === 'CHAR' || key === '#text') {
        collectHwpmlChars(value, out)
        continue
      }
      collectHwpmlChars(value, out)
    }
  }
}

const extractHwpmlText = (parsed: Record<string, unknown>): { text: string; metadata: HwpMetadata } => {
  const hwpml = (parsed.HWPML ?? parsed.hwpml) as Record<string, unknown> | undefined
  const head = hwpml?.HEAD as Record<string, unknown> | undefined
  const summary = head?.DOCSUMMARY as Record<string, unknown> | undefined
  const title = typeof summary?.TITLE === 'string' ? decodeXmlEntities(summary.TITLE) : undefined
  const author = typeof summary?.AUTHOR === 'string' ? decodeXmlEntities(summary.AUTHOR) : undefined
  const body = hwpml?.BODY as Record<string, unknown> | undefined
  const sections = ensureArray(body?.SECTION as Record<string, unknown> | Record<string, unknown>[] | undefined)
  const paragraphs: string[] = []
  for (const section of sections) {
    const ps = ensureArray(section.P as Record<string, unknown> | Record<string, unknown>[] | undefined)
    for (const p of ps) {
      const buffer: string[] = []
      collectHwpmlChars(p, buffer)
      const line = buffer.join('')
      if (line.trim().length > 0) {
        paragraphs.push(line.trim())
      }
    }
  }
  return {
    text: paragraphs.join('\n'),
    metadata: { version: 'HWPML', title, author, pages: undefined },
  }
}

export const parseHwpxXmlFile = async (
  filePath: string,
): Promise<{ text: string; metadata: HwpMetadata }> => {
  checkMemory()
  const xml = await fs.readFile(filePath, 'utf8')
  const parser = new XMLParser({
    ignoreAttributes: true,
    removeNSPrefix: true,
    trimValues: true,
  })
  const parsed = parser.parse(xml) as Record<string, unknown>
  if ('HWPML' in parsed || 'hwpml' in parsed) {
    return extractHwpmlText(parsed)
  }
  const parts: string[] = []
  collectXmlText(parsed, parts)
  return {
    text: parts.join('\n'),
    metadata: { version: 'HWPX', title: undefined, author: undefined, pages: undefined },
  }
}
