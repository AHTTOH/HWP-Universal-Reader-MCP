import { ErrorCode } from '../types/index.js'
import { HwpError } from './error-handler.js'

const defaultLimitMb = 512
const limitMb = Number(process.env.HWP_MCP_MEMORY_LIMIT_MB ?? defaultLimitMb)
const MEMORY_LIMIT = Number.isFinite(limitMb) && limitMb > 0 ? limitMb * 1024 * 1024 : defaultLimitMb * 1024 * 1024

export const checkMemory = (): void => {
  const usage = process.memoryUsage()
  if (usage.heapUsed > MEMORY_LIMIT) {
    throw new HwpError(ErrorCode.OUT_OF_MEMORY, 'Memory limit exceeded', {
      heapUsed: usage.heapUsed,
      limit: MEMORY_LIMIT,
    })
  }
}
