const crypto = require('crypto');

// ── Demo data ──
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
    clinical_insight: 'HFrEF 및 HFpEF 환자 모두에서 SGLT2 억제제 사용을 적극 고려해야 합니다.',
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
    clinical_insight: 'BMI 30 이상 또는 BMI 27 이상 + 대사 합병증 환자에서 GLP-1 RA를 1차 약물 요법으로 고려할 수 있습니다.',
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
    clinical_insight: '비만 동반 2형 당뇨에서 tirzepatide가 혈당 조절과 체중 감량 모두에서 우수한 효과를 보여줍니다.',
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
    clinical_insight: '노화 관련 질환 예방을 위한 메트포르민 재목적화의 과학적 근거가 마련되었습니다.',
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
    clinical_insight: '노화세포 타겟 치료가 IPF에서 새로운 치료 가능성을 제시합니다.',
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
    clinical_insight: '인슐린 사용 2형 당뇨 환자에서 CGM 적용을 적극 권장합니다.',
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
    clinical_insight: '1형 당뇨의 근본적 치료 가능성을 제시하는 획기적 연구입니다.',
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
    clinical_insight: '최적의 약물 치료에도 잔여 위험이 있는 관상동맥질환 환자에게 저용량 콜히친 추가를 고려할 수 있습니다.',
    published_at: '2026-02-08'
  },
  {
    id: 9, slug: 'immunotherapy-nsclc-2026',
    title: '면역항암제 병용 요법이 비소세포폐암 5년 생존율을 2배로 향상',
    original_title: 'Combination Immunotherapy in NSCLC: 5-Year Overall Survival Update',
    journal: 'New England Journal of Medicine', doi: '10.1056/NEJMoa2026004',
    topic: '암', tier: 'basic', study_n: 5200,
    study_endpoint: 'Primary: 5-year overall survival rate',
    study_limitations: 'PD-L1 ≥50% subgroup enriched, limited Asian data',
    key_messages: [
      'Nivolumab+Ipilimumab 병용이 PD-L1 양성 NSCLC에서 5년 OS 24%→43% 향상 (HR 0.61, P<0.001)',
      '면역 관련 이상반응(irAE) 발생률 35%이나, 대부분 관리 가능',
      '바이오마커 기반 환자 선별이 치료 효과 극대화에 핵심'
    ],
    clinical_insight: 'PD-L1 ≥1% 비소세포폐암 환자에서 면역항암제 병용 요법을 1차 치료로 적극 고려해야 합니다. TMB, MSI 등 추가 바이오마커 검사가 치료 반응 예측에 도움됩니다.',
    published_at: '2026-02-07'
  },
  {
    id: 10, slug: 'adc-breast-cancer-2026',
    title: 'ADC(항체-약물 접합체)가 HER2-low 유방암에서 PFS 2배 연장',
    original_title: 'Trastuzumab Deruxtecan in HER2-low Metastatic Breast Cancer: Updated Results',
    journal: 'The Lancet Oncology', doi: '10.1016/S1470-2045(26)00089',
    topic: '암', tier: 'pro', study_n: 1800,
    study_endpoint: 'Primary: Progression-free survival (PFS)',
    study_limitations: 'ILD risk 12%, requires close monitoring, cost-effectiveness uncertain',
    key_messages: [
      'T-DXd가 HER2-low 전이성 유방암에서 PFS를 5.4→10.1개월로 연장 (HR 0.50, P<0.001)',
      '전체 생존율(OS)도 유의하게 개선 (23.9 vs 17.5개월, HR 0.66)',
      '간질성 폐질환(ILD) 12% 발생 — 조기 발견 및 관리 프로토콜 필수'
    ],
    clinical_insight: 'HER2-low 유방암이라는 새로운 치료 대상군을 정립한 혁신적 연구입니다. IHC 1+ 또는 2+/ISH− 환자에서 T-DXd 투여를 고려하되, ILD 모니터링이 필수적입니다.',
    published_at: '2026-02-06'
  }
];

// ── Helpers ──
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

function parseCookies(req) {
  const cookies = {};
  (req.headers.cookie || '').split(';').forEach(c => {
    const [name, ...rest] = c.trim().split('=');
    if (name) cookies[name] = decodeURIComponent(rest.join('='));
  });
  return cookies;
}

function json(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function setCookieHeader(res, name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.path) parts.push(`Path=${opts.path}`);
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  const existing = res.getHeader('Set-Cookie') || [];
  const all = Array.isArray(existing) ? existing : existing ? [existing] : [];
  all.push(parts.join('; '));
  res.setHeader('Set-Cookie', all);
}

function deleteCookieHeader(res, name) {
  setCookieHeader(res, name, '', { path: '/', maxAge: 0 });
}

function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

function getDemoArticle(slug) {
  return DEMO_ARTICLES.find(a => a.slug === slug) || DEMO_ARTICLES[0];
}

function parseUrl(req) {
  return new URL(req.url, `https://${req.headers.host || 'localhost'}`);
}

// ── Europe PMC API for automated article fetching ──
const TOPIC_QUERIES = {
  '심혈관': '(cardiovascular OR "heart failure" OR "myocardial infarction" OR hypertension)',
  '내분비': '(endocrine OR thyroid OR "hormone therapy" OR "adrenal")',
  '노화': '(aging OR "anti-aging" OR senescence OR longevity OR geroscience)',
  '당뇨': '("diabetes mellitus" OR "insulin resistance" OR "glycemic control" OR HbA1c)',
  '암': '(cancer OR oncology OR tumor OR neoplasm OR immunotherapy)'
};

async function fetchFromEuropePMC(topic, pageSize = 3) {
  const query = TOPIC_QUERIES[topic];
  if (!query) return [];

  const searchQuery = `${query} AND SRC:MED AND OPEN_ACCESS:y AND (PUB_TYPE:"research-article" OR PUB_TYPE:"review")`;
  const apiUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(searchQuery)}&resultType=core&pageSize=${pageSize}&sort=FIRST_PDATE desc&format=json`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    return (data.resultList?.result || []).map(a => formatPMCArticle(a, topic));
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

async function fetchAllTopics(specificTopic = null) {
  const topics = specificTopic ? [specificTopic] : Object.keys(TOPIC_QUERIES);
  const perTopic = specificTopic ? 5 : 2;

  const results = await Promise.all(
    topics.map(topic => fetchFromEuropePMC(topic, perTopic))
  );
  return results.flat();
}

function formatPMCArticle(article, topic) {
  const abstract = (article.abstractText || '').replace(/<[^>]*>/g, '');
  const title = (article.title || 'Untitled').replace(/<[^>]*>/g, '');

  // Extract key sentences from abstract
  const sentences = abstract
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.length > 30 && s.length < 500)
    .slice(0, 3);

  const keyMessages = sentences.length > 0
    ? sentences.map(s => s.trim())
    : [abstract.substring(0, 200) || 'Abstract not available'];

  return {
    id: parseInt(article.pmid) || Math.floor(Math.random() * 90000) + 10000,
    slug: `pubmed-${article.pmid || article.id}`,
    title: title,
    original_title: title,
    journal: article.journalTitle || '',
    doi: article.doi || '',
    topic: topic,
    tier: 'basic',
    source: 'pubmed',
    study_n: null,
    study_endpoint: '',
    study_limitations: '',
    key_messages: keyMessages,
    clinical_insight: abstract.length > 100 ? abstract.substring(0, 800) : abstract,
    published_at: article.firstPublicationDate || new Date().toISOString().split('T')[0]
  };
}

async function fetchPMCArticleByPMID(pmid) {
  const apiUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:${pmid} AND SRC:MED&resultType=core&format=json`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    const result = data.resultList?.result?.[0];
    if (!result) return null;
    return formatPMCArticle(result, '');
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

// ── Main handler ──
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const url = parseUrl(req);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  try {
    // ── /api/test ──
    if (path === '/api/test') {
      return json(res, { ok: true, time: new Date().toISOString() });
    }

    // ── /api/health ──
    if (path === '/api/health') {
      return json(res, {
        status: 'ok',
        app: 'MedDigest',
        platform: 'Vercel',
        features: ['WebGPU AI Chat', 'Medical Paper Insights'],
        db: 'demo-mode',
        timestamp: new Date().toISOString()
      });
    }

    // ── /api/auth/signup ──
    if (path === '/api/auth/signup' && req.method === 'POST') {
      const { email, password, nickname } = await parseBody(req);
      if (!email || !password || !nickname) return json(res, { error: '모든 필드를 입력해주세요.' }, 400);
      if (password.length < 6) return json(res, { error: '비밀번호는 6자 이상이어야 합니다.' }, 400);
      // Demo mode
      return json(res, { success: true, user: { email, nickname } });
    }

    // ── /api/auth/login ──
    if (path === '/api/auth/login' && req.method === 'POST') {
      const { email, password } = await parseBody(req);
      if (!email || !password) return json(res, { error: '이메일과 비밀번호를 입력해주세요.' }, 400);
      // Demo mode
      return json(res, { success: true, user: { email, nickname: email.split('@')[0] } });
    }

    // ── /api/auth/logout ──
    if (path === '/api/auth/logout' && req.method === 'POST') {
      deleteCookieHeader(res, 'session');
      return json(res, { success: true });
    }

    // ── /api/me ──
    if (path === '/api/me') {
      return json(res, { user: null });
    }

    // ── /api/articles ──
    if (path === '/api/articles' && req.method === 'GET') {
      const topic = url.searchParams.get('topic');

      // Get curated demo articles
      let demoList = DEMO_ARTICLES.map(({ id, slug, title, journal, topic, tier, key_messages, published_at }) =>
        ({ id, slug, title, journal, topic, tier, key_messages, published_at, source: 'curated' })
      );
      if (topic) demoList = demoList.filter(a => a.topic === topic);

      // Fetch latest from PubMed (Europe PMC)
      let pubmedList = [];
      try {
        pubmedList = await fetchAllTopics(topic || null);
      } catch (e) {
        console.error('PubMed fetch error:', e);
      }

      // Combine: curated first, then PubMed
      const articles = [...demoList, ...pubmedList];
      return json(res, { articles });
    }

    // ── /api/articles/:slug ──
    const articleMatch = path.match(/^\/api\/articles\/([^/]+)$/);
    if (articleMatch && req.method === 'GET') {
      const slug = decodeURIComponent(articleMatch[1]);

      // Check if it's a PubMed article
      if (slug.startsWith('pubmed-')) {
        const pmid = slug.replace('pubmed-', '');
        const article = await fetchPMCArticleByPMID(pmid);
        if (article) return json(res, { article });
        return json(res, { error: 'Article not found' }, 404);
      }

      // Otherwise look up in demo articles
      const article = getDemoArticle(slug);
      return json(res, { article });
    }

    // ── /api/newsletter/subscribe ──
    if (path === '/api/newsletter/subscribe' && req.method === 'POST') {
      const { email } = await parseBody(req);
      if (!email) return json(res, { error: '이메일을 입력해주세요.' }, 400);
      return json(res, { success: true, message: '뉴스레터 구독이 완료되었습니다!' });
    }

    // ── 404 ──
    return json(res, { error: 'Not found', path }, 404);

  } catch (err) {
    console.error('API Error:', err);
    return json(res, { error: 'Internal server error' }, 500);
  }
};
