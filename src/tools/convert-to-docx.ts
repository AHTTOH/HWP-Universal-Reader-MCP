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
  validateFileAccess,
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
      outputPath: {
        type: 'string',
        description: 'Output DOCX file path',
      },
    },
    required: ['filePath'],
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
  const fileInfo = await validateFileAccess(parsed.filePath, deps.sandbox)
  const fileType = await detectFileType(fileInfo.path)
  const outputPathRaw =
    parsed.outputPath ??
    path.join(path.dirname(fileInfo.path), `${path.basename(fileInfo.path, path.extname(fileInfo.path))}.docx`)
  const outputPath = validateOutputPath(outputPathRaw, deps.sandbox)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  const tempManager = new TempFileManager()
  try {
    checkMemory()
    let htmlResult: { html: string; metadata: DocxMetadata }
    if (fileType === 'hwp') {
      const tempHwpx = await tempManager.createTempFile('.hwpx')
      const converter = new HwpConverter({ verbose: false })
      const available = await converter.isAvailable()
      if (!available) {
        throw new HwpError(
          ErrorCode.CONVERSION_ERROR,
          'HWP converter is not available in this environment',
        )
      }
      const result = await converter.convertHwpToHwpx(fileInfo.path, tempHwpx)
      if (!result.success || !result.outputPath) {
        throw new HwpError(ErrorCode.CONVERSION_ERROR, 'Failed to convert HWP to HWPX', {
          cause: result.error ?? 'Unknown conversion error',
        })
      }
      htmlResult = await extractHwpxHtml(result.outputPath)
    } else if (fileType === 'hwpx') {
      htmlResult = await extractHwpxHtml(fileInfo.path)
    } else {
      const xmlResult = await parseHwpxXmlFile(fileInfo.path)
      const html = xmlResult.text
        .split(/\r?\n+/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => `<p>${line}</p>`)
        .join('')
      htmlResult = {
        html,
        metadata: {
          title: xmlResult.metadata.title,
          author: xmlResult.metadata.author,
          pages: xmlResult.metadata.pages,
        },
      }
    }
    const doc = parseHtmlToDocx(htmlResult.html)
    const finalPath = await writeDocxFile(outputPath, doc, htmlResult.metadata)
    const convertedStats = await fs.stat(finalPath)
    return {
      success: true,
      docxPath: finalPath,
      originalSize: fileInfo.size,
      convertedSize: convertedStats.size,
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
