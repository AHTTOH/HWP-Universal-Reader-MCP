import { ErrorCode } from '../types/index.js'
import { HwpError } from '../utils/error-handler.js'

export interface RemoteClient {
  callTool: <T>(toolName: string, args: unknown, clientId: string) => Promise<T>
}

const DEFAULT_TIMEOUT_MS = 30_000

const ensureMessageEndpoint = (rawUrl: string): string => {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new HwpError(ErrorCode.PARSE_ERROR, 'Invalid remote MCP URL', { url: rawUrl })
  }
  const pathname = url.pathname || '/'
  if (pathname === '/' || pathname.length === 0) {
    url.pathname = '/message'
  } else if (pathname.endsWith('/sse')) {
    url.pathname = pathname.replace(/\/sse$/, '/message')
  }
  return url.toString()
}

const isErrorCode = (value: unknown): value is ErrorCode => {
  return typeof value === 'string' && Object.values(ErrorCode).includes(value as ErrorCode)
}

const parseRemoteError = (payload: {
  message?: string
  code?: number
  data?: { code?: unknown; details?: unknown }
}): HwpError => {
  const message = payload.message ?? 'Remote MCP error'
  if (payload.data && isErrorCode(payload.data.code)) {
    const details =
      payload.data && typeof payload.data.details === 'object'
        ? (payload.data.details as Record<string, unknown>)
        : undefined
    return new HwpError(payload.data.code, message, details)
  }
  return new HwpError(ErrorCode.CONVERSION_ERROR, message, {
    remoteCode: payload.code,
    remoteData: payload.data,
  })
}

const parseRemoteResult = <T>(payload: unknown): T => {
  if (!payload || typeof payload !== 'object') {
    throw new HwpError(ErrorCode.PARSE_ERROR, 'Invalid remote MCP response')
  }
  const response = payload as {
    result?: { content?: { type?: string; text?: string }[] }
    error?: { message?: string; code?: number; data?: { code?: unknown; details?: unknown } }
  }
  if (response.error) {
    throw parseRemoteError(response.error)
  }
  const content = response.result?.content ?? []
  const text = content.find((entry) => entry.type === 'text')?.text
  if (!text) {
    throw new HwpError(ErrorCode.PARSE_ERROR, 'Missing content in remote MCP response')
  }
  try {
    return JSON.parse(text) as T
  } catch (error) {
    throw new HwpError(ErrorCode.PARSE_ERROR, 'Invalid JSON from remote MCP', {
      cause: (error as Error).message,
    })
  }
}

export const createRemoteClient = (
  rawUrl: string,
  options: { timeoutMs?: number } = {},
): RemoteClient => {
  const endpoint = ensureMessageEndpoint(rawUrl)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  return {
    callTool: async <T>(toolName: string, args: unknown, clientId: string): Promise<T> => {
      const payload = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args,
          _meta: { clientId },
        },
      }
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })
        if (!response.ok) {
          const body = await response.text().catch(() => '')
          throw new HwpError(ErrorCode.CONVERSION_ERROR, 'Remote MCP request failed', {
            status: response.status,
            statusText: response.statusText,
            body: body ? body.slice(0, 200) : undefined,
          })
        }
        const data = await response.json()
        return parseRemoteResult<T>(data)
      } catch (error) {
        if (error instanceof HwpError) {
          throw error
        }
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new HwpError(ErrorCode.CONVERSION_ERROR, 'Remote MCP request timed out', {
            timeoutMs,
          })
        }
        throw new HwpError(ErrorCode.CONVERSION_ERROR, 'Remote MCP request failed', {
          cause: (error as Error).message,
        })
      } finally {
        clearTimeout(timeout)
      }
    },
  }
}
