import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  LATEST_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
} from '@modelcontextprotocol/sdk/types.js'
import { readHwpTool, handleReadHwp } from './tools/read-hwp.js'
import { readHwpxTool, handleReadHwpx } from './tools/read-hwpx.js'
import { convertToDocxTool, handleConvertToDocx } from './tools/convert-to-docx.js'
import { Sandbox } from './security/sandbox.js'
import { RateLimiter } from './security/rate-limiter.js'
import { ErrorCode } from './types/index.js'
import { HwpError, formatError, normalizeError } from './utils/error-handler.js'
import { logger } from './utils/logger.js'
import { startHttpServer } from './http-server.js'
import { createRemoteClient, type RemoteClient } from './bridge/remote-client.js'
import {
  handleBridgeConvertToDocx,
  handleBridgeReadHwp,
  handleBridgeReadHwpx,
} from './bridge/bridge-handlers.js'

const sandbox = Sandbox.fromEnv()
const rateLimiter = new RateLimiter({ windowMs: 60_000, max: 30 })
const SERVER_INFO = { name: 'hwp-mcp-server', version: '1.0.0' }
const SERVER_CAPABILITIES = { tools: {} }
const serverMode = process.argv.includes('--bridge') || process.env.HWP_MCP_MODE === 'bridge'
  ? 'bridge'
  : 'server'
let bridgeRemote: RemoteClient | null = null

const getBridgeRemote = (): RemoteClient => {
  if (bridgeRemote) {
    return bridgeRemote
  }
  const remoteUrl = process.env.HWP_MCP_REMOTE_URL
  if (!remoteUrl || remoteUrl.trim().length === 0) {
    throw new HwpError(
      ErrorCode.PARSE_ERROR,
      'HWP_MCP_REMOTE_URL is required when running in bridge mode',
    )
  }
  const timeoutValue = Number(process.env.HWP_MCP_REMOTE_TIMEOUT_MS)
  const timeoutMs = Number.isFinite(timeoutValue) && timeoutValue > 0 ? timeoutValue : undefined
  bridgeRemote = createRemoteClient(remoteUrl, timeoutMs ? { timeoutMs } : {})
  return bridgeRemote
}

const server = new Server(SERVER_INFO, {
  capabilities: SERVER_CAPABILITIES,
})

const tools = [readHwpTool, readHwpxTool, convertToDocxTool]

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools,
  }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name
  const meta = request.params._meta as { clientId?: string } | undefined
  const clientId = meta?.clientId ?? 'local'
  try {
    if (name === readHwpTool.name) {
      const result =
        serverMode === 'bridge'
          ? await handleBridgeReadHwp(request.params.arguments, {
              sandbox,
              rateLimiter,
              clientId,
              remote: getBridgeRemote(),
            })
          : await handleReadHwp(request.params.arguments, {
              sandbox,
              rateLimiter,
              clientId,
            })
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    }
    if (name === readHwpxTool.name) {
      const result =
        serverMode === 'bridge'
          ? await handleBridgeReadHwpx(request.params.arguments, {
              sandbox,
              rateLimiter,
              clientId,
              remote: getBridgeRemote(),
            })
          : await handleReadHwpx(request.params.arguments, {
              sandbox,
              rateLimiter,
              clientId,
            })
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    }
    if (name === convertToDocxTool.name) {
      const result =
        serverMode === 'bridge'
          ? await handleBridgeConvertToDocx(request.params.arguments, {
              sandbox,
              rateLimiter,
              clientId,
              remote: getBridgeRemote(),
            })
          : await handleConvertToDocx(request.params.arguments, {
              sandbox,
              rateLimiter,
              clientId,
            })
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    }
    return {
      isError: true,
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    }
  } catch (error) {
    const normalized = normalizeError(error)
    logger.error('Tool execution failed', {
      tool: name,
      code: normalized.code,
      message: normalized.message,
    })
    return {
      isError: true,
      content: [{ type: 'text', text: formatError(normalized) }],
    }
  }
})

const run = async () => {
  const transportMode =
    process.argv.includes('--http') || (process.env.MCP_TRANSPORT ?? '').toLowerCase() === 'http'

  if (transportMode) {
    const port = Number(process.env.PORT ?? process.env.MCP_PORT ?? '8787')
    const handleJsonRpc = async (
      payload: unknown,
      fallbackClientId: string,
    ): Promise<unknown | null> => {
      if (!payload || typeof payload !== 'object') {
        return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } }
      }
      const request = payload as Record<string, unknown>
      const jsonrpc = request.jsonrpc
      const method = request.method
      if (jsonrpc !== '2.0' || typeof method !== 'string') {
        return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } }
      }
      const id = request.id as string | number | null | undefined
      const params = (request.params ?? {}) as Record<string, unknown>
      const meta = (params._meta ?? {}) as Record<string, unknown>
      const clientId =
        typeof meta.clientId === 'string' && meta.clientId.length > 0
          ? meta.clientId
          : fallbackClientId

      if (method === 'initialize') {
        const requestedVersion = params.protocolVersion
        const protocolVersion =
          typeof requestedVersion === 'string' &&
          SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion)
            ? requestedVersion
            : LATEST_PROTOCOL_VERSION
        return {
          jsonrpc: '2.0',
          id: id ?? null,
          result: {
            protocolVersion,
            capabilities: SERVER_CAPABILITIES,
            serverInfo: SERVER_INFO,
          },
        }
      }

      if (method === 'notifications/initialized') {
        return null
      }

      if (method === 'tools/list') {
        return {
          jsonrpc: '2.0',
          id: id ?? null,
          result: { tools },
        }
      }

      if (method === 'tools/call') {
        try {
          const toolName = params.name
          const toolArgs = params.arguments
          if (toolName === readHwpTool.name) {
            const result =
              serverMode === 'bridge'
                ? await handleBridgeReadHwp(toolArgs, {
                    sandbox,
                    rateLimiter,
                    clientId,
                    remote: getBridgeRemote(),
                  })
                : await handleReadHwp(toolArgs, { sandbox, rateLimiter, clientId })
            return {
              jsonrpc: '2.0',
              id: id ?? null,
              result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] },
            }
          }
          if (toolName === readHwpxTool.name) {
            const result =
              serverMode === 'bridge'
                ? await handleBridgeReadHwpx(toolArgs, {
                    sandbox,
                    rateLimiter,
                    clientId,
                    remote: getBridgeRemote(),
                  })
                : await handleReadHwpx(toolArgs, { sandbox, rateLimiter, clientId })
            return {
              jsonrpc: '2.0',
              id: id ?? null,
              result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] },
            }
          }
          if (toolName === convertToDocxTool.name) {
            const result =
              serverMode === 'bridge'
                ? await handleBridgeConvertToDocx(toolArgs, {
                    sandbox,
                    rateLimiter,
                    clientId,
                    remote: getBridgeRemote(),
                  })
                : await handleConvertToDocx(toolArgs, { sandbox, rateLimiter, clientId })
            return {
              jsonrpc: '2.0',
              id: id ?? null,
              result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] },
            }
          }
          return {
            jsonrpc: '2.0',
            id: id ?? null,
            error: { code: -32601, message: `Unknown tool: ${String(toolName)}` },
          }
        } catch (error) {
          const normalized = normalizeError(error)
          return {
            jsonrpc: '2.0',
            id: id ?? null,
            error: {
              code: -32603,
              message: normalized.message,
              data: { code: normalized.code, details: normalized.details },
            },
          }
        }
      }

      return {
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code: -32601, message: `Method not found: ${method}` },
      }
    }

    startHttpServer(server, { port, jsonRpcHandler: handleJsonRpc })
    logger.info('HWP MCP server started', { transport: 'http', port, mode: serverMode })
    return
  }

  const transport = new StdioServerTransport()
  await server.connect(transport)
  logger.info('HWP MCP server started', { transport: 'stdio', mode: serverMode })
}

run().catch((error) => {
  const normalized = normalizeError(error)
  logger.error('Server startup failed', {
    code: normalized.code,
    message: normalized.message,
  })
  process.exit(1)
})
