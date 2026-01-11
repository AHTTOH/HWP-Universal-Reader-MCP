# PRD: HWP Universal Reader MCP

## 1. 제품 개요 (Product Overview)

### 1.1 제품 설명

HWP Universal Reader는 AI 도구(ChatGPT, Claude, Cursor 등)가 한글 문서 파일(.hwp, .hwpx)을 네이티브로 읽고 변환할 수 있도록 하는 MCP(Model Context Protocol) 서버입니다. 

전 세계 AI 도구는 한국에서 가장 널리 사용되는 HWP 포맷을 지원하지 않아, 한국 사용자들은 수동으로 PDF나 DOCX로 변환한 후 업로드해야 하는 불편함을 겪고 있습니다. 본 제품은 MCP 프로토콜을 통해 AI가 HWP 파일을 직접 파싱하고, 텍스트를 추출하며, 다른 포맷으로 변환할 수 있는 기능을 제공합니다.

### 1.2 핵심 가치 제안

- **즉시성**: 변환 과정 없이 AI가 HWP 파일을 직접 읽음
- **프라이버시**: 로컬 환경에서 파일 처리, 외부 업로드 불필요
- **범용성**: ChatGPT, Claude, Cursor 등 주요 AI 도구 모두 지원
- **무료**: 오픈소스 라이선스, 사용 제한 없음
- **확장성**: 나중에 Cloud API로 SaaS 전환 가능

***

## 2. 시장 문제 정의 (Pain Points)

### 2.1 현재 사용자가 겪는 문제

**문제 1: AI 도구의 HWP 미지원**
```
현상: ChatGPT, Claude, Gemini 등 모든 주요 AI 도구가 HWP 파일 형식을 인식하지 못함
영향: 한국 사용자는 AI로 문서 분석/요약 시 수동 변환 필수
빈도: 매일 수만 건 발생 추정
```

**문제 2: 온라인 변환기의 한계**
```
현상: Vertopal, FreeFileConvert 등 온라인 변환기 사용 시
- 파일 업로드 필요 (프라이버시 우려)
- 광고 노출
- 파일 크기 제한 (5MB~10MB)
- 변환 품질 저하 (레이아웃 깨짐)
- 추가 단계 필요 (변환 → 다운로드 → AI 업로드)
```

**문제 3: 한컴오피스 의존성**
```
현상: HWP를 읽으려면 한컴오피스 구매 필요
비용: 개인용 ₩132,000 ~ 기업용 수십만 원
문제: 
- 비용 부담
- Windows/Mac 전용 (Linux 불가)
- 라이선스 관리 복잡
- AI 워크플로우에 통합 불가
```

**문제 4: 공공기관/교육기관의 HWP 의존도**
```
통계:
- 한국 공공기관 문서의 99% HWP 사용
- 대학 과제 80% 이상 HWP 제출
- 기업 보고서 대부분 HWP

결과: 외국 유학생, 외국계 기업, 글로벌 협업 시 장벽
```

### 2.2 시장 규모

**1차 타겟 (Early Adopters):**
- ChatGPT Plus 구독자 (한국): 추정 50만 명
- Claude Desktop 사용자 (한국): 추정 5만 명
- Cursor 개발자 (한국): 추정 1만 명

**2차 타겟 (Mass Market):**
- 한국 AI 도구 사용자: 추정 500만 명
- HWP 파일 접하는 사람: 추정 2,000만 명 (한국 인구의 40%)

***

## 3. 레퍼런스 서비스 분석

### 3.1 경쟁 서비스

| 서비스 | 유형 | 장점 | 단점 | 비고 |
|--------|------|------|------|------|
| **Vertopal** | 온라인 변환기 | 무료, 간단 | 업로드 필요, 프라이버시 우려, AI 통합 불가 | vertopal.com |
| **한컴오피스** | 데스크톱 앱 | 완벽한 호환성 | 유료(₩132,000~), AI 통합 불가 | hancom.com |
| **LibreOffice** | 오픈소스 오피스 | 무료 | HWP 지원 제한적, 레이아웃 깨짐 | libreoffice.org |
| **pyhwp** | Python 라이브러리 | 오픈소스, 텍스트 추출 | Python 환경 필요, 개발자용, AI 통합 복잡 | github.com/mete0r/pyhwp |
| **hwp.js** | JavaScript 라이브러리 | 웹 기술, 오픈소스 | 라이브러리 수준, 최종 사용자 제품 아님 | github.com/hahnlee/hwp.js |

### 3.2 차별화 전략

**vs 온라인 변환기:**
- AI 도구에 직접 통합 (변환 과정 생략)
- 로컬 처리 (프라이버시 보장)
- 무제한 사용 (파일 크기/개수 제한 없음)

**vs 한컴오피스:**
- 무료 오픈소스
- AI 워크플로우 자동화 가능
- 크로스 플랫폼 (Windows/Mac/Linux)

**vs 기존 라이브러리:**
- 최종 사용자 제품 (설치/설정 간단)
- MCP 표준 프로토콜 지원
- 주요 AI 도구 모두 연동

**Note:** 현재 MCP 생태계에 HWP 파싱 서버는 존재하지 않음. PlayMCP, MCP Market 등 주요 마켓플레이스에서 "한글", "HWP", "Korean document" 검색 시 결과 없음 (2026년 1월 기준).

***

## 4. 목표 및 핵심 지표 (Goals & KPIs)

### 4.1 비즈니스 목표

**Phase 1 (1개월):** 오픈소스 런칭 및 커뮤니티 구축
- PlayMCP 도구함 등록 승인
- GitHub 스타 100개 달성
- Reddit/HackerNews 반응 확보

**Phase 2 (3개월):** 사용자 확보 및 검증
- 월간 활성 사용자(MAU) 1,000명
- GitHub 스타 500개
- 기업 문의 5건 이상

**Phase 3 (6개월):** 생태계 확장
- ChatGPT/Claude 공식 추천 도구 등재
- 커뮤니티 기여자 10명 이상
- Cloud API 베타 출시

### 4.2 측정 지표 (KPIs)

**기술 지표:**
- HWP 파싱 성공률: ≥95%
- HWPX 파싱 성공률: ≥99%
- 평균 처리 시간: <3초 (10MB 파일 기준)
- 에러율: <5%

**사용자 지표:**
- GitHub 스타: 100 (1개월), 500 (3개월), 1,000 (6개월)
- 월간 다운로드: 1,000 (npm)
- 사용자 리텐션: 주간 30%

**비즈니스 지표:**
- PlayMCP 도구함 호출 수: 월 1,000건
- 기업 문의: 월 5건
- 미디어 언급: 10건 (한국 IT 미디어)

***

## 5. 핵심 기능 및 명세 (Core Features)

### 5.1 MCP Tools (필수 3개)

#### Tool 1: `read_hwp` - HWP 파일 읽기

**설명:** HWP 5.0 이상 파일에서 모든 텍스트 내용을 추출합니다.

**Input Schema:**
```json
{
  "name": "read_hwp",
  "description": "HWP(한글) 파일에서 텍스트를 추출합니다. 본문, 각주, 헤더, 푸터 등 모든 텍스트를 포함합니다.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "filePath": {
        "type": "string",
        "description": "HWP 파일의 절대 경로 (예: /Users/name/document.hwp)"
      }
    },
    "required": ["filePath"]
  }
}
```

**Output:**
```typescript
{
  text: string;              // 추출된 전체 텍스트
  metadata?: {               // 선택적 메타데이터
    version: string;         // HWP 버전 (예: "5.0")
    author?: string;         // 작성자
    title?: string;          // 문서 제목
    pages?: number;          // 페이지 수 (추정)
  }
}
```

**처리 방식:**
- hwp.js 라이브러리 사용
- OLE Compound Document 구조 파싱
- 텍스트 노드 재귀적 추출
- 한글 인코딩 자동 감지 (EUC-KR/UTF-8)

**에러 처리:**
```typescript
Error Types:
- FILE_NOT_FOUND: 파일 경로 없음
- UNSUPPORTED_VERSION: HWP 3.0 이하
- ENCRYPTED: 암호화된 파일
- CORRUPTED: 손상된 파일
- PARSE_ERROR: 파싱 실패
```

***

#### Tool 2: `read_hwpx` - HWPX 파일 읽기

**설명:** HWPX (XML 기반) 파일에서 텍스트를 추출합니다. HWP보다 빠르고 안정적입니다.

**Input Schema:**
```json
{
  "name": "read_hwpx",
  "description": "HWPX 파일에서 텍스트를 추출합니다. HWPX는 XML 기반으로 HWP보다 파싱이 빠릅니다.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "filePath": {
        "type": "string",
        "description": "HWPX 파일의 절대 경로 (예: /Users/name/document.hwpx)"
      }
    },
    "required": ["filePath"]
  }
}
```

**Output:** (read_hwp와 동일)

**처리 방식:**
- @ssabrojs/hwpxjs 라이브러리 사용
- ZIP 압축 해제
- Contents/section*.xml 파싱
- `<hp:t>` 태그에서 텍스트 추출

***

#### Tool 3: `convert_to_docx` - DOCX 변환

**설명:** HWP/HWPX 파일을 Microsoft Word 형식(.docx)으로 변환합니다.

**Input Schema:**
```json
{
  "name": "convert_to_docx",
  "description": "HWP 또는 HWPX 파일을 DOCX(Microsoft Word) 형식으로 변환합니다. 텍스트와 기본 서식이 보존됩니다.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "filePath": {
        "type": "string",
        "description": "원본 HWP/HWPX 파일 경로"
      },
      "outputPath": {
        "type": "string",
        "description": "출력 DOCX 파일 경로 (선택, 미입력 시 자동 생성)"
      }
    },
    "required": ["filePath"]
  }
}
```

**Output:**
```typescript
{
  success: boolean;
  docxPath: string;         // 생성된 DOCX 파일 경로
  originalSize: number;     // 원본 파일 크기 (bytes)
  convertedSize: number;    // 변환된 파일 크기 (bytes)
}
```

**변환 로직:**
1. HWP/HWPX 텍스트 추출 (Tool 1 또는 2 사용)
2. Office Open XML 구조 생성
3. 텍스트를 `<w:t>` 태그로 매핑
4. ZIP 압축하여 .docx 생성

**제약사항:**
- 기본 서식만 보존 (굵게, 기울임, 밑줄)
- 표는 텍스트로 변환 (레이아웃 미보존)
- 이미지는 Phase 2에서 지원 예정

***

### 5.2 지원 환경

**AI 플랫폼:**
- ChatGPT (Plus/Team/Enterprise) - Connector 방식
- Claude Desktop (Mac/Windows) - Config 파일 방식
- PlayMCP 웹 - 도구함 등록
- Cursor - 내장 MCP 지원
- Cline (VS Code Extension)

**운영체제:**
- macOS 11+ (Intel/Apple Silicon)
- Windows 10/11
- Linux (Ubuntu 20.04+)

**Node.js 버전:**
- 최소: Node.js 20.0.0
- 권장: Node.js 22.0.0 (LTS)

***

## 6. 부가 기능 제안 (Nice-to-Have Features)

### Phase 2 기능 (출시 후 3개월)

**1. 문서 구조 분석 API**
```typescript
analyzeStructure(filePath: string): {
  sections: number;      // 섹션 개수
  tables: number;        // 표 개수
  images: number;        // 이미지 개수
  toc: string[];         // 목차 추출
  wordCount: number;     // 단어 수
}
```

**2. 배치 처리**
```typescript
convertBatch(filePaths: string[]): Promise<Result[]>
// 여러 파일 동시 변환
```

**3. 스트리밍 API**
```typescript
readHwpStream(filePath: string): AsyncIterator<string>
// 큰 파일을 청크로 나눠 전송
```

### Phase 3 기능 (출시 후 6개월)

**4. 양방향 변환**
```typescript
docxToHwp(docxPath: string): string
// DOCX → HWP 역변환
```

**5. OCR 지원**
```typescript
readScannedHwp(filePath: string): string
// 스캔된 HWP 이미지 텍스트 추출
```

**6. 암호화 파일 지원**
```typescript
readEncryptedHwp(filePath: string, password: string): string
```

***

## 7. 사용자 페르소나 및 시나리오

### 페르소나 1: 민준 (대학생, 23세)

**배경:**
- 서울 소재 대학 경영학과 3학년
- ChatGPT Plus 구독 중 (과제/리포트 작성용)
- 주 3회 HWP 형식 과제 제출

**Pain Point:**
- 교수님이 올린 HWP 강의자료를 ChatGPT로 요약하고 싶은데, 매번 온라인 변환기로 PDF 만든 후 업로드해야 함
- 변환 과정에서 표와 수식이 깨져서 내용 파악 어려움

**사용 시나리오:**
```
1. 교수님이 "2024년 마케팅 트렌드.hwp" 업로드 (학교 LMS)
2. 민준이 파일 다운로드
3. ChatGPT 열고 [+] > More > HWP Reader 선택
4. "이 HWP 파일 핵심 내용 5줄로 요약해줘" + 파일 첨부
5. ChatGPT가 HWP 읽고 즉시 요약 제공
6. 민준: "3페이지 표 내용 설명해줘"
7. ChatGPT: 표 내용 파싱해서 설명
```

**기대 효과:**
- 시간 절약: 변환 과정 생략 (30초 → 5초)
- 정확도 향상: 원본 파일 직접 파싱
- 학습 효율: 즉시 질문/답변 가능

***

### 페르소나 2: 수진 (스타트업 개발자, 29세)

**배경:**
- AI 스타트업 백엔드 개발자
- Claude Desktop 사용 (코딩 어시스턴트)
- 정부 지원사업 신청 중 (서류 대부분 HWP)

**Pain Point:**
- 정부 공고문 100페이지 HWP 분석 필요
- 한컴오피스 구매 부담 (개인 ₩132,000)
- 수동으로 내용 복사-붙여넣기 시 서식 깨짐

**사용 시나리오:**
```
1. 중소벤처기업부 "AI 바우처 지원사업.hwp" 다운로드
2. Claude Desktop 실행
3. "~/Downloads/지원사업.hwp 파일에서 '신청 자격' 부분 찾아줘"
4. Claude가 HWP MCP 호출 → 파싱 → 관련 섹션 추출
5. 수진: "제출 서류 목록 표로 정리해줘"
6. Claude: 표 파싱 → Markdown 표로 변환
7. 수진: 노션에 복사-붙여넣기
```

**기대 효과:**
- 비용 절감: 한컴오피스 불필요
- 자동화: API로 여러 공고 동시 분석 가능
- 협업: 팀원들과 Claude 통해 정보 공유

***

### 페르소나 3: James (외국계 기업 PM, 35세)

**배경:**
- 미국 본사, 한국 지사 근무
- 한국어 읽기는 가능하지만 HWP 환경 없음
- 한국 파트너사와 협업 (계약서/보고서 대부분 HWP)

**Pain Point:**
- 파트너사가 보낸 HWP 계약서를 열 수 없음
- 온라인 변환기 사용 시 회사 보안 정책 위반 우려
- 파트너사에게 "PDF로 보내달라" 요청하면 비즈니스 속도 저하

**사용 시나리오:**
```
1. 파트너사에서 "공급계약서_2026.hwp" 이메일 수신
2. Jamesがファイル다운로드
3. ChatGPT Enterprise 사용
4. "Summarize this contract in English" + HWP 첨부
5. ChatGPT가 한글 텍스트 추출 → 영어로 요약
6. James: "What are the payment terms?"
7. ChatGPT: 계약서에서 지불 조건 찾아서 영어로 설명
```

**기대 효과:**
- 비즈니스 속도: 즉시 문서 확인
- 보안: 외부 변환기 사용 불필요 (로컬 처리)
- 글로벌 협업: 언어 장벽 해소

***

## 8. 기술 스택 및 아키텍처

### 8.1 기술 스택

**Backend (MCP Server):**
```json
{
  "runtime": "Node.js 20+",
  "language": "TypeScript 5.3+",
  "framework": "@modelcontextprotocol/sdk ^0.5.0",
  "parsing": {
    "hwp": "hwp.js ^0.0.3",
    "hwpx": "@ssabrojs/hwpxjs latest"
  },
  "utilities": {
    "compression": "adm-zip ^0.5.14",
    "xml": "fast-xml-parser ^4.3.5",
    "encoding": "iconv-lite ^0.6.3"
  },
  "validation": "zod ^3.22.4"
}
```

**Development:**
```json
{
  "build": "typescript",
  "linter": "eslint",
  "formatter": "prettier",
  "testing": "vitest",
  "ci": "GitHub Actions"
}
```

**Deployment:**
```
옵션 1: mcphosting.io (카카오 공식, 무료)
옵션 2: Railway (Dockerfile 배포)
옵션 3: Self-hosted (사용자 로컬 실행)
```

### 8.2 시스템 아키텍처

```
┌─────────────────────────────────────────┐
│         AI Client Layer                 │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │ ChatGPT  │ │  Claude  │ │ Cursor  │ │
│  │Connector │ │ Desktop  │ │  MCP    │ │
│  └────┬─────┘ └─────┬────┘ └────┬────┘ │
└───────┼─────────────┼───────────┼──────┘
        │             │           │
        └─────────────┼───────────┘
                      │
              ┌───────▼────────┐
              │  MCP Protocol  │
              │   (stdio/SSE)  │
              └───────┬────────┘
                      │
        ┌─────────────▼──────────────┐
        │   HWP MCP Server (Node.js) │
        │                            │
        │  ┌──────────────────────┐  │
        │  │   Tool Handlers      │  │
        │  │  - read_hwp()        │  │
        │  │  - read_hwpx()       │  │
        │  │  - convert_to_docx() │  │
        │  └──────────┬───────────┘  │
        │             │              │
        │  ┌──────────▼───────────┐  │
        │  │   Parser Layer       │  │
        │  ├──────────┬───────────┤  │
        │  │ hwp.js   │ hwpxjs    │  │
        │  └──────────┴───────────┘  │
        └──────────────┬──────────────┘
                       │
        ┌──────────────▼──────────────┐
        │   File System (Local)       │
        │   /Users/name/document.hwp  │
        └─────────────────────────────┘
```

### 8.3 데이터 흐름

**Case 1: ChatGPT에서 HWP 읽기**
```
1. User → ChatGPT: "이 HWP 파일 요약해줘" + 파일 업로드
2. ChatGPT → 내부 스토리지: 파일 저장 (/tmp/upload_xxx.hwp)
3. ChatGPT → MCP Connector: read_hwp("/tmp/upload_xxx.hwp")
4. MCP Server → hwp.js: 파일 파싱
5. hwp.js → MCP Server: 텍스트 반환
6. MCP Server → ChatGPT: { text: "..." }
7. ChatGPT → LLM: 텍스트 요약 생성
8. ChatGPT → User: 요약 결과 표시
```

**Case 2: Claude Desktop에서 DOCX 변환**
```
1. User → Claude: "~/Documents/report.hwp를 docx로 변환해줘"
2. Claude → MCP Server: convert_to_docx("~/Documents/report.hwp")
3. MCP Server → hwp.js: HWP 파싱
4. MCP Server → DOCX Generator: XML 생성
5. MCP Server → File System: report.docx 저장
6. MCP Server → Claude: { success: true, docxPath: "..." }
7. Claude → User: "✅ 변환 완료: ~/Documents/report.docx"
```

***

## 9. 보안 및 컴플라이언스

### 9.1 파일 처리 보안

**원칙:**
- 모든 파일은 로컬에서 처리
- 네트워크 전송 없음 (사용자 PC ↔ MCP Server 간만 통신)
- 임시 파일은 처리 후 즉시 삭제

**구현:**
```typescript
async function safeFileProcessing(filePath: string) {
  let tempFile: string | null = null;
  
  try {
    // 파일 읽기 (메모리로만)
    const content = await fs.readFile(filePath);
    
    // 파싱 (메모리 내)
    const text = parseHwp(content);
    
    return text;
    
  } finally {
    // 임시 파일 삭제 (있다면)
    if (tempFile) {
      await fs.unlink(tempFile).catch(() => {});
    }
  }
}
```

### 9.2 악성 파일 방어

**HWP 매크로 실행 방지:**
- hwp.js는 텍스트만 추출 (매크로 실행 안 함)
- 샌드박스 환경 (Node.js VM)
- 파일 시스템 접근 제한

**입력 검증:**
```typescript
// 파일 크기 제한
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// 파일 확장자 검증
const ALLOWED_EXTENSIONS = ['.hwp', '.hwpx'];

// Magic number 검증 (HWP 시그니처)
const HWP_SIGNATURE = Buffer.from([0xD0, 0xCF, 0x11, 0xE0]);
```

### 9.3 개인정보 처리

**GDPR/PIPA 준수:**
- 사용자 파일은 서버에 저장하지 않음
- 로그에 파일 내용 기록 안 함
- 사용 통계는 익명화

**프라이버시 정책:**
```
- 파일 처리: 로컬 환경에서만
- 데이터 수집: 없음
- 쿠키: 사용 안 함
- 분석: GitHub 스타/다운로드 수만 (공개 정보)
```

### 9.4 라이선스 컴플라이언스

**오픈소스 라이선스:**
- HWP MCP Server: Apache 2.0 (상업적 이용 허용)
- hwp.js: Apache 2.0 (준수 필요)
- @ssabrojs/hwpxjs: MIT (자유로운 사용)

**크레딧 명시:**
```markdown
## Credits
- [hwp.js](https://github.com/hahnlee/hwp.js) by @hahnlee - Apache 2.0
- [@ssabrojs/hwpxjs](https://www.npmjs.com/package/@ssabrojs/hwpxjs) - MIT
```

***

## 10. 배포 및 운영

### 10.1 배포 전략

**Phase 1: GitHub 오픈소스**
```
1. GitHub Repository 생성 (Public)
2. README.md 작성 (한글/영어)
3. npm 패키지 등록
4. PlayMCP 도구함 등록
```

**Phase 2: 주요 플랫폼 지원**
```
1. ChatGPT Connector 공식 지원
2. Claude Desktop Quickstart 가이드
3. Cursor 마켓플레이스 등록 (가능 시)
```

**Phase 3: SaaS 전환**
```
1. Cloud API 베타 출시
2. hwp-reader.com 웹사이트
3. 유료 플랜 도입
```

### 10.2 모니터링

**기술 지표:**
```
- 에러율: Sentry
- 응답 시간: 자체 로깅
- 메모리 사용량: Node.js metrics
```

**비즈니스 지표:**
```
- GitHub 스타: GitHub API
- npm 다운로드: npm stats
- PlayMCP 호출 수: 카카오 제공 대시보드
```

### 10.3 사용자 지원

**문서:**
- README.md (설치/사용법)
- TROUBLESHOOTING.md (문제 해결)
- API.md (Tool 명세)
- CONTRIBUTING.md (기여 가이드)

**커뮤니티:**
- GitHub Issues (버그 리포트)
- GitHub Discussions (Q&A)
- Discord 서버 (커뮤니티, 선택)

***

## 11. 마일스톤 및 로드맵

### Week 1: MVP 개발
```
Day 1-2: 프로젝트 세팅, hwp.js/hwpxjs 통합
Day 3-4: 3개 Tool 구현 (read_hwp, read_hwpx, convert_to_docx)
Day 5-6: 에러 처리, 테스트 작성
Day 7: README 작성, GitHub 공개
```

### Week 2: 배포 및 홍보
```
Day 8-9: PlayMCP 등록, ChatGPT Connector 가이드 작성
Day 10-11: Reddit/HN 포스팅, 한국 커뮤니티 홍보
Day 12-13: 초기 사용자 피드백 수집, 버그 수정
Day 14: 버전 1.0.0 릴리스
```

### Month 2-3: 성장 및 개선
```
- 사용자 피드백 기반 개선
- 성능 최적화 (큰 파일 처리)
- 추가 기능 개발 (analyzeStructure 등)
- 미디어 인터뷰/기고
```

### Month 4-6: 생태계 확장
```
- Cloud API 설계 및 개발
- 웹사이트 구축 (hwp-reader.com)
- 유료 플랜 모델 검증
- 기업 고객 확보
```

***

## 12. 리스크 및 대응 방안

### 기술적 리스크

**R1: hwp.js 라이브러리 버그/한계**
```
리스크: hwp.js가 일부 HWP 파일 파싱 실패
확률: 중 (커뮤니티 라이브러리)
영향: 높음 (핵심 기능)
대응:
- 테스트 케이스 100개 이상 확보
- hwp.js에 기여 (버그 수정 PR)
- 대안 라이브러리 조사 (pyhwp 백업)
- 에러 메시지에 회피 방법 안내
```

**R2: MCP 프로토콜 변경**
```
리스크: Anthropic이 MCP 스펙 변경
확률: 낮음 (표준화 진행 중)
영향: 중 (호환성 깨짐)
대응:
- MCP SDK 버전 고정
- 변경 사항 모니터링
- 빠른 업데이트 릴리스
```

**R3: 파일 크기/복잡도 한계**
```
리스크: 50MB+ HWP 파일 메모리 초과
확률: 중
영향: 중
대응:
- 스트리밍 API 개발 (Phase 2)
- 파일 크기 경고 (>10MB)
- 청크 단위 처리
```

### 비즈니스 리스크

**R4: 사용자 확보 실패**
```
리스크: 홍보 부족으로 사용자 미확보
확률: 중
영향: 높음
대응:
- Reddit/HN 타이밍 전략
- 인플루언서 협업
- 유튜브 튜토리얼 제작
- Product Hunt 런칭
```

**R5: 한컴과 법적 이슈**
```
리스크: 한글과컴퓨터의 특허 문제 제기
확률: 낮음 (리버스 엔지니어링 합법)
영향: 매우 높음 (프로젝트 중단)
대응:
- 법률 자문 확보
- hwp.js 커뮤니티 선례 확인
- 최악 시 프로젝트 중단 각오
```

**R6: ChatGPT/Claude 정책 변경**
```
리스크: OpenAI/Anthropic이 MCP 제한
확률: 낮음
영향: 높음
대응:
- 여러 플랫폼 지원 (분산)
- 웹 서비스 대안 준비
- 커뮤니티 압력
```

***

## 13. 성공 기준 (Definition of Success)

### 기술적 성공
```
✅ 3개 Tool 모두 정상 작동
✅ HWP 5.0+ 파일 95% 이상 파싱 성공
✅ HWPX 파일 99% 이상 파싱 성공
✅ 평균 응답 시간 3초 이내
✅ 에러율 5% 미만
```

### 사용자 성공
```
✅ GitHub 스타 100개 (1개월 내)
✅ PlayMCP 월간 호출 1,000건 (2개월 내)
✅ Reddit/HN 포스팅 100+ 업보트
✅ 사용자 리뷰 "This is exactly what I needed!" 유형
✅ 기업 문의 5건 이상
```

### 비즈니스 성공
```
✅ PlayMCP 공식 추천 도구 선정
✅ 한국 IT 미디어 10곳 이상 보도
✅ Cloud API 베타 대기자 100명
✅ 포트폴리오로 취업 성공 (개인 목표)
```

***

## 14. 부록 (Appendix)

### A. HWP 파일 포맷 이해

**HWP 5.0 구조:**
```
OLE Compound Document (Microsoft 표준)
├─ FileHeader: 버전 정보
├─ BodyText/: 본문
│   ├─ Section0: 첫 번째 섹션
│   ├─ Section1: 두 번째 섹션
│   └─ ...
├─ BinData/: 이미지/OLE 객체
└─ DocInfo: 문서 메타데이터
```

**HWPX 구조:**
```
ZIP 압축 파일
├─ Contents/
│   ├─ section0.xml: 본문
│   ├─ header.xml: 헤더
│   └─ styles.xml: 스타일
├─ BinData/: 바이너리 데이터
└─ manifest.xml: 파일 목록
```

**Note:** hwp.js는 HWP 공식 문서 ([한글과컴퓨터 문서 포맷](https://github.com/hahnlee/hwp.js/blob/main/docs/hwp-format.md)) 기반으로 개발됨.

### B. 테스트 시나리오

**기본 테스트:**
1. 일반 텍스트 HWP (10페이지)
2. 표 포함 HWP (5개 표)
3. 이미지 포함 HWP (10장)
4. 수식 포함 HWP (LaTeX)
5. 각주/미주 HWP
6. 목차 자동 생성 HWP
7. 헤더/푸터 HWP

**엣지 케이스:**
1. 빈 파일 (0바이트)
2. 암호화된 HWP
3. 손상된 HWP (중간에 잘림)
4. 매우 큰 HWP (100MB)
5. HWP 3.0 (지원 안 함)
6. 가짜 확장자 (.txt → .hwp 이름 변경)

### C. FAQ

**Q1: 한컴오피스 없이도 작동하나요?**
A: 네, 한컴오피스 설치 불필요합니다. 오픈소스 라이브러리(hwp.js)로 파싱합니다.

**Q2: 온라인 변환기보다 뭐가 좋나요?**
A: ① 파일 업로드 불필요 (프라이버시), ② AI 도구에 직접 통합, ③ 무제한 사용

**Q3: 레이아웃이 완벽히 보존되나요?**
A: Phase 1에서는 텍스트 위주로 추출됩니다. 표/이미지는 Phase 2에서 개선 예정입니다.

**Q4: 상업적으로 사용 가능한가요?**
A: 네, Apache 2.0 라이선스로 상업적 이용 가능합니다.

**Q5: Windows에서도 작동하나요?**
A: 네, Node.js 20+가 설치되어 있으면 Windows/Mac/Linux 모두 작동합니다.

***

## 15. 레퍼런스

**기술 문서:**
- [MCP Protocol Specification](https://modelcontextprotocol.io/docs)
- [hwp.js GitHub](https://github.com/hahnlee/hwp.js)
- [PlayMCP 개발 가이드](https://playmcp.kakao.com/docs)

**시장 조사:**
- 한국 HWP 사용 통계: 한글과컴퓨터 공식 발표
- ChatGPT Plus 구독자 수: OpenAI 공개 자료
- MCP 생태계 현황: Anthropic 블로그

**경쟁 분석:**
- Vertopal: https://www.vertopal.com
- FreeFileConvert: https://www.freefileconvert.com
- pyhwp: https://github.com/mete0r/pyhwp

***
