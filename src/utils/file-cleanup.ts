import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

export class TempFileManager {
  private tempRoot: string | null = null

  async createTempFile(extension: string): Promise<string> {
    if (!this.tempRoot) {
      const prefix = path.join(os.tmpdir(), 'hwp-mcp-')
      this.tempRoot = await fs.mkdtemp(prefix)
    }
    const safeExt = extension.startsWith('.') ? extension : `.${extension}`
    const filePath = path.join(this.tempRoot, `${crypto.randomUUID()}${safeExt}`)
    return filePath
  }

  async cleanup(): Promise<void> {
    if (!this.tempRoot) {
      return
    }
    const target = this.tempRoot
    this.tempRoot = null
    await fs.rm(target, { recursive: true, force: true })
  }
}
