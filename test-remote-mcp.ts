import { readFile } from 'node:fs/promises'
import { writeFile } from 'node:fs/promises'

const RENDER_URL = 'https://hwp-mcp-server.onrender.com'
const TEST_FILE = '표준이력서.hwpx'

interface ErrorReport {
  timestamp: string
  testType: string
  inputFile: string
  error: {
    type: string
    message: string
    stack?: string
    details?: unknown
  }
  request?: {
    url: string
    method: string
    body?: unknown
  }
  response?: {
    status?: number
    statusText?: string
    body?: string
  }
}

const createErrorReport = async (error: unknown, context: {
  testType: string
  request?: ErrorReport['request']
  response?: ErrorReport['response']
}): Promise<void> => {
  const report: ErrorReport = {
    timestamp: new Date().toISOString(),
    testType: context.testType,
    inputFile: TEST_FILE,
    error: {
      type: error?.constructor?.name || typeof error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      details: error && typeof error === 'object' ? { ...error } : undefined,
    },
    request: context.request,
    response: context.response,
  }

  const reportPath = `error-report-${Date.now()}.json`
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8')
  console.error(`\n에러 보고서 생성: ${reportPath}`)
}

const testHealthCheck = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${RENDER_URL}/health`)
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status} ${response.statusText}`)
    }
    const data = await response.json()
    console.log('✅ Health check 성공:', data)
    return true
  } catch (error) {
    console.error('❌ Health check 실패:', error)
    await createErrorReport(error, { testType: 'health-check' })
    return false
  }
}

const testMCPConversion = async (): Promise<void> => {
  console.log('\n' + '='.repeat(60))
  console.log('원격 MCP 서버 변환 테스트')
  console.log('='.repeat(60))
  console.log('서버 URL:', RENDER_URL)
  console.log('테스트 파일:', TEST_FILE)
  console.log('')

  // Health check 먼저
  const healthOk = await testHealthCheck()
  if (!healthOk) {
    throw new Error('Health check 실패 - 서버가 응답하지 않습니다')
  }

  // 파일 읽기
  const fileBuffer = await readFile(TEST_FILE)
  const fileBase64 = fileBuffer.toString('base64')

  // MCP JSON-RPC 요청
  const requestBody = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'convert_to_docx',
      arguments: {
        fileContentBase64: fileBase64,
        fileName: TEST_FILE,
        returnBase64: true,
      },
    },
  }

  console.log('MCP 요청 전송 중...')
  const request: ErrorReport['request'] = {
    url: `${RENDER_URL}/message`,
    method: 'POST',
    body: requestBody,
  }

  try {
    const response = await fetch(`${RENDER_URL}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    const responseText = await response.text()
    const responseInfo: ErrorReport['response'] = {
      status: response.status,
      statusText: response.statusText,
      body: responseText.substring(0, 1000), // 처음 1000자만
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}\n${responseText}`)
    }

    let result
    try {
      result = JSON.parse(responseText)
    } catch {
      throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}`)
    }

    if (result.error) {
      throw new Error(`MCP Error: ${JSON.stringify(result.error)}`)
    }

    if (!result.result) {
      throw new Error('No result in response')
    }

    const content = result.result.content?.[0]?.text
    if (!content) {
      throw new Error('No content in result')
    }

    const parsedResult = JSON.parse(content)
    if (!parsedResult.success) {
      throw new Error(`Conversion failed: ${JSON.stringify(parsedResult)}`)
    }

    console.log('✅ 변환 성공!')
    console.log('원본 크기:', parsedResult.originalSize, 'bytes')
    console.log('변환 크기:', parsedResult.convertedSize, 'bytes')
    console.log('DOCX 파일명:', parsedResult.docxFileName)

  } catch (error) {
    console.error('❌ 변환 실패!')
    await createErrorReport(error, {
      testType: 'mcp-conversion',
      request,
      response: {
        status: response?.status,
        statusText: response?.statusText,
        body: responseText?.substring(0, 1000),
      },
    })
    throw error
  }
}

const run = async () => {
  try {
    await testMCPConversion()
    console.log('\n✅ 모든 테스트 통과!')
    process.exit(0)
  } catch (error) {
    console.error('\n❌ 테스트 실패:', error)
    process.exit(1)
  }
}

run()
