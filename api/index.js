const { Hono } = require('hono');
const { handle } = require('hono/vercel');
const { cors } = require('hono/cors');
const { getCookie, setCookie, deleteCookie } = require('hono/cookie');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const app = new Hono().basePath('/api');

// CORS
app.use('/*', cors());

// Health check
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    app: 'MedDigest', 
    platform: 'Vercel',
    db: supabase ? 'connected' : 'not configured',
    timestamp: new Date().toISOString() 
  });
});

// Articles
app.get('/articles', async (c) => {
  if (!supabase) {
    return c.json({
      articles: [
        {
          id: 1, slug: 'sample-1', title: 'SGLT2 억제제가 심부전 입원을 35% 감소',
          journal: 'NEJM', topic: '심혈관', tier: 'basic',
          key_messages: ['심부전 입원 35% 감소', 'eGFR 감소 속도 40% 둔화'],
          published_at: new Date().toISOString().split('T')[0]
        },
        {
          id: 2, slug: 'sample-2', title: 'GLP-1 수용체 작용제의 체중 감량 효과',
          journal: 'Lancet', topic: '내분비', tier: 'basic',
          key_messages: ['평균 15% 체중 감량', '심혈관 위험 감소'],
          published_at: new Date().toISOString().split('T')[0]
        }
      ]
    });
  }
  
  try {
    const topic = c.req.query('topic');
    let query = supabase
      .from('articles')
      .select('id, slug, title, journal, topic, tier, key_messages, published_at')
      .order('published_at', { ascending: false })
      .limit(20);
    
    if (topic) query = query.eq('topic', topic);
    const { data: articles } = await query;
    return c.json({ articles: articles || [] });
  } catch (e) {
    return c.json({ articles: [] });
  }
});

app.get('/articles/:slug', async (c) => {
  const slug = c.req.param('slug');
  
  if (!supabase) {
    return c.json({
      article: {
        id: 1, slug, title: 'Sample Article', journal: 'NEJM', topic: '심혈관',
        key_messages: ['Key point 1', 'Key point 2'],
        clinical_insight: 'Clinical insight here.',
        published_at: new Date().toISOString().split('T')[0]
      }
    });
  }
  
  try {
    const { data: article } = await supabase
      .from('articles')
      .select('*')
      .eq('slug', slug)
      .single();
    
    if (!article) return c.json({ error: 'Not found' }, 404);
    return c.json({ article });
  } catch (e) {
    return c.json({ error: 'Failed' }, 500);
  }
});

// Newsletter
app.post('/newsletter/subscribe', async (c) => {
  const { email } = await c.req.json();
  if (!email) return c.json({ error: '이메일을 입력해주세요.' }, 400);
  
  if (!supabase) return c.json({ success: true, message: '구독 완료! (Demo)' });
  
  try {
    await supabase.from('subscribers').upsert({ 
      email: email.toLowerCase(), status: 'active' 
    }, { onConflict: 'email' });
    return c.json({ success: true, message: '뉴스레터 구독이 완료되었습니다!' });
  } catch (e) {
    return c.json({ error: '구독 중 오류가 발생했습니다.' }, 500);
  }
});

module.exports = handle(app);
