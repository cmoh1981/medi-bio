import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { handle } from 'hono/vercel'
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

// Resend Email Helper
async function sendEmail(options) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY not configured')
  
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: options.from || 'MedDigest <onboarding@resend.dev>',
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html
    })
  })
  
  return response.json()
}

// Newsletter Email Template
function generateNewsletterHTML(articles, unsubscribeUrl) {
  const articleCards = articles.map(a => `
    <div style="background: #ffffff; border-radius: 12px; padding: 24px; margin-bottom: 16px; border: 1px solid #e8d5c8;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
        <span style="background: #e3e7e3; color: #4a5c4b; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">${a.topic}</span>
        <span style="color: #9a9a9a; font-size: 12px;">${a.published_at}</span>
      </div>
      <p style="color: #7d5236; font-size: 12px; margin: 0 0 8px 0; font-weight: 500;">${a.journal}</p>
      <h3 style="color: #2c3e50; font-size: 18px; margin: 0 0 16px 0; font-family: 'Georgia', serif; line-height: 1.4;">${a.title}</h3>
      <div style="margin-bottom: 16px;">
        ${(a.key_messages || []).slice(0, 2).map((msg, i) => `
          <div style="display: flex; align-items: flex-start; margin-bottom: 8px;">
            <span style="background: linear-gradient(135deg, #5f7360, #7d917d); color: white; width: 20px; height: 20px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; margin-right: 10px; flex-shrink: 0;">${i + 1}</span>
            <span style="color: #4a5c4b; font-size: 14px; line-height: 1.5;">${msg}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #fcf9f4; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto;">
    <div style="text-align: center; padding: 32px 0;">
      <h1 style="color: #2c3e50; font-size: 28px; margin: 0;">📚 MedDigest Daily</h1>
      <p style="color: #5f7360; margin: 8px 0 0 0;">오늘의 의학 논문 인사이트</p>
    </div>
    ${articleCards}
    <div style="text-align: center; padding: 32px 0; border-top: 1px solid #e8d5c8; margin-top: 32px;">
      <p style="color: #9a9a9a; font-size: 12px;">
        더 이상 이메일을 받고 싶지 않으시면 <a href="${unsubscribeUrl}" style="color: #7d5236;">구독 취소</a>를 클릭하세요.
      </p>
    </div>
  </div>
</body>
</html>
`
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
    platform: 'Vercel',
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
    
    // Check if user exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single()
    
    if (existing) {
      return c.json({ error: '이미 등록된 이메일입니다.' }, 400)
    }
    
    const passwordHash = await hashPassword(password)
    
    // Create user
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({ email: email.toLowerCase(), password_hash: passwordHash, nickname })
      .select('id')
      .single()
    
    if (error) throw error
    
    // Create session
    const sessionToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    
    await supabase.from('sessions').insert({
      user_id: newUser.id,
      session_token: sessionToken,
      expires_at: expiresAt.toISOString()
    })
    
    setCookie(c, 'session_token', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: true,
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
    
    // Create session
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
      secure: true,
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
    // Return sample data if DB not configured
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
  if (!supabase) return c.json({ error: 'Database not configured' }, 500)
  
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
    
    // Record read history if user is logged in
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

// ===== Bookmarks Routes =====
app.get('/api/bookmarks', async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  if (!supabase) return c.json({ error: 'Database not configured' }, 500)
  
  try {
    const { data: bookmarks } = await supabase
      .from('bookmarks')
      .select(`
        id,
        created_at,
        articles (id, slug, title, journal, topic, tier, published_at)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    
    return c.json({ bookmarks: bookmarks || [] })
  } catch (e) {
    return c.json({ bookmarks: [] })
  }
})

app.post('/api/bookmarks/:articleId', async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  if (!supabase) return c.json({ error: 'Database not configured' }, 500)
  
  const articleId = parseInt(c.req.param('articleId'))
  
  try {
    await supabase.from('bookmarks').upsert({
      user_id: user.id,
      article_id: articleId
    }, { onConflict: 'user_id,article_id' })
    
    return c.json({ success: true })
  } catch (e) {
    return c.json({ error: 'Failed to add bookmark' }, 500)
  }
})

app.delete('/api/bookmarks/:articleId', async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  if (!supabase) return c.json({ error: 'Database not configured' }, 500)
  
  const articleId = parseInt(c.req.param('articleId'))
  
  try {
    await supabase
      .from('bookmarks')
      .delete()
      .eq('user_id', user.id)
      .eq('article_id', articleId)
    
    return c.json({ success: true })
  } catch (e) {
    return c.json({ error: 'Failed to remove bookmark' }, 500)
  }
})

// ===== Newsletter Routes =====
app.post('/api/newsletter/subscribe', async (c) => {
  if (!supabase) return c.json({ error: 'Database not configured' }, 500)
  
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

app.get('/api/newsletter/unsubscribe', async (c) => {
  if (!supabase) return c.html('<html><body>Database not configured</body></html>')
  
  const email = c.req.query('email')
  
  if (!email) {
    return c.html('<html><body style="font-family: sans-serif; text-align: center; padding: 50px;"><h2>잘못된 요청입니다.</h2></body></html>')
  }
  
  try {
    await supabase
      .from('subscribers')
      .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
      .eq('email', email.toLowerCase())
    
    return c.html(`
      <html><body style="font-family: sans-serif; text-align: center; padding: 50px; background: #fcf9f4;">
        <div style="max-width: 400px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">구독이 취소되었습니다</h2>
          <p style="color: #5f7360;">MedDigest 뉴스레터 구독이 취소되었습니다.<br>언제든 다시 구독할 수 있습니다.</p>
        </div>
      </body></html>
    `)
  } catch (e) {
    return c.html('<html><body style="font-family: sans-serif; text-align: center; padding: 50px;"><h2>오류가 발생했습니다.</h2></body></html>')
  }
})

app.get('/api/newsletter/stats', async (c) => {
  if (!supabase) return c.json({ stats: { total: 0, active: 0, unsubscribed: 0 } })
  
  try {
    const { data } = await supabase
      .from('subscribers')
      .select('status')
    
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

app.post('/api/newsletter/send', async (c) => {
  const auth = c.req.header('Authorization')
  const secret = process.env.CRON_SECRET || 'dev-secret'
  
  if (auth !== `Bearer ${secret}`) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  if (!supabase) return c.json({ error: 'Database not configured' }, 500)
  if (!process.env.RESEND_API_KEY) return c.json({ error: 'Resend not configured' }, 500)
  
  try {
    // Get recent articles
    const { data: articles } = await supabase
      .from('articles')
      .select('*')
      .gte('published_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('published_at', { ascending: false })
      .limit(5)
    
    if (!articles || articles.length === 0) {
      return c.json({ message: 'No new articles to send', sent: 0 })
    }
    
    // Get active subscribers
    const { data: subscribers } = await supabase
      .from('subscribers')
      .select('id, email')
      .eq('status', 'active')
    
    if (!subscribers || subscribers.length === 0) {
      return c.json({ message: 'No active subscribers', sent: 0 })
    }
    
    let successful = 0
    let failed = 0
    
    for (const sub of subscribers) {
      const unsubscribeUrl = `${process.env.VERCEL_URL || 'https://meddigest.vercel.app'}/api/newsletter/unsubscribe?email=${encodeURIComponent(sub.email)}`
      const html = generateNewsletterHTML(articles, unsubscribeUrl)
      
      try {
        await sendEmail({
          to: sub.email,
          subject: `📚 MedDigest Daily - ${new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}`,
          html
        })
        successful++
        
        await supabase
          .from('subscribers')
          .update({ 
            last_email_sent_at: new Date().toISOString(),
            emails_sent: supabase.sql`emails_sent + 1`
          })
          .eq('id', sub.id)
      } catch (e) {
        failed++
        console.error(`Failed to send to ${sub.email}:`, e)
      }
      
      // Rate limiting
      await new Promise(r => setTimeout(r, 100))
    }
    
    // Log the send
    await supabase.from('newsletter_logs').insert({
      subject: `Daily - ${new Date().toISOString().split('T')[0]}`,
      total_recipients: subscribers.length,
      successful,
      failed,
      article_ids: articles.map(a => a.id)
    })
    
    return c.json({ message: 'Newsletter sent', total: subscribers.length, successful, failed })
  } catch (e) {
    console.error('Newsletter send error:', e)
    return c.json({ error: 'Failed to send newsletter' }, 500)
  }
})

// ===== Cron endpoint =====
app.get('/api/cron/daily', async (c) => {
  // Verify Vercel cron secret
  const authHeader = c.req.header('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  // TODO: Implement PubMed fetch and article generation
  return c.json({ message: 'Cron job executed', timestamp: new Date().toISOString() })
})

// ===== Main Page =====
app.get('/', (c) => {
  const user = c.get('user')
  const adsenseId = process.env.ADSENSE_CLIENT_ID || 'ca-pub-XXXXXXXXXX'
  
  return c.html(getMainPageHTML(user, adsenseId))
})

// Main page HTML generator
function getMainPageHTML(user, adsenseId) {
  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MedDigest - 무료 의학 논문 인사이트</title>
  <meta name="description" content="의료 전문가를 위한 무료 Med-Bio 논문 요약 서비스. 매일 업데이트되는 심혈관, 내분비, 노화, 당뇨 분야 최신 연구.">
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
            cream: { 50: '#fefdfb', 100: '#fcf9f4', 200: '#f9f3ea', 300: '#f5ebdb', 400: '#efe0c9', DEFAULT: '#fcf9f4' },
            navy: { 700: '#2c3e50', 800: '#1e2a36', 900: '#141d24', DEFAULT: '#2c3e50' }
          }
        }
      }
    }
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@300;400;500;600;700&family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap');
    body { font-family: 'Noto Sans KR', system-ui, sans-serif; background-color: #fcf9f4; }
    .font-serif { font-family: 'Noto Serif KR', Georgia, serif; }
    .warm-gradient { background: linear-gradient(135deg, #5f7360 0%, #7d5236 50%, #9a6642 100%); }
    .elegant-gradient { background: linear-gradient(180deg, #f6f7f6 0%, #fcf9f4 100%); }
    .card-elegant { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 2px 8px rgba(125, 82, 54, 0.06), 0 1px 3px rgba(125, 82, 54, 0.1); }
    .card-elegant:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(125, 82, 54, 0.12), 0 4px 12px rgba(125, 82, 54, 0.08); }
    .topic-filter { border: 1px solid transparent; transition: all 0.2s ease; }
    .topic-filter:hover { border-color: #d4b69e; background: #faf7f5; }
    .topic-filter.active { background: linear-gradient(135deg, #7d5236 0%, #9a6642 100%); color: white; border-color: transparent; }
    .btn-warm { background: linear-gradient(135deg, #7d5236 0%, #9a6642 100%); transition: all 0.3s ease; }
    .btn-warm:hover { background: linear-gradient(135deg, #5f3f2a 0%, #7d5236 100%); transform: translateY(-1px); }
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
            <p class="text-xs text-sage-600 font-medium tracking-wide">무료 Med-Bio 인사이트</p>
          </div>
        </div>
        <nav class="flex items-center space-x-4">
          ${user ? `
            <span class="text-sm text-navy-700">${user.nickname}님</span>
            <button onclick="logout()" class="px-4 py-2 text-sm font-medium text-primary-700 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition">로그아웃</button>
          ` : `
            <button onclick="openAuthModal('login')" class="px-4 py-2 text-sm font-medium text-primary-700 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition">로그인</button>
            <button onclick="openAuthModal('signup')" class="px-5 py-2.5 btn-warm text-white rounded-xl text-sm font-medium shadow-sm">무료 회원가입</button>
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
    
    <div class="relative max-w-6xl mx-auto px-6 py-16 md:py-20">
      <div class="max-w-3xl">
        <div class="inline-flex items-center px-3 py-1 bg-sage-100 text-sage-700 rounded-full text-xs font-semibold mb-4">
          <i class="fas fa-gift mr-2"></i>100% 무료 서비스
        </div>
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
              <div class="text-sm text-navy-700/60">읽기 시간</div>
            </div>
          </div>
          <div class="flex items-center space-x-3">
            <div class="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center">
              <i class="fas fa-calendar-check text-sage-600 text-lg"></i>
            </div>
            <div>
              <div class="text-2xl font-serif font-semibold text-navy-800">매일</div>
              <div class="text-sm text-navy-700/60">새 콘텐츠</div>
            </div>
          </div>
          <div class="flex items-center space-x-3">
            <div class="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center">
              <i class="fas fa-brain text-sage-600 text-lg"></i>
            </div>
            <div>
              <div class="text-2xl font-serif font-semibold text-navy-800">AI</div>
              <div class="text-sm text-navy-700/60">질문 가능</div>
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
        <button onclick="filterTopic('심혈관')" class="topic-btn topic-filter px-5 py-2 rounded-full text-sm font-medium" data-topic="심혈관">
          <i class="fas fa-heartbeat mr-1.5 text-xs"></i>심혈관
        </button>
        <button onclick="filterTopic('내분비')" class="topic-btn topic-filter px-5 py-2 rounded-full text-sm font-medium" data-topic="내분비">
          <i class="fas fa-dna mr-1.5 text-xs"></i>내분비
        </button>
        <button onclick="filterTopic('노화')" class="topic-btn topic-filter px-5 py-2 rounded-full text-sm font-medium" data-topic="노화">
          <i class="fas fa-hourglass-half mr-1.5 text-xs"></i>노화
        </button>
        <button onclick="filterTopic('당뇨')" class="topic-btn topic-filter px-5 py-2 rounded-full text-sm font-medium" data-topic="당뇨">
          <i class="fas fa-tint mr-1.5 text-xs"></i>당뇨
        </button>
      </div>
    </div>
  </section>

  <!-- Articles Grid -->
  <main class="max-w-6xl mx-auto px-6 py-10">
    <div id="articles-container" class="grid md:grid-cols-2 gap-6">
      <div class="col-span-2 text-center py-16">
        <div class="animate-pulse">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-sage-100"></div>
          <p class="text-navy-700/60 font-medium">논문 요약을 불러오는 중...</p>
        </div>
      </div>
    </div>
  </main>

  <!-- Newsletter CTA -->
  <section class="relative overflow-hidden py-16 md:py-20">
    <div class="absolute inset-0 warm-gradient opacity-95"></div>
    <div class="absolute top-0 left-1/4 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
    
    <div class="relative max-w-4xl mx-auto px-6 text-center">
      <div class="inline-flex items-center px-4 py-1.5 bg-white/20 rounded-full text-white/90 text-sm font-medium mb-6">
        <i class="fas fa-envelope mr-2"></i>뉴스레터 구독
      </div>
      <h3 class="font-serif text-3xl md:text-4xl font-semibold text-white mb-4">
        매일 아침, 최신 논문을<br>받아보세요
      </h3>
      <p class="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
        새로운 논문 요약이 업데이트되면 이메일로 알려드립니다.
      </p>
      
      <div id="newsletter-form-container">
        <form onsubmit="handleNewsletterSubscribe(event)" class="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
          <input type="email" id="newsletter-email" placeholder="이메일 주소" required
                 class="flex-1 px-5 py-3.5 rounded-xl text-navy-800 placeholder-navy-400 focus:outline-none focus:ring-2 focus:ring-white/50">
          <button type="submit" class="px-8 py-3.5 bg-white text-primary-700 rounded-xl font-semibold hover:bg-cream-100 transition shadow-lg">
            <i class="fas fa-paper-plane mr-2"></i>구독하기
          </button>
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
    <div class="max-w-6xl mx-auto px-6">
      <div class="flex flex-col md:flex-row justify-between items-center">
        <div class="flex items-center space-x-3 mb-6 md:mb-0">
          <div class="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <i class="fas fa-book-medical text-sage-300"></i>
          </div>
          <div>
            <span class="font-serif font-semibold text-lg">MedDigest</span>
            <p class="text-xs text-white/50">무료 Med-Bio 인사이트</p>
          </div>
        </div>
        <div class="text-sm text-white/50 text-center md:text-right">
          <p>© 2026 MedDigest. All rights reserved.</p>
          <p class="mt-1">Powered by Vercel + Supabase</p>
        </div>
      </div>
    </div>
  </footer>

  <!-- Auth Modal -->
  <div id="auth-modal" class="fixed inset-0 bg-black/50 z-50 hidden items-center justify-center p-4">
    <div id="auth-modal-content" class="bg-white rounded-2xl shadow-2xl max-w-md w-full relative"></div>
  </div>

  <!-- Article Modal -->
  <div id="article-modal" class="fixed inset-0 bg-black/50 z-50 hidden items-center justify-center p-4 overflow-y-auto">
    <div id="article-modal-content" class="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-8 relative"></div>
  </div>

  <script>
    let currentTopic = '';
    const isLoggedIn = ${user ? 'true' : 'false'};
    const currentUser = ${user ? JSON.stringify({ email: user.email, nickname: user.nickname }) : 'null'};

    // Auth Modal
    function openAuthModal(mode) {
      const modal = document.getElementById('auth-modal');
      const content = document.getElementById('auth-modal-content');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      
      if (mode === 'login') {
        content.innerHTML = \`
          <div class="p-8">
            <button onclick="closeAuthModal()" class="absolute top-4 right-4 w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600">
              <i class="fas fa-times"></i>
            </button>
            <div class="text-center mb-6">
              <div class="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-sage-500 to-primary-600 rounded-2xl flex items-center justify-center">
                <i class="fas fa-book-medical text-white text-2xl"></i>
              </div>
              <h3 class="font-serif text-2xl font-semibold text-navy-800">로그인</h3>
              <p class="text-navy-700/60 text-sm mt-1">MedDigest에 오신 것을 환영합니다</p>
            </div>
            <form onsubmit="handleLogin(event)" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-navy-700 mb-1">이메일</label>
                <input type="email" id="login-email" required class="w-full px-4 py-3 border border-primary-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent" placeholder="your@email.com">
              </div>
              <div>
                <label class="block text-sm font-medium text-navy-700 mb-1">비밀번호</label>
                <input type="password" id="login-password" required class="w-full px-4 py-3 border border-primary-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent" placeholder="••••••••">
              </div>
              <div id="login-error" class="text-red-500 text-sm hidden"></div>
              <button type="submit" class="w-full py-3 btn-warm text-white rounded-xl font-medium">로그인</button>
            </form>
            <div class="mt-6 text-center text-sm text-navy-700/60">
              계정이 없으신가요? <button onclick="openAuthModal('signup')" class="text-primary-600 hover:text-primary-700 font-medium">무료 회원가입</button>
            </div>
          </div>
        \`;
      } else {
        content.innerHTML = \`
          <div class="p-8">
            <button onclick="closeAuthModal()" class="absolute top-4 right-4 w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600">
              <i class="fas fa-times"></i>
            </button>
            <div class="text-center mb-6">
              <div class="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-sage-500 to-primary-600 rounded-2xl flex items-center justify-center">
                <i class="fas fa-user-plus text-white text-2xl"></i>
              </div>
              <h3 class="font-serif text-2xl font-semibold text-navy-800">무료 회원가입</h3>
              <p class="text-navy-700/60 text-sm mt-1">모든 콘텐츠를 무료로 이용하세요</p>
            </div>
            <form onsubmit="handleSignup(event)" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-navy-700 mb-1">닉네임</label>
                <input type="text" id="signup-nickname" required class="w-full px-4 py-3 border border-primary-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent" placeholder="홍길동">
              </div>
              <div>
                <label class="block text-sm font-medium text-navy-700 mb-1">이메일</label>
                <input type="email" id="signup-email" required class="w-full px-4 py-3 border border-primary-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent" placeholder="your@email.com">
              </div>
              <div>
                <label class="block text-sm font-medium text-navy-700 mb-1">비밀번호</label>
                <input type="password" id="signup-password" required minlength="6" class="w-full px-4 py-3 border border-primary-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent" placeholder="최소 6자 이상">
              </div>
              <div id="signup-error" class="text-red-500 text-sm hidden"></div>
              <button type="submit" class="w-full py-3 btn-warm text-white rounded-xl font-medium">회원가입</button>
            </form>
            <div class="mt-6 text-center text-sm text-navy-700/60">
              이미 계정이 있으신가요? <button onclick="openAuthModal('login')" class="text-primary-600 hover:text-primary-700 font-medium">로그인</button>
            </div>
          </div>
        \`;
      }
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
        
        if (data.success) {
          window.location.reload();
        } else {
          errorDiv.textContent = data.error;
          errorDiv.classList.remove('hidden');
        }
      } catch (e) {
        errorDiv.textContent = '로그인 중 오류가 발생했습니다.';
        errorDiv.classList.remove('hidden');
      }
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
        
        if (data.success) {
          window.location.reload();
        } else {
          errorDiv.textContent = data.error;
          errorDiv.classList.remove('hidden');
        }
      } catch (e) {
        errorDiv.textContent = '회원가입 중 오류가 발생했습니다.';
        errorDiv.classList.remove('hidden');
      }
    }
    
    async function logout() {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.reload();
    }
    
    // Newsletter subscription
    async function handleNewsletterSubscribe(e) {
      e.preventDefault();
      const email = document.getElementById('newsletter-email').value;
      const formContainer = document.getElementById('newsletter-form-container');
      const successDiv = document.getElementById('newsletter-success');
      
      try {
        const res = await fetch('/api/newsletter/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        
        if (data.success) {
          formContainer.classList.add('hidden');
          successDiv.classList.remove('hidden');
        } else {
          alert(data.error || '구독 중 오류가 발생했습니다.');
        }
      } catch (e) {
        alert('구독 중 오류가 발생했습니다.');
      }
    }

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
            <div class="col-span-2 text-center py-16">
              <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-sage-100 flex items-center justify-center">
                <i class="fas fa-inbox text-3xl text-sage-400"></i>
              </div>
              <p class="text-navy-700/60 font-medium">아직 등록된 논문이 없습니다.</p>
            </div>
          \`;
          return;
        }
        
        container.innerHTML = data.articles.map((article, index) => \`
          <article class="bg-white rounded-2xl p-6 card-elegant cursor-pointer border border-primary-100/50" onclick="openArticle('\${article.slug}')">
            <div class="flex justify-between items-start mb-4">
              <div class="flex items-center space-x-3">
                <span class="px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide bg-sage-100 text-sage-700">
                  무료
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
              \${(article.key_messages || []).slice(0, 2).map((msg, i) => \`
                <div class="flex items-start space-x-3">
                  <span class="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-sage-500 to-sage-600 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm">\${i + 1}</span>
                  <p class="text-sm text-navy-700/80 leading-relaxed">\${msg}</p>
                </div>
              \`).join('')}
            </div>
            
            <div class="flex items-center justify-between pt-4 border-t border-primary-100">
              <span class="text-xs text-primary-600 font-medium hover:text-primary-700 transition">
                자세히 보기 <i class="fas fa-arrow-right ml-1 text-xs"></i>
              </span>
            </div>
          </article>
        \`).join('');
      } catch (e) {
        console.error('Failed to load articles:', e);
        container.innerHTML = \`
          <div class="col-span-2 text-center py-16">
            <p class="text-red-500">논문을 불러오는 중 오류가 발생했습니다.</p>
          </div>
        \`;
      }
    }
    
    function filterTopic(topic) {
      currentTopic = topic;
      document.querySelectorAll('.topic-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.topic === topic) {
          btn.classList.add('active');
        }
      });
      loadArticles(topic);
    }
    
    async function openArticle(slug) {
      const modal = document.getElementById('article-modal');
      const content = document.getElementById('article-modal-content');
      
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      
      content.innerHTML = \`
        <div class="p-8 text-center">
          <div class="animate-pulse">
            <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-sage-100"></div>
            <p class="text-navy-700/60">논문 정보를 불러오는 중...</p>
          </div>
        </div>
      \`;
      
      try {
        const res = await fetch('/api/articles/' + slug);
        const data = await res.json();
        
        if (data.error) {
          content.innerHTML = \`
            <div class="p-8 text-center">
              <p class="text-red-500">\${data.error}</p>
              <button onclick="closeModal()" class="mt-4 px-4 py-2 bg-gray-200 rounded-lg">닫기</button>
            </div>
          \`;
          return;
        }
        
        const article = data.article;
        const keyMessages = typeof article.key_messages === 'string' ? JSON.parse(article.key_messages) : article.key_messages;
        
        content.innerHTML = \`
          <div class="relative">
            <button onclick="closeModal()" class="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-navy-700 shadow-md transition">
              <i class="fas fa-times"></i>
            </button>
            
            <div class="warm-gradient p-8 rounded-t-2xl">
              <div class="flex items-center space-x-3 mb-4">
                <span class="px-3 py-1 bg-white/20 text-white rounded-full text-sm font-medium">\${article.topic}</span>
                <span class="text-white/70 text-sm">\${article.published_at}</span>
              </div>
              <p class="text-white/80 text-sm font-medium mb-2">\${article.journal}</p>
              <h2 class="font-serif text-2xl md:text-3xl font-semibold text-white leading-tight">\${article.title}</h2>
              \${article.doi ? \`<p class="text-white/60 text-sm mt-4">DOI: \${article.doi}</p>\` : ''}
            </div>
            
            <div class="p-8">
              <section class="mb-8">
                <h3 class="font-serif text-lg font-semibold text-navy-800 mb-4 flex items-center">
                  <span class="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center mr-3">
                    <i class="fas fa-lightbulb text-amber-600"></i>
                  </span>
                  핵심 메시지
                </h3>
                <div class="space-y-4">
                  \${keyMessages.map((msg, i) => \`
                    <div class="flex items-start space-x-4 p-4 bg-sage-50 rounded-xl">
                      <span class="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-sage-500 to-sage-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">\${i + 1}</span>
                      <p class="text-navy-700 leading-relaxed">\${msg}</p>
                    </div>
                  \`).join('')}
                </div>
              </section>
              
              \${article.clinical_insight ? \`
                <section class="mb-8">
                  <h3 class="font-serif text-lg font-semibold text-navy-800 mb-4 flex items-center">
                    <span class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mr-3">
                      <i class="fas fa-stethoscope text-blue-600"></i>
                    </span>
                    임상적 시사점
                  </h3>
                  <div class="p-4 bg-blue-50 rounded-xl border-l-4 border-blue-400">
                    <p class="text-navy-700 leading-relaxed">\${article.clinical_insight}</p>
                  </div>
                </section>
              \` : ''}
            </div>
          </div>
        \`;
      } catch (e) {
        console.error('Failed to load article:', e);
        content.innerHTML = \`
          <div class="p-8 text-center">
            <p class="text-red-500">논문 정보를 불러오는 데 실패했습니다.</p>
            <button onclick="closeModal()" class="mt-4 px-4 py-2 bg-gray-200 rounded-lg">닫기</button>
          </div>
        \`;
      }
    }
    
    function closeModal() {
      document.getElementById('article-modal').classList.add('hidden');
      document.getElementById('article-modal').classList.remove('flex');
    }

    // Event listeners
    document.getElementById('article-modal').addEventListener('click', (e) => {
      if (e.target.id === 'article-modal') closeModal();
    });
    
    document.getElementById('auth-modal').addEventListener('click', (e) => {
      if (e.target.id === 'auth-modal') closeAuthModal();
    });

    // Initialize
    loadArticles();
  </script>
</body>
</html>
`
}

// Export for Vercel
export default handle(app)
