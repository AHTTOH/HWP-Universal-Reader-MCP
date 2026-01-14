import { readFile } from 'node:fs/promises'
import { writeFile } from 'node:fs/promises'

const RENDER_URL = 'https://hwp-mcp-server.onrender.com'
const TEST_FILE = '표준이력서.hwpx'

interface DetailedErrorReport {
  timestamp: string
  serverUrl: string
  tests: Array<{
    endpoint: string
    method: string
    status?: number
    statusText?: string
    responseBody?: string
    error?: string
    headers?: Record<string, string>
  }>
  conclusion: string
  recommendations: string[]
}

const testEndpoint = async (url: string, method: string = 'GET'): Promise<{
  status?: number
  statusText?: string
  responseBody?: string
  error?: string
  headers?: Record<string, string>
}> => {
  try {
    const response = await fetch(url, { method })
    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headers[key] = value
    })
    
    let responseBody: string | undefined
    try {
      responseBody = await response.text()
      // 너무 길면 잘라내기
      if (responseBody.length > 500) {
        responseBody = responseBody.substring(0, 500) + '... (truncated)'
      }
    } catch {
      responseBody = '(unable to read response body)'
    }

    return {
      status: response.status,
      statusText: response.statusText,
      responseBody,
      headers,
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

const run = async () => {
  console.log('='.repeat(60))
  console.log('원격 MCP 서버 상세 진단')
  console.log('='.repeat(60))
  console.log('서버 URL:', RENDER_URL)
  console.log('')

  const tests: DetailedErrorReport['tests'] = []

  // 1. Health check
  console.log('1. Health check 테스트...')
  const healthResult = await testEndpoint(`${RENDER_URL}/health`)
  tests.push({ endpoint: '/health', method: 'GET', ...healthResult })
  console.log('   결과:', healthResult.status || healthResult.error)

  // 2. Root endpoint
  console.log('2. Root endpoint 테스트...')
  const rootResult = await testEndpoint(`${RENDER_URL}/`)
  tests.push({ endpoint: '/', method: 'GET', ...rootResult })
  console.log('   결과:', rootResult.status || rootResult.error)

  // 3. SSE endpoint
  console.log('3. SSE endpoint 테스트...')
  const sseResult = await testEndpoint(`${RENDER_URL}/sse`)
  tests.push({ endpoint: '/sse', method: 'GET', ...sseResult })
  console.log('   결과:', sseResult.status || sseResult.error)

  // 4. Message endpoint (GET)
  console.log('4. Message endpoint (GET) 테스트...')
  const messageGetResult = await testEndpoint(`${RENDER_URL}/message`)
  tests.push({ endpoint: '/message', method: 'GET', ...messageGetResult })
  console.log('   결과:', messageGetResult.status || messageGetResult.error)

  // 5. Message endpoint (POST - invalid)
  console.log('5. Message endpoint (POST - invalid) 테스트...')
  const messagePostResult = await testEndpoint(`${RENDER_URL}/message`, 'POST')
  tests.push({ endpoint: '/message', method: 'POST', ...messagePostResult })
  console.log('   결과:', messagePostResult.status || messagePostResult.error)

  // 보고서 생성
  let conclusion = ''
  const recommendations: string[] = []

  const has200 = tests.some(t => t.status === 200)
  const has404 = tests.some(t => t.status === 404)
  const hasErrors = tests.some(t => t.error)

  if (hasErrors && !has200) {
    conclusion = '서버가 응답하지 않거나 접근할 수 없습니다. Render 배포가 완료되지 않았거나 서버가 다운되었을 수 있습니다.'
    recommendations.push('Render Dashboard에서 서비스 상태 확인')
    recommendations.push('서비스 로그 확인')
    recommendations.push('배포가 완료되었는지 확인 (보통 2-3분 소요)')
  } else if (has404 && !has200) {
    conclusion = '서버는 응답하지만 요청한 엔드포인트를 찾을 수 없습니다. 라우팅 설정이나 배포 상태를 확인해야 합니다.'
    recommendations.push('서버가 정상적으로 시작되었는지 확인')
    recommendations.push('HTTP 서버 라우팅 설정 확인')
    recommendations.push('환경 변수 및 포트 설정 확인')
  } else if (has200) {
    conclusion = '일부 엔드포인트는 정상 작동하지만, MCP 기능 테스트가 필요합니다.'
    recommendations.push('정상 응답하는 엔드포인트로 MCP 요청 테스트')
  }

  const report: DetailedErrorReport = {
    timestamp: new Date().toISOString(),
    serverUrl: RENDER_URL,
    tests,
    conclusion,
    recommendations,
  }

  const reportPath = `error-report-detailed-${Date.now()}.json`
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8')
  
  console.log('\n' + '='.repeat(60))
  console.log('진단 완료')
  console.log('='.repeat(60))
  console.log('결론:', conclusion)
  console.log('권장사항:')
  recommendations.forEach((rec, i) => console.log(`  ${i + 1}. ${rec}`))
  console.log(`\n상세 보고서: ${reportPath}`)
}

run().catch((error) => {
  console.error('진단 중 에러:', error)
  process.exit(1)
})
