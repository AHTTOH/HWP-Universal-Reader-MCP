import path from 'node:path'
import fs from 'node:fs/promises'
import AdmZip from 'adm-zip'
import { describe, expect, it } from 'vitest'
import { handleConvertToDocx } from '../../src/tools/convert-to-docx.js'
import { Sandbox } from '../../src/security/sandbox.js'
import { RateLimiter } from '../../src/security/rate-limiter.js'

const deps = {
  sandbox: new Sandbox([process.cwd()]),
  rateLimiter: new RateLimiter({ windowMs: 60_000, max: 100 }),
  clientId: 'test',
}

describe('convert_to_docx integration', () => {
  it('converts HWPX to DOCX with content', async () => {
    const fixture = path.resolve('tests/fixtures/sample.hwpx')
    const outputDir = path.resolve('tests/fixtures/output')
    await fs.mkdir(outputDir, { recursive: true })
    const outputPath = path.join(outputDir, 'sample.hwpx.docx')
    const result = await handleConvertToDocx({ filePath: fixture, outputPath }, deps)
    expect(result.success).toBe(true)
    const zip = new AdmZip(result.docxPath)
    const documentXml = zip.readAsText('word/document.xml')
    expect(documentXml).toContain('Sample HWPX content line 1.')
    await fs.rm(result.docxPath, { force: true })
  })

  it('converts HWP to DOCX and produces a valid document', async () => {
    const fixture = path.resolve('tests/fixtures/sample.hwp')
    const outputDir = path.resolve('tests/fixtures/output')
    await fs.mkdir(outputDir, { recursive: true })
    const outputPath = path.join(outputDir, 'sample.hwp.docx')
    const result = await handleConvertToDocx({ filePath: fixture, outputPath }, deps)
    expect(result.success).toBe(true)
    const zip = new AdmZip(result.docxPath)
    const documentXml = zip.readAsText('word/document.xml')
    expect(documentXml).toContain('<w:document')
    await fs.rm(result.docxPath, { force: true })
  })
})
