import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { readHwpTool, handleReadHwp } from './tools/read-hwp.js'
import { readHwpxTool, handleReadHwpx } from './tools/read-hwpx.js'
import { convertToDocxTool, handleConvertToDocx } from './tools/convert-to-docx.js'
import { Sandbox } from './security/sandbox.js'
import { RateLimiter } from './security/rate-limiter.js'
import { formatError, normalizeError } from './utils/error-handler.js'
import { logger } from './utils/logger.js'
import { startHttpServer } from './http-server.js'

const sandbox = Sandbox.fromEnv()
const rateLimiter = new RateLimiter({ windowMs: 60_000, max: 30 })

const server = new Server(
  {
    name: 'hwp-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [readHwpTool, readHwpxTool, convertToDocxTool],
  }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name
  const meta = request.params._meta as { clientId?: string } | undefined
  const clientId = meta?.clientId ?? 'local'
  try {
    if (name === readHwpTool.name) {
      const result = await handleReadHwp(request.params.arguments, {
        sandbox,
        rateLimiter,
        clientId,
      })
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    }
    if (name === readHwpxTool.name) {
      const result = await handleReadHwpx(request.params.arguments, {
        sandbox,
        rateLimiter,
        clientId,
      })
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    }
    if (name === convertToDocxTool.name) {
      const result = await handleConvertToDocx(request.params.arguments, {
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
    startHttpServer(server, { port })
    logger.info('HWP MCP server started', { transport: 'http', port })
    return
  }

  const transport = new StdioServerTransport()
  await server.connect(transport)
  logger.info('HWP MCP server started', { transport: 'stdio' })
}

run().catch((error) => {
  const normalized = normalizeError(error)
  logger.error('Server startup failed', {
    code: normalized.code,
    message: normalized.message,
  })
  process.exit(1)
})
