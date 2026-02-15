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
            primary: '#0066CC',
            secondary: '#00A86B',
            accent: '#FF6B35'
          }
        }
      }
    }
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
    body { font-family: 'Noto Sans KR', sans-serif; }
    .gradient-bg { background: linear-gradient(135deg, #0066CC 0%, #00A86B 100%); }
    .card-hover { transition: transform 0.2s, box-shadow 0.2s; }
    .card-hover:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.1); }
    .tier-badge-basic { background: #E3F2FD; color: #1976D2; }
    .tier-badge-pro { background: #FFF3E0; color: #F57C00; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <!-- Header -->
  <header class="gradient-bg text-white shadow-lg">
    <div class="max-w-6xl mx-auto px-4 py-4">
      <div class="flex justify-between items-center">
        <div class="flex items-center space-x-3">
          <i class="fas fa-flask text-2xl"></i>
          <div>
            <h1 class="text-2xl font-bold">MedDigest</h1>
            <p class="text-sm opacity-80">Daily Med-Bio Insight</p>
          </div>
        </div>
        <nav class="flex items-center space-x-4">
          ${user ? `
            <div class="flex items-center space-x-3">
              <span class="text-sm">${user.nickname}님</span>
              <span class="px-2 py-1 rounded text-xs ${user.subscription_tier === 'pro' ? 'bg-orange-500' : user.subscription_tier === 'basic' ? 'bg-blue-500' : 'bg-gray-500'}">${user.subscription_tier.toUpperCase()}</span>
              <button onclick="logout()" class="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-sm transition">로그아웃</button>
            </div>
          ` : `
            <a href="/api/auth/kakao" class="flex items-center space-x-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black rounded-lg transition">
              <img src="https://developers.kakao.com/assets/img/about/logos/kakao/kakao_login_btn_kakao_symbol.png" alt="Kakao" class="w-5 h-5">
              <span class="font-medium">카카오 로그인</span>
            </a>
          `}
        </nav>
      </div>
    </div>
  </header>

  <!-- Hero Section -->
  <section class="gradient-bg text-white py-12">
    <div class="max-w-6xl mx-auto px-4 text-center">
      <h2 class="text-3xl md:text-4xl font-bold mb-4">
        논문 한 장으로 끝내는<br>Daily Med-Bio Insight
      </h2>
      <p class="text-lg opacity-90 mb-6">
        바쁜 임상의, 연구자, 바이오 창업자를 위한<br>
        매일 1편 논문을 "임상의 시각"으로 해설해 드립니다.
      </p>
      <div class="flex justify-center space-x-4">
        <div class="text-center">
          <div class="text-2xl font-bold">5분</div>
          <div class="text-sm opacity-80">읽기 시간</div>
        </div>
        <div class="text-center border-l border-white/30 pl-4">
          <div class="text-2xl font-bold">매일</div>
          <div class="text-sm opacity-80">새 콘텐츠</div>
        </div>
        <div class="text-center border-l border-white/30 pl-4">
          <div class="text-2xl font-bold">100%</div>
          <div class="text-sm opacity-80">프라이버시</div>
        </div>
      </div>
    </div>
  </section>

  <!-- Topic Filter -->
  <section class="bg-white border-b">
    <div class="max-w-6xl mx-auto px-4 py-4">
      <div class="flex items-center space-x-4 overflow-x-auto">
        <span class="text-gray-500 text-sm whitespace-nowrap">주제:</span>
        <button onclick="filterTopic('')" class="topic-btn px-4 py-2 rounded-full text-sm font-medium bg-primary text-white" data-topic="">전체</button>
        <button onclick="filterTopic('심혈관')" class="topic-btn px-4 py-2 rounded-full text-sm font-medium bg-gray-100 hover:bg-gray-200" data-topic="심혈관">심혈관</button>
        <button onclick="filterTopic('내분비')" class="topic-btn px-4 py-2 rounded-full text-sm font-medium bg-gray-100 hover:bg-gray-200" data-topic="내분비">내분비</button>
        <button onclick="filterTopic('노화')" class="topic-btn px-4 py-2 rounded-full text-sm font-medium bg-gray-100 hover:bg-gray-200" data-topic="노화">노화</button>
        <button onclick="filterTopic('당뇨')" class="topic-btn px-4 py-2 rounded-full text-sm font-medium bg-gray-100 hover:bg-gray-200" data-topic="당뇨">당뇨</button>
      </div>
    </div>
  </section>

  <!-- Articles List -->
  <main class="max-w-6xl mx-auto px-4 py-8">
    <div id="articles-container" class="space-y-6">
      <div class="text-center py-8">
        <i class="fas fa-spinner fa-spin text-3xl text-primary"></i>
        <p class="mt-2 text-gray-500">논문 요약을 불러오는 중...</p>
      </div>
    </div>
  </main>

  <!-- Subscription CTA -->
  ${!user || user.subscription_tier === 'free' ? `
  <section class="bg-gradient-to-r from-orange-500 to-red-500 text-white py-12">
    <div class="max-w-4xl mx-auto px-4 text-center">
      <h3 class="text-2xl font-bold mb-4">Pro 멤버십으로 업그레이드</h3>
      <p class="mb-6">AI 기반 논문 분석, 전문 콘텐츠, 프로젝트 관점 코멘트를 만나보세요.</p>
      <div class="flex justify-center space-x-6">
        <div class="bg-white/20 rounded-lg p-6">
          <div class="text-sm mb-2">Basic</div>
          <div class="text-3xl font-bold mb-2">₩19,000<span class="text-sm font-normal">/월</span></div>
          <ul class="text-sm text-left space-y-1">
            <li>✓ 주 3회 요약</li>
            <li>✓ 주간 하이라이트</li>
          </ul>
        </div>
        <div class="bg-white rounded-lg p-6 text-gray-900">
          <div class="text-sm text-orange-500 font-bold mb-2">Pro</div>
          <div class="text-3xl font-bold mb-2">₩49,000<span class="text-sm font-normal">/월</span></div>
          <ul class="text-sm text-left space-y-1">
            <li>✓ 주 5회 요약</li>
            <li>✓ AI 논문 분석</li>
            <li>✓ 프로젝트 관점 코멘트</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
  ` : ''}

  <!-- Footer -->
  <footer class="bg-gray-900 text-white py-8">
    <div class="max-w-6xl mx-auto px-4">
      <div class="flex flex-col md:flex-row justify-between items-center">
        <div class="flex items-center space-x-2 mb-4 md:mb-0">
          <i class="fas fa-flask"></i>
          <span class="font-bold">MedDigest</span>
        </div>
        <div class="text-sm text-gray-400">
          © 2026 MedDigest. 의료 전문가를 위한 논문 인사이트 서비스.
        </div>
      </div>
    </div>
  </footer>

  <!-- Article Modal -->
  <div id="article-modal" class="fixed inset-0 bg-black/50 hidden items-center justify-center z-50 p-4">
    <div class="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
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
          container.innerHTML = '<div class="text-center py-12 text-gray-500"><i class="fas fa-inbox text-4xl mb-4"></i><p>아직 등록된 논문이 없습니다.</p></div>';
          return;
        }
        
        container.innerHTML = data.articles.map(article => \`
          <article class="bg-white rounded-xl shadow-md p-6 card-hover cursor-pointer" onclick="openArticle('\${article.slug}')">
            <div class="flex justify-between items-start mb-3">
              <span class="px-3 py-1 rounded-full text-xs font-medium \${article.tier === 'pro' ? 'tier-badge-pro' : 'tier-badge-basic'}">
                \${article.tier === 'pro' ? 'PRO' : 'BASIC'}
              </span>
              <span class="text-sm text-gray-400">\${article.published_at}</span>
            </div>
            <div class="flex items-center space-x-2 mb-2">
              <span class="text-xs bg-gray-100 px-2 py-1 rounded">\${article.topic}</span>
              <span class="text-xs text-gray-500">\${article.journal}</span>
            </div>
            <h3 class="text-lg font-bold text-gray-900 mb-3">\${article.title}</h3>
            <div class="space-y-2">
              \${article.key_messages.slice(0, 2).map((msg, i) => \`
                <div class="flex items-start space-x-2">
                  <span class="text-primary font-bold">\${i + 1}.</span>
                  <span class="text-sm text-gray-600">\${msg}</span>
                </div>
              \`).join('')}
            </div>
            <div class="mt-4 text-primary text-sm font-medium">자세히 보기 →</div>
          </article>
        \`).join('');
      } catch (e) {
        container.innerHTML = '<div class="text-center py-12 text-red-500"><i class="fas fa-exclamation-circle text-4xl mb-4"></i><p>데이터를 불러오는데 실패했습니다.</p></div>';
      }
    }

    // Filter by topic
    function filterTopic(topic) {
      currentTopic = topic;
      document.querySelectorAll('.topic-btn').forEach(btn => {
        if (btn.dataset.topic === topic) {
          btn.classList.remove('bg-gray-100');
          btn.classList.add('bg-primary', 'text-white');
        } else {
          btn.classList.remove('bg-primary', 'text-white');
          btn.classList.add('bg-gray-100');
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
      content.innerHTML = '<div class="p-8 text-center"><i class="fas fa-spinner fa-spin text-3xl text-primary"></i></div>';
      
      try {
        const res = await fetch('/api/articles/' + slug);
        const data = await res.json();
        
        if (res.status === 403) {
          content.innerHTML = \`
            <div class="p-8">
              <div class="text-center mb-6">
                <i class="fas fa-lock text-5xl text-orange-500 mb-4"></i>
                <h3 class="text-xl font-bold mb-2">\${data.preview.title}</h3>
                <p class="text-gray-500">이 콘텐츠는 Pro 멤버십 전용입니다.</p>
              </div>
              <div class="text-center">
                <button class="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition">
                  Pro 업그레이드
                </button>
              </div>
              <button onclick="closeModal()" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                <i class="fas fa-times text-xl"></i>
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
            <button onclick="closeModal()" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10">
              <i class="fas fa-times text-xl"></i>
            </button>
            
            <div class="gradient-bg text-white p-6 rounded-t-2xl">
              <div class="flex items-center space-x-2 mb-2">
                <span class="px-3 py-1 rounded-full text-xs font-medium bg-white/20">\${article.tier === 'pro' ? 'PRO' : 'BASIC'}</span>
                <span class="text-sm opacity-80">\${article.journal}</span>
              </div>
              <h2 class="text-xl font-bold mb-2">\${article.title}</h2>
              <div class="flex items-center space-x-4 text-sm opacity-80">
                <span><i class="fas fa-tag mr-1"></i>\${article.topic}</span>
                <span><i class="fas fa-calendar mr-1"></i>\${article.published_at}</span>
                \${article.doi ? \`<span><i class="fas fa-link mr-1"></i>DOI: \${article.doi}</span>\` : ''}
              </div>
            </div>
            
            <div class="p-6">
              <!-- Key Messages -->
              <section class="mb-6">
                <h3 class="text-lg font-bold text-gray-900 mb-3 flex items-center">
                  <i class="fas fa-lightbulb text-yellow-500 mr-2"></i>핵심 메시지
                </h3>
                <div class="space-y-3">
                  \${article.key_messages.map((msg, i) => \`
                    <div class="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                      <span class="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">\${i + 1}</span>
                      <span class="text-gray-700">\${msg}</span>
                    </div>
                  \`).join('')}
                </div>
              </section>
              
              <!-- Study Design -->
              <section class="mb-6">
                <h3 class="text-lg font-bold text-gray-900 mb-3 flex items-center">
                  <i class="fas fa-microscope text-green-500 mr-2"></i>Study Design
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  \${article.study_n ? \`
                    <div class="p-4 bg-gray-50 rounded-lg">
                      <div class="text-sm text-gray-500 mb-1">N</div>
                      <div class="text-xl font-bold text-gray-900">\${article.study_n.toLocaleString()}명</div>
                    </div>
                  \` : ''}
                  \${article.study_endpoint ? \`
                    <div class="p-4 bg-gray-50 rounded-lg md:col-span-2">
                      <div class="text-sm text-gray-500 mb-1">Endpoint</div>
                      <div class="text-sm text-gray-700">\${article.study_endpoint}</div>
                    </div>
                  \` : ''}
                </div>
                \${article.study_limitations ? \`
                  <div class="mt-3 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                    <div class="text-sm font-medium text-yellow-800 mb-1">한계점</div>
                    <div class="text-sm text-yellow-700">\${article.study_limitations}</div>
                  </div>
                \` : ''}
              </section>
              
              <!-- Clinical Insight -->
              <section class="mb-6">
                <h3 class="text-lg font-bold text-gray-900 mb-3 flex items-center">
                  <i class="fas fa-stethoscope text-red-500 mr-2"></i>임상/비즈니스 관점
                </h3>
                <div class="p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-100">
                  <p class="text-gray-700 leading-relaxed">\${article.clinical_insight}</p>
                </div>
              </section>
              
              <!-- AI Chat (Pro only) -->
              \${userSubscription === 'pro' ? \`
                <section class="border-t pt-6">
                  <h3 class="text-lg font-bold text-gray-900 mb-3 flex items-center">
                    <i class="fas fa-robot text-purple-500 mr-2"></i>AI에게 질문하기
                    <span class="ml-2 px-2 py-1 bg-purple-100 text-purple-600 text-xs rounded">PRO</span>
                    <span class="ml-2 px-2 py-1 bg-green-100 text-green-600 text-xs rounded">WebGPU</span>
                  </h3>
                  <div class="p-4 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border border-purple-100">
                    <div class="flex items-center justify-between mb-3">
                      <p class="text-sm text-gray-600">이 논문에 대해 궁금한 점을 물어보세요.</p>
                      <div class="flex items-center space-x-2 text-xs">
                        <span class="flex items-center text-gray-500">
                          <i class="fas fa-shield-alt text-green-500 mr-1"></i>100% 로컬 처리
                        </span>
                        <span class="flex items-center text-gray-500">
                          <i class="fas fa-bolt text-yellow-500 mr-1"></i>WebGPU 가속
                        </span>
                      </div>
                    </div>
                    
                    <!-- 빠른 질문 버튼 -->
                    <div class="flex flex-wrap gap-2 mb-3">
                      <button onclick="document.getElementById('ai-question').value='이 연구의 주요 한계점은 무엇인가요?'; askAI('\${article.slug}')" class="px-3 py-1 bg-white/80 hover:bg-white text-purple-600 text-xs rounded-full border border-purple-200 transition">
                        <i class="fas fa-exclamation-triangle mr-1"></i>한계점
                      </button>
                      <button onclick="document.getElementById('ai-question').value='NNT(Number Needed to Treat)가 어떻게 되나요?'; askAI('\${article.slug}')" class="px-3 py-1 bg-white/80 hover:bg-white text-purple-600 text-xs rounded-full border border-purple-200 transition">
                        <i class="fas fa-calculator mr-1"></i>NNT
                      </button>
                      <button onclick="document.getElementById('ai-question').value='실제 임상에서 어떻게 적용할 수 있나요?'; askAI('\${article.slug}')" class="px-3 py-1 bg-white/80 hover:bg-white text-purple-600 text-xs rounded-full border border-purple-200 transition">
                        <i class="fas fa-stethoscope mr-1"></i>임상 적용
                      </button>
                      <button onclick="document.getElementById('ai-question').value='이 약물의 부작용 프로파일은 어떤가요?'; askAI('\${article.slug}')" class="px-3 py-1 bg-white/80 hover:bg-white text-purple-600 text-xs rounded-full border border-purple-200 transition">
                        <i class="fas fa-pills mr-1"></i>부작용
                      </button>
                    </div>
                    
                    <div class="flex space-x-2">
                      <input type="text" id="ai-question" 
                        class="flex-1 px-4 py-3 border-2 border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white" 
                        placeholder="예: 이 연구의 NNT는 어떻게 되나요?"
                        onkeypress="if(event.key === 'Enter') askAI('\${article.slug}')">
                      <button onclick="askAI('\${article.slug}')" class="px-5 py-3 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-xl transition shadow-lg hover:shadow-xl">
                        <i class="fas fa-paper-plane"></i>
                      </button>
                    </div>
                    <div id="ai-response" class="mt-4 hidden"></div>
                    
                    <div class="mt-3 text-xs text-gray-400 flex items-center">
                      <i class="fas fa-info-circle mr-1"></i>
                      Transformers.js v4 + Qwen2.5-0.5B 모델 사용 | 첫 로딩시 약 400MB 다운로드
                    </div>
                  </div>
                </section>
              \` : ''}
            </div>
          </div>
        \`;
      } catch (e) {
        content.innerHTML = '<div class="p-8 text-center text-red-500"><i class="fas fa-exclamation-circle text-4xl mb-4"></i><p>데이터를 불러오는데 실패했습니다.</p></div>';
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
        responseDiv.innerHTML = '<div class="p-4 bg-purple-50 rounded-lg"><div class="text-center"><p class="text-sm text-gray-700 mb-3">AI 모델을 먼저 로딩해야 합니다.</p><button onclick="startAIModel()" class="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm transition"><i class="fas fa-play mr-2"></i>AI 시작하기</button><p class="text-xs text-gray-400 mt-3">WebGPU 기반으로 브라우저에서 직접 실행됩니다 (약 300-500MB 다운로드)</p></div></div>';
        return;
      }
      
      responseDiv.classList.remove('hidden');
      responseDiv.innerHTML = '<div class="p-4 bg-purple-50 rounded-lg"><i class="fas fa-spinner fa-spin mr-2"></i>AI가 분석 중입니다...</div>';
      
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
        
        responseDiv.innerHTML = '<div class="p-4 bg-purple-50 rounded-lg"><div class="flex items-start space-x-3"><i class="fas fa-robot text-purple-500 mt-1 flex-shrink-0"></i><div><p class="text-sm text-gray-700 whitespace-pre-wrap">' + response + '</p><p class="text-xs text-gray-400 mt-2">Transformers.js v4 + WebGPU 기반 로컬 AI</p></div></div></div>';
      } catch (error) {
        responseDiv.innerHTML = '<div class="p-4 bg-red-50 rounded-lg"><div class="flex items-start space-x-3"><i class="fas fa-exclamation-circle text-red-500 mt-1"></i><div><p class="text-sm text-red-700">응답 생성 실패: ' + error.message + '</p><button onclick="askAI(\\'' + slug + '\\')" class="mt-2 text-xs text-red-500 hover:text-red-700 underline">다시 시도</button></div></div></div>';
      }
    }
    
    // AI 모델 시작
    async function startAIModel() {
      const responseDiv = document.getElementById('ai-response');
      
      responseDiv.innerHTML = '<div class="p-4 bg-purple-50 rounded-lg"><div class="text-center"><div class="mb-3"><i class="fas fa-spinner fa-spin text-2xl text-purple-500"></i></div><p class="text-sm text-gray-700" id="ai-load-status">WebGPU 초기화 중...</p><div class="mt-3 w-full bg-gray-200 rounded-full h-2"><div id="ai-load-progress" class="bg-purple-500 h-2 rounded-full transition-all" style="width: 0%"></div></div></div></div>';
      
      // 프로그레스 콜백 설정
      window.medLLM.on('onProgress', function(data) {
        var status = document.getElementById('ai-load-status');
        var progress = document.getElementById('ai-load-progress');
        if (status) status.textContent = data.message;
        if (progress) progress.style.width = data.percent + '%';
      });
      
      window.medLLM.on('onReady', function(info) {
        responseDiv.innerHTML = '<div class="p-4 bg-green-50 rounded-lg"><div class="flex items-center space-x-3"><i class="fas fa-check-circle text-green-500 text-xl"></i><div><p class="text-sm font-medium text-green-700">' + info.model + ' 모델 준비 완료!</p><p class="text-xs text-green-600">' + info.device.toUpperCase() + ' 모드로 실행 중</p></div></div><p class="mt-3 text-sm text-gray-600">이제 위 입력창에 질문을 입력하고 전송해 주세요.</p></div>';
      });
      
      window.medLLM.on('onError', function(error) {
        responseDiv.innerHTML = '<div class="p-4 bg-red-50 rounded-lg"><div class="flex items-start space-x-3"><i class="fas fa-exclamation-circle text-red-500 mt-1"></i><div><p class="text-sm text-red-700">모델 로딩 실패: ' + error.message + '</p><button onclick="startAIModel()" class="mt-2 px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600">다시 시도</button></div></div></div>';
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
