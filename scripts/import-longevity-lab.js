/**
 * MedDigest Content Importer
 * longevity-lab.io API에서 논문 데이터 가져와서 MedDigest 형식으로 변환
 */

import fs from 'fs';
import path from 'path';

const LONGEVITY_LAB_API = 'https://longevity-lab.io/api/articles';

// 주제 매핑 (키워드 기반)
const TOPIC_KEYWORDS = {
  '심혈관': ['heart', 'cardiac', 'cardiovascular', '심장', '심혈관', '혈압', 'hypertension', 'stroke', 'artery'],
  '내분비': ['hormone', 'thyroid', 'GLP-1', 'insulin', '호르몬', '내분비', 'metabolic', 'obesity', '비만'],
  '노화': ['aging', 'longevity', 'senescent', 'senolytic', '노화', '세놀리틱', '미토콘드리아', 'mitochondria', 'NAD', 'healthspan'],
  '당뇨': ['diabetes', 'glucose', 'glycemic', '당뇨', '혈당', 'insulin', 'HbA1c']
};

/**
 * 텍스트 기반으로 주제 분류
 */
function classifyTopic(title, summary) {
  const text = `${title} ${summary}`.toLowerCase();
  
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return topic;
      }
    }
  }
  
  // 기본값: 노화 (longevity-lab 특성상)
  return '노화';
}

/**
 * 슬러그 생성 (고유성 보장)
 */
const usedSlugs = new Set();

function generateSlug(originalSlug, title, index) {
  // 기본 슬러그 생성
  let baseSlug;
  if (originalSlug && !originalSlug.includes('/')) {
    baseSlug = `ll-${originalSlug}`;
  } else {
    const words = title.toLowerCase()
      .replace(/[^a-z0-9가-힣\s]/g, '')
      .split(/\s+/)
      .slice(0, 4)
      .join('-');
    baseSlug = `ll-${words}`;
  }
  
  // 고유성 보장
  let slug = baseSlug;
  let counter = 1;
  while (usedSlugs.has(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  usedSlugs.add(slug);
  return slug;
}

/**
 * Key messages 추출 (요약에서 문장 분리)
 */
function extractKeyMessages(summary) {
  // 문장 분리
  const sentences = summary
    .split(/[.!?]\s+/)
    .filter(s => s.length > 20 && s.length < 100)
    .slice(0, 3);
  
  if (sentences.length < 3) {
    // 문장이 부족하면 요약을 3등분
    const chunkSize = Math.floor(summary.length / 3);
    return [
      summary.slice(0, chunkSize).trim(),
      summary.slice(chunkSize, chunkSize * 2).trim(),
      summary.slice(chunkSize * 2).trim()
    ].map(s => s.slice(0, 80));
  }
  
  return sentences.map(s => s.trim().slice(0, 80));
}

/**
 * longevity-lab.io API에서 데이터 가져오기
 */
async function fetchLongevityLabArticles() {
  console.log('📡 Fetching articles from longevity-lab.io...');
  
  const response = await fetch(LONGEVITY_LAB_API);
  const data = await response.json();
  
  console.log(`✅ Found ${data.count} articles`);
  
  return data.articles;
}

/**
 * MedDigest 형식으로 변환
 */
function transformArticle(article, index) {
  const topic = classifyTopic(article.korean_title, article.korean_summary);
  const keyMessages = extractKeyMessages(article.korean_summary);
  
  // tier 결정 (confidence_score 기반 또는 랜덤)
  const tier = article.confidence_score >= 0.95 ? 'pro' : 'basic';
  
  return {
    slug: generateSlug(article.slug, article.korean_title),
    title: article.korean_title,
    original_title: article.korean_title, // 원본이 이미 한국어
    journal: article.journal || 'Research Paper',
    doi: article.doi,
    topic: topic,
    tier: tier,
    key_messages: JSON.stringify(keyMessages),
    study_n: null, // API에서 제공 안 함
    study_endpoint: null,
    study_limitations: '원본 연구 참조 필요',
    clinical_insight: article.korean_summary.slice(0, 200),
    published_at: article.created_at ? article.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
    source: article.source,
    confidence_score: article.confidence_score
  };
}

/**
 * SQL INSERT 문 생성
 */
function generateSQL(articles) {
  return articles.map(article => {
    const escapeSql = (str) => str ? str.replace(/'/g, "''") : '';
    
    return `INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES ('${escapeSql(article.slug)}', '${escapeSql(article.title)}', '${escapeSql(article.original_title)}', '${escapeSql(article.journal)}', ${article.doi ? `'${escapeSql(article.doi)}'` : 'NULL'}, '${article.topic}', '${article.tier}', '${escapeSql(article.key_messages)}', ${article.study_n || 'NULL'}, ${article.study_endpoint ? `'${escapeSql(article.study_endpoint)}'` : 'NULL'}, ${article.study_limitations ? `'${escapeSql(article.study_limitations)}'` : 'NULL'}, '${escapeSql(article.clinical_insight)}', '${article.published_at}');`;
  }).join('\n\n');
}

/**
 * 주제별 통계 출력
 */
function printStats(articles) {
  const stats = {};
  
  for (const article of articles) {
    stats[article.topic] = (stats[article.topic] || 0) + 1;
  }
  
  console.log('\n📊 Topic Distribution:');
  for (const [topic, count] of Object.entries(stats)) {
    console.log(`   ${topic}: ${count} articles`);
  }
}

// ============ 메인 실행 ============

async function main() {
  console.log('🔬 MedDigest Content Importer');
  console.log('==============================');
  console.log('Source: longevity-lab.io\n');
  
  try {
    // 1. API에서 데이터 가져오기
    const rawArticles = await fetchLongevityLabArticles();
    
    // 2. digest 타입 제외 (내부 뉴스레터)
    const filteredArticles = rawArticles.filter(a => 
      a.source !== 'internal_digest' && 
      a.korean_title && 
      a.korean_summary
    );
    
    console.log(`📝 Processing ${filteredArticles.length} articles (excluding digests)...`);
    
    // 3. MedDigest 형식으로 변환
    const transformedArticles = filteredArticles.map((a, i) => transformArticle(a, i));
    
    // 4. 통계 출력
    printStats(transformedArticles);
    
    // 5. SQL 생성
    const sql = generateSQL(transformedArticles);
    
    // 6. 파일 저장
    const timestamp = Date.now();
    const sqlPath = path.join(process.cwd(), `longevity-lab-import-${timestamp}.sql`);
    const jsonPath = path.join(process.cwd(), `longevity-lab-import-${timestamp}.json`);
    
    fs.writeFileSync(sqlPath, sql);
    fs.writeFileSync(jsonPath, JSON.stringify(transformedArticles, null, 2));
    
    console.log(`\n💾 SQL saved to: ${sqlPath}`);
    console.log(`💾 JSON saved to: ${jsonPath}`);
    
    // 7. 샘플 출력
    console.log('\n' + '='.repeat(60));
    console.log('📋 Sample Articles (first 5):');
    console.log('='.repeat(60));
    
    for (const article of transformedArticles.slice(0, 5)) {
      console.log(`\n📰 ${article.title.slice(0, 50)}...`);
      console.log(`   Topic: ${article.topic} | Tier: ${article.tier}`);
      console.log(`   Journal: ${article.journal}`);
    }
    
    console.log(`\n🎉 Total: ${transformedArticles.length} articles imported!`);
    
    return { articles: transformedArticles, sqlPath, jsonPath };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// 실행
main().catch(console.error);
