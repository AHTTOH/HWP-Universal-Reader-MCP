import http from 'node:http'
import tls from 'node:tls'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { logger } from './utils/logger.js'

const DEFAULT_PORT = 8787
const MAX_JSON_BODY_BYTES = 4 * 1024 * 1024

export interface HttpServerOptions {
  port?: number
  host?: string
  ssePath?: string
  messagePath?: string
  healthPath?: string
  jsonRpcHandler?: (message: unknown, clientId: string) => Promise<unknown | null>
}

export const startHttpServer = (mcpServer: Server, options: HttpServerOptions = {}) => {
  const port = options.port ?? DEFAULT_PORT
  const host = options.host ?? '0.0.0.0'
  const ssePath = options.ssePath ?? '/sse'
  const messagePath = options.messagePath ?? '/message'
  const healthPath = options.healthPath ?? '/health'

  const transports = new Map<string, SSEServerTransport>()

  const readJsonBody = async (req: http.IncomingMessage): Promise<unknown> => {
    let total = 0
    const chunks: Buffer[] = []
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      total += buffer.length
      if (total > MAX_JSON_BODY_BYTES) {
        throw new Error('Request body too large')
      }
      chunks.push(buffer)
    }
    const raw = Buffer.concat(chunks).toString('utf8')
    return JSON.parse(raw)
  }

  const server = http.createServer(async (req, res) => {
    if (!req.url) {
      res.writeHead(400).end('Bad Request')
      return
    }
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`)
    logger.info('HTTP request', {
      method: req.method,
      path: url.pathname,
      userAgent: req.headers['user-agent'],
      accept: req.headers.accept,
      contentType: req.headers['content-type'],
    })
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end()
      return
    }
    if (req.method === 'GET' && url.pathname === healthPath) {
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok')
      return
    }
    if (req.method === 'GET' && (url.pathname === ssePath || url.pathname === '/')) {
      const forwardedProto = req.headers['x-forwarded-proto']
      const forwardedHost = req.headers['x-forwarded-host']
      const isTls = req.socket instanceof tls.TLSSocket && req.socket.encrypted
      const proto =
        (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) ??
        (isTls ? 'https' : 'http')
      const host =
        (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) ??
        req.headers.host ??
        'localhost'
      const absoluteMessageUrl = new URL(messagePath, `${proto}://${host}`).toString()
      const transport = new SSEServerTransport(absoluteMessageUrl, res)
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
      if (sessionId) {
        const transport = transports.get(sessionId)
        if (transport) {
          try {
            await transport.handlePostMessage(req, res)
          } catch (error) {
            logger.error('Failed to handle POST message', { error: (error as Error).message })
          }
          return
        }
      }
      if (options.jsonRpcHandler) {
        try {
          const payload = await readJsonBody(req)
          const clientId = url.searchParams.get('clientId') ?? 'http'
          const response = await options.jsonRpcHandler(payload, clientId)
          if (response === null) {
            res.writeHead(204).end()
            return
          }
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(response))
          return
        } catch (error) {
          res.writeHead(400).end('Invalid JSON')
          return
        }
      }
      res.writeHead(404).end('Unknown session')
      return
    }
    if (req.method === 'POST' && (url.pathname === '/' || url.pathname === ssePath)) {
      if (!options.jsonRpcHandler) {
        res.writeHead(404).end('Not Found')
        return
      }
      try {
        const payload = await readJsonBody(req)
        const clientId = url.searchParams.get('clientId') ?? 'http'
        const response = await options.jsonRpcHandler(payload, clientId)
        if (response === null) {
          res.writeHead(204).end()
          return
        }
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(response))
        return
      } catch (error) {
        res.writeHead(400).end('Invalid JSON')
        return
      }
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
