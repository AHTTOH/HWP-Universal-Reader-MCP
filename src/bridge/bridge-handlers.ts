import fs from 'node:fs/promises'
import path from 'node:path'
import type { Sandbox } from '../security/sandbox.js'
import type { RateLimiter } from '../security/rate-limiter.js'
import { ErrorCode, type ConvertResult, type ReadResult } from '../types/index.js'
import { HwpError } from '../utils/error-handler.js'
import { TempFileManager } from '../utils/file-cleanup.js'
import { validateFileAccess, validateOutputPath } from '../validators/file-validator.js'
import { convertToDocxSchema, parseInput, readHwpSchema, readHwpxSchema } from '../validators/input-validator.js'
import type { RemoteClient } from './remote-client.js'

const READ_HWP_TOOL = 'read_hwp'
const READ_HWPX_TOOL = 'read_hwpx'
const CONVERT_TOOL = 'convert_to_docx'

interface BridgeDeps {
  sandbox: Sandbox
  rateLimiter: RateLimiter
  clientId: string
  remote: RemoteClient
}

interface FileInput {
  filePath?: string
  fileUrl?: string
  fileContentBase64?: string
  fileName?: string
}

interface ResolvedBridgeInput {
  remoteArgs: {
    fileUrl?: string
    fileContentBase64?: string
    fileName?: string
  }
  localPath?: string
  localFileName?: string
}

const sanitizeFileName = (value: string): string => {
  const base = path.basename(value)
  return base.replace(/[^\w.\-() ]/g, '_')
}

const resolveBridgeInput = async (
  input: FileInput,
  sandbox: Sandbox,
): Promise<ResolvedBridgeInput> => {
  if (input.filePath) {
    const fileInfo = await validateFileAccess(input.filePath, sandbox)
    const buffer = await fs.readFile(fileInfo.path)
    const fileName = sanitizeFileName(input.fileName ?? path.basename(fileInfo.path))
    return {
      remoteArgs: {
        fileContentBase64: buffer.toString('base64'),
        fileName,
      },
      localPath: fileInfo.path,
      localFileName: fileName,
    }
  }
  return {
    remoteArgs: {
      fileUrl: input.fileUrl,
      fileContentBase64: input.fileContentBase64,
      fileName: input.fileName ? sanitizeFileName(input.fileName) : undefined,
    },
  }
}

const resolveBaseName = (fileName?: string, filePath?: string): string => {
  if (fileName) {
    const base = path.basename(fileName, path.extname(fileName))
    return base.length > 0 ? base : 'document'
  }
  if (filePath) {
    const base = path.basename(filePath, path.extname(filePath))
    return base.length > 0 ? base : 'document'
  }
  return 'document'
}

const resolveOutputPath = async (
  outputPath: string | undefined,
  localPath: string | undefined,
  baseName: string,
  remoteFileName: string | undefined,
  sandbox: Sandbox,
  tempManager: TempFileManager,
): Promise<{ path: string; keepTemp: boolean }> => {
  if (outputPath) {
    return { path: validateOutputPath(outputPath, sandbox), keepTemp: false }
  }
  if (localPath) {
    const candidate = path.join(path.dirname(localPath), `${baseName}.docx`)
    return { path: validateOutputPath(candidate, sandbox), keepTemp: false }
  }
  if (remoteFileName) {
    const candidate = path.join(process.cwd(), remoteFileName)
    return { path: validateOutputPath(candidate, sandbox), keepTemp: false }
  }
  const tempPath = await tempManager.createTempFile('.docx')
  return { path: validateOutputPath(tempPath, sandbox), keepTemp: true }
}

export const handleBridgeReadHwp = async (input: unknown, deps: BridgeDeps): Promise<ReadResult> => {
  deps.rateLimiter.check(deps.clientId)
  const parsed = parseInput(readHwpSchema, input)
  const resolved = await resolveBridgeInput(parsed, deps.sandbox)
  return deps.remote.callTool<ReadResult>(READ_HWP_TOOL, resolved.remoteArgs, deps.clientId)
}

export const handleBridgeReadHwpx = async (
  input: unknown,
  deps: BridgeDeps,
): Promise<ReadResult> => {
  deps.rateLimiter.check(deps.clientId)
  const parsed = parseInput(readHwpxSchema, input)
  const resolved = await resolveBridgeInput(parsed, deps.sandbox)
  return deps.remote.callTool<ReadResult>(READ_HWPX_TOOL, resolved.remoteArgs, deps.clientId)
}

export const handleBridgeConvertToDocx = async (
  input: unknown,
  deps: BridgeDeps,
): Promise<ConvertResult> => {
  deps.rateLimiter.check(deps.clientId)
  const parsed = parseInput(convertToDocxSchema, input)
  const tempManager = new TempFileManager()
  let resolvedOutput: { path: string; keepTemp: boolean } | null = null
  try {
    const resolved = await resolveBridgeInput(parsed, deps.sandbox)
    const baseName = resolveBaseName(resolved.localFileName ?? resolved.remoteArgs.fileName, resolved.localPath)
    const remoteArgs = {
      ...resolved.remoteArgs,
      returnBase64: true,
    }
    const remoteResult = await deps.remote.callTool<ConvertResult>(
      CONVERT_TOOL,
      remoteArgs,
      deps.clientId,
    )
    if (!remoteResult.docxBase64) {
      throw new HwpError(ErrorCode.CONVERSION_ERROR, 'Remote conversion did not return DOCX data')
    }
    resolvedOutput = await resolveOutputPath(
      parsed.outputPath,
      resolved.localPath,
      baseName,
      remoteResult.docxFileName,
      deps.sandbox,
      tempManager,
    )
    const outputPath = resolvedOutput.path
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, Buffer.from(remoteResult.docxBase64, 'base64'))
    const convertedStats = await fs.stat(outputPath)
    const shouldReturnBase64 = parsed.returnBase64 ?? !parsed.filePath
    return {
      success: remoteResult.success,
      docxPath: outputPath,
      originalSize: remoteResult.originalSize,
      convertedSize: convertedStats.size,
      docxBase64: shouldReturnBase64 ? remoteResult.docxBase64 : undefined,
      docxFileName: shouldReturnBase64
        ? remoteResult.docxFileName ?? path.basename(outputPath)
        : undefined,
    }
  } finally {
    if (!resolvedOutput?.keepTemp) {
      await tempManager.cleanup()
    }
  }
}
