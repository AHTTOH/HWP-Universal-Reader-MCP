import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { handleReadHwpx } from '../../src/tools/read-hwpx.js'
import { Sandbox } from '../../src/security/sandbox.js'
import { RateLimiter } from '../../src/security/rate-limiter.js'

describe('read_hwpx integration', () => {
  it('extracts text and metadata from a real HWPX file', async () => {
    const fixture = path.resolve('tests/fixtures/sample.hwpx')
    const result = await handleReadHwpx(
      { filePath: fixture },
      {
        sandbox: new Sandbox([process.cwd()]),
        rateLimiter: new RateLimiter({ windowMs: 60_000, max: 100 }),
        clientId: 'test',
      },
    )
    expect(result.text).toContain('Sample HWPX content line 1.')
    expect(result.metadata?.title).toBe('Sample HWPX')
    expect(result.metadata?.author).toBe('HWP MCP')
  })
})
