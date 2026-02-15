import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

const app = new Hono()

// CORS
app.use('/api/*', cors())

// ===== Helper Functions =====
async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'meddigest-salt-2026')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function verifyPassword(password, hash) {
  const inputHash = await hashPassword(password)
  return inputHash === hash
}

// ===== Auth Middleware =====
app.use('*', async (c, next) => {
  if (!supabase) {
    c.set('user', null)
    return next()
  }
  
  const sessionToken = getCookie(c, 'session_token')
  if (!sessionToken) {
    c.set('user', null)
    return next()
  }

  try {
    const { data: session } = await supabase
      .from('sessions')
      .select('user_id, expires_at')
      .eq('session_token', sessionToken)
      .single()

    if (!session || new Date(session.expires_at) < new Date()) {
      c.set('user', null)
      return next()
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, email, nickname')
      .eq('id', session.user_id)
      .single()

    c.set('user', user || null)
  } catch (e) {
    c.set('user', null)
  }
  return next()
})

// ===== API Routes =====

// Health check
app.get('/api/health', (c) => {
  return c.json({ 
    status: 'ok', 
    app: 'MedDigest', 
    platform: 'Local Dev',
    db: supabase ? 'connected' : 'not configured',
    timestamp: new Date().toISOString() 
  })
})

// Current user
app.get('/api/me', (c) => {
  const user = c.get('user')
  return c.json({ 
    authenticated: !!user, 
    user: user ? { email: user.email, nickname: user.nickname } : null 
  })
})

// ===== Auth Routes =====
app.post('/api/auth/signup', async (c) => {
  if (!supabase) return c.json({ error: 'Database not configured' }, 500)
  
  try {
    const { email, password, nickname } = await c.req.json()
    
    if (!email || !password || !nickname) {
      return c.json({ error: '모든 필드를 입력해주세요.' }, 400)
    }
    
    if (password.length < 6) {
      return c.json({ error: '비밀번호는 최소 6자 이상이어야 합니다.' }, 400)
    }
    
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single()
    
    if (existing) {
      return c.json({ error: '이미 등록된 이메일입니다.' }, 400)
    }
    
    const passwordHash = await hashPassword(password)
    
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({ email: email.toLowerCase(), password_hash: passwordHash, nickname })
      .select('id')
      .single()
    
    if (error) throw error
    
    const sessionToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    
    await supabase.from('sessions').insert({
      user_id: newUser.id,
      session_token: sessionToken,
      expires_at: expiresAt.toISOString()
    })
    
    setCookie(c, 'session_token', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
      maxAge: 30 * 24 * 60 * 60
    })
    
    return c.json({ success: true, message: '회원가입 완료!' })
  } catch (e) {
    console.error('Signup error:', e)
    return c.json({ error: '회원가입 중 오류가 발생했습니다.' }, 500)
  }
})

app.post('/api/auth/login', async (c) => {
  if (!supabase) return c.json({ error: 'Database not configured' }, 500)
  
  try {
    const { email, password } = await c.req.json()
    
    const { data: user } = await supabase
      .from('users')
      .select('id, email, nickname, password_hash')
      .eq('email', email.toLowerCase())
      .single()
    
    if (!user) {
      return c.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401)
    }
    
    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) {
      return c.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401)
    }
    
    const sessionToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    
    await supabase.from('sessions').insert({
      user_id: user.id,
      session_token: sessionToken,
      expires_at: expiresAt.toISOString()
    })
    
    setCookie(c, 'session_token', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
      maxAge: 30 * 24 * 60 * 60
    })
    
    return c.json({ success: true })
  } catch (e) {
    console.error('Login error:', e)
    return c.json({ error: '로그인 중 오류가 발생했습니다.' }, 500)
  }
})

app.post('/api/auth/logout', async (c) => {
  const sessionToken = getCookie(c, 'session_token')
  
  if (sessionToken && supabase) {
    await supabase.from('sessions').delete().eq('session_token', sessionToken)
  }
  
  deleteCookie(c, 'session_token', { path: '/' })
  return c.json({ success: true })
})

// ===== Articles Routes =====
app.get('/api/articles', async (c) => {
  if (!supabase) {
    return c.json({
      articles: [
        {
          id: 1,
          slug: 'sample-article-1',
          title: 'SGLT2 억제제가 심부전 입원을 35% 감소시켰다',
          journal: 'New England Journal of Medicine',
          topic: '심혈관',
          tier: 'basic',
          key_messages: ['심부전 입원 35% 감소', 'eGFR 감소 속도 40% 둔화', '심혈관 사망률 20% 감소'],
          published_at: new Date().toISOString().split('T')[0]
        },
        {
          id: 2,
          slug: 'sample-article-2',
          title: 'GLP-1 수용체 작용제의 체중 감량 효과',
          journal: 'Lancet',
          topic: '내분비',
          tier: 'basic',
          key_messages: ['평균 15% 체중 감량', '심혈관 위험 감소', '위장관 부작용 관리 가능'],
          published_at: new Date().toISOString().split('T')[0]
        }
      ]
    })
  }
  
  try {
    const topic = c.req.query('topic')
    
    let query = supabase
      .from('articles')
      .select('id, slug, title, journal, topic, tier, key_messages, published_at')
      .order('published_at', { ascending: false })
      .limit(20)
    
    if (topic) {
      query = query.eq('topic', topic)
    }
    
    const { data: articles, error } = await query
    
    if (error) throw error
    
    return c.json({ articles: articles || [] })
  } catch (e) {
    console.error('Articles error:', e)
    return c.json({ articles: [] })
  }
})

app.get('/api/articles/:slug', async (c) => {
  if (!supabase) {
    return c.json({
      article: {
        id: 1,
        slug: 'sample-article-1',
        title: 'SGLT2 억제제가 심부전 입원을 35% 감소시켰다',
        journal: 'New England Journal of Medicine',
        topic: '심혈관',
        tier: 'basic',
        key_messages: ['심부전 입원 35% 감소', 'eGFR 감소 속도 40% 둔화', '심혈관 사망률 20% 감소'],
        clinical_insight: 'HFpEF 환자에서 SGLT2 억제제 사용을 적극 고려해야 한다.',
        published_at: new Date().toISOString().split('T')[0]
      }
    })
  }
  
  const slug = c.req.param('slug')
  
  try {
    const { data: article, error } = await supabase
      .from('articles')
      .select('*')
      .eq('slug', slug)
      .single()
    
    if (error || !article) {
      return c.json({ error: 'Article not found' }, 404)
    }
    
    const user = c.get('user')
    if (user) {
      await supabase.from('read_history').insert({
        user_id: user.id,
        article_id: article.id
      })
    }
    
    return c.json({ article })
  } catch (e) {
    console.error('Article error:', e)
    return c.json({ error: 'Failed to fetch article' }, 500)
  }
})

// ===== Newsletter Routes =====
app.post('/api/newsletter/subscribe', async (c) => {
  if (!supabase) return c.json({ success: true, message: '뉴스레터 구독이 완료되었습니다! (Demo mode)' })
  
  try {
    const { email, name } = await c.req.json()
    
    if (!email) {
      return c.json({ error: '이메일을 입력해주세요.' }, 400)
    }
    
    const { error } = await supabase
      .from('subscribers')
      .upsert({ 
        email: email.toLowerCase(), 
        name: name || null,
        status: 'active'
      }, { onConflict: 'email' })
    
    if (error) throw error
    
    return c.json({ success: true, message: '뉴스레터 구독이 완료되었습니다!' })
  } catch (e) {
    console.error('Subscribe error:', e)
    return c.json({ error: '구독 중 오류가 발생했습니다.' }, 500)
  }
})

app.get('/api/newsletter/stats', async (c) => {
  if (!supabase) return c.json({ stats: { total: 0, active: 0, unsubscribed: 0 } })
  
  try {
    const { data } = await supabase.from('subscribers').select('status')
    
    const stats = {
      total: data?.length || 0,
      active: data?.filter(s => s.status === 'active').length || 0,
      unsubscribed: data?.filter(s => s.status === 'unsubscribed').length || 0
    }
    
    return c.json({ stats })
  } catch (e) {
    return c.json({ stats: { total: 0, active: 0, unsubscribed: 0 } })
  }
})

// ===== Main Page =====
app.get('/', (c) => {
  const user = c.get('user')
  return c.html(getMainPageHTML(user))
})

function getMainPageHTML(user) {
  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MedDigest - 무료 의학 논문 인사이트</title>
  <meta name="description" content="의료 전문가를 위한 무료 Med-Bio 논문 요약 서비스.">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📚</text></svg>">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: { 50: '#faf7f5', 100: '#f5ede8', 200: '#e8d5c8', 300: '#d4b69e', 400: '#c49a7a', 500: '#b07d56', 600: '#9a6642', 700: '#7d5236', 800: '#5f3f2a', 900: '#4a3121', DEFAULT: '#7d5236' },
            sage: { 50: '#f6f7f6', 100: '#e3e7e3', 200: '#c7d0c7', 300: '#a3b3a3', 400: '#7d917d', 500: '#5f7360', 600: '#4a5c4b', 700: '#3d4a3e', 800: '#333d34', 900: '#2b332c', DEFAULT: '#5f7360' },
            cream: { DEFAULT: '#fcf9f4' },
            navy: { 700: '#2c3e50', 800: '#1e2a36', DEFAULT: '#2c3e50' }
          }
        }
      }
    }
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600&family=Noto+Sans+KR:wght@400;500;600&display=swap');
    body { font-family: 'Noto Sans KR', sans-serif; background-color: #fcf9f4; }
    .font-serif { font-family: 'Noto Serif KR', serif; }
    .warm-gradient { background: linear-gradient(135deg, #5f7360 0%, #7d5236 50%, #9a6642 100%); }
    .elegant-gradient { background: linear-gradient(180deg, #f6f7f6 0%, #fcf9f4 100%); }
    .card-elegant { transition: all 0.3s; box-shadow: 0 2px 8px rgba(125, 82, 54, 0.06); }
    .card-elegant:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(125, 82, 54, 0.12); }
    .topic-filter.active { background: linear-gradient(135deg, #7d5236, #9a6642); color: white; }
    .btn-warm { background: linear-gradient(135deg, #7d5236, #9a6642); }
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
            <h1 class="text-xl font-serif font-semibold text-navy-800">MedDigest</h1>
            <p class="text-xs text-sage-600 font-medium">무료 Med-Bio 인사이트</p>
          </div>
        </div>
        <nav class="flex items-center space-x-4">
          ${user ? `
            <span class="text-sm text-navy-700">${user.nickname}님</span>
            <button onclick="logout()" class="px-4 py-2 text-sm text-primary-700 hover:bg-primary-50 rounded-lg">로그아웃</button>
          ` : `
            <button onclick="openAuthModal('login')" class="px-4 py-2 text-sm text-primary-700 hover:bg-primary-50 rounded-lg">로그인</button>
            <button onclick="openAuthModal('signup')" class="px-5 py-2.5 btn-warm text-white rounded-xl text-sm font-medium">무료 회원가입</button>
          `}
        </nav>
      </div>
    </div>
  </header>

  <!-- Hero -->
  <section class="relative overflow-hidden">
    <div class="absolute inset-0 elegant-gradient"></div>
    <div class="relative max-w-6xl mx-auto px-6 py-16">
      <div class="max-w-3xl">
        <div class="inline-flex items-center px-3 py-1 bg-sage-100 text-sage-700 rounded-full text-xs font-semibold mb-4">
          <i class="fas fa-gift mr-2"></i>100% 무료 서비스
        </div>
        <h2 class="font-serif text-3xl md:text-5xl font-semibold text-navy-800 leading-tight mb-6">
          매일 한 편의 논문이<br><span class="text-primary-700">임상의 통찰</span>로 다가옵니다
        </h2>
        <p class="text-lg text-navy-700/80 mb-8">
          바쁜 임상의, 연구자를 위해 엄선된 Med-Bio 논문을 전문가 시각으로 해설해 드립니다.
        </p>
      </div>
    </div>
  </section>

  <!-- Topic Filter -->
  <section class="bg-white border-y border-primary-100">
    <div class="max-w-6xl mx-auto px-6 py-5">
      <div class="flex items-center space-x-3 overflow-x-auto">
        <span class="text-navy-700/60 text-sm font-medium whitespace-nowrap"><i class="fas fa-filter mr-2"></i>주제</span>
        <div class="h-6 w-px bg-primary-200"></div>
        <button onclick="filterTopic('')" class="topic-btn topic-filter px-5 py-2 rounded-full text-sm font-medium active" data-topic="">전체</button>
        <button onclick="filterTopic('심혈관')" class="topic-btn topic-filter px-5 py-2 rounded-full text-sm font-medium" data-topic="심혈관">심혈관</button>
        <button onclick="filterTopic('내분비')" class="topic-btn topic-filter px-5 py-2 rounded-full text-sm font-medium" data-topic="내분비">내분비</button>
        <button onclick="filterTopic('노화')" class="topic-btn topic-filter px-5 py-2 rounded-full text-sm font-medium" data-topic="노화">노화</button>
        <button onclick="filterTopic('당뇨')" class="topic-btn topic-filter px-5 py-2 rounded-full text-sm font-medium" data-topic="당뇨">당뇨</button>
      </div>
    </div>
  </section>

  <!-- Articles -->
  <main class="max-w-6xl mx-auto px-6 py-10">
    <div id="articles-container" class="grid md:grid-cols-2 gap-6">
      <div class="col-span-2 text-center py-16">
        <div class="animate-pulse">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-sage-100"></div>
          <p class="text-navy-700/60">논문을 불러오는 중...</p>
        </div>
      </div>
    </div>
  </main>

  <!-- Newsletter -->
  <section class="relative overflow-hidden py-16">
    <div class="absolute inset-0 warm-gradient opacity-95"></div>
    <div class="relative max-w-4xl mx-auto px-6 text-center">
      <h3 class="font-serif text-3xl font-semibold text-white mb-4">매일 아침, 최신 논문을 받아보세요</h3>
      <p class="text-white/80 text-lg mb-8">새로운 논문 요약이 업데이트되면 이메일로 알려드립니다.</p>
      <div id="newsletter-form-container">
        <form onsubmit="handleNewsletterSubscribe(event)" class="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
          <input type="email" id="newsletter-email" placeholder="이메일 주소" required class="flex-1 px-5 py-3.5 rounded-xl text-navy-800 focus:outline-none">
          <button type="submit" class="px-8 py-3.5 bg-white text-primary-700 rounded-xl font-semibold hover:bg-cream-100">구독하기</button>
        </form>
      </div>
      <div id="newsletter-success" class="hidden">
        <div class="bg-white/20 rounded-xl p-6 max-w-md mx-auto">
          <i class="fas fa-check-circle text-4xl text-white mb-3"></i>
          <p class="text-white font-medium">구독이 완료되었습니다!</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="bg-navy-800 text-white py-12">
    <div class="max-w-6xl mx-auto px-6 text-center">
      <p class="text-white/50">© 2026 MedDigest. Powered by Vercel + Supabase</p>
    </div>
  </footer>

  <!-- Modals -->
  <div id="auth-modal" class="fixed inset-0 bg-black/50 z-50 hidden items-center justify-center p-4">
    <div id="auth-modal-content" class="bg-white rounded-2xl shadow-2xl max-w-md w-full relative"></div>
  </div>
  <div id="article-modal" class="fixed inset-0 bg-black/50 z-50 hidden items-center justify-center p-4 overflow-y-auto">
    <div id="article-modal-content" class="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-8 relative"></div>
  </div>

  <script>
    const isLoggedIn = ${user ? 'true' : 'false'};

    function openAuthModal(mode) {
      const modal = document.getElementById('auth-modal');
      const content = document.getElementById('auth-modal-content');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      
      content.innerHTML = mode === 'login' ? \`
        <div class="p-8">
          <button onclick="closeAuthModal()" class="absolute top-4 right-4 w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"><i class="fas fa-times"></i></button>
          <h3 class="font-serif text-2xl font-semibold text-center mb-6">로그인</h3>
          <form onsubmit="handleLogin(event)" class="space-y-4">
            <input type="email" id="login-email" required class="w-full px-4 py-3 border rounded-xl" placeholder="이메일">
            <input type="password" id="login-password" required class="w-full px-4 py-3 border rounded-xl" placeholder="비밀번호">
            <div id="login-error" class="text-red-500 text-sm hidden"></div>
            <button type="submit" class="w-full py-3 btn-warm text-white rounded-xl">로그인</button>
          </form>
          <p class="mt-4 text-center text-sm">계정이 없으신가요? <button onclick="openAuthModal('signup')" class="text-primary-600">회원가입</button></p>
        </div>
      \` : \`
        <div class="p-8">
          <button onclick="closeAuthModal()" class="absolute top-4 right-4 w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"><i class="fas fa-times"></i></button>
          <h3 class="font-serif text-2xl font-semibold text-center mb-6">무료 회원가입</h3>
          <form onsubmit="handleSignup(event)" class="space-y-4">
            <input type="text" id="signup-nickname" required class="w-full px-4 py-3 border rounded-xl" placeholder="닉네임">
            <input type="email" id="signup-email" required class="w-full px-4 py-3 border rounded-xl" placeholder="이메일">
            <input type="password" id="signup-password" required minlength="6" class="w-full px-4 py-3 border rounded-xl" placeholder="비밀번호 (6자 이상)">
            <div id="signup-error" class="text-red-500 text-sm hidden"></div>
            <button type="submit" class="w-full py-3 btn-warm text-white rounded-xl">회원가입</button>
          </form>
          <p class="mt-4 text-center text-sm">이미 계정이 있으신가요? <button onclick="openAuthModal('login')" class="text-primary-600">로그인</button></p>
        </div>
      \`;
    }
    
    function closeAuthModal() {
      document.getElementById('auth-modal').classList.add('hidden');
      document.getElementById('auth-modal').classList.remove('flex');
    }
    
    async function handleLogin(e) {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      const errorDiv = document.getElementById('login-error');
      
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success) window.location.reload();
        else { errorDiv.textContent = data.error; errorDiv.classList.remove('hidden'); }
      } catch (e) { errorDiv.textContent = '오류가 발생했습니다.'; errorDiv.classList.remove('hidden'); }
    }
    
    async function handleSignup(e) {
      e.preventDefault();
      const nickname = document.getElementById('signup-nickname').value;
      const email = document.getElementById('signup-email').value;
      const password = document.getElementById('signup-password').value;
      const errorDiv = document.getElementById('signup-error');
      
      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nickname, email, password })
        });
        const data = await res.json();
        if (data.success) window.location.reload();
        else { errorDiv.textContent = data.error; errorDiv.classList.remove('hidden'); }
      } catch (e) { errorDiv.textContent = '오류가 발생했습니다.'; errorDiv.classList.remove('hidden'); }
    }
    
    async function logout() {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.reload();
    }
    
    async function handleNewsletterSubscribe(e) {
      e.preventDefault();
      const email = document.getElementById('newsletter-email').value;
      try {
        const res = await fetch('/api/newsletter/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (data.success) {
          document.getElementById('newsletter-form-container').classList.add('hidden');
          document.getElementById('newsletter-success').classList.remove('hidden');
        } else alert(data.error);
      } catch (e) { alert('오류가 발생했습니다.'); }
    }

    async function loadArticles(topic = '') {
      const container = document.getElementById('articles-container');
      try {
        const params = new URLSearchParams();
        if (topic) params.set('topic', topic);
        const res = await fetch('/api/articles?' + params.toString());
        const data = await res.json();
        
        if (!data.articles.length) {
          container.innerHTML = '<div class="col-span-2 text-center py-16"><p class="text-navy-700/60">논문이 없습니다.</p></div>';
          return;
        }
        
        container.innerHTML = data.articles.map(article => \`
          <article class="bg-white rounded-2xl p-6 card-elegant cursor-pointer border border-primary-100/50" onclick="openArticle('\${article.slug}')">
            <div class="flex justify-between items-start mb-4">
              <span class="px-3 py-1.5 rounded-full text-xs font-semibold bg-sage-100 text-sage-700">\${article.topic}</span>
              <span class="text-xs text-navy-700/40">\${article.published_at}</span>
            </div>
            <p class="text-xs text-primary-600 font-medium mb-2">\${article.journal}</p>
            <h3 class="font-serif text-xl font-semibold text-navy-800 mb-4">\${article.title}</h3>
            <div class="space-y-2">
              \${(article.key_messages || []).slice(0, 2).map((msg, i) => \`
                <div class="flex items-start space-x-3">
                  <span class="w-6 h-6 bg-sage-500 rounded-lg flex items-center justify-center text-white text-xs font-bold">\${i + 1}</span>
                  <p class="text-sm text-navy-700/80">\${msg}</p>
                </div>
              \`).join('')}
            </div>
          </article>
        \`).join('');
      } catch (e) {
        container.innerHTML = '<div class="col-span-2 text-center py-16"><p class="text-red-500">오류가 발생했습니다.</p></div>';
      }
    }
    
    function filterTopic(topic) {
      document.querySelectorAll('.topic-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.topic === topic) btn.classList.add('active');
      });
      loadArticles(topic);
    }
    
    async function openArticle(slug) {
      const modal = document.getElementById('article-modal');
      const content = document.getElementById('article-modal-content');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      content.innerHTML = '<div class="p-8 text-center"><p>불러오는 중...</p></div>';
      
      try {
        const res = await fetch('/api/articles/' + slug);
        const data = await res.json();
        if (data.error) { content.innerHTML = '<div class="p-8"><p class="text-red-500">' + data.error + '</p></div>'; return; }
        
        const article = data.article;
        const keyMessages = typeof article.key_messages === 'string' ? JSON.parse(article.key_messages) : article.key_messages;
        
        content.innerHTML = \`
          <div class="relative">
            <button onclick="closeModal()" class="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-md"><i class="fas fa-times"></i></button>
            <div class="warm-gradient p-8 rounded-t-2xl">
              <span class="px-3 py-1 bg-white/20 text-white rounded-full text-sm">\${article.topic}</span>
              <p class="text-white/80 text-sm mt-4">\${article.journal}</p>
              <h2 class="font-serif text-2xl font-semibold text-white mt-2">\${article.title}</h2>
            </div>
            <div class="p-8">
              <h3 class="font-serif text-lg font-semibold text-navy-800 mb-4">핵심 메시지</h3>
              <div class="space-y-4">
                \${keyMessages.map((msg, i) => \`
                  <div class="flex items-start space-x-4 p-4 bg-sage-50 rounded-xl">
                    <span class="w-8 h-8 bg-sage-500 rounded-lg flex items-center justify-center text-white font-bold">\${i + 1}</span>
                    <p class="text-navy-700">\${msg}</p>
                  </div>
                \`).join('')}
              </div>
              \${article.clinical_insight ? \`
                <h3 class="font-serif text-lg font-semibold text-navy-800 mt-8 mb-4">임상적 시사점</h3>
                <div class="p-4 bg-blue-50 rounded-xl border-l-4 border-blue-400">
                  <p class="text-navy-700">\${article.clinical_insight}</p>
                </div>
              \` : ''}
            </div>
          </div>
        \`;
      } catch (e) { content.innerHTML = '<div class="p-8"><p class="text-red-500">오류가 발생했습니다.</p></div>'; }
    }
    
    function closeModal() {
      document.getElementById('article-modal').classList.add('hidden');
      document.getElementById('article-modal').classList.remove('flex');
    }

    document.getElementById('article-modal').addEventListener('click', e => { if (e.target.id === 'article-modal') closeModal(); });
    document.getElementById('auth-modal').addEventListener('click', e => { if (e.target.id === 'auth-modal') closeAuthModal(); });
    
    loadArticles();
  </script>
</body>
</html>
`
}

// Start server
const port = process.env.PORT || 3000
console.log(`Starting MedDigest server on port ${port}...`)

serve({
  fetch: app.fetch,
  port: parseInt(port)
}, (info) => {
  console.log(`🚀 MedDigest running at http://localhost:${info.port}`)
  console.log(`📊 Database: ${supabase ? 'Supabase connected' : 'Demo mode (no DB)'}`)
})
