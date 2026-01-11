import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { handleReadHwp } from '../../src/tools/read-hwp.js'
import { Sandbox } from '../../src/security/sandbox.js'
import { RateLimiter } from '../../src/security/rate-limiter.js'

describe('read_hwp integration', () => {
  it('extracts text from a real HWP file', async () => {
    const fixture = path.resolve('tests/fixtures/sample.hwp')
    const result = await handleReadHwp(
      { filePath: fixture },
      {
        sandbox: new Sandbox([process.cwd()]),
        rateLimiter: new RateLimiter({ windowMs: 60_000, max: 100 }),
        clientId: 'test',
      },
    )
    expect(result.text.length).toBeGreaterThan(0)
    expect(result.metadata?.version).toMatch(/^5\./)
  })
})
