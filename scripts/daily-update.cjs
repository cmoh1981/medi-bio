#!/usr/bin/env node
/**
 * MedDigest Daily Content Update
 * 매일 자동으로 새 논문을 검색하고 AI 요약 생성
 * 
 * 사용법:
 *   node scripts/daily-update.cjs              # 모든 주제 각 1편
 *   node scripts/daily-update.cjs --topic 심혈관 --count 3
 *   node scripts/daily-update.cjs --all --count 5  # 모든 주제 각 5편
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { OpenAI } = require('openai');

// Load LLM config - directly use environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://www.genspark.ai/api/llm_proxy/v1'
});

console.log('🔑 Using API:', process.env.OPENAI_BASE_URL || 'default');

// Topic configuration with research focus
const TOPICS = {
  '심혈관': {
    searchPrompts: [
      '2025년 또는 2026년에 발표된 SGLT2 억제제와 심부전에 대한 최신 임상연구',
      '2025년 또는 2026년 심방세동 카테터 절제술 관련 최신 연구',
      '2025년 또는 2026년 관상동맥질환 새로운 치료 임상시험'
    ]
  },
  '내분비': {
    searchPrompts: [
      '2025년 또는 2026년 GLP-1 작용제 비만 치료 최신 연구',
      '2025년 또는 2026년 tirzepatide 또는 semaglutide 임상시험 결과',
      '2025년 또는 2026년 대사증후군 새로운 치료법'
    ]
  },
  '노화': {
    searchPrompts: [
      '2025년 또는 2026년 senolytic 노화세포 제거 치료 연구',
      '2025년 또는 2026년 NAD+ 보충제 수명연장 임상연구',
      '2025년 또는 2026년 건강수명 longevity 최신 연구'
    ]
  },
  '당뇨': {
    searchPrompts: [
      '2025년 또는 2026년 연속혈당측정 CGM 당뇨병 연구',
      '2025년 또는 2026년 당뇨병성 신장질환 새로운 치료',
      '2025년 또는 2026년 인슐린 전달 시스템 혁신'
    ]
  }
};

// Use AI to find and summarize recent papers
async function findAndSummarizePaper(topic, searchPrompt) {
  const prompt = `당신은 내분비내과 전문의이자 최신 의학 연구 전문가입니다.

다음 주제에 대해 2025년 또는 2026년에 발표된 실제 중요한 임상 연구 1편을 찾아 요약해 주세요:

검색 주제: ${searchPrompt}
분야: ${topic}

최근 발표된 실제 연구를 기반으로, 다음 JSON 형식으로 응답하세요. 반드시 실제 존재하는 연구여야 합니다:

{
  "original_title": "논문의 영어 원제목 (실제 제목)",
  "title_ko": "한국어 제목 (35자 이내, 호기심을 유발하는 질문형 또는 핵심 발견 중심)",
  "journal": "저널명 (예: NEJM, Lancet, JAMA 등)",
  "key_messages": ["핵심 메시지 1", "핵심 메시지 2", "핵심 메시지 3"],
  "study_n": 연구 참가자 수 (숫자만),
  "study_endpoint": "1차 평가변수",
  "study_limitations": "주요 연구 한계점",
  "clinical_insight": "임상 현장에서 이 연구를 어떻게 적용할 수 있는지 해설 (150자 이내)"
}

중요: 실제 연구가 없다면 "null"이라고 응답하세요. 가상의 연구를 만들지 마세요.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5',
      messages: [
        { role: 'system', content: '당신은 최신 의학 연구에 정통한 내분비내과 전문의입니다. 반드시 실제 존재하는 연구만 언급하고, 유효한 JSON으로 응답합니다.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 1000
    });

    const content = response.choices[0]?.message?.content || '';
    
    if (content.toLowerCase().includes('null') && content.length < 50) {
      return null;
    }
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      // Validate required fields
      if (result.original_title && result.title_ko && result.journal) {
        return result;
      }
    }
    return null;
  } catch (error) {
    console.error(`  ⚠️ AI generation failed: ${error.message}`);
    return null;
  }
}

// Generate slug
function generateSlug(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .slice(0, 4)
    .join('-') + '-' + Date.now().toString(36);
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  let topics = Object.keys(TOPICS);
  let countPerTopic = 1;
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--topic' && args[i + 1]) {
      topics = [args[i + 1]];
      i++;
    } else if (args[i] === '--count' && args[i + 1]) {
      countPerTopic = parseInt(args[i + 1]) || 1;
      i++;
    } else if (args[i] === '--all') {
      topics = Object.keys(TOPICS);
    }
  }

  console.log('\n🔬 MedDigest Daily Content Update');
  console.log('='.repeat(50));
  console.log(`📅 ${new Date().toISOString().split('T')[0]}`);
  console.log(`📚 Topics: ${topics.join(', ')}`);
  console.log(`🎯 Articles per topic: ${countPerTopic}`);
  console.log('='.repeat(50));

  const allArticles = [];
  const sqlStatements = [];

  for (const topic of topics) {
    const config = TOPICS[topic];
    if (!config) {
      console.log(`\n⚠️ Unknown topic: ${topic}`);
      continue;
    }

    console.log(`\n📖 ${topic}`);
    console.log('-'.repeat(40));

    let generated = 0;
    const usedPrompts = new Set();

    for (let attempt = 0; attempt < countPerTopic && attempt < config.searchPrompts.length; attempt++) {
      const promptIndex = attempt % config.searchPrompts.length;
      const searchPrompt = config.searchPrompts[promptIndex];
      
      if (usedPrompts.has(searchPrompt)) continue;
      usedPrompts.add(searchPrompt);

      console.log(`  🔍 Searching: ${topic} paper ${attempt + 1}...`);

      const paper = await findAndSummarizePaper(topic, searchPrompt);
      
      if (!paper) {
        console.log(`  ⚠️ No paper found for this query`);
        continue;
      }

      const slug = generateSlug(paper.original_title || paper.title_ko);
      const tier = Math.random() > 0.5 ? 'pro' : 'basic';
      const publishedAt = new Date().toISOString().split('T')[0];
      const pmid = `ai-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

      const articleData = {
        slug,
        title: paper.title_ko,
        original_title: paper.original_title,
        journal: paper.journal,
        doi: null,
        pmid,
        topic,
        tier,
        key_messages: paper.key_messages,
        study_n: paper.study_n,
        study_endpoint: paper.study_endpoint,
        study_limitations: paper.study_limitations,
        clinical_insight: paper.clinical_insight,
        published_at: publishedAt
      };

      allArticles.push(articleData);

      // Generate SQL
      const escapeSql = (str) => str ? String(str).replace(/'/g, "''") : null;
      sqlStatements.push(`
INSERT INTO articles (slug, title, original_title, journal, doi, pmid, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES (
  '${escapeSql(slug)}',
  '${escapeSql(paper.title_ko)}',
  '${escapeSql(paper.original_title)}',
  '${escapeSql(paper.journal)}',
  NULL,
  '${pmid}',
  '${topic}',
  '${tier}',
  '${escapeSql(JSON.stringify(paper.key_messages))}',
  ${paper.study_n || 'NULL'},
  ${paper.study_endpoint ? `'${escapeSql(paper.study_endpoint)}'` : 'NULL'},
  ${paper.study_limitations ? `'${escapeSql(paper.study_limitations)}'` : 'NULL'},
  '${escapeSql(paper.clinical_insight)}',
  '${publishedAt}'
);`);

      generated++;
      console.log(`  ✅ Generated: ${paper.title_ko}`);
      console.log(`     Journal: ${paper.journal}`);
      
      // Rate limiting
      await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`  📊 ${topic}: ${generated}/${countPerTopic} articles generated`);
  }

  // Save outputs
  const timestamp = Date.now();
  const sqlFile = path.join(__dirname, '..', `generated-${timestamp}.sql`);
  const jsonFile = path.join(__dirname, '..', `generated-${timestamp}.json`);

  if (sqlStatements.length > 0) {
    fs.writeFileSync(sqlFile, sqlStatements.join('\n'));
    fs.writeFileSync(jsonFile, JSON.stringify(allArticles, null, 2));
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary');
  console.log('='.repeat(50));
  console.log(`✅ Total articles: ${allArticles.length}`);
  
  if (allArticles.length > 0) {
    console.log(`📁 SQL file: ${sqlFile}`);
    console.log(`📁 JSON file: ${jsonFile}`);
    console.log('\n📌 To import to local DB:');
    console.log(`   npx wrangler d1 execute meddigest-db --local --file=${sqlFile}`);
    console.log('\n📌 To import to production DB:');
    console.log(`   npx wrangler d1 execute meddigest-db --file=${sqlFile}`);
  } else {
    console.log('⚠️ No articles generated');
  }
}

main().catch(console.error);
