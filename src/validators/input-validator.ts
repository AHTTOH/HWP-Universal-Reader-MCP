import { z, ZodError } from 'zod'
import { ErrorCode } from '../types/index.js'
import { HwpError } from '../utils/error-handler.js'

export const readHwpSchema = z.object({
  filePath: z.string().min(1),
})

export const readHwpxSchema = z.object({
  filePath: z.string().min(1),
})

export const convertToDocxSchema = z.object({
  filePath: z.string().min(1),
  outputPath: z.string().min(1).optional(),
})

export type ReadHwpInput = z.infer<typeof readHwpSchema>
export type ReadHwpxInput = z.infer<typeof readHwpxSchema>
export type ConvertToDocxInput = z.infer<typeof convertToDocxSchema>

export const parseInput = <T>(schema: z.ZodSchema<T>, input: unknown): T => {
  try {
    return schema.parse(input)
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HwpError(ErrorCode.PARSE_ERROR, 'Invalid input', {
        issues: error.issues,
      })
    }
    throw error
  }
}
