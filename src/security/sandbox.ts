import os from 'node:os'
import path from 'node:path'
import { ErrorCode } from '../types/index.js'
import { HwpError } from '../utils/error-handler.js'

export class Sandbox {
  private readonly roots: string[]

  constructor(roots: string[]) {
    this.roots = roots.map((root) => path.resolve(root))
  }

  static fromEnv(): Sandbox {
    const envRoots = process.env.HWP_MCP_ALLOWED_DIRS
    if (envRoots) {
      const roots = envRoots
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
      if (roots.length > 0) {
        return new Sandbox(roots)
      }
    }
    return new Sandbox([process.cwd(), os.homedir(), os.tmpdir()])
  }

  assertPath(filePath: string): void {
    const target = path.resolve(filePath)
    const allowed = this.roots.some((root) => {
      const rel = path.relative(root, target)
      return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
    })
    if (!allowed) {
      throw new HwpError(ErrorCode.PERMISSION_DENIED, 'Path is outside the sandbox', {
        filePath: target,
      })
    }
  }
}
