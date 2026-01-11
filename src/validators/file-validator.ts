/* eslint-disable @typescript-eslint/consistent-type-imports */
import fs from 'node:fs/promises'
import path from 'node:path'
import { ErrorCode } from '../types/index.js'
import { HwpError } from '../utils/error-handler.js'
import { Sandbox } from '../security/sandbox.js'

export const MAX_FILE_SIZE = 100 * 1024 * 1024
export const HWP_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0])
export const HWPX_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04])
export const XML_SIGNATURE = Buffer.from([0x3c, 0x3f, 0x78, 0x6d])

const hasTraversal = (normalized: string): boolean => {
  return normalized.split(path.sep).includes('..')
}

export const normalizePath = (filePath: string): string => {
  if (filePath.includes('\0')) {
    throw new HwpError(ErrorCode.PERMISSION_DENIED, 'Invalid file path')
  }
  const rawSegments = filePath.split(/[\\/]/)
  if (rawSegments.includes('..')) {
    throw new HwpError(ErrorCode.PERMISSION_DENIED, 'Invalid file path')
  }
  const normalized = path.normalize(filePath)
  if (hasTraversal(normalized)) {
    throw new HwpError(ErrorCode.PERMISSION_DENIED, 'Invalid file path')
  }
  return path.resolve(normalized)
}

export const validateFileAccess = async (
  filePath: string,
  sandbox: Sandbox,
): Promise<{ path: string; size: number }> => {
  const resolved = normalizePath(filePath)
  sandbox.assertPath(resolved)
  let stats
  try {
    stats = await fs.stat(resolved)
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code === 'ENOENT') {
      throw new HwpError(ErrorCode.FILE_NOT_FOUND, 'File not found', { filePath: resolved })
    }
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      throw new HwpError(ErrorCode.PERMISSION_DENIED, 'Permission denied', { filePath: resolved })
    }
    throw error
  }
  if (!stats.isFile()) {
    throw new HwpError(ErrorCode.PERMISSION_DENIED, 'Path is not a file', { filePath: resolved })
  }
  if (stats.size > MAX_FILE_SIZE) {
    throw new HwpError(ErrorCode.FILE_TOO_LARGE, 'File exceeds size limit', {
      maxBytes: MAX_FILE_SIZE,
      size: stats.size,
    })
  }
  return { path: resolved, size: stats.size }
}

export const validateSignature = async (
  filePath: string,
  expected: Buffer,
): Promise<void> => {
  const handle = await fs.open(filePath, 'r')
  try {
    const buffer = Buffer.alloc(expected.length)
    const { bytesRead } = await handle.read(buffer, 0, expected.length, 0)
    if (bytesRead < expected.length || !buffer.equals(expected)) {
      throw new HwpError(ErrorCode.CORRUPTED, 'File signature mismatch', {
        expected: expected.toString('hex'),
        actual: buffer.toString('hex'),
      })
    }
  } finally {
    await handle.close()
  }
}

export const readFileSignature = async (filePath: string, length = 4): Promise<Buffer> => {
  const handle = await fs.open(filePath, 'r')
  try {
    const buffer = Buffer.alloc(length)
    await handle.read(buffer, 0, length, 0)
    return buffer
  } finally {
    await handle.close()
  }
}

export const validateOutputPath = (filePath: string, sandbox: Sandbox): string => {
  const resolved = normalizePath(filePath)
  sandbox.assertPath(resolved)
  return resolved
}
