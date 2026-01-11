import http from 'node:http'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { logger } from './utils/logger.js'

const DEFAULT_PORT = 8787

export interface HttpServerOptions {
  port?: number
  host?: string
  ssePath?: string
  messagePath?: string
  healthPath?: string
}

export const startHttpServer = (mcpServer: Server, options: HttpServerOptions = {}) => {
  const port = options.port ?? DEFAULT_PORT
  const host = options.host ?? '0.0.0.0'
  const ssePath = options.ssePath ?? '/sse'
  const messagePath = options.messagePath ?? '/message'
  const healthPath = options.healthPath ?? '/health'

  const transports = new Map<string, SSEServerTransport>()

  const server = http.createServer(async (req, res) => {
    if (!req.url) {
      res.writeHead(400).end('Bad Request')
      return
    }
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`)
    if (req.method === 'GET' && url.pathname === healthPath) {
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok')
      return
    }
    if (req.method === 'GET' && url.pathname === ssePath) {
      const transport = new SSEServerTransport(messagePath, res)
      transports.set(transport.sessionId, transport)
      transport.onclose = () => {
        transports.delete(transport.sessionId)
      }
      try {
        await mcpServer.connect(transport)
      } catch (error) {
        transports.delete(transport.sessionId)
        logger.error('Failed to connect SSE transport', { error: (error as Error).message })
      }
      return
    }
    if (req.method === 'POST' && url.pathname === messagePath) {
      const sessionId = url.searchParams.get('sessionId')
      if (!sessionId) {
        res.writeHead(400).end('Missing sessionId')
        return
      }
      const transport = transports.get(sessionId)
      if (!transport) {
        res.writeHead(404).end('Unknown session')
        return
      }
      try {
        await transport.handlePostMessage(req, res)
      } catch (error) {
        logger.error('Failed to handle POST message', { error: (error as Error).message })
      }
      return
    }
    res.writeHead(404).end('Not Found')
  })

  server.listen(port, host, () => {
    logger.info('HTTP server listening', {
      host,
      port,
      ssePath,
      messagePath,
      healthPath,
    })
  })
}
