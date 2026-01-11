import { ErrorCode } from '../types/index.js'

export class HwpError extends Error {
  public readonly code: ErrorCode
  public readonly details?: Record<string, unknown>

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.code = code
    this.details = details
    this.name = 'HwpError'
    Object.setPrototypeOf(this, HwpError.prototype)
  }
}

export const isHwpError = (error: unknown): error is HwpError => {
  return (
    error instanceof HwpError ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      Object.values(ErrorCode).includes((error as { code: ErrorCode }).code))
  )
}

const mapNodeError = (error: NodeJS.ErrnoException): HwpError | null => {
  if (error.code === 'ENOENT') {
    return new HwpError(ErrorCode.FILE_NOT_FOUND, 'File not found', {
      cause: error.message,
    })
  }
  if (error.code === 'EACCES' || error.code === 'EPERM') {
    return new HwpError(ErrorCode.PERMISSION_DENIED, 'Permission denied', {
      cause: error.message,
    })
  }
  return null
}

export const normalizeError = (error: unknown): HwpError => {
  if (error instanceof HwpError) {
    return error
  }
  if (error instanceof Error) {
    const mapped = mapNodeError(error as NodeJS.ErrnoException)
    if (mapped) {
      return mapped
    }
    return new HwpError(ErrorCode.PARSE_ERROR, error.message, { cause: error.name })
  }
  return new HwpError(ErrorCode.PARSE_ERROR, 'Unknown error', {
    cause: String(error),
  })
}

export const formatError = (error: HwpError): string => {
  const base = `[${error.code}] ${error.message}`
  if (!error.details) {
    return base
  }
  return `${base} ${JSON.stringify(error.details)}`
}
