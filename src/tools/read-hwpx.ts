import { parseInput, readHwpxSchema } from '../validators/input-validator.js'
import { HWPX_SIGNATURE, XML_SIGNATURE, readFileSignature } from '../validators/file-validator.js'
import { parseHwpxFile, parseHwpxXmlFile } from '../parsers/hwpx-parser.js'
import { ErrorCode } from '../types/index.js'
import type { ReadResult } from '../types/index.js'
import { HwpError } from '../utils/error-handler.js'
import type { Sandbox } from '../security/sandbox.js'
import type { RateLimiter } from '../security/rate-limiter.js'
import { TempFileManager } from '../utils/file-cleanup.js'
import { resolveInputFile } from '../utils/input-file.js'

export const readHwpxTool = {
  name: 'read_hwpx',
  description: 'Extract text and metadata from HWPX files.',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Absolute path to a .hwpx file',
      },
      fileUrl: {
        type: 'string',
        description: 'Public URL to a .hwpx file',
      },
      fileContentBase64: {
        type: 'string',
        description: 'Base64-encoded HWPX file content',
      },
      fileName: {
        type: 'string',
        description: 'Original file name (used for display/output naming)',
      },
    },
    required: [],
  },
}

interface ToolDeps {
  sandbox: Sandbox
  rateLimiter: RateLimiter
  clientId: string
}

export const handleReadHwpx = async (input: unknown, deps: ToolDeps): Promise<ReadResult> => {
  deps.rateLimiter.check(deps.clientId)
  const parsed = parseInput(readHwpxSchema, input)
  const tempManager = new TempFileManager()
  try {
    const fileInfo = await resolveInputFile(parsed, deps.sandbox, tempManager)
    const signature = await readFileSignature(fileInfo.path, 4)
    if (signature.equals(XML_SIGNATURE)) {
      const result = await parseHwpxXmlFile(fileInfo.path)
      return {
        text: result.text,
        metadata: result.metadata,
      }
    }
    if (!signature.equals(HWPX_SIGNATURE)) {
      throw new HwpError(ErrorCode.CORRUPTED, 'Unsupported HWPX signature', {
        filePath: fileInfo.path,
        signature: signature.toString('hex'),
      })
    }
    const result = await parseHwpxFile(fileInfo.path)
    return {
      text: result.text,
      metadata: result.metadata,
    }
  } finally {
    await tempManager.cleanup()
  }
}
