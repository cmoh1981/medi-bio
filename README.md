# MedDigest - Daily Med-Bio Insight

> 논문 한 장으로 끝내는 Daily Med-Bio Insight  
> 바쁜 임상의, 연구자, 바이오 창업자를 위한 매일 1편 논문 해설 서비스

## 🎯 Project Overview

- **Name**: MedDigest
- **Goal**: 의료/바이오 분야 논문을 "임상의 시각"으로 해설하는 구독형 서비스
- **Target Users**: 
  - 바쁜 임상의, 전공의, 펠로우
  - 바이오/헬스케어 스타트업 창업자·CTO
  - 투자 리서치 담당자 (바이오 커버리지 애널리스트, VC)

## 🔗 URLs

- **Preview (Sandbox)**: https://3000-iq577i3bwi02266jzki9m-b32ec7bb.sandbox.novita.ai
- **Production**: (배포 후 업데이트)

## ✅ Implemented Features

### 1. 카카오 로그인 (OAuth 2.0)
- `/api/auth/kakao` - 카카오 로그인 시작
- `/api/auth/kakao/callback` - 콜백 처리 및 세션 생성
- `/api/auth/logout` - 로그아웃

### 2. 논문 아카이브 시스템
- `/api/articles` - 논문 목록 (topic 필터 지원)
- `/api/articles/:slug` - 논문 상세 (구독 티어별 접근 제어)

### 3. 북마크 기능
- `/api/bookmarks` - 북마크 목록
- `/api/bookmarks/:articleId` - 북마크 추가/삭제

### 4. 구독 티어 시스템
- **Free**: 기본 콘텐츠 열람
- **Basic** (₩19,000/월): 주 3회 요약 + 주간 하이라이트
- **Pro** (₩49,000/월): 주 5회 요약 + AI 분석 + 프로젝트 관점 코멘트

### 5. 🤖 WebGPU LLM (Transformers.js v4) ✅ 완료
**Pro 사용자 전용 브라우저 내 AI 분석 기능**

#### 기술 스택
- **Transformers.js v4**: Hugging Face의 최신 JavaScript ML 라이브러리
- **Primary Model**: `onnx-community/Qwen2.5-0.5B-Instruct` (~400MB, 의료 문헌 분석 최적화)
- **Fallback Model**: `HuggingFaceTB/SmolLM2-360M-Instruct` (~280MB, 경량화 버전)
- **Quantization**: q4f16 (4-bit) for WebGPU, fp32 for WASM

#### 주요 기능
- **100% 로컬 처리**: 환자 데이터 프라이버시 완전 보장 (서버 전송 없음)
- **WebGPU 가속**: Chrome/Edge에서 GPU 가속 추론 (60+ tok/s on high-end devices)
- **WASM Fallback**: WebGPU 미지원 브라우저에서 자동 폴백
- **IndexedDB 캐싱**: 모델 다운로드 후 브라우저 캐시에 저장

#### 지원 브라우저
- ✅ Chrome 113+ (WebGPU)
- ✅ Edge 113+ (WebGPU)
- ✅ Opera 99+ (WebGPU)
- ⚠️ Safari/Firefox (WASM 폴백)

#### API Endpoints
- `/static/webgpu-llm.js` - LLM 모듈 (ES Module)
- `/static/ai-chat.js` - Chat UI 컴포넌트

#### 사용법 (프론트엔드 JavaScript)
```javascript
// 모델 초기화
await window.medLLM.initialize('primary');

// 질문 생성
const response = await window.medLLM.generate(question, {
  title: '논문 제목',
  keyMessages: ['핵심 메시지 1', '핵심 메시지 2'],
  clinicalInsight: '임상 관점 해설'
}, {
  maxNewTokens: 300,
  temperature: 0.7
});
```

## 📊 Data Architecture

### D1 Database Tables
```sql
users          - 사용자 정보 (카카오 연동)
sessions       - 세션 관리
articles       - 논문 요약 콘텐츠
bookmarks      - 사용자 북마크
read_history   - 열람 기록
```

### Article Structure
```json
{
  "slug": "unique-identifier",
  "title": "논문 제목",
  "journal": "NEJM",
  "doi": "10.1056/xxx",
  "topic": "심혈관",
  "tier": "basic | pro",
  "key_messages": ["핵심 메시지 1", "핵심 메시지 2", "핵심 메시지 3"],
  "study_n": 12500,
  "study_endpoint": "Primary/Secondary endpoints",
  "study_limitations": "연구 한계점",
  "clinical_insight": "임상/비즈니스 관점 해설"
}
```

## 🚀 Getting Started

### Local Development
```bash
# Install dependencies
npm install

# Apply migrations
npm run db:migrate:local

# Seed sample data
npm run db:seed

# Build
npm run build

# Start development server
npm run dev:sandbox
# or with PM2
pm2 start ecosystem.config.cjs
```

### Environment Variables (Production)
```bash
# Kakao OAuth
wrangler secret put KAKAO_CLIENT_ID
wrangler secret put KAKAO_CLIENT_SECRET
```

## 📁 Project Structure
```
meddigest/
├── src/
│   └── index.tsx           # Main Hono application
├── public/
│   └── static/
│       ├── webgpu-llm.js   # WebGPU LLM Module (Transformers.js v4)
│       └── ai-chat.js      # AI Chat UI Component
├── migrations/
│   └── 0001_initial_schema.sql
├── seed.sql                # Sample data
├── ecosystem.config.cjs    # PM2 config
├── wrangler.jsonc          # Cloudflare config
├── vite.config.ts          # Vite build config
└── package.json
```

## 🗓️ Deployment

### Platform: Cloudflare Pages

```bash
# Create D1 database
npx wrangler d1 create meddigest-db

# Apply migrations to production
npm run db:migrate:prod

# Deploy
npm run deploy:prod
```

### Status: ⏳ Pending
- [ ] D1 Production database 생성
- [ ] Kakao OAuth 시크릿 설정
- [ ] Cloudflare Pages 배포

## 🤖 Content Automation System

### 자동 콘텐츠 생성 스크립트

MedDigest는 고품질 의학 논문 데이터베이스를 기반으로 콘텐츠를 자동 생성합니다.

#### 사용법
```bash
# 모든 주제 각 1편씩 생성
node scripts/auto-generate.cjs

# 특정 주제로 3편 생성
node scripts/auto-generate.cjs --topic 심혈관 --count 3

# 모든 주제 각 5편씩 생성 + 바로 DB에 import
node scripts/auto-generate.cjs --all --count 5 --import
```

#### 지원 주제
- **심혈관** (5편): SGLT2i, 심방세동, 고혈압 RNA 치료제 등
- **내분비** (5편): Tirzepatide, Retatrutide, GLP-1 등
- **노화** (5편): Senolytic, NMN, TAME, Rapamycin 등
- **당뇨** (5편): CGM, 인공췌장, 줄기세포 췌도 이식 등

#### 출력 파일
- `generated-{timestamp}.sql` - D1 데이터베이스 INSERT 문
- `generated-{timestamp}.json` - 생성된 논문 데이터 (JSON)

#### Cloudflare Cron 자동화 (배포 후)
```jsonc
// wrangler.jsonc
{
  "triggers": {
    "crons": ["0 21 * * *"]  // 매일 오전 6시 KST
  }
}
```

#### 수동 Cron 트리거
```bash
curl -X POST "https://your-domain.pages.dev/api/cron/trigger" \
  -H "Authorization: Bearer your-cron-secret"
```

### 현재 콘텐츠 현황
- **총 논문 수**: 40편
- **주제별 분포**:
  - 심혈관: 10편 (basic: 5, pro: 5)
  - 내분비: 10편 (basic: 6, pro: 4)
  - 노화: 10편 (basic: 3, pro: 7)
  - 당뇨: 10편 (basic: 3, pro: 7)

## 📋 Progress (MVP 2주 계획)

### Week 1 ✅
- [x] 프로젝트 구조 설계
- [x] 카카오 로그인 구현
- [x] D1 데이터베이스 스키마
- [x] 기본 UI 구현
- [x] **WebGPU LLM 통합 (Transformers.js v4)**
- [x] **콘텐츠 자동화 시스템 구축**
- [x] **실제 논문 40편 요약 작성**

### Week 2
- [ ] Cloudflare 배포
- [ ] Kakao Developers 앱 등록
- [ ] 파일럿 사용자 10명 모집
- [ ] X/인스타 콘텐츠 발행 시작

## 🔧 Tech Stack

- **Frontend**: Tailwind CSS, Vanilla JS
- **Backend**: Hono (Edge Runtime)
- **Database**: Cloudflare D1 (SQLite)
- **Auth**: Kakao OAuth 2.0
- **AI**: 
  - Transformers.js v4 (Hugging Face)
  - WebGPU / WASM Runtime
  - Qwen2.5-0.5B-Instruct (Primary)
  - SmolLM2-360M-Instruct (Fallback)
- **Hosting**: Cloudflare Pages

## 🔮 Future Enhancements

- **PDF Upload & Analysis**: 사용자가 직접 논문 PDF 업로드하여 AI 분석
- **Multi-language Support**: 영어 논문 자동 한국어 요약
- **Personalized Recommendations**: 관심 분야 기반 논문 추천
- **Discussion Forum**: 전문가 토론 기능
- **API Access**: 기업/연구기관용 API 제공

---

**Last Updated**: 2026-02-15
