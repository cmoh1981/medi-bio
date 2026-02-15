/**
 * MedDigest Content Generator
 * PubMed API + OpenAI를 사용한 논문 콘텐츠 자동 생성
 * 
 * Usage: node scripts/content-generator.js [topic] [count]
 * Example: node scripts/content-generator.js cardiovascular 5
 */

import OpenAI from 'openai';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import os from 'os';

// ============ Configuration ============

const TOPICS = {
  cardiovascular: {
    name: '심혈관',
    searchTerms: [
      'cardiovascular disease treatment',
      'heart failure therapy',
      'SGLT2 inhibitor cardiovascular',
      'anticoagulation therapy',
      'hypertension management'
    ],
    koreanName: '심혈관'
  },
  endocrine: {
    name: '내분비',
    searchTerms: [
      'GLP-1 receptor agonist',
      'thyroid disorder treatment',
      'obesity pharmacotherapy',
      'metabolic syndrome',
      'hormonal therapy'
    ],
    koreanName: '내분비'
  },
  aging: {
    name: '노화',
    searchTerms: [
      'aging biology intervention',
      'longevity research',
      'senescence therapy',
      'anti-aging treatment',
      'geriatric medicine'
    ],
    koreanName: '노화'
  },
  diabetes: {
    name: '당뇨',
    searchTerms: [
      'diabetes mellitus treatment',
      'insulin therapy',
      'diabetic complications',
      'glucose monitoring',
      'type 2 diabetes management'
    ],
    koreanName: '당뇨'
  }
};

// OpenAI 설정 로드
function loadOpenAIConfig() {
  const configPath = path.join(os.homedir(), '.genspark_llm.yaml');
  
  if (fs.existsSync(configPath)) {
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(fileContents);
    return {
      apiKey: config?.openai?.api_key || process.env.OPENAI_API_KEY,
      baseURL: config?.openai?.base_url || process.env.OPENAI_BASE_URL
    };
  }
  
  return {
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL
  };
}

// ============ PubMed API ============

/**
 * PubMed E-utilities로 논문 검색
 */
async function searchPubMed(query, maxResults = 10) {
  const baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  
  // 최근 2년 논문만 검색
  const currentYear = new Date().getFullYear();
  const searchQuery = `${query} AND (${currentYear}[pdat] OR ${currentYear - 1}[pdat])`;
  
  try {
    // 1. ESearch - 검색하여 PMID 목록 획득
    const searchUrl = `${baseUrl}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchQuery)}&retmax=${maxResults}&sort=relevance&retmode=json`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    
    const pmids = searchData.esearchresult?.idlist || [];
    
    if (pmids.length === 0) {
      console.log(`No results for: ${query}`);
      return [];
    }
    
    // 2. EFetch - 상세 정보 획득
    const fetchUrl = `${baseUrl}/efetch.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=xml`;
    const fetchRes = await fetch(fetchUrl);
    const xmlText = await fetchRes.text();
    
    // XML 파싱 (간단한 정규식 사용)
    const articles = parseArticlesFromXML(xmlText);
    
    return articles;
  } catch (error) {
    console.error('PubMed search error:', error);
    return [];
  }
}

/**
 * PubMed XML 응답 파싱
 */
function parseArticlesFromXML(xml) {
  const articles = [];
  
  // PubmedArticle 블록 추출
  const articleBlocks = xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) || [];
  
  for (const block of articleBlocks) {
    try {
      // PMID
      const pmidMatch = block.match(/<PMID[^>]*>(\d+)<\/PMID>/);
      const pmid = pmidMatch ? pmidMatch[1] : null;
      
      // 제목
      const titleMatch = block.match(/<ArticleTitle>([^<]+)<\/ArticleTitle>/);
      const title = titleMatch ? titleMatch[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') : '';
      
      // 저널
      const journalMatch = block.match(/<Title>([^<]+)<\/Title>/);
      const journal = journalMatch ? journalMatch[1] : '';
      
      // 초록
      const abstractMatch = block.match(/<AbstractText[^>]*>([^<]+)<\/AbstractText>/g);
      let abstract = '';
      if (abstractMatch) {
        abstract = abstractMatch.map(m => {
          const textMatch = m.match(/>([^<]+)</);
          return textMatch ? textMatch[1] : '';
        }).join(' ');
      }
      
      // DOI
      const doiMatch = block.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/);
      const doi = doiMatch ? doiMatch[1] : null;
      
      // 출판 연도
      const yearMatch = block.match(/<PubDate>[\s\S]*?<Year>(\d+)<\/Year>/);
      const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
      
      // 저자
      const authorMatches = block.match(/<LastName>([^<]+)<\/LastName>/g);
      const authors = authorMatches 
        ? authorMatches.slice(0, 3).map(m => m.match(/>([^<]+)</)[1]).join(', ')
        : '';
      
      if (pmid && title && abstract.length > 100) {
        articles.push({
          pmid,
          title,
          journal,
          abstract,
          doi,
          year,
          authors
        });
      }
    } catch (e) {
      // 파싱 오류 무시
    }
  }
  
  return articles;
}

// ============ OpenAI 요약 생성 ============

/**
 * OpenAI를 사용하여 논문 요약 생성
 */
async function generateSummary(article, topic, openai) {
  const prompt = `당신은 의료 전문 저널리스트입니다. 다음 논문을 바쁜 임상의를 위해 한국어로 요약해주세요.

## 논문 정보
- 제목: ${article.title}
- 저널: ${article.journal}
- DOI: ${article.doi || 'N/A'}
- 초록: ${article.abstract}

## 요약 형식 (JSON)
다음 JSON 형식으로 응답해주세요:

{
  "title_ko": "한국어 제목 (원문 의미 유지, 30자 이내)",
  "key_messages": [
    "핵심 메시지 1 (임상적 의미 중심, 50자 이내)",
    "핵심 메시지 2 (연구 결과 요약, 50자 이내)",
    "핵심 메시지 3 (실용적 시사점, 50자 이내)"
  ],
  "study_n": 연구 참여자 수 (숫자만, 없으면 null),
  "study_endpoint": "Primary endpoint 설명 (50자 이내)",
  "study_limitations": "주요 한계점 (50자 이내)",
  "clinical_insight": "임상/비즈니스 관점의 해설 (150자 이내, 실제 진료에서 어떻게 적용할 수 있는지)"
}

중요:
- 반드시 유효한 JSON만 출력하세요
- 모든 텍스트는 한국어로 작성하세요
- 임상의가 5분 안에 핵심을 파악할 수 있도록 작성하세요`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-5',
      messages: [
        { role: 'system', content: '당신은 의료 논문을 임상의를 위해 요약하는 전문가입니다. 항상 유효한 JSON으로만 응답합니다.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    const content = completion.choices[0].message.content;
    
    // JSON 추출 (코드 블록 제거)
    let jsonStr = content;
    if (content.includes('```json')) {
      jsonStr = content.match(/```json\s*([\s\S]*?)\s*```/)?.[1] || content;
    } else if (content.includes('```')) {
      jsonStr = content.match(/```\s*([\s\S]*?)\s*```/)?.[1] || content;
    }
    
    const summary = JSON.parse(jsonStr.trim());
    
    return {
      slug: generateSlug(article.title),
      title: summary.title_ko || article.title,
      original_title: article.title,
      journal: article.journal,
      doi: article.doi,
      pmid: article.pmid,
      topic: topic.koreanName,
      tier: Math.random() > 0.6 ? 'pro' : 'basic', // 40% basic, 60% pro
      key_messages: JSON.stringify(summary.key_messages),
      study_n: summary.study_n,
      study_endpoint: summary.study_endpoint,
      study_limitations: summary.study_limitations,
      clinical_insight: summary.clinical_insight,
      published_at: new Date().toISOString().split('T')[0],
      authors: article.authors
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
    .slice(0, 5)
    .join('-');
  
  const timestamp = Date.now().toString(36);
  return `${words}-${timestamp}`;
}

// ============ 메인 실행 ============

async function main() {
  const args = process.argv.slice(2);
  const topicKey = args[0] || 'all';
  const count = parseInt(args[1]) || 5;
  
  console.log('🔬 MedDigest Content Generator');
  console.log('================================');
  
  // OpenAI 클라이언트 초기화
  const config = loadOpenAIConfig();
  
  if (!config.apiKey) {
    console.error('❌ OpenAI API key not found. Please configure ~/.genspark_llm.yaml');
    process.exit(1);
  }
  
  const openai = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL
  });
  
  console.log('✅ OpenAI client initialized');
  
  // 처리할 주제 결정
  const topicsToProcess = topicKey === 'all' 
    ? Object.keys(TOPICS) 
    : [topicKey];
  
  const allArticles = [];
  
  for (const key of topicsToProcess) {
    const topic = TOPICS[key];
    if (!topic) {
      console.log(`⚠️ Unknown topic: ${key}`);
      continue;
    }
    
    console.log(`\n📚 Processing topic: ${topic.name}`);
    console.log('─'.repeat(40));
    
    // 검색어별로 논문 검색
    const searchTerm = topic.searchTerms[Math.floor(Math.random() * topic.searchTerms.length)];
    console.log(`🔍 Searching: ${searchTerm}`);
    
    const pubmedArticles = await searchPubMed(searchTerm, count * 2);
    console.log(`📄 Found ${pubmedArticles.length} articles`);
    
    // 상위 N개 논문 요약 생성
    let generated = 0;
    for (const article of pubmedArticles) {
      if (generated >= count) break;
      
      console.log(`\n📝 Generating summary for: ${article.title.substring(0, 50)}...`);
      
      const summary = await generateSummary(article, topic, openai);
      
      if (summary) {
        allArticles.push(summary);
        generated++;
        console.log(`✅ Generated: ${summary.title}`);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\n✅ ${topic.name}: ${generated}/${count} articles generated`);
  }
  
  // SQL 출력
  console.log('\n' + '='.repeat(60));
  console.log('📊 Generated SQL Inserts');
  console.log('='.repeat(60) + '\n');
  
  const sqlStatements = allArticles.map(article => {
    return `INSERT INTO articles (slug, title, original_title, journal, doi, pmid, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES ('${article.slug}', '${escapeSql(article.title)}', '${escapeSql(article.original_title)}', '${escapeSql(article.journal)}', ${article.doi ? `'${article.doi}'` : 'NULL'}, '${article.pmid}', '${article.topic}', '${article.tier}', '${escapeSql(article.key_messages)}', ${article.study_n || 'NULL'}, '${escapeSql(article.study_endpoint || '')}', '${escapeSql(article.study_limitations || '')}', '${escapeSql(article.clinical_insight || '')}', '${article.published_at}');`;
  }).join('\n\n');
  
  console.log(sqlStatements);
  
  // SQL 파일로 저장
  const sqlFilePath = path.join(process.cwd(), `generated-content-${Date.now()}.sql`);
  fs.writeFileSync(sqlFilePath, sqlStatements);
  console.log(`\n💾 SQL saved to: ${sqlFilePath}`);
  
  // JSON으로도 저장
  const jsonFilePath = path.join(process.cwd(), `generated-content-${Date.now()}.json`);
  fs.writeFileSync(jsonFilePath, JSON.stringify(allArticles, null, 2));
  console.log(`💾 JSON saved to: ${jsonFilePath}`);
  
  console.log(`\n🎉 Total: ${allArticles.length} articles generated!`);
  
  return allArticles;
}

function escapeSql(str) {
  if (!str) return '';
  return str.replace(/'/g, "''");
}

// 실행
main().catch(console.error);
