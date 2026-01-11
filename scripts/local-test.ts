import path from 'node:path'
import fs from 'node:fs/promises'
import { handleReadHwp } from '../src/tools/read-hwp.js'
import { handleReadHwpx } from '../src/tools/read-hwpx.js'
import { handleConvertToDocx } from '../src/tools/convert-to-docx.js'
import { Sandbox } from '../src/security/sandbox.js'
import { RateLimiter } from '../src/security/rate-limiter.js'

const sampleDir = path.resolve('local-test-samples')
const hwpPath = path.join(sampleDir, '근로기준법(법률)(제20520호)(20251023).hwp')
const hwpxPath = path.join(sampleDir, '근로기준법(법률)(제20520호)(20251023).hwpx')
const outputDir = path.join(sampleDir, 'output')

const deps = {
  sandbox: new Sandbox([process.cwd()]),
  rateLimiter: new RateLimiter({ windowMs: 60_000, max: 50 }),
  clientId: 'local-test',
}

const run = async () => {
  await fs.mkdir(outputDir, { recursive: true })

  console.log('--- read_hwp ---')
  const hwpResult = await handleReadHwp({ filePath: hwpPath }, deps)
  console.log('metadata:', hwpResult.metadata)
  console.log('text sample:', hwpResult.text.slice(0, 500))

  console.log('\n--- read_hwpx ---')
  const hwpxResult = await handleReadHwpx({ filePath: hwpxPath }, deps)
  console.log('metadata:', hwpxResult.metadata)
  console.log('text sample:', hwpxResult.text.slice(0, 500))

  console.log('\n--- convert_to_docx (HWP) ---')
  const hwpDocx = await handleConvertToDocx(
    {
      filePath: hwpPath,
      outputPath: path.join(outputDir, '근로기준법.hwp.docx'),
    },
    deps,
  )
  console.log('result:', hwpDocx)

  console.log('\n--- convert_to_docx (HWPX) ---')
  const hwpxDocx = await handleConvertToDocx(
    {
      filePath: hwpxPath,
      outputPath: path.join(outputDir, '근로기준법.hwpx.docx'),
    },
    deps,
  )
  console.log('result:', hwpxDocx)
}

run().catch((error) => {
  console.error('local test failed:', error)
  process.exit(1)
})
