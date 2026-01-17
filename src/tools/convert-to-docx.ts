import fs from 'node:fs/promises'
import path from 'node:path'
import {
  HwpConverter,
  HwpxReader,
  HwpxEncryptedDocumentError,
  InvalidHwpxFormatError,
} from '@ssabrojs/hwpxjs'
import { convertToDocxSchema, parseInput } from '../validators/input-validator.js'
import {
  HWPX_SIGNATURE,
  HWP_SIGNATURE,
  XML_SIGNATURE,
  readFileSignature,
  validateOutputPath,
} from '../validators/file-validator.js'
import { parseHtmlToDocx, writeDocxFile } from '../parsers/docx-generator.js'
import { TempFileManager } from '../utils/file-cleanup.js'
import { checkMemory } from '../utils/memory.js'
import { ErrorCode } from '../types/index.js'
import type { ConvertResult, DocxMetadata } from '../types/index.js'
import { HwpError } from '../utils/error-handler.js'
import { parseHwpxXmlFile } from '../parsers/hwpx-parser.js'
import type { Sandbox } from '../security/sandbox.js'
import type { RateLimiter } from '../security/rate-limiter.js'
import { resolveInputFile } from '../utils/input-file.js'

export const convertToDocxTool = {
  name: 'convert_to_docx',
  description: 'Convert HWP or HWPX files to DOCX format.',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Source HWP or HWPX file path',
      },
      fileUrl: {
        type: 'string',
        description: 'Public URL to a HWP or HWPX file',
      },
      fileContentBase64: {
        type: 'string',
        description: 'Base64-encoded HWP or HWPX file content',
      },
      fileName: {
        type: 'string',
        description: 'Original file name (used for output naming)',
      },
      outputPath: {
        type: 'string',
        description: 'Output DOCX file path',
      },
      returnBase64: {
        type: 'boolean',
        description: 'Include base64-encoded DOCX in the response',
      },
    },
    required: [],
  },
}

interface ToolDeps {
  sandbox: Sandbox
  rateLimiter: RateLimiter
  clientId: string
}

type FileType = 'hwp' | 'hwpx' | 'xml'

const detectFileType = async (filePath: string): Promise<FileType> => {
  const signature = await readFileSignature(filePath, 4)
  if (signature.equals(HWP_SIGNATURE)) {
    return 'hwp'
  }
  if (signature.equals(HWPX_SIGNATURE)) {
    return 'hwpx'
  }
  if (signature.equals(XML_SIGNATURE)) {
    return 'xml'
  }
  throw new HwpError(ErrorCode.CORRUPTED, 'Unsupported file type', {
    signature: signature.toString('hex'),
  })
}

const bufferToArrayBuffer = (buffer: Buffer): ArrayBuffer => {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer
}

const escapeHtmlText = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const resolveBaseName = (inputPath?: string, fileName?: string, fileUrl?: string): string => {
  if (fileName) {
    return path.basename(fileName, path.extname(fileName)) || 'document'
  }
  if (inputPath) {
    return path.basename(inputPath, path.extname(inputPath)) || 'document'
  }
  if (fileUrl) {
    try {
      const url = new URL(fileUrl)
      const base = path.basename(url.pathname || '')
      return base ? path.basename(base, path.extname(base)) : 'document'
    } catch {
      return 'document'
    }
  }
  return 'document'
}

const isPlaceholderHtml = (html: string): boolean => {
  const normalized = html.replace(/\s+/g, '').toLowerCase()
  return normalized.includes('hwpfile') || (normalized.includes('hwp') && normalized.length < 200)
}

const extractHwpxHtml = async (
  filePath: string,
): Promise<{ html: string; metadata: DocxMetadata }> => {
  const buffer = await fs.readFile(filePath)
  const reader = new HwpxReader()
  await reader.loadFromArrayBuffer(bufferToArrayBuffer(buffer))
  const [html, info] = await Promise.all([
    reader.extractHtml({ renderStyles: true, renderTables: true, renderImages: false }),
    reader.getDocumentInfo(),
  ])
  if (isPlaceholderHtml(html)) {
    throw new HwpError(ErrorCode.CONVERSION_ERROR, 'Failed to extract content from HWPX file - placeholder HTML detected')
  }
  const pages = info.summary.contentsFiles.length > 0 ? info.summary.contentsFiles.length : undefined
  return {
    html,
    metadata: {
      title: info.metadata.title,
      author: info.metadata.creator,
      pages,
    },
  }
}

export const handleConvertToDocx = async (
  input: unknown,
  deps: ToolDeps,
): Promise<ConvertResult> => {
  deps.rateLimiter.check(deps.clientId)
  const parsed = parseInput(convertToDocxSchema, input)
  const tempManager = new TempFileManager()
  try {
    checkMemory()
    const inputFile = await resolveInputFile(parsed, deps.sandbox, tempManager)
    const fileType = await detectFileType(inputFile.path)
    const baseName = resolveBaseName(parsed.filePath, inputFile.fileName, parsed.fileUrl)
    const outputPathRaw =
      parsed.outputPath ??
      (inputFile.source === 'path'
        ? path.join(path.dirname(inputFile.path), `${baseName}.docx`)
        : await tempManager.createTempFile('.docx'))
    const outputPath = validateOutputPath(outputPathRaw, deps.sandbox)
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    let htmlResult: { html: string; metadata: DocxMetadata } | undefined
    let docResult: { doc: ReturnType<typeof parseHtmlToDocx>; metadata: DocxMetadata } | null =
      null
    if (fileType === 'hwp') {
      const tempHwpx = await tempManager.createTempFile('.hwpx')
      const converter = new HwpConverter({ verbose: false })
      const available = await converter.isAvailable()
      if (!available) {
        throw new HwpError(
          ErrorCode.CONVERSION_ERROR,
          'HWP converter is not available. Please install required dependencies.',
        )
      }
      const result = await converter.convertHwpToHwpx(inputFile.path, tempHwpx)
      if (!result.success || !result.outputPath) {
        const errorMsg = result.error ? String(result.error) : 'Unknown error'
        throw new HwpError(
          ErrorCode.CONVERSION_ERROR,
          'Failed to convert HWP to HWPX',
          { cause: errorMsg },
        )
      }
      htmlResult = await extractHwpxHtml(result.outputPath)
    } else if (fileType === 'hwpx') {
      htmlResult = await extractHwpxHtml(inputFile.path)
    } else if (fileType === 'xml') {
      // HWPML (XML) 파일 처리
      const xmlResult = await parseHwpxXmlFile(inputFile.path)
      const html = xmlResult.text
        .split(/\r?\n/)
        .map((line) => `<p>${escapeHtmlText(line)}</p>`)
        .join('')
      htmlResult = {
        html,
        metadata: {
          title: xmlResult.metadata.title,
          author: xmlResult.metadata.author,
          pages: xmlResult.metadata.pages,
        },
      }
    } else {
      throw new HwpError(ErrorCode.CORRUPTED, 'Unsupported file type')
    }
    if (!htmlResult) {
      throw new HwpError(ErrorCode.CONVERSION_ERROR, 'No conversion output available')
    }
    docResult = {
      doc: parseHtmlToDocx(htmlResult.html),
      metadata: htmlResult.metadata,
    }
    const finalPath = await writeDocxFile(outputPath, docResult.doc, docResult.metadata)
    const convertedStats = await fs.stat(finalPath)
    const shouldReturnBase64 = parsed.returnBase64 ?? inputFile.source !== 'path'
    const docxBase64 = shouldReturnBase64 ? (await fs.readFile(finalPath)).toString('base64') : undefined
    const docxFileName = shouldReturnBase64 ? `${baseName}.docx` : undefined
    return {
      success: true,
      docxPath: finalPath,
      originalSize: inputFile.size,
      convertedSize: convertedStats.size,
      docxBase64,
      docxFileName,
    }
  } catch (error) {
    if (error instanceof HwpxEncryptedDocumentError) {
      throw new HwpError(ErrorCode.ENCRYPTED, 'Encrypted HWPX files are not supported')
    }
    if (error instanceof InvalidHwpxFormatError) {
      throw new HwpError(ErrorCode.CORRUPTED, 'Invalid HWPX format', {
        cause: error.message,
      })
    }
    if (error instanceof HwpError) {
      throw error
    }
    throw new HwpError(ErrorCode.CONVERSION_ERROR, 'DOCX conversion failed', {
      cause: (error as Error).message,
    })
  } finally {
    await tempManager.cleanup()
  }
}




