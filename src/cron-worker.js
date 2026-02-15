/**
 * MedDigest Cron Worker
 * 매일 자동으로 새 논문을 검색하고 AI 요약을 생성하여 DB에 저장
 * 
 * Cron Schedule: 매일 오전 6시 (KST) = 21:00 UTC (전날)
 */

// 주제별 검색어 설정
const TOPICS = {
  cardiovascular: {
    koreanName: '심혈관',
    searchTerms: ['cardiovascular disease', 'heart failure', 'SGLT2 inhibitor', 'anticoagulation']
  },
  endocrine: {
    koreanName: '내분비',
    searchTerms: ['GLP-1 agonist', 'obesity treatment', 'thyroid', 'metabolic syndrome']
  },
  aging: {
    koreanName: '노화',
    searchTerms: ['aging longevity', 'senolytic', 'NAD supplement', 'healthspan']
  },
  diabetes: {
    koreanName: '당뇨',
    searchTerms: ['diabetes mellitus', 'glucose monitoring', 'insulin therapy', 'diabetic complications']
  }
};

/**
 * PubMed에서 최신 논문 검색
 */
async function searchPubMed(query, maxResults = 3) {
  const currentYear = new Date().getFullYear();
  const searchQuery = `${query} AND (${currentYear}[pdat] OR ${currentYear - 1}[pdat])`;
  
  try {
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchQuery)}&retmax=${maxResults}&sort=date&retmode=json`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    
    const pmids = searchData.esearchresult?.idlist || [];
    if (pmids.length === 0) return [];
    
    // 상세 정보 가져오기
    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=xml`;
    const fetchRes = await fetch(fetchUrl);
    const xmlText = await fetchRes.text();
    
    return parseArticlesFromXML(xmlText);
  } catch (error) {
    console.error('PubMed search error:', error);
    return [];
  }
}

/**
 * XML 파싱
 */
function parseArticlesFromXML(xml) {
  const articles = [];
  const articleBlocks = xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) || [];
  
  for (const block of articleBlocks) {
    try {
      const pmidMatch = block.match(/<PMID[^>]*>(\d+)<\/PMID>/);
      const titleMatch = block.match(/<ArticleTitle>([^<]+)<\/ArticleTitle>/);
      const journalMatch = block.match(/<Title>([^<]+)<\/Title>/);
      const abstractMatch = block.match(/<AbstractText[^>]*>([^<]+)<\/AbstractText>/g);
      const doiMatch = block.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/);
      
      let abstract = '';
      if (abstractMatch) {
        abstract = abstractMatch.map(m => m.match(/>([^<]+)</)?.[1] || '').join(' ');
      }
      
      if (pmidMatch && titleMatch && abstract.length > 100) {
        articles.push({
          pmid: pmidMatch[1],
          title: titleMatch[1],
          journal: journalMatch?.[1] || 'Unknown',
          abstract,
          doi: doiMatch?.[1] || null
        });
      }
    } catch (e) {
      // 파싱 오류 무시
    }
  }
  
  return articles;
}

/**
 * AI를 사용하여 논문 요약 생성 (Cloudflare AI 또는 외부 API)
 */
async function generateSummary(article, topicName, env) {
  const prompt = `당신은 내분비내과 전문의입니다. 다음 논문을 한국어로 요약해주세요.

제목: ${article.title}
저널: ${article.journal}
초록: ${article.abstract}

JSON 형식으로 응답:
{
  "title_ko": "한국어 제목 (30자 이내)",
  "key_messages": ["핵심1", "핵심2", "핵심3"],
  "clinical_insight": "임상 관점 해설 (150자)"
}`;

  try {
    // Cloudflare Workers AI 사용 (바인딩 필요)
    if (env.AI) {
      const response = await env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
        messages: [
          { role: 'system', content: '의료 논문 요약 전문가입니다. JSON으로만 응답합니다.' },
          { role: 'user', content: prompt }
        ]
      });
      
      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
    
    // Fallback: 기본 요약 생성
    return {
      title_ko: article.title.substring(0, 50),
      key_messages: [
        '이 연구는 ' + topicName + ' 분야의 최신 연구입니다.',
        '상세 내용은 원문을 참조해 주세요.',
        'DOI: ' + (article.doi || 'N/A')
      ],
      clinical_insight: '최신 ' + topicName + ' 연구로, 임상 적용 가능성을 검토해 볼 만합니다.'
    };
  } catch (error) {
    console.error('Summary generation error:', error);
    return null;
  }
}

/**
 * 슬러그 생성
 */
function generateSlug(title) {
  const words = title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .slice(0, 4)
    .join('-');
  return `${words}-${Date.now().toString(36)}`;
}

/**
 * DB에 논문 저장
 */
async function saveArticle(db, article, summary, topicName) {
  const slug = generateSlug(article.title);
  const tier = Math.random() > 0.5 ? 'pro' : 'basic';
  const publishedAt = new Date().toISOString().split('T')[0];
  
  try {
    await db.prepare(`
      INSERT INTO articles (slug, title, original_title, journal, doi, pmid, topic, tier, key_messages, clinical_insight, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      slug,
      summary.title_ko,
      article.title,
      article.journal,
      article.doi,
      article.pmid,
      topicName,
      tier,
      JSON.stringify(summary.key_messages),
      summary.clinical_insight,
      publishedAt
    ).run();
    
    return true;
  } catch (error) {
    console.error('DB save error:', error);
    return false;
  }
}

/**
 * 중복 체크
 */
async function isDuplicate(db, pmid) {
  const result = await db.prepare('SELECT id FROM articles WHERE pmid = ?').bind(pmid).first();
  return !!result;
}

/**
 * 메인 Cron 핸들러
 */
async function handleScheduled(env) {
  console.log('🔬 MedDigest Cron Job Started:', new Date().toISOString());
  
  const results = {
    searched: 0,
    generated: 0,
    saved: 0,
    errors: 0
  };
  
  // 각 주제별로 논문 검색 및 저장
  for (const [key, topic] of Object.entries(TOPICS)) {
    const searchTerm = topic.searchTerms[Math.floor(Math.random() * topic.searchTerms.length)];
    console.log(`📚 Searching ${topic.koreanName}: ${searchTerm}`);
    
    const articles = await searchPubMed(searchTerm, 2);
    results.searched += articles.length;
    
    for (const article of articles) {
      // 중복 체크
      if (await isDuplicate(env.DB, article.pmid)) {
        console.log(`⏭️ Skip duplicate: ${article.pmid}`);
        continue;
      }
      
      // 요약 생성
      const summary = await generateSummary(article, topic.koreanName, env);
      if (!summary) {
        results.errors++;
        continue;
      }
      results.generated++;
      
      // DB 저장
      const saved = await saveArticle(env.DB, article, summary, topic.koreanName);
      if (saved) {
        results.saved++;
        console.log(`✅ Saved: ${summary.title_ko}`);
      } else {
        results.errors++;
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('🎉 Cron Job Completed:', results);
  return results;
}

// Cloudflare Workers export
export default {
  // HTTP 요청 핸들러 (기존 Hono 앱)
  async fetch(request, env, ctx) {
    // 수동 트리거 엔드포인트
    const url = new URL(request.url);
    if (url.pathname === '/api/cron/trigger' && request.method === 'POST') {
      // 인증 체크 (선택적)
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
      }
      
      const results = await handleScheduled(env);
      return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 기존 앱으로 전달 (Hono)
    const { default: app } = await import('./index.js');
    return app.fetch(request, env, ctx);
  },
  
  // Cron 트리거 핸들러
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(env));
  }
};
