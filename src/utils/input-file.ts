import fs from 'node:fs/promises'
import path from 'node:path'
import { ErrorCode } from '../types/index.js'
import { HwpError } from './error-handler.js'
import { TempFileManager } from './file-cleanup.js'
import { MAX_FILE_SIZE, readFileSignature, HWP_SIGNATURE, HWPX_SIGNATURE, XML_SIGNATURE } from '../validators/file-validator.js'
import type { Sandbox } from '../security/sandbox.js'
import { validateFileAccess } from '../validators/file-validator.js'

export interface InputFileArgs {
  filePath?: string
  fileUrl?: string
  fileContentBase64?: string
  fileName?: string
}

export interface ResolvedInputFile {
  path: string
  size: number
  source: 'path' | 'url' | 'base64'
  fileName?: string
}

const parseDataUrl = (value: string): string => {
  const match = /^data:.*;base64,(.*)$/i.exec(value.trim())
  return match ? match[1] : value.trim()
}

const inferExtensionFromSignature = async (filePath: string): Promise<string> => {
  const signature = await readFileSignature(filePath, 4)
  if (signature.equals(HWP_SIGNATURE)) {
    return '.hwp'
  }
  if (signature.equals(HWPX_SIGNATURE)) {
    return '.hwpx'
  }
  if (signature.equals(XML_SIGNATURE)) {
    return '.xml'
  }
  return '.bin'
}

const inferExtensionFromBuffer = (buffer: Buffer): string => {
  if (buffer.length >= 4) {
    const signature = buffer.subarray(0, 4)
    if (signature.equals(HWP_SIGNATURE)) {
      return '.hwp'
    }
    if (signature.equals(HWPX_SIGNATURE)) {
      return '.hwpx'
    }
    if (signature.equals(XML_SIGNATURE)) {
      return '.xml'
    }
  }
  return '.bin'
}

const sanitizeFileName = (value: string): string => {
  const base = path.basename(value)
  return base.replace(/[^\w.\-() ]/g, '_')
}

const downloadToTempFile = async (
  url: URL,
  tempManager: TempFileManager,
  suggestedName?: string,
): Promise<{ path: string; size: number; fileName?: string }> => {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) {
    throw new HwpError(ErrorCode.FILE_NOT_FOUND, 'Failed to download file', {
      status: response.status,
    })
  }
  const contentLength = response.headers.get('content-length')
  if (contentLength) {
    const size = Number(contentLength)
    if (Number.isFinite(size) && size > MAX_FILE_SIZE) {
      throw new HwpError(ErrorCode.FILE_TOO_LARGE, 'File exceeds size limit', {
        maxBytes: MAX_FILE_SIZE,
        size,
      })
    }
  }
  const pathName = url.pathname
  const nameFromUrl = pathName ? path.basename(pathName) : undefined
  const fileName =
    suggestedName && suggestedName.length > 0
      ? sanitizeFileName(suggestedName)
      : nameFromUrl
        ? sanitizeFileName(nameFromUrl)
        : undefined
  const ext = fileName ? path.extname(fileName) : '.bin'
  const tempPath = await tempManager.createTempFile(ext || '.bin')
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  if (buffer.length > MAX_FILE_SIZE) {
    throw new HwpError(ErrorCode.FILE_TOO_LARGE, 'File exceeds size limit', {
      maxBytes: MAX_FILE_SIZE,
      size: buffer.length,
    })
  }
  await fs.writeFile(tempPath, buffer)
  return { path: tempPath, size: buffer.length, fileName }
}

const writeBase64ToTempFile = async (
  payload: string,
  tempManager: TempFileManager,
  suggestedName?: string,
): Promise<{ path: string; size: number; fileName?: string }> => {
  const base64 = parseDataUrl(payload)
  let buffer: Buffer
  try {
    buffer = Buffer.from(base64, 'base64')
  } catch (error) {
    throw new HwpError(ErrorCode.PARSE_ERROR, 'Invalid base64 data', {
      cause: (error as Error).message,
    })
  }
  if (buffer.length === 0) {
    throw new HwpError(ErrorCode.CORRUPTED, 'Empty file data')
  }
  if (buffer.length > MAX_FILE_SIZE) {
    throw new HwpError(ErrorCode.FILE_TOO_LARGE, 'File exceeds size limit', {
      maxBytes: MAX_FILE_SIZE,
      size: buffer.length,
    })
  }
  const fileName = suggestedName && suggestedName.length > 0 ? sanitizeFileName(suggestedName) : undefined
  const ext = fileName ? path.extname(fileName) : inferExtensionFromBuffer(buffer)
  const tempPath = await tempManager.createTempFile(ext || '.bin')
  await fs.writeFile(tempPath, buffer)
  const inferredExt = ext || (await inferExtensionFromSignature(tempPath))
  if (!ext && inferredExt !== '.bin') {
    const renamed = tempPath.replace(/\.[^./\\]+$/, inferredExt)
    await fs.rename(tempPath, renamed)
    return { path: renamed, size: buffer.length, fileName: fileName ?? `upload${inferredExt}` }
  }
  return { path: tempPath, size: buffer.length, fileName: fileName ?? `upload${ext || '.bin'}` }
}

export const resolveInputFile = async (
  input: InputFileArgs,
  sandbox: Sandbox,
  tempManager: TempFileManager,
): Promise<ResolvedInputFile> => {
  if (input.filePath) {
    const fileInfo = await validateFileAccess(input.filePath, sandbox)
    return {
      path: fileInfo.path,
      size: fileInfo.size,
      source: 'path',
      fileName: sanitizeFileName(path.basename(fileInfo.path)),
    }
  }
  if (input.fileUrl) {
    let url: URL
    try {
      url = new URL(input.fileUrl)
    } catch {
      throw new HwpError(ErrorCode.PARSE_ERROR, 'Invalid file URL')
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new HwpError(ErrorCode.PERMISSION_DENIED, 'Unsupported URL scheme')
    }
    const downloaded = await downloadToTempFile(url, tempManager, input.fileName)
    return { ...downloaded, source: 'url' }
  }
  if (input.fileContentBase64) {
    const written = await writeBase64ToTempFile(input.fileContentBase64, tempManager, input.fileName)
    return { ...written, source: 'base64' }
  }
  throw new HwpError(ErrorCode.PARSE_ERROR, 'Missing file input')
}
