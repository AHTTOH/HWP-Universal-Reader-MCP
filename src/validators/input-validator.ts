import { z, ZodError } from 'zod'
import { ErrorCode } from '../types/index.js'
import { HwpError } from '../utils/error-handler.js'

const fileInputSchema = z.object({
  filePath: z.string().min(1).optional(),
  fileUrl: z.string().url().optional(),
  fileContentBase64: z.string().min(1).optional(),
  fileName: z.string().min(1).optional(),
})

const requireOneInput = (data: {
  filePath?: string
  fileUrl?: string
  fileContentBase64?: string
}) => Boolean(data.filePath || data.fileUrl || data.fileContentBase64)

export const readHwpSchema = fileInputSchema.refine(requireOneInput, {
  message: 'One of filePath, fileUrl, or fileContentBase64 is required',
})

export const readHwpxSchema = fileInputSchema.refine(requireOneInput, {
  message: 'One of filePath, fileUrl, or fileContentBase64 is required',
})

export const convertToDocxSchema = fileInputSchema
  .extend({
    outputPath: z.string().min(1).optional(),
    returnBase64: z.boolean().optional(),
  })
  .refine(requireOneInput, {
    message: 'One of filePath, fileUrl, or fileContentBase64 is required',
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
