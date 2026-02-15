const { Hono } = require('hono');
const { handle } = require('hono/vercel');
const { cors } = require('hono/cors');
const { getCookie, setCookie, deleteCookie } = require('hono/cookie');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const app = new Hono().basePath('/api');

// CORS
app.use('/*', cors());

// ── Demo data (used when Supabase is not configured) ──
const DEMO_ARTICLES = [
  {
    id: 1, slug: 'sglt2-heart-failure-2026',
    title: 'SGLT2 억제제가 심부전 입원을 35% 감소시킨 대규모 연구',
    original_title: 'Effect of SGLT2 Inhibitors on Heart Failure Hospitalization',
    journal: 'New England Journal of Medicine', doi: '10.1056/NEJMoa2026001',
    topic: '심혈관', tier: 'basic', study_n: 12500,
    study_endpoint: 'Primary: Heart failure hospitalization + CV death',
    study_limitations: '3-year follow-up needed, 15% Asian representation',
    key_messages: [
      'SGLT2 억제제가 심부전 입원율을 35% 감소시켰다 (HR 0.65, P<0.001)',
      'eGFR 감소 속도가 40% 둔화되었으며, 신장 보호 효과가 확인됨',
      '심혈관 사망률이 20% 감소 — 기존 표준 치료 대비 추가적 이점'
    ],
    clinical_insight: 'HFrEF 및 HFpEF 환자 모두에서 SGLT2 억제제 사용을 적극 고려해야 합니다. 당뇨 유무와 관계없이 심부전 위험 감소 효과가 확인되었으며, 특히 입원 감소 효과가 두드러집니다. 1차 진료에서도 조기 도입이 권장됩니다.',
    published_at: '2026-02-15'
  },
  {
    id: 2, slug: 'glp1-weight-loss-2026',
    title: 'GLP-1 수용체 작용제의 체중 감량 효과: 15% 평균 감량 달성',
    original_title: 'GLP-1 Receptor Agonists for Weight Management: A Meta-Analysis',
    journal: 'The Lancet', doi: '10.1016/S0140-6736(26)00123',
    topic: '내분비', tier: 'basic', study_n: 8400,
    study_endpoint: 'Primary: Percent body weight change at 68 weeks',
    study_limitations: 'High cost limits accessibility, GI side effects common',
    key_messages: [
      '평균 15.2% 체중 감량 달성 (위약 대비 12.4% 차이, P<0.001)',
      '심혈관 위험 인자(혈압, LDL, HbA1c) 동시 개선 확인',
      '오심·구토 등 위장관 부작용이 30%에서 발생하나 대부분 경증'
    ],
    clinical_insight: 'BMI 30 이상 또는 BMI 27 이상 + 대사 합병증 환자에서 GLP-1 RA를 1차 약물 요법으로 고려할 수 있습니다. 생활습관 개선과 병행 시 효과가 극대화되며, 장기 유지 전략이 중요합니다.',
    published_at: '2026-02-14'
  },
  {
    id: 3, slug: 'tirzepatide-diabetes-2026',
    title: 'Tirzepatide vs Semaglutide: 당화혈색소 2.4% 감소, 체중 21% 감량',
    original_title: 'Tirzepatide vs Semaglutide Head-to-Head Trial',
    journal: 'New England Journal of Medicine', doi: '10.1056/NEJMoa2026002',
    topic: '내분비', tier: 'pro', study_n: 3200,
    study_endpoint: 'Primary: HbA1c change and body weight change at 72 weeks',
    study_limitations: 'Open-label design, mostly Caucasian population',
    key_messages: [
      'Tirzepatide가 semaglutide 대비 HbA1c 0.5% 추가 감소 (2.4% vs 1.9%, P<0.001)',
      '체중 감소도 6% 더 우수 (21.1% vs 15.0%, P<0.001)',
      '두 약제 모두 위장관 부작용이 흔했으나 내약성은 유사'
    ],
    clinical_insight: '비만 동반 2형 당뇨에서 tirzepatide가 혈당 조절과 체중 감량 모두에서 우수한 효과를 보여줍니다. GIP+GLP-1 이중 수용체 작용 기전이 차별적 이점을 제공합니다.',
    published_at: '2026-02-13'
  },
  {
    id: 4, slug: 'metformin-tame-aging-2026',
    title: 'TAME 시험: 메트포르민이 노화 관련 질환 발생 21% 감소',
    original_title: 'TAME Trial: Targeting Aging with Metformin',
    journal: 'Nature Medicine', doi: '10.1038/s41591-026-0001',
    topic: '노화', tier: 'pro', study_n: 3000,
    study_endpoint: 'Primary: Composite of cancer, CVD, dementia, and mortality',
    study_limitations: 'Observational component, GI side effects, vitamin B12 monitoring needed',
    key_messages: [
      '비당뇨 65-79세에서 메트포르민이 암·심혈관질환·치매·사망 복합 결과를 21% 감소 (HR 0.79, P<0.001)',
      '염증 마커 감소 및 인슐린 감수성 개선이 주요 기전으로 추정',
      '위장관 부작용 외 심각한 이상반응은 드물었다'
    ],
    clinical_insight: '노화 관련 질환 예방을 위한 메트포르민 재목적화의 과학적 근거가 마련되었습니다. 향후 항노화 의학의 방향성을 제시하는 획기적 연구입니다.',
    published_at: '2026-02-12'
  },
  {
    id: 5, slug: 'senolytics-ipf-2026',
    title: '노화세포 제거 치료제(Senolytic)가 폐섬유증 환자의 운동능력 개선',
    original_title: 'Senolytics in Idiopathic Pulmonary Fibrosis: Phase 2 Trial',
    journal: 'Lancet Respiratory Medicine', doi: '10.1016/S2213-2600(26)00045',
    topic: '노화', tier: 'basic', study_n: 120,
    study_endpoint: 'Primary: 6-minute walk distance change at 24 weeks',
    study_limitations: 'Small sample size, short follow-up, single-center',
    key_messages: [
      'Dasatinib+Quercetin 간헐 투여가 IPF 환자의 6분 보행 거리를 35m 증가 (P=0.008)',
      'FVC 감소 속도가 둔화되고 노화세포 마커(p16INK4a)가 40% 감소',
      '부작용은 관리 가능한 수준으로 안전성 프로파일 양호'
    ],
    clinical_insight: '노화세포 타겟 치료가 IPF에서 새로운 치료 가능성을 제시합니다. 아직 초기 단계이나 기전적 타당성이 입증되어 향후 대규모 시험이 기대됩니다.',
    published_at: '2026-02-11'
  },
  {
    id: 6, slug: 'cgm-type2-diabetes-2026',
    title: '연속혈당측정(CGM)이 2형 당뇨 환자의 혈당 조절 획기적 개선',
    original_title: 'Continuous Glucose Monitoring in Type 2 Diabetes Management',
    journal: 'JAMA', doi: '10.1001/jama.2026.1234',
    topic: '당뇨', tier: 'basic', study_n: 800,
    study_endpoint: 'Primary: HbA1c change and time in range at 6 months',
    study_limitations: 'Unblinded design, Hawthorne effect possible',
    key_messages: [
      '기저 인슐린 사용 2형 당뇨 환자에서 CGM이 HbA1c 0.5% 추가 감소',
      '목표 범위 내 시간(TIR)이 59%에서 73%로 14%p 개선',
      '저혈당 사건이 50% 감소하여 안전성도 향상'
    ],
    clinical_insight: '인슐린 사용 2형 당뇨 환자에서 CGM 적용을 적극 권장합니다. 실시간 혈당 피드백이 자기관리 행동 변화를 촉진하고, 저혈당 위험을 현저히 줄여줍니다.',
    published_at: '2026-02-10'
  },
  {
    id: 7, slug: 'stem-cell-islet-t1d-2026',
    title: '줄기세포 유래 췌도 이식으로 1형 당뇨 환자 65%가 인슐린 독립 달성',
    original_title: 'Stem Cell-Derived Islet Transplantation for Type 1 Diabetes',
    journal: 'New England Journal of Medicine', doi: '10.1056/NEJMoa2026003',
    topic: '당뇨', tier: 'pro', study_n: 40,
    study_endpoint: 'Primary: Insulin independence at 12 months',
    study_limitations: 'Very small sample, single-arm design, long-term durability unknown',
    key_messages: [
      '캡슐화된 줄기세포 유래 췌도 이식 후 12개월에 65%가 인슐린 비의존 상태 달성',
      '면역억제제 없이 C-펩타이드 분비가 88%에서 검출됨',
      '중증 저혈당이 연간 6.2회에서 0.3회로 급감'
    ],
    clinical_insight: '1형 당뇨의 근본적 치료 가능성을 제시하는 획기적 연구입니다. 면역억제 없는 캡슐화 기술이 핵심이며, 향후 대규모 검증이 필요합니다.',
    published_at: '2026-02-09'
  },
  {
    id: 8, slug: 'colchicine-cv-prevention-2026',
    title: '저용량 콜히친이 관상동맥질환 2차 예방에서 심혈관 사건 23% 감소',
    original_title: 'Low-dose Colchicine in Secondary Cardiovascular Prevention',
    journal: 'The Lancet', doi: '10.1016/S0140-6736(26)00456',
    topic: '심혈관', tier: 'pro', study_n: 7500,
    study_endpoint: 'Primary: MACE (CV death, MI, stroke)',
    study_limitations: 'GI intolerance in 8%, drug interactions with statins',
    key_messages: [
      '콜히친 0.5mg/일이 안정형 관상동맥질환 환자에서 MACE를 23% 감소 (HR 0.77, P<0.001)',
      '항염증 기전으로 잔여 심혈관 위험을 감소시키는 새로운 접근법',
      '오심이 다소 증가했으나 심각한 이상반응 발생률은 유사'
    ],
    clinical_insight: '최적의 약물 치료에도 잔여 위험이 있는 관상동맥질환 환자에게 저용량 콜히친 추가를 고려할 수 있습니다. 저렴하고 접근성이 높은 항염증 전략입니다.',
    published_at: '2026-02-08'
  }
];

function getDemoArticle(slug) {
  return DEMO_ARTICLES.find(a => a.slug === slug) || DEMO_ARTICLES[0];
}

// ── Health check ──
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    app: 'MedDigest',
    platform: 'Vercel',
    features: ['WebGPU AI Chat', 'Medical Paper Insights'],
    db: supabase ? 'connected' : 'demo-mode',
    timestamp: new Date().toISOString()
  });
});

// ── Auth ──
function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

app.post('/auth/signup', async (c) => {
  const { email, password, nickname } = await c.req.json();
  if (!email || !password || !nickname) return c.json({ error: '모든 필드를 입력해주세요.' }, 400);
  if (password.length < 6) return c.json({ error: '비밀번호는 6자 이상이어야 합니다.' }, 400);

  if (!supabase) return c.json({ success: true, user: { email, nickname } });

  try {
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    const { data: user, error } = await supabase.from('users').insert({
      email: email.toLowerCase(),
      password_hash: salt + ':' + passwordHash,
      nickname
    }).select('id, email, nickname').single();

    if (error) {
      if (error.code === '23505') return c.json({ error: '이미 등록된 이메일입니다.' }, 409);
      return c.json({ error: '회원가입 실패' }, 500);
    }

    // Create session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    await supabase.from('sessions').insert({
      user_id: user.id,
      session_token: sessionToken,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });

    setCookie(c, 'session', sessionToken, { httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 30 * 24 * 60 * 60, path: '/' });
    return c.json({ success: true, user });
  } catch (e) {
    return c.json({ error: '서버 오류' }, 500);
  }
});

app.post('/auth/login', async (c) => {
  const { email, password } = await c.req.json();
  if (!email || !password) return c.json({ error: '이메일과 비밀번호를 입력해주세요.' }, 400);

  if (!supabase) return c.json({ success: true, user: { email, nickname: email.split('@')[0] } });

  try {
    const { data: user } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).single();
    if (!user) return c.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401);

    const [salt, hash] = user.password_hash.split(':');
    if (hashPassword(password, salt) !== hash) return c.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401);

    const sessionToken = crypto.randomBytes(32).toString('hex');
    await supabase.from('sessions').insert({
      user_id: user.id,
      session_token: sessionToken,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });

    setCookie(c, 'session', sessionToken, { httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 30 * 24 * 60 * 60, path: '/' });
    return c.json({ success: true, user: { id: user.id, email: user.email, nickname: user.nickname } });
  } catch (e) {
    return c.json({ error: '서버 오류' }, 500);
  }
});

app.post('/auth/logout', async (c) => {
  const token = getCookie(c, 'session');
  if (token && supabase) {
    await supabase.from('sessions').delete().eq('session_token', token);
  }
  deleteCookie(c, 'session', { path: '/' });
  return c.json({ success: true });
});

app.get('/me', async (c) => {
  const token = getCookie(c, 'session');
  if (!token) return c.json({ user: null });
  if (!supabase) return c.json({ user: null });

  try {
    const { data: session } = await supabase.from('sessions').select('user_id, expires_at').eq('session_token', token).single();
    if (!session || new Date(session.expires_at) < new Date()) return c.json({ user: null });

    const { data: user } = await supabase.from('users').select('id, email, nickname, profile_image').eq('id', session.user_id).single();
    return c.json({ user: user || null });
  } catch (e) {
    return c.json({ user: null });
  }
});

// ── Articles ──
app.get('/articles', async (c) => {
  if (!supabase) {
    const topic = c.req.query('topic');
    let articles = DEMO_ARTICLES.map(({ id, slug, title, journal, topic, tier, key_messages, published_at }) =>
      ({ id, slug, title, journal, topic, tier, key_messages, published_at })
    );
    if (topic) articles = articles.filter(a => a.topic === topic);
    return c.json({ articles });
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
    return c.json({ article: getDemoArticle(slug) });
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

// ── Newsletter ──
app.post('/newsletter/subscribe', async (c) => {
  const { email } = await c.req.json();
  if (!email) return c.json({ error: '이메일을 입력해주세요.' }, 400);

  if (!supabase) return c.json({ success: true, message: '구독 완료!' });

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
