import { parseInput, readHwpSchema } from '../validators/input-validator.js'
import {
  HWP_SIGNATURE,
  HWPX_SIGNATURE,
  XML_SIGNATURE,
  readFileSignature,
  validateFileAccess,
} from '../validators/file-validator.js'
import { parseHwpFile } from '../parsers/hwp-parser.js'
import { parseHwpxFile, parseHwpxXmlFile } from '../parsers/hwpx-parser.js'
import { ErrorCode } from '../types/index.js'
import type { ReadResult } from '../types/index.js'
import { HwpError } from '../utils/error-handler.js'
import type { Sandbox } from '../security/sandbox.js'
import type { RateLimiter } from '../security/rate-limiter.js'

export const readHwpTool = {
  name: 'read_hwp',
  description:
    'Extract all text and metadata from HWP 5.0+ files, including body text and table content.',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Absolute path to a .hwp file',
      },
    },
    required: ['filePath'],
  },
}

interface ToolDeps {
  sandbox: Sandbox
  rateLimiter: RateLimiter
  clientId: string
}

export const handleReadHwp = async (input: unknown, deps: ToolDeps): Promise<ReadResult> => {
  deps.rateLimiter.check(deps.clientId)
  const parsed = parseInput(readHwpSchema, input)
  const fileInfo = await validateFileAccess(parsed.filePath, deps.sandbox)
  const signature = await readFileSignature(fileInfo.path, 4)
  if (signature.equals(HWP_SIGNATURE)) {
    const result = await parseHwpFile(fileInfo.path)
    return {
      text: result.text,
      metadata: result.metadata,
    }
  }
  if (signature.equals(HWPX_SIGNATURE)) {
    const result = await parseHwpxFile(fileInfo.path)
    return {
      text: result.text,
      metadata: result.metadata,
    }
  }
  if (signature.equals(XML_SIGNATURE)) {
    const result = await parseHwpxXmlFile(fileInfo.path)
    return {
      text: result.text,
      metadata: result.metadata,
    }
  }
  throw new HwpError(ErrorCode.CORRUPTED, 'Unsupported file signature', {
    filePath: fileInfo.path,
    signature: signature.toString('hex'),
  })
}
