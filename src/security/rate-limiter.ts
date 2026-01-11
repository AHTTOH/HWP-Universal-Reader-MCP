import { ErrorCode } from '../types/index.js'
import { HwpError } from '../utils/error-handler.js'

interface RateLimitState {
  count: number
  resetAt: number
}

interface RateLimiterOptions {
  windowMs: number
  max: number
}

export class RateLimiter {
  private readonly windowMs: number
  private readonly max: number
  private readonly hits = new Map<string, RateLimitState>()

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs
    this.max = options.max
  }

  check(key: string): void {
    const now = Date.now()
    const existing = this.hits.get(key)
    if (!existing || existing.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs })
      return
    }
    existing.count += 1
    if (existing.count > this.max) {
      throw new HwpError(ErrorCode.PERMISSION_DENIED, 'Rate limit exceeded', {
        limit: this.max,
        resetAt: new Date(existing.resetAt).toISOString(),
      })
    }
  }

  reset(key: string): void {
    this.hits.delete(key)
  }
}
