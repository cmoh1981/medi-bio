import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'

// Types
type Bindings = {
  DB: D1Database
  KAKAO_CLIENT_ID: string
  KAKAO_CLIENT_SECRET: string
  APP_NAME: string
  APP_ENV: string
  CRON_SECRET?: string
}

// Cloudflare Workers types
interface ScheduledEvent {
  cron: string
  scheduledTime: number
}

interface ExecutionContext {
  waitUntil(promise: Promise<any>): void
  passThroughOnException(): void
}

type Variables = {
  user: {
    id: number
    kakao_id: string
    nickname: string
    subscription_tier: string
  } | null
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// CORS
app.use('/api/*', cors())

// Auth Middleware
app.use('*', async (c, next) => {
  const sessionToken = getCookie(c, 'session_token')
  
  if (sessionToken && c.env.DB) {
    try {
      const session = await c.env.DB.prepare(`
        SELECT u.id, u.kakao_id, u.nickname, u.subscription_tier
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.session_token = ? AND s.expires_at > datetime('now')
      `).bind(sessionToken).first()
      
      if (session) {
        c.set('user', session as Variables['user'])
      }
    } catch (e) {
      // DB not available in dev, continue
    }
  }
  
  c.set('user', c.get('user') || null)
  await next()
})

// ===== API Routes =====

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', app: 'MedDigest', timestamp: new Date().toISOString() })
})

// Get current user
app.get('/api/me', (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ authenticated: false }, 200)
  }
  return c.json({ authenticated: true, user })
})

// ===== Kakao OAuth =====

// Start Kakao login
app.get('/api/auth/kakao', (c) => {
  const clientId = c.env.KAKAO_CLIENT_ID || 'YOUR_KAKAO_CLIENT_ID'
  const redirectUri = `${new URL(c.req.url).origin}/api/auth/kakao/callback`
  
  const kakaoAuthUrl = new URL('https://kauth.kakao.com/oauth/authorize')
  kakaoAuthUrl.searchParams.set('client_id', clientId)
  kakaoAuthUrl.searchParams.set('redirect_uri', redirectUri)
  kakaoAuthUrl.searchParams.set('response_type', 'code')
  
  return c.redirect(kakaoAuthUrl.toString())
})

// Kakao callback
app.get('/api/auth/kakao/callback', async (c) => {
  const code = c.req.query('code')
  const error = c.req.query('error')
  
  if (error || !code) {
    return c.redirect('/?error=kakao_auth_failed')
  }
  
  const clientId = c.env.KAKAO_CLIENT_ID || 'YOUR_KAKAO_CLIENT_ID'
  const clientSecret = c.env.KAKAO_CLIENT_SECRET || ''
  const redirectUri = `${new URL(c.req.url).origin}/api/auth/kakao/callback`
  
  try {
    // Exchange code for token
    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code: code
      })
    })
    
    const tokens = await tokenRes.json() as { access_token?: string; error?: string }
    
    if (!tokens.access_token) {
      return c.redirect('/?error=kakao_token_failed')
    }
    
    // Get user info
    const userRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    })
    
    const kakaoUser = await userRes.json() as {
      id: number
      kakao_account?: {
        email?: string
        profile?: {
          nickname?: string
          profile_image_url?: string
        }
      }
    }
    
    const kakaoId = String(kakaoUser.id)
    const email = kakaoUser.kakao_account?.email || null
    const nickname = kakaoUser.kakao_account?.profile?.nickname || '사용자'
    const profileImage = kakaoUser.kakao_account?.profile?.profile_image_url || null
    
    // Upsert user
    await c.env.DB.prepare(`
      INSERT INTO users (kakao_id, email, nickname, profile_image)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(kakao_id) DO UPDATE SET
        email = excluded.email,
        nickname = excluded.nickname,
        profile_image = excluded.profile_image,
        updated_at = CURRENT_TIMESTAMP
    `).bind(kakaoId, email, nickname, profileImage).run()
    
    // Get user ID
    const user = await c.env.DB.prepare(`
      SELECT id FROM users WHERE kakao_id = ?
    `).bind(kakaoId).first() as { id: number }
    
    // Create session
    const sessionToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    
    await c.env.DB.prepare(`
      INSERT INTO sessions (user_id, session_token, expires_at)
      VALUES (?, ?, ?)
    `).bind(user.id, sessionToken, expiresAt).run()
    
    // Set cookie
    setCookie(c, 'session_token', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    })
    
    return c.redirect('/?login=success')
  } catch (e) {
    console.error('Kakao auth error:', e)
    return c.redirect('/?error=kakao_auth_error')
  }
})

// Logout
app.post('/api/auth/logout', async (c) => {
  const sessionToken = getCookie(c, 'session_token')
  
  if (sessionToken && c.env.DB) {
    await c.env.DB.prepare(`
      DELETE FROM sessions WHERE session_token = ?
    `).bind(sessionToken).run()
  }
  
  deleteCookie(c, 'session_token')
  return c.json({ success: true })
})

// ===== Articles API =====

// List articles
app.get('/api/articles', async (c) => {
  const user = c.get('user')
  const topic = c.req.query('topic')
  const limit = parseInt(c.req.query('limit') || '10')
  const offset = parseInt(c.req.query('offset') || '0')
  
  // Determine accessible tiers
  const userTier = user?.subscription_tier || 'free'
  const accessibleTiers = userTier === 'pro' ? ['basic', 'pro'] : ['basic']
  
  let query = `
    SELECT id, slug, title, journal, topic, tier, key_messages, published_at
    FROM articles
    WHERE tier IN (${accessibleTiers.map(() => '?').join(',')})
  `
  const params: (string | number)[] = [...accessibleTiers]
  
  if (topic) {
    query += ' AND topic = ?'
    params.push(topic)
  }
  
  query += ' ORDER BY published_at DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)
  
  try {
    const articles = await c.env.DB.prepare(query).bind(...params).all()
    
    // Parse key_messages JSON
    const parsedArticles = articles.results.map((a: any) => ({
      ...a,
      key_messages: JSON.parse(a.key_messages)
    }))
    
    return c.json({ articles: parsedArticles })
  } catch (e) {
    // Return sample data if DB not available
    return c.json({
      articles: [
        {
          id: 1,
          slug: 'sglt2-heart-failure-2026',
          title: 'SGLT2 억제제의 심부전 예방 효과: 대규모 RCT 결과',
          journal: 'NEJM',
          topic: '심혈관',
          tier: 'basic',
          key_messages: [
            'SGLT2 억제제가 당뇨병 환자의 심부전 입원율을 35% 감소시켰다',
            'eGFR 감소 속도가 위약 대비 40% 둔화되었다',
            '심혈관 사망률이 20% 유의하게 감소했다'
          ],
          published_at: '2026-02-15'
        },
        {
          id: 2,
          slug: 'glp1-obesity-brain-2026',
          title: 'GLP-1 수용체 작용제의 뇌 보상회로 조절 메커니즘',
          journal: 'Nature Medicine',
          topic: '내분비',
          tier: 'pro',
          key_messages: [
            'Semaglutide가 시상하부-보상회로 연결성을 직접 조절함을 fMRI로 확인',
            '음식 갈망(craving) 점수가 60% 감소, 이는 체중 감소와 독립적 효과',
            '도파민 D2 수용체 가용성 변화가 치료 반응 예측인자로 확인'
          ],
          published_at: '2026-02-14'
        }
      ]
    })
  }
})

// Get single article
app.get('/api/articles/:slug', async (c) => {
  const slug = c.req.param('slug')
  const user = c.get('user')
  
  try {
    const article = await c.env.DB.prepare(`
      SELECT * FROM articles WHERE slug = ?
    `).bind(slug).first() as any
    
    if (!article) {
      return c.json({ error: 'Article not found' }, 404)
    }
    
    // Check access
    const userTier = user?.subscription_tier || 'free'
    if (article.tier === 'pro' && userTier !== 'pro') {
      return c.json({ 
        error: 'Pro subscription required',
        preview: {
          id: article.id,
          slug: article.slug,
          title: article.title,
          journal: article.journal,
          topic: article.topic,
          tier: article.tier,
          published_at: article.published_at
        }
      }, 403)
    }
    
    // Record read history
    if (user) {
      await c.env.DB.prepare(`
        INSERT INTO read_history (user_id, article_id) VALUES (?, ?)
      `).bind(user.id, article.id).run()
    }
    
    // Parse JSON fields
    article.key_messages = JSON.parse(article.key_messages)
    
    // Remove full_content for non-pro users
    if (userTier !== 'pro') {
      delete article.full_content
    }
    
    return c.json({ article })
  } catch (e) {
    return c.json({ error: 'Database error' }, 500)
  }
})

// ===== Bookmarks API =====

// Get user bookmarks
app.get('/api/bookmarks', async (c) => {
  const user = c.get('user')
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const bookmarks = await c.env.DB.prepare(`
      SELECT a.id, a.slug, a.title, a.journal, a.topic, a.tier, a.published_at, b.created_at as bookmarked_at
      FROM bookmarks b
      JOIN articles a ON b.article_id = a.id
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
    `).bind(user.id).all()
    
    return c.json({ bookmarks: bookmarks.results })
  } catch (e) {
    return c.json({ bookmarks: [] })
  }
})

// Add bookmark
app.post('/api/bookmarks/:articleId', async (c) => {
  const user = c.get('user')
  const articleId = parseInt(c.req.param('articleId'))
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO bookmarks (user_id, article_id) VALUES (?, ?)
    `).bind(user.id, articleId).run()
    
    return c.json({ success: true })
  } catch (e) {
    return c.json({ error: 'Failed to add bookmark' }, 500)
  }
})

// Remove bookmark
app.delete('/api/bookmarks/:articleId', async (c) => {
  const user = c.get('user')
  const articleId = parseInt(c.req.param('articleId'))
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    await c.env.DB.prepare(`
      DELETE FROM bookmarks WHERE user_id = ? AND article_id = ?
    `).bind(user.id, articleId).run()
    
    return c.json({ success: true })
  } catch (e) {
    return c.json({ error: 'Failed to remove bookmark' }, 500)
  }
})

// ===== Main Page =====

app.get('/', (c) => {
  const user = c.get('user')
  
  return c.html(`
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MedDigest - Daily Med-Bio Insight</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <!-- WebGPU LLM 모듈 -->
  <script type="module" src="/static/webgpu-llm.js"></script>
  <script src="/static/ai-chat.js" defer></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            // 따뜻하고 지적인 색상 팔레트
            primary: {
              50: '#faf7f5',
              100: '#f5ede8',
              200: '#e8d5c8',
              300: '#d4b69e',
              400: '#c49a7a',
              500: '#b07d56',
              600: '#9a6642',
              700: '#7d5236',
              800: '#5f3f2a',
              900: '#4a3121',
              DEFAULT: '#7d5236'
            },
            sage: {
              50: '#f6f7f6',
              100: '#e3e7e3',
              200: '#c7d0c7',
              300: '#a3b3a3',
              400: '#7d917d',
              500: '#5f7360',
              600: '#4a5c4b',
              700: '#3d4a3e',
              800: '#333d34',
              900: '#2b332c',
              DEFAULT: '#5f7360'
            },
            cream: {
              50: '#fefdfb',
              100: '#fcf9f4',
              200: '#f9f3ea',
              300: '#f5ebdb',
              400: '#efe0c9',
              DEFAULT: '#fcf9f4'
            },
            navy: {
              700: '#2c3e50',
              800: '#1e2a36',
              900: '#141d24',
              DEFAULT: '#2c3e50'
            }
          },
          fontFamily: {
            'serif': ['Noto Serif KR', 'Georgia', 'serif'],
            'sans': ['Pretendard', 'Noto Sans KR', 'system-ui', 'sans-serif']
          }
        }
      }
    }
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@300;400;500;600;700&family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap');
    
    body { 
      font-family: 'Noto Sans KR', system-ui, sans-serif;
      background-color: #fcf9f4;
    }
    
    .font-serif { font-family: 'Noto Serif KR', Georgia, serif; }
    
    /* 따뜻한 그라데이션 */
    .warm-gradient { 
      background: linear-gradient(135deg, #5f7360 0%, #7d5236 50%, #9a6642 100%); 
    }
    
    .elegant-gradient {
      background: linear-gradient(180deg, #f6f7f6 0%, #fcf9f4 100%);
    }
    
    /* 부드러운 카드 스타일 */
    .card-elegant { 
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 8px rgba(125, 82, 54, 0.06), 0 1px 3px rgba(125, 82, 54, 0.1);
    }
    .card-elegant:hover { 
      transform: translateY(-3px); 
      box-shadow: 0 12px 32px rgba(125, 82, 54, 0.12), 0 4px 12px rgba(125, 82, 54, 0.08);
    }
    
    /* 티어 배지 */
    .tier-badge-basic { 
      background: linear-gradient(135deg, #e3e7e3 0%, #c7d0c7 100%); 
      color: #4a5c4b; 
    }
    .tier-badge-pro { 
      background: linear-gradient(135deg, #f5ebdb 0%, #e8d5c8 100%); 
      color: #7d5236; 
    }
    
    /* 구분선 */
    .divider-warm {
      height: 1px;
      background: linear-gradient(90deg, transparent 0%, #d4b69e 50%, transparent 100%);
    }
    
    /* 버튼 스타일 */
    .btn-warm {
      background: linear-gradient(135deg, #7d5236 0%, #9a6642 100%);
      transition: all 0.3s ease;
    }
    .btn-warm:hover {
      background: linear-gradient(135deg, #5f3f2a 0%, #7d5236 100%);
      transform: translateY(-1px);
    }
    
    .btn-sage {
      background: linear-gradient(135deg, #5f7360 0%, #7d917d 100%);
      transition: all 0.3s ease;
    }
    .btn-sage:hover {
      background: linear-gradient(135deg, #4a5c4b 0%, #5f7360 100%);
    }
    
    /* 토픽 필터 버튼 */
    .topic-filter {
      border: 1px solid transparent;
      transition: all 0.2s ease;
    }
    .topic-filter:hover {
      border-color: #d4b69e;
      background: #faf7f5;
    }
    .topic-filter.active {
      background: linear-gradient(135deg, #7d5236 0%, #9a6642 100%);
      color: white;
      border-color: transparent;
    }
    
    /* 인용문 스타일 */
    .quote-mark {
      font-family: Georgia, serif;
      font-size: 4rem;
      line-height: 1;
      opacity: 0.15;
    }
  </style>
</head>
<body class="min-h-screen">
  <!-- Header -->
  <header class="bg-white/80 backdrop-blur-sm border-b border-primary-200/50 sticky top-0 z-40">
    <div class="max-w-6xl mx-auto px-6 py-4">
      <div class="flex justify-between items-center">
        <div class="flex items-center space-x-4">
          <div class="w-10 h-10 bg-gradient-to-br from-sage-500 to-primary-600 rounded-xl flex items-center justify-center shadow-md">
            <i class="fas fa-book-medical text-white text-lg"></i>
          </div>
          <div>
            <h1 class="text-xl font-serif font-semibold text-navy-800 tracking-tight">MedDigest</h1>
            <p class="text-xs text-sage-600 font-medium tracking-wide">Daily Med-Bio Insight</p>
          </div>
        </div>
        <nav class="flex items-center space-x-4">
          ${user ? `
            <div class="flex items-center space-x-4">
              <div class="text-right">
                <span class="text-sm font-medium text-navy-800">${user.nickname}님</span>
                <span class="ml-2 px-2.5 py-1 rounded-full text-xs font-medium ${user.subscription_tier === 'pro' ? 'tier-badge-pro' : user.subscription_tier === 'basic' ? 'tier-badge-basic' : 'bg-gray-100 text-gray-600'}">${user.subscription_tier.toUpperCase()}</span>
              </div>
              <button onclick="logout()" class="px-4 py-2 text-sm font-medium text-primary-700 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition">로그아웃</button>
            </div>
          ` : `
            <a href="/api/auth/kakao" class="flex items-center space-x-2 px-5 py-2.5 bg-[#FEE500] hover:bg-[#FDD835] text-[#3C1E1E] rounded-xl transition shadow-sm hover:shadow">
              <img src="https://developers.kakao.com/assets/img/about/logos/kakao/kakao_login_btn_kakao_symbol.png" alt="Kakao" class="w-5 h-5">
              <span class="font-medium text-sm">카카오 로그인</span>
            </a>
          `}
        </nav>
      </div>
    </div>
  </header>

  <!-- Hero Section -->
  <section class="relative overflow-hidden">
    <div class="absolute inset-0 elegant-gradient"></div>
    <div class="absolute top-0 right-0 w-96 h-96 bg-sage-200/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
    <div class="absolute bottom-0 left-0 w-80 h-80 bg-primary-200/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3"></div>
    
    <div class="relative max-w-6xl mx-auto px-6 py-16 md:py-24">
      <div class="max-w-3xl">
        <p class="text-sage-600 font-medium text-sm tracking-widest uppercase mb-4">For Healthcare Professionals</p>
        <h2 class="font-serif text-3xl md:text-5xl font-semibold text-navy-800 leading-tight mb-6">
          매일 한 편의 논문이<br>
          <span class="text-primary-700">임상의 통찰</span>로 다가옵니다
        </h2>
        <p class="text-lg text-navy-700/80 leading-relaxed mb-8">
          바쁜 임상의, 연구자, 바이오 창업자를 위해<br class="hidden md:block">
          엄선된 Med-Bio 논문을 전문가 시각으로 해설해 드립니다.
        </p>
        
        <div class="flex flex-wrap gap-8 mb-8">
          <div class="flex items-center space-x-3">
            <div class="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center">
              <i class="fas fa-clock text-sage-600 text-lg"></i>
            </div>
            <div>
              <div class="text-2xl font-serif font-semibold text-navy-800">5분</div>
              <div class="text-sm text-sage-600">읽기 시간</div>
            </div>
          </div>
          <div class="flex items-center space-x-3">
            <div class="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center">
              <i class="fas fa-calendar-check text-sage-600 text-lg"></i>
            </div>
            <div>
              <div class="text-2xl font-serif font-semibold text-navy-800">매일</div>
              <div class="text-sm text-sage-600">새 콘텐츠</div>
            </div>
          </div>
          <div class="flex items-center space-x-3">
            <div class="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center">
              <i class="fas fa-shield-alt text-sage-600 text-lg"></i>
            </div>
            <div>
              <div class="text-2xl font-serif font-semibold text-navy-800">100%</div>
              <div class="text-sm text-sage-600">로컬 AI</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Topic Filter -->
  <section class="bg-white border-y border-primary-100">
    <div class="max-w-6xl mx-auto px-6 py-5">
      <div class="flex items-center space-x-3 overflow-x-auto pb-1">
        <span class="text-navy-700/60 text-sm font-medium whitespace-nowrap flex items-center">
          <i class="fas fa-filter mr-2 text-xs"></i>주제 필터
        </span>
        <div class="h-6 w-px bg-primary-200"></div>
        <button onclick="filterTopic('')" class="topic-btn topic-filter px-5 py-2 rounded-full text-sm font-medium active" data-topic="">
          <i class="fas fa-th-large mr-1.5 text-xs"></i>전체
        </button>
        <button onclick="filterTopic('심혈관')" class="topic-btn topic-filter px-5 py-2 rounded-full text-sm font-medium text-navy-700" data-topic="심혈관">
          <i class="fas fa-heartbeat mr-1.5 text-xs text-red-400"></i>심혈관
        </button>
        <button onclick="filterTopic('내분비')" class="topic-btn topic-filter px-5 py-2 rounded-full text-sm font-medium text-navy-700" data-topic="내분비">
          <i class="fas fa-dna mr-1.5 text-xs text-purple-400"></i>내분비
        </button>
        <button onclick="filterTopic('노화')" class="topic-btn topic-filter px-5 py-2 rounded-full text-sm font-medium text-navy-700" data-topic="노화">
          <i class="fas fa-hourglass-half mr-1.5 text-xs text-amber-500"></i>노화
        </button>
        <button onclick="filterTopic('당뇨')" class="topic-btn topic-filter px-5 py-2 rounded-full text-sm font-medium text-navy-700" data-topic="당뇨">
          <i class="fas fa-tint mr-1.5 text-xs text-blue-400"></i>당뇨
        </button>
      </div>
    </div>
  </section>

  <!-- Articles List -->
  <main class="max-w-6xl mx-auto px-6 py-10">
    <div class="mb-8">
      <h3 class="font-serif text-2xl font-semibold text-navy-800 mb-2">최신 논문 인사이트</h3>
      <p class="text-sage-600">전문가가 엄선한 Med-Bio 논문 요약</p>
    </div>
    
    <div id="articles-container" class="grid gap-6">
      <div class="text-center py-16">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-100 flex items-center justify-center">
          <i class="fas fa-spinner fa-spin text-2xl text-primary-600"></i>
        </div>
        <p class="text-navy-700/60 font-medium">논문 요약을 불러오는 중...</p>
      </div>
    </div>
  </main>

  <!-- Subscription CTA -->
  ${!user || user.subscription_tier === 'free' ? `
  <section class="relative overflow-hidden py-16 md:py-20">
    <div class="absolute inset-0 warm-gradient opacity-95"></div>
    <div class="absolute top-0 left-1/4 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
    <div class="absolute bottom-0 right-1/4 w-80 h-80 bg-white/5 rounded-full blur-3xl"></div>
    
    <div class="relative max-w-5xl mx-auto px-6">
      <div class="text-center mb-12">
        <p class="text-white/70 font-medium text-sm tracking-widest uppercase mb-3">Premium Membership</p>
        <h3 class="font-serif text-3xl md:text-4xl font-semibold text-white mb-4">더 깊은 인사이트를 원하신다면</h3>
        <p class="text-white/80 text-lg max-w-2xl mx-auto">AI 기반 논문 분석과 전문가 코멘트로<br class="hidden md:block">연구의 핵심을 빠르게 파악하세요.</p>
      </div>
      
      <div class="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <div class="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
          <div class="text-white/70 text-sm font-medium mb-2">Basic</div>
          <div class="flex items-baseline mb-4">
            <span class="text-4xl font-serif font-bold text-white">₩19,000</span>
            <span class="text-white/60 ml-2">/월</span>
          </div>
          <div class="divider-warm opacity-30 mb-4"></div>
          <ul class="space-y-3 text-white/90">
            <li class="flex items-center"><i class="fas fa-check text-sage-300 mr-3 w-4"></i>주 3회 논문 요약</li>
            <li class="flex items-center"><i class="fas fa-check text-sage-300 mr-3 w-4"></i>주간 하이라이트 레터</li>
            <li class="flex items-center"><i class="fas fa-check text-sage-300 mr-3 w-4"></i>북마크 기능</li>
          </ul>
          <button class="w-full mt-6 py-3 bg-white/20 hover:bg-white/30 text-white font-medium rounded-xl transition">시작하기</button>
        </div>
        
        <div class="bg-white rounded-2xl p-8 shadow-xl relative overflow-hidden">
          <div class="absolute top-0 right-0 bg-gradient-to-l from-primary-500 to-sage-500 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl">추천</div>
          <div class="text-primary-600 text-sm font-bold mb-2">Pro</div>
          <div class="flex items-baseline mb-4">
            <span class="text-4xl font-serif font-bold text-navy-800">₩49,000</span>
            <span class="text-navy-700/60 ml-2">/월</span>
          </div>
          <div class="divider-warm mb-4"></div>
          <ul class="space-y-3 text-navy-700">
            <li class="flex items-center"><i class="fas fa-check text-sage-600 mr-3 w-4"></i>주 5회 논문 요약</li>
            <li class="flex items-center"><i class="fas fa-check text-sage-600 mr-3 w-4"></i><strong class="font-semibold">AI 논문 질의응답</strong></li>
            <li class="flex items-center"><i class="fas fa-check text-sage-600 mr-3 w-4"></i>프로젝트 관점 코멘트</li>
            <li class="flex items-center"><i class="fas fa-check text-sage-600 mr-3 w-4"></i>전체 아카이브 접근</li>
          </ul>
          <button class="w-full mt-6 py-3 btn-warm text-white font-medium rounded-xl shadow-lg">Pro 시작하기</button>
        </div>
      </div>
    </div>
  </section>
  ` : ''}

  <!-- Footer -->
  <footer class="bg-navy-800 text-white py-12">
    <div class="max-w-6xl mx-auto px-6">
      <div class="flex flex-col md:flex-row justify-between items-center">
        <div class="flex items-center space-x-3 mb-6 md:mb-0">
          <div class="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <i class="fas fa-book-medical text-sage-300"></i>
          </div>
          <div>
            <span class="font-serif font-semibold text-lg">MedDigest</span>
            <p class="text-xs text-white/50">Daily Med-Bio Insight</p>
          </div>
        </div>
        <div class="text-sm text-white/50 text-center md:text-right">
          <p>© 2026 MedDigest. All rights reserved.</p>
          <p class="mt-1">의료 전문가를 위한 논문 인사이트 서비스</p>
        </div>
      </div>
    </div>
  </footer>

  <!-- Article Modal -->
  <div id="article-modal" class="fixed inset-0 bg-navy-900/60 backdrop-blur-sm hidden items-center justify-center z-50 p-4">
    <div class="bg-cream-100 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-primary-200/30">
      <div id="article-modal-content"></div>
    </div>
  </div>

  <script>
    let currentTopic = '';
    const userSubscription = '${user?.subscription_tier || 'free'}';

    // Load articles
    async function loadArticles(topic = '') {
      const container = document.getElementById('articles-container');
      
      try {
        const params = new URLSearchParams();
        if (topic) params.set('topic', topic);
        
        const res = await fetch('/api/articles?' + params.toString());
        const data = await res.json();
        
        if (data.articles.length === 0) {
          container.innerHTML = \`
            <div class="text-center py-16">
              <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-sage-100 flex items-center justify-center">
                <i class="fas fa-inbox text-3xl text-sage-400"></i>
              </div>
              <p class="text-navy-700/60 font-medium">아직 등록된 논문이 없습니다.</p>
            </div>
          \`;
          return;
        }
        
        container.innerHTML = data.articles.map(article => \`
          <article class="bg-white rounded-2xl p-6 card-elegant cursor-pointer border border-primary-100/50" onclick="openArticle('\${article.slug}')">
            <div class="flex justify-between items-start mb-4">
              <div class="flex items-center space-x-3">
                <span class="px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide \${article.tier === 'pro' ? 'tier-badge-pro' : 'tier-badge-basic'}">
                  \${article.tier === 'pro' ? 'PRO' : 'BASIC'}
                </span>
                <span class="flex items-center text-xs text-sage-600 font-medium">
                  <i class="fas fa-tag mr-1.5 text-sage-400"></i>\${article.topic}
                </span>
              </div>
              <span class="text-xs text-navy-700/40 font-medium">\${article.published_at}</span>
            </div>
            
            <div class="mb-3">
              <span class="text-xs text-primary-600 font-medium tracking-wide">\${article.journal}</span>
            </div>
            
            <h3 class="font-serif text-xl font-semibold text-navy-800 mb-4 leading-relaxed">\${article.title}</h3>
            
            <div class="space-y-2.5 mb-4">
              \${article.key_messages.slice(0, 2).map((msg, i) => \`
                <div class="flex items-start space-x-3">
                  <span class="w-6 h-6 bg-gradient-to-br from-sage-400 to-sage-500 text-white rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">\${i + 1}</span>
                  <span class="text-sm text-navy-700/80 leading-relaxed">\${msg}</span>
                </div>
              \`).join('')}
            </div>
            
            <div class="flex items-center justify-between pt-4 border-t border-primary-100">
              <div class="flex items-center space-x-2 text-xs text-sage-500">
                <i class="fas fa-book-open"></i>
                <span>5분 읽기</span>
              </div>
              <span class="text-primary-600 text-sm font-medium flex items-center group-hover:text-primary-700">
                자세히 보기 <i class="fas fa-arrow-right ml-2 text-xs"></i>
              </span>
            </div>
          </article>
        \`).join('');
      } catch (e) {
        container.innerHTML = \`
          <div class="text-center py-16">
            <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
              <i class="fas fa-exclamation-circle text-3xl text-red-400"></i>
            </div>
            <p class="text-navy-700/60 font-medium">데이터를 불러오는데 실패했습니다.</p>
            <button onclick="loadArticles()" class="mt-4 px-4 py-2 text-sm text-primary-600 hover:text-primary-700 font-medium">다시 시도</button>
          </div>
        \`;
      }
    }

    // Filter by topic
    function filterTopic(topic) {
      currentTopic = topic;
      document.querySelectorAll('.topic-btn').forEach(btn => {
        if (btn.dataset.topic === topic) {
          btn.classList.add('active');
          btn.classList.remove('text-navy-700');
        } else {
          btn.classList.remove('active');
          btn.classList.add('text-navy-700');
        }
      });
      loadArticles(topic);
    }

    // Open article modal
    async function openArticle(slug) {
      const modal = document.getElementById('article-modal');
      const content = document.getElementById('article-modal-content');
      
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      content.innerHTML = \`
        <div class="p-12 text-center">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-100 flex items-center justify-center">
            <i class="fas fa-spinner fa-spin text-2xl text-primary-600"></i>
          </div>
        </div>
      \`;
      
      try {
        const res = await fetch('/api/articles/' + slug);
        const data = await res.json();
        
        if (res.status === 403) {
          content.innerHTML = \`
            <div class="p-8">
              <div class="text-center mb-8">
                <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary-100 to-sage-100 flex items-center justify-center">
                  <i class="fas fa-lock text-3xl text-primary-600"></i>
                </div>
                <h3 class="font-serif text-xl font-semibold text-navy-800 mb-3">\${data.preview.title}</h3>
                <p class="text-navy-700/60">이 콘텐츠는 Pro 멤버십 전용입니다.</p>
              </div>
              <div class="text-center">
                <button class="px-8 py-3.5 btn-warm text-white rounded-xl font-medium shadow-lg">
                  <i class="fas fa-crown mr-2"></i>Pro 업그레이드
                </button>
              </div>
              <button onclick="closeModal()" class="absolute top-4 right-4 w-10 h-10 rounded-full bg-navy-800/5 hover:bg-navy-800/10 flex items-center justify-center text-navy-700/50 hover:text-navy-700 transition">
                <i class="fas fa-times"></i>
              </button>
            </div>
          \`;
          return;
        }
        
        const article = data.article;
        // AI Chat용 데이터 저장
        currentArticleData = article;
        content.innerHTML = \`
          <div class="relative">
            <button onclick="closeModal()" class="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white/80 hover:text-white transition z-10">
              <i class="fas fa-times"></i>
            </button>
            
            <div class="warm-gradient text-white p-8 rounded-t-2xl">
              <div class="flex items-center space-x-3 mb-4">
                <span class="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-sm">\${article.tier === 'pro' ? 'PRO' : 'BASIC'}</span>
                <span class="text-sm text-white/80">\${article.journal}</span>
              </div>
              <h2 class="font-serif text-2xl font-semibold mb-4 leading-relaxed">\${article.title}</h2>
              <div class="flex flex-wrap items-center gap-4 text-sm text-white/70">
                <span class="flex items-center"><i class="fas fa-tag mr-2"></i>\${article.topic}</span>
                <span class="flex items-center"><i class="fas fa-calendar mr-2"></i>\${article.published_at}</span>
                \${article.doi ? \`<span class="flex items-center"><i class="fas fa-external-link-alt mr-2"></i>DOI: \${article.doi}</span>\` : ''}
              </div>
            </div>
            
            <div class="p-8">
              <!-- Key Messages -->
              <section class="mb-8">
                <h3 class="font-serif text-lg font-semibold text-navy-800 mb-4 flex items-center">
                  <span class="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center mr-3">
                    <i class="fas fa-lightbulb text-amber-600"></i>
                  </span>
                  핵심 메시지
                </h3>
                <div class="space-y-3">
                  \${article.key_messages.map((msg, i) => \`
                    <div class="flex items-start space-x-4 p-4 bg-gradient-to-r from-sage-50 to-cream-200 rounded-xl border border-sage-100">
                      <span class="w-7 h-7 bg-gradient-to-br from-sage-500 to-sage-600 text-white rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0">\${i + 1}</span>
                      <span class="text-navy-700 leading-relaxed">\${msg}</span>
                    </div>
                  \`).join('')}
                </div>
              </section>
              
              <!-- Study Design -->
              <section class="mb-8">
                <h3 class="font-serif text-lg font-semibold text-navy-800 mb-4 flex items-center">
                  <span class="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center mr-3">
                    <i class="fas fa-microscope text-emerald-600"></i>
                  </span>
                  연구 설계
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  \${article.study_n ? \`
                    <div class="p-5 bg-white rounded-xl border border-primary-100 shadow-sm">
                      <div class="text-xs text-sage-600 font-medium mb-1 uppercase tracking-wide">Sample Size</div>
                      <div class="text-2xl font-serif font-bold text-navy-800">\${article.study_n.toLocaleString()}<span class="text-base font-normal text-navy-700/60 ml-1">명</span></div>
                    </div>
                  \` : ''}
                  \${article.study_endpoint ? \`
                    <div class="p-5 bg-white rounded-xl border border-primary-100 shadow-sm md:col-span-2">
                      <div class="text-xs text-sage-600 font-medium mb-1 uppercase tracking-wide">Primary Endpoint</div>
                      <div class="text-sm text-navy-700 leading-relaxed">\${article.study_endpoint}</div>
                    </div>
                  \` : ''}
                </div>
                \${article.study_limitations ? \`
                  <div class="mt-4 p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-xl">
                    <div class="text-xs font-semibold text-amber-700 mb-1 uppercase tracking-wide">Limitations</div>
                    <div class="text-sm text-amber-800">\${article.study_limitations}</div>
                  </div>
                \` : ''}
              </section>
              
              <!-- Clinical Insight -->
              <section class="mb-8">
                <h3 class="font-serif text-lg font-semibold text-navy-800 mb-4 flex items-center">
                  <span class="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center mr-3">
                    <i class="fas fa-stethoscope text-rose-600"></i>
                  </span>
                  임상 · 비즈니스 인사이트
                </h3>
                <div class="relative p-6 bg-gradient-to-br from-cream-200 via-white to-sage-50 rounded-xl border border-primary-100">
                  <span class="quote-mark absolute top-2 left-4 text-primary-300">"</span>
                  <p class="text-navy-700 leading-relaxed pl-8 pr-4">\${article.clinical_insight}</p>
                </div>
              </section>
              
              <!-- AI Chat (Pro only) -->
              \${userSubscription === 'pro' ? \`
                <section class="border-t border-primary-100 pt-8">
                  <h3 class="font-serif text-lg font-semibold text-navy-800 mb-4 flex items-center">
                    <span class="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center mr-3">
                      <i class="fas fa-robot text-purple-600"></i>
                    </span>
                    AI에게 질문하기
                    <span class="ml-3 px-2.5 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">PRO</span>
                    <span class="ml-2 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">WebGPU</span>
                  </h3>
                  <div class="p-6 bg-gradient-to-br from-purple-50 via-cream-100 to-blue-50 rounded-xl border border-purple-100">
                    <div class="flex items-center justify-between mb-4">
                      <p class="text-sm text-navy-700/70">이 논문에 대해 궁금한 점을 물어보세요.</p>
                      <div class="flex items-center space-x-3 text-xs">
                        <span class="flex items-center text-sage-600 bg-white px-2.5 py-1 rounded-full shadow-sm">
                          <i class="fas fa-shield-alt text-emerald-500 mr-1.5"></i>100% 로컬
                        </span>
                        <span class="flex items-center text-sage-600 bg-white px-2.5 py-1 rounded-full shadow-sm">
                          <i class="fas fa-bolt text-amber-500 mr-1.5"></i>WebGPU
                        </span>
                      </div>
                    </div>
                    
                    <!-- 빠른 질문 버튼 -->
                    <div class="flex flex-wrap gap-2 mb-4">
                      <button onclick="document.getElementById('ai-question').value='이 연구의 주요 한계점은 무엇인가요?'; askAI('\${article.slug}')" class="px-4 py-2 bg-white hover:bg-purple-50 text-navy-700 text-xs rounded-full border border-purple-200 hover:border-purple-300 transition shadow-sm">
                        <i class="fas fa-exclamation-triangle mr-1.5 text-amber-500"></i>한계점
                      </button>
                      <button onclick="document.getElementById('ai-question').value='NNT(Number Needed to Treat)가 어떻게 되나요?'; askAI('\${article.slug}')" class="px-4 py-2 bg-white hover:bg-purple-50 text-navy-700 text-xs rounded-full border border-purple-200 hover:border-purple-300 transition shadow-sm">
                        <i class="fas fa-calculator mr-1.5 text-blue-500"></i>NNT
                      </button>
                      <button onclick="document.getElementById('ai-question').value='실제 임상에서 어떻게 적용할 수 있나요?'; askAI('\${article.slug}')" class="px-4 py-2 bg-white hover:bg-purple-50 text-navy-700 text-xs rounded-full border border-purple-200 hover:border-purple-300 transition shadow-sm">
                        <i class="fas fa-stethoscope mr-1.5 text-rose-500"></i>임상 적용
                      </button>
                      <button onclick="document.getElementById('ai-question').value='이 약물의 부작용 프로파일은 어떤가요?'; askAI('\${article.slug}')" class="px-4 py-2 bg-white hover:bg-purple-50 text-navy-700 text-xs rounded-full border border-purple-200 hover:border-purple-300 transition shadow-sm">
                        <i class="fas fa-pills mr-1.5 text-purple-500"></i>부작용
                      </button>
                    </div>
                    
                    <div class="flex space-x-3">
                      <input type="text" id="ai-question" 
                        class="flex-1 px-5 py-3.5 border-2 border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent bg-white text-navy-800 placeholder-navy-400" 
                        placeholder="예: 이 연구의 NNT는 어떻게 되나요?"
                        onkeypress="if(event.key === 'Enter') askAI('\${article.slug}')">
                      <button onclick="askAI('\${article.slug}')" class="px-6 py-3.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-xl transition shadow-lg hover:shadow-xl">
                        <i class="fas fa-paper-plane"></i>
                      </button>
                    </div>
                    <div id="ai-response" class="mt-4 hidden"></div>
                    
                    <div class="mt-4 pt-4 border-t border-purple-100 text-xs text-navy-700/50 flex items-center">
                      <i class="fas fa-microchip mr-2"></i>
                      Transformers.js v4 + Qwen2.5-0.5B | 첫 로딩시 약 400MB 다운로드
                    </div>
                  </div>
                </section>
              \` : ''}
            </div>
          </div>
        \`;
      } catch (e) {
        content.innerHTML = \`
          <div class="p-12 text-center">
            <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
              <i class="fas fa-exclamation-circle text-3xl text-red-400"></i>
            </div>
            <p class="text-navy-700/60 font-medium">데이터를 불러오는데 실패했습니다.</p>
          </div>
        \`;
      }
    }

    // Close modal
    function closeModal() {
      const modal = document.getElementById('article-modal');
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }

    // Logout
    async function logout() {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.reload();
    }

    // AI Chat 초기화
    let currentArticleData = null;
    
    function initAIChat(articleData) {
      currentArticleData = articleData;
      
      // AI Chat 컨테이너가 없으면 생성
      if (!window.medChat) {
        window.medChat = new MedDigestChat('ai-chat-container');
      }
      
      // 채팅 UI 렌더링
      window.medChat.render(articleData);
    }
    
    // AI Question - WebGPU LLM 연동
    async function askAI(slug) {
      const question = document.getElementById('ai-question')?.value;
      const responseDiv = document.getElementById('ai-response');
      
      if (!question) return;
      
      // WebGPU LLM이 준비되지 않은 경우
      if (!window.medLLM || !window.medLLM.isReady) {
        responseDiv.classList.remove('hidden');
        responseDiv.innerHTML = \`
          <div class="p-5 bg-white rounded-xl border border-purple-100 shadow-sm">
            <div class="text-center">
              <div class="w-14 h-14 mx-auto mb-4 rounded-full bg-purple-100 flex items-center justify-center">
                <i class="fas fa-microchip text-2xl text-purple-500"></i>
              </div>
              <p class="text-sm text-navy-700 mb-4">AI 모델을 먼저 로딩해야 합니다.</p>
              <button onclick="startAIModel()" class="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-xl text-sm font-medium transition shadow-md">
                <i class="fas fa-play mr-2"></i>AI 시작하기
              </button>
              <p class="text-xs text-navy-700/50 mt-4">WebGPU 기반 브라우저 실행 (약 300-500MB)</p>
            </div>
          </div>
        \`;
        return;
      }
      
      responseDiv.classList.remove('hidden');
      responseDiv.innerHTML = \`
        <div class="p-5 bg-white rounded-xl border border-purple-100 shadow-sm">
          <div class="flex items-center space-x-3">
            <div class="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
              <i class="fas fa-spinner fa-spin text-purple-500"></i>
            </div>
            <span class="text-sm text-navy-700">AI가 분석 중입니다...</span>
          </div>
        </div>
      \`;
      
      try {
        // 현재 논문 컨텍스트로 응답 생성
        const context = currentArticleData ? {
          title: currentArticleData.title,
          journal: currentArticleData.journal,
          keyMessages: currentArticleData.key_messages,
          clinicalInsight: currentArticleData.clinical_insight
        } : {};
        
        const response = await window.medLLM.generate(question, context, {
          maxNewTokens: 300,
          temperature: 0.7
        });
        
        responseDiv.innerHTML = \`
          <div class="p-5 bg-white rounded-xl border border-purple-100 shadow-sm">
            <div class="flex items-start space-x-4">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                <i class="fas fa-robot text-white"></i>
              </div>
              <div class="flex-1">
                <p class="text-navy-700 leading-relaxed whitespace-pre-wrap">\${response}</p>
                <p class="text-xs text-navy-700/40 mt-3 pt-3 border-t border-purple-50">
                  <i class="fas fa-microchip mr-1"></i>Transformers.js v4 + WebGPU 로컬 AI
                </p>
              </div>
            </div>
          </div>
        \`;
      } catch (error) {
        responseDiv.innerHTML = \`
          <div class="p-5 bg-red-50 rounded-xl border border-red-100">
            <div class="flex items-start space-x-3">
              <div class="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <i class="fas fa-exclamation-circle text-red-500"></i>
              </div>
              <div>
                <p class="text-sm text-red-700 font-medium">응답 생성 실패</p>
                <p class="text-xs text-red-600 mt-1">\${error.message}</p>
                <button onclick="askAI('\${slug}')" class="mt-3 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-medium transition">다시 시도</button>
              </div>
            </div>
          </div>
        \`;
      }
    }
    
    // AI 모델 시작
    async function startAIModel() {
      const responseDiv = document.getElementById('ai-response');
      
      responseDiv.innerHTML = \`
        <div class="p-5 bg-white rounded-xl border border-purple-100 shadow-sm">
          <div class="text-center">
            <div class="w-14 h-14 mx-auto mb-4 rounded-full bg-purple-100 flex items-center justify-center">
              <i class="fas fa-spinner fa-spin text-2xl text-purple-500"></i>
            </div>
            <p class="text-sm text-navy-700 font-medium mb-2" id="ai-load-status">WebGPU 초기화 중...</p>
            <div class="w-full max-w-xs mx-auto bg-purple-100 rounded-full h-2 overflow-hidden">
              <div id="ai-load-progress" class="bg-gradient-to-r from-purple-500 to-indigo-500 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
            </div>
          </div>
        </div>
      \`;
      
      // 프로그레스 콜백 설정
      window.medLLM.on('onProgress', function(data) {
        var status = document.getElementById('ai-load-status');
        var progress = document.getElementById('ai-load-progress');
        if (status) status.textContent = data.message;
        if (progress) progress.style.width = data.percent + '%';
      });
      
      window.medLLM.on('onReady', function(info) {
        responseDiv.innerHTML = \`
          <div class="p-5 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-emerald-100 shadow-sm">
            <div class="flex items-center space-x-4">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center flex-shrink-0">
                <i class="fas fa-check text-white text-lg"></i>
              </div>
              <div>
                <p class="font-medium text-emerald-800">\${info.model} 준비 완료!</p>
                <p class="text-xs text-emerald-600 mt-0.5">\${info.device.toUpperCase()} 모드로 실행 중</p>
              </div>
            </div>
            <p class="mt-4 text-sm text-navy-700/70 pl-16">위 입력창에 질문을 입력하고 전송해 주세요.</p>
          </div>
        \`;
      });
      
      window.medLLM.on('onError', function(error) {
        responseDiv.innerHTML = \`
          <div class="p-5 bg-red-50 rounded-xl border border-red-100">
            <div class="flex items-start space-x-3">
              <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <i class="fas fa-exclamation-triangle text-red-500"></i>
              </div>
              <div>
                <p class="font-medium text-red-700">모델 로딩 실패</p>
                <p class="text-xs text-red-600 mt-1">\${error.message}</p>
                <button onclick="startAIModel()" class="mt-3 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition">다시 시도</button>
              </div>
            </div>
          </div>
        \`;
      });
      
      try {
        await window.medLLM.initialize('primary');
      } catch (e) {
        console.error('Model init failed:', e);
      }
    }

    // Click outside modal to close
    document.getElementById('article-modal').addEventListener('click', (e) => {
      if (e.target.id === 'article-modal') closeModal();
    });

    // Initialize
    loadArticles();
  </script>
</body>
</html>
  `)
})

// ===== Cron Job Handler =====

const CRON_TOPICS = {
  cardiovascular: { koreanName: '심혈관', searchTerms: ['cardiovascular disease', 'heart failure SGLT2'] },
  endocrine: { koreanName: '내분비', searchTerms: ['GLP-1 agonist obesity', 'tirzepatide semaglutide'] },
  aging: { koreanName: '노화', searchTerms: ['aging longevity senolytic', 'NAD healthspan'] },
  diabetes: { koreanName: '당뇨', searchTerms: ['diabetes CGM insulin', 'diabetic kidney'] }
};

async function searchPubMedForCron(query: string) {
  const year = new Date().getFullYear();
  const searchQuery = `${query} AND (${year}[pdat] OR ${year - 1}[pdat])`;
  
  try {
    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchQuery)}&retmax=2&sort=date&retmode=json`;
    const res = await fetch(url);
    const data = await res.json() as { esearchresult?: { idlist?: string[] } };
    const pmids = data.esearchresult?.idlist || [];
    
    if (pmids.length === 0) return [];
    
    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=xml`;
    const fetchRes = await fetch(fetchUrl);
    const xml = await fetchRes.text();
    
    const articles: Array<{pmid: string, title: string, journal: string, abstract: string, doi: string | null}> = [];
    const blocks = xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) || [];
    
    for (const block of blocks) {
      const pmid = block.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1];
      const title = block.match(/<ArticleTitle>([^<]+)<\/ArticleTitle>/)?.[1];
      const journal = block.match(/<Title>([^<]+)<\/Title>/)?.[1];
      const abstractMatch = block.match(/<AbstractText[^>]*>([^<]+)<\/AbstractText>/g);
      const doi = block.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/)?.[1];
      
      const abstract = abstractMatch?.map(m => m.match(/>([^<]+)</)?.[1] || '').join(' ') || '';
      
      if (pmid && title && abstract.length > 100) {
        articles.push({ pmid, title, journal: journal || 'Unknown', abstract, doi: doi || null });
      }
    }
    return articles;
  } catch (e) {
    console.error('PubMed error:', e);
    return [];
  }
}

function generateCronSlug(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).slice(0, 4).join('-') + '-' + Date.now().toString(36);
}

async function handleCronJob(env: Bindings) {
  console.log('🔬 MedDigest Cron Started:', new Date().toISOString());
  let saved = 0;
  
  for (const [, topic] of Object.entries(CRON_TOPICS)) {
    const term = topic.searchTerms[Math.floor(Math.random() * topic.searchTerms.length)];
    const articles = await searchPubMedForCron(term);
    
    for (const article of articles) {
      // 중복 체크
      const exists = await env.DB.prepare('SELECT id FROM articles WHERE pmid = ?').bind(article.pmid).first();
      if (exists) continue;
      
      // 간단 요약 생성 (AI 없이)
      const slug = generateCronSlug(article.title);
      const tier = Math.random() > 0.5 ? 'pro' : 'basic';
      const keyMessages = JSON.stringify([
        article.abstract.substring(0, 80) + '...',
        `저널: ${article.journal}`,
        `PMID: ${article.pmid}`
      ]);
      
      try {
        await env.DB.prepare(`
          INSERT INTO articles (slug, title, original_title, journal, doi, pmid, topic, tier, key_messages, clinical_insight, published_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          slug,
          article.title.substring(0, 100),
          article.title,
          article.journal,
          article.doi,
          article.pmid,
          topic.koreanName,
          tier,
          keyMessages,
          '최신 연구입니다. 상세 내용은 원문을 참조하세요.',
          new Date().toISOString().split('T')[0]
        ).run();
        saved++;
        console.log('✅ Saved:', article.title.substring(0, 50));
      } catch (e) {
        console.error('DB error:', e);
      }
    }
  }
  
  console.log(`🎉 Cron Completed: ${saved} articles saved`);
  return { saved };
}

// Manual cron trigger endpoint
app.post('/api/cron/trigger', async (c) => {
  const auth = c.req.header('Authorization');
  const secret = c.env.CRON_SECRET || 'dev-secret';
  
  if (auth !== `Bearer ${secret}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const result = await handleCronJob(c.env);
  return c.json(result);
});

// Export with scheduled handler for Cloudflare Workers
export default {
  fetch: app.fetch,
  scheduled: async (event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) => {
    ctx.waitUntil(handleCronJob(env));
  }
}
