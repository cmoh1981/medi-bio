import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'

// Types
type Bindings = {
  DB: D1Database
  APP_NAME: string
  APP_ENV: string
  CRON_SECRET?: string
  ADSENSE_CLIENT_ID?: string
  RESEND_API_KEY?: string
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
    email: string
    nickname: string
  } | null
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// CORS
app.use('/api/*', cors())

// Simple password hashing using Web Crypto API (for Cloudflare Workers)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'meddigest-salt-2026')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const inputHash = await hashPassword(password)
  return inputHash === hash
}

// ===== Resend Email Helper =====
async function sendEmail(apiKey: string, options: {
  to: string | string[]
  subject: string
  html: string
  from?: string
}) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: options.from || 'MedDigest <newsletter@meddigest.io>',
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html
    })
  })
  
  return response.json()
}

// Newsletter Email Template
function generateNewsletterHTML(articles: any[], unsubscribeUrl: string) {
  const articleCards = articles.map(a => `
    <div style="background: #ffffff; border-radius: 12px; padding: 24px; margin-bottom: 16px; border: 1px solid #e8d5c8;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
        <span style="background: #e3e7e3; color: #4a5c4b; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">${a.topic}</span>
        <span style="color: #9a9a9a; font-size: 12px;">${a.published_at}</span>
      </div>
      <p style="color: #7d5236; font-size: 12px; margin: 0 0 8px 0; font-weight: 500;">${a.journal}</p>
      <h3 style="color: #2c3e50; font-size: 18px; margin: 0 0 16px 0; font-family: 'Georgia', serif; line-height: 1.4;">${a.title}</h3>
      <div style="margin-bottom: 16px;">
        ${a.key_messages.slice(0, 2).map((msg: string, i: number) => `
          <div style="display: flex; align-items: flex-start; margin-bottom: 8px;">
            <span style="background: linear-gradient(135deg, #5f7360, #7d917d); color: white; width: 20px; height: 20px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; margin-right: 10px; flex-shrink: 0;">${i + 1}</span>
            <span style="color: #4a5c4b; font-size: 14px; line-height: 1.5;">${msg}</span>
          </div>
        `).join('')}
      </div>
      <a href="https://meddigest.io/article/${a.slug}" style="color: #7d5236; font-size: 14px; font-weight: 500; text-decoration: none;">자세히 보기 →</a>
    </div>
  `).join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MedDigest Daily</title>
</head>
<body style="margin: 0; padding: 0; background-color: #fcf9f4; font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; background: linear-gradient(135deg, #5f7360, #7d5236); width: 48px; height: 48px; border-radius: 12px; margin-bottom: 16px;"></div>
      <h1 style="color: #2c3e50; font-size: 24px; margin: 0; font-family: 'Georgia', serif;">MedDigest</h1>
      <p style="color: #5f7360; font-size: 14px; margin: 8px 0 0 0;">Daily Med-Bio Insight</p>
    </div>
    
    <!-- Greeting -->
    <div style="background: linear-gradient(135deg, #5f7360 0%, #7d5236 50%, #9a6642 100%); border-radius: 16px; padding: 32px; text-align: center; margin-bottom: 24px;">
      <h2 style="color: white; font-size: 20px; margin: 0 0 8px 0; font-family: 'Georgia', serif;">오늘의 논문 인사이트</h2>
      <p style="color: rgba(255,255,255,0.8); font-size: 14px; margin: 0;">${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>
    </div>
    
    <!-- Articles -->
    ${articleCards}
    
    <!-- CTA -->
    <div style="text-align: center; margin: 32px 0;">
      <a href="https://meddigest.io" style="display: inline-block; background: linear-gradient(135deg, #7d5236, #9a6642); color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 500; font-size: 14px;">더 많은 논문 보기</a>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; padding-top: 24px; border-top: 1px solid #e8d5c8;">
      <p style="color: #9a9a9a; font-size: 12px; margin: 0 0 8px 0;">© 2026 MedDigest. 의료 전문가를 위한 무료 논문 인사이트.</p>
      <a href="${unsubscribeUrl}" style="color: #9a9a9a; font-size: 12px; text-decoration: underline;">구독 취소</a>
    </div>
  </div>
</body>
</html>
  `
}

// Auth Middleware
app.use('*', async (c, next) => {
  const sessionToken = getCookie(c, 'session_token')
  
  if (sessionToken && c.env.DB) {
    try {
      const session = await c.env.DB.prepare(`
        SELECT u.id, u.email, u.nickname
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

// ===== Email Auth =====

// Sign up
app.post('/api/auth/signup', async (c) => {
  try {
    const { email, password, nickname } = await c.req.json()
    
    // Validation
    if (!email || !password || !nickname) {
      return c.json({ error: '모든 필드를 입력해주세요.' }, 400)
    }
    
    if (password.length < 6) {
      return c.json({ error: '비밀번호는 최소 6자 이상이어야 합니다.' }, 400)
    }
    
    if (!email.includes('@')) {
      return c.json({ error: '올바른 이메일 형식이 아닙니다.' }, 400)
    }
    
    // Check if email exists
    const existing = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first()
    
    if (existing) {
      return c.json({ error: '이미 가입된 이메일입니다.' }, 400)
    }
    
    // Hash password and create user
    const passwordHash = await hashPassword(password)
    
    await c.env.DB.prepare(`
      INSERT INTO users (email, password_hash, nickname)
      VALUES (?, ?, ?)
    `).bind(email.toLowerCase(), passwordHash, nickname).run()
    
    // Get user ID
    const user = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first() as { id: number }
    
    // Create session
    const sessionToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    
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
      maxAge: 30 * 24 * 60 * 60
    })
    
    return c.json({ success: true, user: { email, nickname } })
  } catch (e) {
    console.error('Signup error:', e)
    return c.json({ error: '회원가입 중 오류가 발생했습니다.' }, 500)
  }
})

// Login
app.post('/api/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json()
    
    if (!email || !password) {
      return c.json({ error: '이메일과 비밀번호를 입력해주세요.' }, 400)
    }
    
    // Find user
    const user = await c.env.DB.prepare(
      'SELECT id, email, password_hash, nickname FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first() as { id: number, email: string, password_hash: string, nickname: string } | null
    
    if (!user) {
      return c.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401)
    }
    
    // Verify password
    const isValid = await verifyPassword(password, user.password_hash)
    if (!isValid) {
      return c.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401)
    }
    
    // Create session
    const sessionToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    
    await c.env.DB.prepare(`
      INSERT INTO sessions (user_id, session_token, expires_at)
      VALUES (?, ?, ?)
    `).bind(user.id, sessionToken, expiresAt).run()
    
    setCookie(c, 'session_token', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 30 * 24 * 60 * 60
    })
    
    return c.json({ success: true, user: { email: user.email, nickname: user.nickname } })
  } catch (e) {
    console.error('Login error:', e)
    return c.json({ error: '로그인 중 오류가 발생했습니다.' }, 500)
  }
})

// Logout
app.post('/api/auth/logout', async (c) => {
  const sessionToken = getCookie(c, 'session_token')
  
  if (sessionToken && c.env.DB) {
    try {
      await c.env.DB.prepare(
        'DELETE FROM sessions WHERE session_token = ?'
      ).bind(sessionToken).run()
    } catch (e) {
      // Ignore errors
    }
  }
  
  deleteCookie(c, 'session_token')
  return c.json({ success: true })
})

// ===== Articles API =====

// List articles (ALL FREE now!)
app.get('/api/articles', async (c) => {
  const topic = c.req.query('topic')
  const limit = parseInt(c.req.query('limit') || '10')
  const offset = parseInt(c.req.query('offset') || '0')
  
  let query = `
    SELECT id, slug, title, journal, topic, tier, key_messages, published_at
    FROM articles
    WHERE 1=1
  `
  const params: (string | number)[] = []
  
  if (topic) {
    query += ' AND topic = ?'
    params.push(topic)
  }
  
  query += ' ORDER BY published_at DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)
  
  try {
    const articles = await c.env.DB.prepare(query).bind(...params).all()
    
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

// Get single article (ALL FREE now!)
app.get('/api/articles/:slug', async (c) => {
  const slug = c.req.param('slug')
  const user = c.get('user')
  
  try {
    const article = await c.env.DB.prepare(
      'SELECT * FROM articles WHERE slug = ?'
    ).bind(slug).first() as any
    
    if (!article) {
      return c.json({ error: 'Article not found' }, 404)
    }
    
    // Record read history if logged in
    if (user) {
      try {
        await c.env.DB.prepare(
          'INSERT INTO read_history (user_id, article_id) VALUES (?, ?)'
        ).bind(user.id, article.id).run()
      } catch (e) {
        // Ignore errors
      }
    }
    
    // Parse JSON fields
    article.key_messages = JSON.parse(article.key_messages)
    
    return c.json({ article })
  } catch (e) {
    return c.json({ error: 'Database error' }, 500)
  }
})

// ===== Bookmarks API =====

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

app.post('/api/bookmarks/:articleId', async (c) => {
  const user = c.get('user')
  const articleId = parseInt(c.req.param('articleId'))
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO bookmarks (user_id, article_id) VALUES (?, ?)'
    ).bind(user.id, articleId).run()
    
    return c.json({ success: true })
  } catch (e) {
    return c.json({ error: 'Failed to add bookmark' }, 500)
  }
})

app.delete('/api/bookmarks/:articleId', async (c) => {
  const user = c.get('user')
  const articleId = parseInt(c.req.param('articleId'))
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    await c.env.DB.prepare(
      'DELETE FROM bookmarks WHERE user_id = ? AND article_id = ?'
    ).bind(user.id, articleId).run()
    
    return c.json({ success: true })
  } catch (e) {
    return c.json({ error: 'Failed to remove bookmark' }, 500)
  }
})

// ===== Newsletter API =====

// Subscribe to newsletter
app.post('/api/newsletter/subscribe', async (c) => {
  try {
    const { email, name } = await c.req.json()
    
    if (!email || !email.includes('@')) {
      return c.json({ error: '올바른 이메일을 입력해주세요.' }, 400)
    }
    
    // Check if already subscribed
    const existing = await c.env.DB.prepare(
      'SELECT id, status FROM subscribers WHERE email = ?'
    ).bind(email.toLowerCase()).first() as { id: number, status: string } | null
    
    if (existing) {
      if (existing.status === 'active') {
        return c.json({ error: '이미 구독 중인 이메일입니다.' }, 400)
      }
      // Reactivate unsubscribed user
      await c.env.DB.prepare(
        'UPDATE subscribers SET status = ?, unsubscribed_at = NULL, subscribed_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind('active', existing.id).run()
    } else {
      // New subscriber
      await c.env.DB.prepare(
        'INSERT INTO subscribers (email, name, status) VALUES (?, ?, ?)'
      ).bind(email.toLowerCase(), name || null, 'active').run()
    }
    
    // Send welcome email if Resend API key is configured
    if (c.env.RESEND_API_KEY) {
      try {
        await sendEmail(c.env.RESEND_API_KEY, {
          to: email,
          subject: '🎉 MedDigest 뉴스레터 구독을 환영합니다!',
          html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 40px 20px; background-color: #fcf9f4; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
  <div style="max-width: 500px; margin: 0 auto; text-align: center;">
    <div style="background: linear-gradient(135deg, #5f7360, #7d5236); width: 64px; height: 64px; border-radius: 16px; margin: 0 auto 24px;"></div>
    <h1 style="color: #2c3e50; font-size: 24px; margin: 0 0 16px;">환영합니다!</h1>
    <p style="color: #5f7360; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
      MedDigest 뉴스레터 구독이 완료되었습니다.<br>
      매일 아침, 엄선된 Med-Bio 논문 인사이트를 받아보세요.
    </p>
    <a href="https://meddigest.io" style="display: inline-block; background: linear-gradient(135deg, #7d5236, #9a6642); color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 500;">오늘의 논문 보기</a>
    <p style="color: #9a9a9a; font-size: 12px; margin: 32px 0 0;">© 2026 MedDigest</p>
  </div>
</body>
</html>
          `
        })
      } catch (e) {
        console.error('Welcome email failed:', e)
      }
    }
    
    return c.json({ success: true, message: '뉴스레터 구독이 완료되었습니다!' })
  } catch (e) {
    console.error('Subscribe error:', e)
    return c.json({ error: '구독 처리 중 오류가 발생했습니다.' }, 500)
  }
})

// Unsubscribe from newsletter
app.get('/api/newsletter/unsubscribe', async (c) => {
  const email = c.req.query('email')
  const token = c.req.query('token')
  
  if (!email) {
    return c.html(`
      <html><body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h2>잘못된 요청입니다.</h2>
      </body></html>
    `)
  }
  
  try {
    await c.env.DB.prepare(
      'UPDATE subscribers SET status = ?, unsubscribed_at = CURRENT_TIMESTAMP WHERE email = ?'
    ).bind('unsubscribed', email.toLowerCase()).run()
    
    return c.html(`
      <html><body style="font-family: sans-serif; text-align: center; padding: 50px; background: #fcf9f4;">
        <div style="max-width: 400px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">구독이 취소되었습니다</h2>
          <p style="color: #5f7360;">MedDigest 뉴스레터 구독이 취소되었습니다.<br>언제든 다시 구독할 수 있습니다.</p>
          <a href="https://meddigest.io" style="color: #7d5236;">홈으로 돌아가기</a>
        </div>
      </body></html>
    `)
  } catch (e) {
    return c.html(`
      <html><body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h2>오류가 발생했습니다.</h2>
      </body></html>
    `)
  }
})

// Get subscriber count (for admin/stats)
app.get('/api/newsletter/stats', async (c) => {
  try {
    const stats = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'unsubscribed' THEN 1 ELSE 0 END) as unsubscribed
      FROM subscribers
    `).first()
    
    return c.json({ stats })
  } catch (e) {
    return c.json({ stats: { total: 0, active: 0, unsubscribed: 0 } })
  }
})

// Send newsletter (triggered by cron or manual)
app.post('/api/newsletter/send', async (c) => {
  const auth = c.req.header('Authorization')
  const secret = c.env.CRON_SECRET || 'dev-secret'
  
  if (auth !== `Bearer ${secret}`) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  if (!c.env.RESEND_API_KEY) {
    return c.json({ error: 'Resend API key not configured' }, 500)
  }
  
  try {
    // Get today's articles
    const articles = await c.env.DB.prepare(`
      SELECT * FROM articles 
      WHERE published_at >= date('now', '-1 day')
      ORDER BY published_at DESC
      LIMIT 5
    `).all()
    
    if (articles.results.length === 0) {
      return c.json({ message: 'No new articles to send', sent: 0 })
    }
    
    // Parse key_messages
    const parsedArticles = articles.results.map((a: any) => ({
      ...a,
      key_messages: JSON.parse(a.key_messages)
    }))
    
    // Get active subscribers
    const subscribers = await c.env.DB.prepare(
      'SELECT id, email FROM subscribers WHERE status = ?'
    ).bind('active').all()
    
    if (subscribers.results.length === 0) {
      return c.json({ message: 'No active subscribers', sent: 0 })
    }
    
    let successful = 0
    let failed = 0
    
    // Send to each subscriber (in batches for Resend)
    for (const sub of subscribers.results as { id: number, email: string }[]) {
      const unsubscribeUrl = `https://meddigest.io/api/newsletter/unsubscribe?email=${encodeURIComponent(sub.email)}`
      const html = generateNewsletterHTML(parsedArticles, unsubscribeUrl)
      
      try {
        await sendEmail(c.env.RESEND_API_KEY, {
          to: sub.email,
          subject: `📚 MedDigest Daily - ${new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}`,
          html
        })
        successful++
        
        // Update subscriber stats
        await c.env.DB.prepare(
          'UPDATE subscribers SET last_email_sent_at = CURRENT_TIMESTAMP, emails_sent = emails_sent + 1 WHERE id = ?'
        ).bind(sub.id).run()
      } catch (e) {
        failed++
        console.error(`Failed to send to ${sub.email}:`, e)
      }
      
      // Rate limiting (Resend free tier: 100 emails/day)
      await new Promise(r => setTimeout(r, 100))
    }
    
    // Log the send
    await c.env.DB.prepare(`
      INSERT INTO newsletter_logs (subject, total_recipients, successful, failed, article_ids)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      `Daily - ${new Date().toISOString().split('T')[0]}`,
      subscribers.results.length,
      successful,
      failed,
      JSON.stringify(parsedArticles.map((a: any) => a.id))
    ).run()
    
    return c.json({ 
      message: 'Newsletter sent',
      total: subscribers.results.length,
      successful,
      failed
    })
  } catch (e) {
    console.error('Newsletter send error:', e)
    return c.json({ error: 'Failed to send newsletter' }, 500)
  }
})

// ===== Main Page =====

app.get('/', (c) => {
  const user = c.get('user')
  const adsenseId = c.env.ADSENSE_CLIENT_ID || 'ca-pub-XXXXXXXXXX'
  
  return c.html(`
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MedDigest - 무료 의학 논문 인사이트</title>
  <meta name="description" content="의료 전문가를 위한 무료 Med-Bio 논문 요약 서비스. 매일 업데이트되는 심혈관, 내분비, 노화, 당뇨 분야 최신 연구.">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  
  <!-- Google AdSense -->
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}" crossorigin="anonymous"></script>
  
  <!-- WebGPU LLM -->
  <script type="module" src="/static/webgpu-llm.js"></script>
  <script src="/static/ai-chat.js" defer></script>
  
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
    .quote-mark { font-family: Georgia, serif; font-size: 4rem; line-height: 1; opacity: 0.15; }
    .ad-container { min-height: 90px; background: #f9f3ea; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
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
            <div class="flex items-center space-x-4">
              <span class="text-sm font-medium text-navy-800">${user.nickname}님</span>
              <button onclick="logout()" class="px-4 py-2 text-sm font-medium text-primary-700 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition">로그아웃</button>
            </div>
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
              <i class="fas fa-unlock text-sage-600 text-lg"></i>
            </div>
            <div>
              <div class="text-2xl font-serif font-semibold text-navy-800">무료</div>
              <div class="text-sm text-sage-600">전체 공개</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Ad Banner (Top) -->
  <div class="max-w-6xl mx-auto px-6 py-4">
    <div class="ad-container">
      <ins class="adsbygoogle"
           style="display:block"
           data-ad-client="${adsenseId}"
           data-ad-slot="1234567890"
           data-ad-format="horizontal"
           data-full-width-responsive="true"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </div>
  </div>

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
      <p class="text-sage-600">전문가가 엄선한 Med-Bio 논문 요약 · 100% 무료</p>
    </div>
    
    <div id="articles-container" class="grid gap-6">
      <div class="text-center py-16">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-100 flex items-center justify-center">
          <i class="fas fa-spinner fa-spin text-2xl text-primary-600"></i>
        </div>
        <p class="text-navy-700/60 font-medium">논문 요약을 불러오는 중...</p>
      </div>
    </div>
    
    <!-- Ad Banner (In-feed) -->
    <div class="my-8">
      <div class="ad-container">
        <ins class="adsbygoogle"
             style="display:block"
             data-ad-client="${adsenseId}"
             data-ad-slot="0987654321"
             data-ad-format="fluid"
             data-ad-layout-key="-6t+ed+2i-1n-4w"></ins>
        <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
      </div>
    </div>
  </main>

  <!-- Newsletter CTA -->
  <!-- Newsletter CTA -->
  <section class="relative overflow-hidden py-16 md:py-20">
    <div class="absolute inset-0 warm-gradient opacity-95"></div>
    <div class="absolute top-0 left-1/4 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
    
    <div class="relative max-w-4xl mx-auto px-6 text-center">
      <div class="inline-flex items-center px-4 py-2 bg-white/20 rounded-full text-white text-sm font-medium mb-6">
        <i class="fas fa-envelope mr-2"></i>뉴스레터 구독
      </div>
      <h3 class="font-serif text-3xl md:text-4xl font-semibold text-white mb-4">매일 아침, 논문 인사이트를 받아보세요</h3>
      <p class="text-white/80 text-lg mb-8">이메일을 입력하고 최신 Med-Bio 논문 요약을 무료로 받아보세요.</p>
      
      <div id="newsletter-form-container">
        <form onsubmit="handleNewsletterSubscribe(event)" class="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
          <input type="email" id="newsletter-email" required 
            class="flex-1 px-5 py-4 rounded-xl text-navy-800 placeholder-navy-400 focus:outline-none focus:ring-2 focus:ring-white/50" 
            placeholder="your@email.com">
          <button type="submit" class="px-8 py-4 bg-white text-primary-700 hover:bg-cream-100 rounded-xl font-semibold shadow-lg transition whitespace-nowrap">
            <i class="fas fa-paper-plane mr-2"></i>구독하기
          </button>
        </form>
        <p class="text-white/60 text-sm mt-4">
          <i class="fas fa-shield-alt mr-1"></i>스팸 없음 · 언제든 구독 취소 가능
        </p>
      </div>
      <div id="newsletter-success" class="hidden">
        <div class="inline-flex items-center px-6 py-4 bg-white/20 rounded-xl">
          <i class="fas fa-check-circle text-2xl text-green-300 mr-3"></i>
          <div class="text-left">
            <p class="text-white font-semibold">구독 완료!</p>
            <p class="text-white/80 text-sm">매일 아침 논문 인사이트가 도착합니다.</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Footer with Ad -->
  <footer class="bg-navy-800 text-white py-12">
    <div class="max-w-6xl mx-auto px-6">
      <!-- Footer Ad -->
      <div class="mb-8">
        <div class="ad-container" style="background: rgba(255,255,255,0.05);">
          <ins class="adsbygoogle"
               style="display:block"
               data-ad-client="${adsenseId}"
               data-ad-slot="1122334455"
               data-ad-format="horizontal"
               data-full-width-responsive="true"></ins>
          <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
        </div>
      </div>
      
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
          <p class="mt-1">의료 전문가를 위한 무료 논문 인사이트 서비스</p>
        </div>
      </div>
    </div>
  </footer>

  <!-- Auth Modal -->
  <div id="auth-modal" class="fixed inset-0 bg-navy-900/60 backdrop-blur-sm hidden items-center justify-center z-50 p-4">
    <div class="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
      <div id="auth-modal-content"></div>
    </div>
  </div>

  <!-- Article Modal -->
  <div id="article-modal" class="fixed inset-0 bg-navy-900/60 backdrop-blur-sm hidden items-center justify-center z-50 p-4">
    <div class="bg-cream-100 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-primary-200/30">
      <div id="article-modal-content"></div>
    </div>
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
            <div class="text-center py-16">
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
              <span class="text-primary-600 text-sm font-medium flex items-center">
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
        const article = data.article;
        
        content.innerHTML = \`
          <div class="relative">
            <button onclick="closeModal()" class="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white/80 hover:text-white transition z-10">
              <i class="fas fa-times"></i>
            </button>
            
            <div class="warm-gradient text-white p-8 rounded-t-2xl">
              <div class="flex items-center space-x-3 mb-4">
                <span class="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-sm">무료</span>
                <span class="text-sm text-white/80">\${article.journal}</span>
              </div>
              <h2 class="font-serif text-2xl font-semibold mb-4 leading-relaxed">\${article.title}</h2>
              <div class="flex flex-wrap items-center gap-4 text-sm text-white/70">
                <span class="flex items-center"><i class="fas fa-tag mr-2"></i>\${article.topic}</span>
                <span class="flex items-center"><i class="fas fa-calendar mr-2"></i>\${article.published_at}</span>
                \${article.doi ? \`<span class="flex items-center"><i class="fas fa-external-link-alt mr-2"></i>DOI: \${article.doi}</span>\` : ''}
              </div>
            </div>
            
            <!-- In-Article Ad -->
            <div class="p-4 bg-cream-200">
              <div class="ad-container">
                <ins class="adsbygoogle"
                     style="display:block"
                     data-ad-client="${adsenseId}"
                     data-ad-slot="5566778899"
                     data-ad-format="fluid"></ins>
                <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
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
              
              <!-- AI Chat (Free for all!) -->
              <section class="border-t border-primary-100 pt-8">
                <h3 class="font-serif text-lg font-semibold text-navy-800 mb-4 flex items-center">
                  <span class="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center mr-3">
                    <i class="fas fa-robot text-purple-600"></i>
                  </span>
                  AI에게 질문하기
                  <span class="ml-3 px-2.5 py-1 bg-sage-100 text-sage-700 text-xs font-semibold rounded-full">무료</span>
                  <span class="ml-2 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">WebGPU</span>
                </h3>
                
                <!-- WebGPU 로딩 시간 안내 -->
                <div class="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div class="flex items-start space-x-3">
                    <div class="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <i class="fas fa-clock text-amber-600"></i>
                    </div>
                    <div>
                      <p class="text-sm font-medium text-amber-800 mb-1">첫 사용 시 AI 모델 로딩 안내</p>
                      <ul class="text-xs text-amber-700 space-y-1">
                        <li class="flex items-center"><i class="fas fa-download mr-2 w-4"></i>첫 로딩: 약 <strong>1-3분</strong> 소요 (모델 다운로드 ~400MB)</li>
                        <li class="flex items-center"><i class="fas fa-hdd mr-2 w-4"></i>이후 사용: 브라우저 캐시로 <strong>10-30초</strong> 내 로딩</li>
                        <li class="flex items-center"><i class="fas fa-wifi mr-2 w-4"></i>네트워크 속도에 따라 시간이 달라질 수 있습니다</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div class="p-6 bg-gradient-to-br from-purple-50 via-cream-100 to-blue-50 rounded-xl border border-purple-100">
                  <div class="flex items-center justify-between mb-4">
                    <p class="text-sm text-navy-700/70">이 논문에 대해 궁금한 점을 물어보세요.</p>
                    <div class="flex items-center space-x-3 text-xs">
                      <span class="flex items-center text-sage-600 bg-white px-2.5 py-1 rounded-full shadow-sm">
                        <i class="fas fa-shield-alt text-emerald-500 mr-1.5"></i>100% 로컬
                      </span>
                    </div>
                  </div>
                  
                  <div class="flex flex-wrap gap-2 mb-4">
                    <button onclick="setQuestion('이 연구의 주요 한계점은 무엇인가요?')" class="px-4 py-2 bg-white hover:bg-purple-50 text-navy-700 text-xs rounded-full border border-purple-200 hover:border-purple-300 transition shadow-sm">
                      <i class="fas fa-exclamation-triangle mr-1.5 text-amber-500"></i>한계점
                    </button>
                    <button onclick="setQuestion('NNT(Number Needed to Treat)가 어떻게 되나요?')" class="px-4 py-2 bg-white hover:bg-purple-50 text-navy-700 text-xs rounded-full border border-purple-200 hover:border-purple-300 transition shadow-sm">
                      <i class="fas fa-calculator mr-1.5 text-blue-500"></i>NNT
                    </button>
                    <button onclick="setQuestion('실제 임상에서 어떻게 적용할 수 있나요?')" class="px-4 py-2 bg-white hover:bg-purple-50 text-navy-700 text-xs rounded-full border border-purple-200 hover:border-purple-300 transition shadow-sm">
                      <i class="fas fa-stethoscope mr-1.5 text-rose-500"></i>임상 적용
                    </button>
                  </div>
                  
                  <div class="flex space-x-3">
                    <input type="text" id="ai-question" 
                      class="flex-1 px-5 py-3.5 border-2 border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent bg-white text-navy-800 placeholder-navy-400" 
                      placeholder="예: 이 연구의 NNT는 어떻게 되나요?"
                      onkeypress="if(event.key === 'Enter') askAI()">
                    <button onclick="askAI()" class="px-6 py-3.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-xl transition shadow-lg hover:shadow-xl">
                      <i class="fas fa-paper-plane"></i>
                    </button>
                  </div>
                  <div id="ai-response" class="mt-4 hidden"></div>
                  
                  <div class="mt-4 pt-4 border-t border-purple-100 text-xs text-navy-700/50">
                    <div class="flex items-center justify-between">
                      <span class="flex items-center">
                        <i class="fas fa-microchip mr-2"></i>
                        Transformers.js v4 + Qwen2.5-0.5B
                      </span>
                      <span class="flex items-center text-amber-600">
                        <i class="fas fa-clock mr-1"></i>
                        첫 로딩 1-3분
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        \`;
        
        // Store article data for AI
        window.currentArticleData = article;
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

    function closeModal() {
      document.getElementById('article-modal').classList.add('hidden');
      document.getElementById('article-modal').classList.remove('flex');
    }
    
    function setQuestion(q) {
      document.getElementById('ai-question').value = q;
    }
    
    // AI Functions
    async function askAI() {
      const question = document.getElementById('ai-question')?.value;
      const responseDiv = document.getElementById('ai-response');
      
      if (!question) return;
      
      if (!window.medLLM || !window.medLLM.isReady) {
        responseDiv.classList.remove('hidden');
        responseDiv.innerHTML = \`
          <div class="p-5 bg-white rounded-xl border border-purple-100 shadow-sm">
            <div class="text-center">
              <div class="w-14 h-14 mx-auto mb-4 rounded-full bg-purple-100 flex items-center justify-center">
                <i class="fas fa-microchip text-2xl text-purple-500"></i>
              </div>
              <p class="text-sm text-navy-700 mb-2">AI 모델을 먼저 로딩해야 합니다.</p>
              <p class="text-xs text-amber-600 mb-4 flex items-center justify-center">
                <i class="fas fa-clock mr-1"></i>
                첫 로딩: 1-3분 | 이후: 10-30초 소요
              </p>
              <button onclick="startAIModel()" class="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-xl text-sm font-medium transition shadow-md">
                <i class="fas fa-play mr-2"></i>AI 시작하기 (무료)
              </button>
              <div class="mt-4 text-xs text-navy-700/50 space-y-1">
                <p><i class="fas fa-download mr-1"></i>모델 크기: 약 400MB (브라우저 캐시 저장)</p>
                <p><i class="fas fa-shield-alt mr-1"></i>100% 로컬 실행 - 데이터가 서버로 전송되지 않음</p>
              </div>
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
        const context = window.currentArticleData ? {
          title: window.currentArticleData.title,
          journal: window.currentArticleData.journal,
          keyMessages: window.currentArticleData.key_messages,
          clinicalInsight: window.currentArticleData.clinical_insight
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
                <button onclick="askAI()" class="mt-3 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-medium transition">다시 시도</button>
              </div>
            </div>
          </div>
        \`;
      }
    }
    
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
      
      window.medLLM.on('onProgress', function(data) {
        var status = document.getElementById('ai-load-status');
        var progress = document.getElementById('ai-load-progress');
        if (status) status.textContent = data.message;
        if (progress) progress.style.width = data.percent + '%';
      });
      
      window.medLLM.on('onReady', function(info) {
        document.getElementById('ai-response').innerHTML = \`
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
        document.getElementById('ai-response').innerHTML = \`
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
  console.log('MedDigest Cron Started:', new Date().toISOString());
  let saved = 0;
  
  // 1. Fetch and save new articles from PubMed
  for (const [, topic] of Object.entries(CRON_TOPICS)) {
    const term = topic.searchTerms[Math.floor(Math.random() * topic.searchTerms.length)];
    const articles = await searchPubMedForCron(term);
    
    for (const article of articles) {
      const exists = await env.DB.prepare('SELECT id FROM articles WHERE pmid = ?').bind(article.pmid).first();
      if (exists) continue;
      
      const slug = generateCronSlug(article.title);
      const tier = 'basic'; // All free now
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
      } catch (e) {
        console.error('DB error:', e);
      }
    }
  }
  
  console.log(`Articles saved: ${saved}`);
  
  // 2. Send daily newsletter if Resend API key is configured
  let newsletterSent = 0;
  if (env.RESEND_API_KEY) {
    try {
      // Get today's articles for newsletter
      const todayArticles = await env.DB.prepare(`
        SELECT * FROM articles 
        WHERE published_at >= date('now', '-1 day')
        ORDER BY published_at DESC
        LIMIT 5
      `).all();
      
      if (todayArticles.results.length > 0) {
        const parsedArticles = todayArticles.results.map((a: any) => ({
          ...a,
          key_messages: JSON.parse(a.key_messages)
        }));
        
        // Get active subscribers
        const subscribers = await env.DB.prepare(
          'SELECT id, email FROM subscribers WHERE status = ?'
        ).bind('active').all();
        
        console.log(`Sending newsletter to ${subscribers.results.length} subscribers...`);
        
        for (const sub of subscribers.results as { id: number, email: string }[]) {
          const unsubscribeUrl = `https://meddigest.io/api/newsletter/unsubscribe?email=${encodeURIComponent(sub.email)}`;
          const html = generateNewsletterHTML(parsedArticles, unsubscribeUrl);
          
          try {
            await sendEmail(env.RESEND_API_KEY, {
              to: sub.email,
              subject: `📚 MedDigest Daily - ${new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}`,
              html
            });
            newsletterSent++;
            
            await env.DB.prepare(
              'UPDATE subscribers SET last_email_sent_at = CURRENT_TIMESTAMP, emails_sent = emails_sent + 1 WHERE id = ?'
            ).bind(sub.id).run();
          } catch (e) {
            console.error(`Newsletter failed for ${sub.email}:`, e);
          }
          
          // Rate limiting
          await new Promise(r => setTimeout(r, 100));
        }
        
        // Log newsletter send
        await env.DB.prepare(`
          INSERT INTO newsletter_logs (subject, total_recipients, successful, failed, article_ids)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
          `Daily - ${new Date().toISOString().split('T')[0]}`,
          subscribers.results.length,
          newsletterSent,
          subscribers.results.length - newsletterSent,
          JSON.stringify(parsedArticles.map((a: any) => a.id))
        ).run();
      }
    } catch (e) {
      console.error('Newsletter send error:', e);
    }
  }
  
  console.log(`Cron Completed: ${saved} articles, ${newsletterSent} emails sent`);
  return { saved, newsletterSent };
}

app.post('/api/cron/trigger', async (c) => {
  const auth = c.req.header('Authorization');
  const secret = c.env.CRON_SECRET || 'dev-secret';
  
  if (auth !== `Bearer ${secret}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const result = await handleCronJob(c.env);
  return c.json(result);
});

export default {
  fetch: app.fetch,
  scheduled: async (event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) => {
    ctx.waitUntil(handleCronJob(env));
  }
}
