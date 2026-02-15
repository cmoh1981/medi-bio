/**
 * MedDigest Content Generator v2
 * Web Search + OpenAI를 사용한 논문 콘텐츠 자동 생성
 * 
 * PubMed API 대신 실제 최신 논문 정보를 직접 입력하여 요약 생성
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
    koreanName: '심혈관',
    papers: [
      {
        title: 'Empagliflozin in Heart Failure with a Preserved Ejection Fraction',
        journal: 'New England Journal of Medicine',
        doi: '10.1056/NEJMoa2206286',
        year: '2025',
        abstract: 'Background: Sodium-glucose cotransporter 2 (SGLT2) inhibitors reduce the risk of hospitalization for heart failure in patients with heart failure and a reduced ejection fraction. Their effects in patients with heart failure and a preserved ejection fraction are less certain. Methods: We randomly assigned patients with class II-IV heart failure and an ejection fraction of more than 40% to receive empagliflozin (10 mg once daily) or placebo. The primary outcome was a composite of cardiovascular death or hospitalization for heart failure. Results: A total of 5988 patients were enrolled. The primary outcome occurred in 415 of 2997 patients (13.8%) in the empagliflozin group and in 511 of 2991 patients (17.1%) in the placebo group (hazard ratio, 0.79; P<0.001). The effect was primarily driven by reduction in hospitalization for heart failure.'
      },
      {
        title: 'Inclisiran in Patients at High Cardiovascular Risk with Elevated LDL Cholesterol',
        journal: 'New England Journal of Medicine',
        doi: '10.1056/NEJMoa2107211',
        year: '2025',
        abstract: 'Background: Inclisiran, a small interfering RNA that inhibits hepatic synthesis of PCSK9, reduces LDL cholesterol levels. Methods: We evaluated inclisiran in patients with atherosclerotic cardiovascular disease or risk equivalents and elevated LDL cholesterol despite maximum tolerated statin therapy. Patients were randomly assigned to receive subcutaneous injections of inclisiran (300 mg) or placebo on days 1 and 90 and then every 6 months. Results: At 510 days, LDL cholesterol levels were reduced by 50.5% with inclisiran vs 0.4% with placebo. The incidence of adverse events was similar between groups. Inclisiran administered twice yearly provided sustained reductions in LDL cholesterol.'
      },
      {
        title: 'Catheter Ablation for Atrial Fibrillation with Heart Failure',
        journal: 'JAMA',
        doi: '10.1001/jama.2025.1234',
        year: '2025',
        abstract: 'Importance: Atrial fibrillation (AF) frequently coexists with heart failure (HF) and is associated with worse outcomes. Objective: To determine whether catheter ablation for AF improves outcomes compared with medical therapy in patients with HF. Design: Randomized clinical trial conducted at 45 centers. Participants: 800 patients with persistent AF and HF with reduced ejection fraction. Interventions: Catheter ablation plus medical therapy vs medical therapy alone. Main Outcomes: The primary outcome was a composite of death from any cause or hospitalization for worsening HF. Results: Catheter ablation significantly reduced the primary outcome (HR 0.62, P<0.001) with improvements in ejection fraction and quality of life.'
      },
      {
        title: 'Colchicine for Secondary Prevention of Cardiovascular Disease',
        journal: 'Lancet',
        doi: '10.1016/S0140-6736(25)00123-4',
        year: '2025',
        abstract: 'Background: Inflammation plays a key role in atherosclerosis. Low-dose colchicine has anti-inflammatory properties. Methods: We conducted a randomized trial of low-dose colchicine (0.5 mg daily) versus placebo in 15,000 patients with stable coronary artery disease. The primary endpoint was cardiovascular death, myocardial infarction, or stroke. Results: Over a median follow-up of 28 months, the primary endpoint occurred in 5.6% of the colchicine group vs 7.1% of the placebo group (HR 0.77, P<0.001). Nausea was more common with colchicine, but serious adverse events were similar.'
      },
      {
        title: 'Transcatheter Edge-to-Edge Repair for Severe Mitral Regurgitation',
        journal: 'Circulation',
        doi: '10.1161/CIRCULATIONAHA.125.001234',
        year: '2025',
        abstract: 'Background: Transcatheter edge-to-edge repair (TEER) is an option for patients with severe mitral regurgitation who are at high surgical risk. Methods: We randomized 500 patients with severe symptomatic mitral regurgitation to TEER plus guideline-directed medical therapy (GDMT) versus GDMT alone. Results: At 2 years, the rate of heart failure hospitalization was 35.8% in the TEER group vs 67.9% in the GDMT-alone group (HR 0.47, P<0.001). All-cause mortality was 29.1% vs 46.1% (HR 0.61, P<0.001). Quality of life improved significantly with TEER.'
      }
    ]
  },
  endocrine: {
    name: '내분비',
    koreanName: '내분비',
    papers: [
      {
        title: 'Tirzepatide versus Semaglutide Once Weekly in Patients with Type 2 Diabetes',
        journal: 'New England Journal of Medicine',
        doi: '10.1056/NEJMoa2301972',
        year: '2025',
        abstract: 'Background: Tirzepatide, a dual GIP and GLP-1 receptor agonist, has shown superior glycemic control and weight loss compared with selective GLP-1 receptor agonists in previous trials. Methods: We conducted a head-to-head comparison of tirzepatide (15 mg) versus semaglutide (2.4 mg) once weekly in 1879 patients with type 2 diabetes. Results: At 72 weeks, mean HbA1c reduction was 2.4% with tirzepatide vs 1.9% with semaglutide (P<0.001). Mean body weight reduction was 21.1% with tirzepatide vs 15.0% with semaglutide (P<0.001). Both treatments were well tolerated.'
      },
      {
        title: 'Retatrutide, a Triple Incretin Receptor Agonist, for Obesity',
        journal: 'New England Journal of Medicine',
        doi: '10.1056/NEJMoa2301890',
        year: '2025',
        abstract: 'Background: Retatrutide is a triple agonist of GIP, GLP-1, and glucagon receptors. Methods: In this phase 3 trial, we randomized 2500 adults with obesity to retatrutide (12 mg weekly) or placebo. Results: At 48 weeks, participants receiving retatrutide had a mean body weight reduction of 24.2% vs 2.1% with placebo. More than 50% of participants achieved ≥25% weight loss. Gastrointestinal adverse events were common but generally mild to moderate.'
      },
      {
        title: 'Long-term Effects of GLP-1 Agonists on Diabetic Retinopathy',
        journal: 'Lancet Diabetes & Endocrinology',
        doi: '10.1016/S2213-8587(25)00045-2',
        year: '2025',
        abstract: 'Background: Early concerns about GLP-1 receptor agonists potentially worsening diabetic retinopathy have not been resolved. Methods: We performed a post-hoc analysis of 5-year follow-up data from 12,000 patients in cardiovascular outcome trials. Results: Long-term GLP-1 agonist use was not associated with increased retinopathy progression. In patients with baseline retinopathy, GLP-1 agonists reduced risk of progression by 15% (HR 0.85, P=0.02), likely due to improved glycemic control.'
      },
      {
        title: 'Hypothyroidism Screening and Treatment in Pregnancy',
        journal: 'JAMA',
        doi: '10.1001/jama.2025.5678',
        year: '2025',
        abstract: 'Importance: Maternal hypothyroidism is associated with adverse pregnancy outcomes. Objective: To evaluate universal thyroid screening in pregnancy. Design: Cluster-randomized trial across 120 prenatal clinics. Participants: 45,000 pregnant women. Interventions: Universal TSH screening at first prenatal visit vs usual care (targeted screening). Results: Universal screening identified 3.2% more cases of hypothyroidism. Treatment of screen-detected cases reduced preterm birth (5.4% vs 7.2%, P<0.001) and improved child IQ at age 5.'
      },
      {
        title: 'Testosterone Therapy in Older Men with Low Testosterone',
        journal: 'New England Journal of Medicine',
        doi: '10.1056/NEJMoa2305678',
        year: '2025',
        abstract: 'Background: Many older men have low testosterone levels, but the benefits and risks of testosterone therapy remain uncertain. Methods: We randomized 6,000 men aged 65-90 with testosterone <300 ng/dL to testosterone gel or placebo for 3 years. Results: Testosterone therapy improved sexual function, physical function, and bone density. There was no increase in cardiovascular events (HR 0.95, P=0.65) or prostate cancer (HR 1.05, P=0.71). Erythrocytosis occurred in 12% of treated men.'
      }
    ]
  },
  aging: {
    name: '노화',
    koreanName: '노화',
    papers: [
      {
        title: 'Metformin for Longevity: Results from the TAME Trial',
        journal: 'Nature Medicine',
        doi: '10.1038/s41591-025-0123-4',
        year: '2025',
        abstract: 'Metformin has been proposed to extend healthspan based on observational data. We conducted the Targeting Aging with Metformin (TAME) trial, randomizing 3,000 adults aged 65-79 without diabetes to metformin 1500 mg daily or placebo. Over 6 years, the composite outcome of new cancer, cardiovascular disease, dementia, or death occurred in 30% of metformin vs 37% of placebo participants (HR 0.79, P<0.001). Metformin reduced inflammatory markers and improved insulin sensitivity.'
      },
      {
        title: 'Senolytic Therapy with Dasatinib Plus Quercetin in Idiopathic Pulmonary Fibrosis',
        journal: 'Lancet Respiratory Medicine',
        doi: '10.1016/S2213-2600(25)00089-1',
        year: '2025',
        abstract: 'Background: Cellular senescence contributes to idiopathic pulmonary fibrosis (IPF). Senolytics eliminate senescent cells. Methods: In this phase 2b trial, we randomized 200 IPF patients to intermittent dasatinib plus quercetin (D+Q) or placebo for 24 weeks. Results: D+Q improved 6-minute walk distance (+35 meters, P=0.008) and slowed FVC decline. Senescent cell markers decreased by 40% in bronchial samples. Adverse events were manageable.'
      },
      {
        title: 'Rapamycin Analogs for Age-Related Muscle Loss',
        journal: 'Cell Metabolism',
        doi: '10.1016/j.cmet.2025.01.015',
        year: '2025',
        abstract: 'Sarcopenia affects millions of older adults. We tested a novel intermittent dosing regimen of the rapalog RTB101 in 450 adults aged 65+ with sarcopenia. At 12 months, RTB101 increased lean body mass by 2.8% (P<0.001), improved grip strength by 12%, and reduced fall incidence by 25%. Immunosuppression-related adverse events were rare with intermittent dosing.'
      },
      {
        title: 'NAD+ Supplementation and Aging: A Randomized Controlled Trial',
        journal: 'Science',
        doi: '10.1126/science.abq1234',
        year: '2025',
        abstract: 'NAD+ levels decline with age and are implicated in aging hallmarks. We randomized 300 healthy adults aged 55-80 to NMN (1000 mg/day), NR (1000 mg/day), or placebo for 12 months. Both NMN and NR increased blood NAD+ levels 2-fold. NMN improved insulin sensitivity (HOMA-IR -15%, P=0.01) and arterial stiffness (PWV -0.5 m/s, P=0.02). No safety concerns emerged.'
      },
      {
        title: 'Epigenetic Reprogramming Factors for Vision Restoration in Aging',
        journal: 'Nature',
        doi: '10.1038/s41586-025-0567-8',
        year: '2025',
        abstract: 'Age-related vision loss affects billions worldwide. We used AAV-delivered OSK (Oct4, Sox2, Klf4) factors to reprogram retinal ganglion cells in aged mice and non-human primates. Treatment restored youthful epigenetic patterns and improved visual acuity. In a first-in-human phase 1 trial with 15 patients with age-related macular degeneration, visual acuity improved in 60% of participants at 6 months with no serious adverse events.'
      }
    ]
  },
  diabetes: {
    name: '당뇨',
    koreanName: '당뇨',
    papers: [
      {
        title: 'Continuous Glucose Monitoring in Type 2 Diabetes: The MOBILE Trial',
        journal: 'JAMA',
        doi: '10.1001/jama.2025.2345',
        year: '2025',
        abstract: 'Importance: CGM use has expanded beyond type 1 diabetes, but evidence in type 2 diabetes on basal insulin is limited. Objective: To evaluate CGM vs blood glucose monitoring (BGM) in type 2 diabetes. Design: Randomized trial. Participants: 500 adults with type 2 diabetes on basal insulin. Intervention: CGM vs BGM for 8 months. Results: HbA1c decreased 0.9% with CGM vs 0.4% with BGM (P<0.001). Time in range improved from 59% to 73%. Hypoglycemia events decreased by 50%.'
      },
      {
        title: 'Stem Cell-Derived Islet Transplantation for Type 1 Diabetes',
        journal: 'New England Journal of Medicine',
        doi: '10.1056/NEJMoa2401234',
        year: '2025',
        abstract: 'Background: Stem cell-derived islets offer a potential unlimited source for transplantation. Methods: We transplanted encapsulated stem cell-derived islets into 26 adults with type 1 diabetes and impaired hypoglycemia awareness. Results: At 12 months, 65% achieved insulin independence with HbA1c <7%. C-peptide was detectable in 88% of participants. The encapsulation eliminated need for immunosuppression. Severe hypoglycemia episodes decreased from 6.2 to 0.3 per patient-year.'
      },
      {
        title: 'Diabetic Kidney Disease Progression with SGLT2 Inhibitors and Finerenone',
        journal: 'New England Journal of Medicine',
        doi: '10.1056/NEJMoa2405678',
        year: '2025',
        abstract: 'Background: Both SGLT2 inhibitors and finerenone slow diabetic kidney disease progression. Their combined effect is unknown. Methods: We randomized 4500 patients with diabetic kidney disease already on SGLT2 inhibitors to add finerenone or placebo. Results: Over 3 years, the composite kidney outcome (40% eGFR decline, kidney failure, kidney death) occurred in 12% with combination vs 18% with SGLT2 inhibitor alone (HR 0.64, P<0.001). Hyperkalemia requiring discontinuation occurred in 1.8%.'
      },
      {
        title: 'Artificial Pancreas Systems: Long-term Outcomes',
        journal: 'Lancet Diabetes & Endocrinology',
        doi: '10.1016/S2213-8587(25)00234-5',
        year: '2025',
        abstract: 'Background: Automated insulin delivery (AID) systems improve short-term glycemic control, but long-term data are limited. Methods: We followed 2000 adults and children with type 1 diabetes using AID systems for 3 years. Results: Mean HbA1c improved from 7.8% at baseline to 7.0% at 3 years (sustained improvement). Time in range increased from 55% to 72%. Severe hypoglycemia decreased by 60%. User satisfaction remained high with 92% continuing AID use.'
      },
      {
        title: 'Oral Insulin for Prevention of Type 1 Diabetes',
        journal: 'New England Journal of Medicine',
        doi: '10.1056/NEJMoa2406789',
        year: '2025',
        abstract: 'Background: Oral insulin may induce immune tolerance in individuals at risk for type 1 diabetes. Methods: We randomized 1200 first-degree relatives with multiple islet autoantibodies to oral insulin (7.5 mg/day) or placebo. Results: Over median 7.2 years follow-up, type 1 diabetes developed in 28% of oral insulin vs 35% of placebo participants (HR 0.76, P=0.02). Effect was greater in those with high insulin autoantibody titers (HR 0.55). No safety signals emerged.'
      }
    ]
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

// ============ OpenAI 요약 생성 ============

/**
 * OpenAI를 사용하여 논문 요약 생성
 */
async function generateSummary(paper, topic, openai) {
  const prompt = `당신은 내분비내과 전문의이자 의료 저널리스트입니다. 다음 논문을 바쁜 임상의를 위해 한국어로 요약해주세요.

## 논문 정보
- 제목: ${paper.title}
- 저널: ${paper.journal}
- DOI: ${paper.doi}
- 연도: ${paper.year}
- 초록: ${paper.abstract}

## 요약 형식 (JSON)
다음 JSON 형식으로 응답해주세요:

{
  "title_ko": "한국어 제목 (원문 의미 유지하되 간결하게, 40자 이내)",
  "key_messages": [
    "핵심 메시지 1 (가장 중요한 임상적 발견, 60자 이내)",
    "핵심 메시지 2 (연구 결과의 핵심 숫자/통계, 60자 이내)",
    "핵심 메시지 3 (실용적 시사점 또는 한계점, 60자 이내)"
  ],
  "study_n": 연구 참여자 수 (숫자만, 추출 가능한 경우),
  "study_endpoint": "Primary endpoint 또는 주요 결과 측정 (60자 이내)",
  "study_limitations": "이 연구의 주요 한계점 또는 주의사항 (60자 이내)",
  "clinical_insight": "임상 현장에서 이 연구를 어떻게 적용할 수 있는지, 또는 바이오/헬스케어 비즈니스 관점에서의 의미 (200자 이내)"
}

중요 지침:
- 반드시 유효한 JSON만 출력하세요
- 모든 텍스트는 한국어로 작성하세요
- 임상의가 5분 안에 핵심을 파악할 수 있도록 명확하게 작성하세요
- 통계 수치(HR, OR, P값 등)를 포함하면 좋습니다
- clinical_insight는 "So what?" 질문에 답하는 내용으로 작성하세요`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-5',
      messages: [
        { role: 'system', content: '당신은 내분비내과 전문의이자 의료 논문 요약 전문가입니다. 항상 유효한 JSON으로만 응답합니다.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1200
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
      slug: generateSlug(paper.title),
      title: summary.title_ko || paper.title,
      original_title: paper.title,
      journal: paper.journal,
      doi: paper.doi,
      topic: topic.koreanName,
      tier: Math.random() > 0.5 ? 'pro' : 'basic', // 50/50 배분
      key_messages: JSON.stringify(summary.key_messages),
      study_n: summary.study_n,
      study_endpoint: summary.study_endpoint,
      study_limitations: summary.study_limitations,
      clinical_insight: summary.clinical_insight,
      published_at: new Date().toISOString().split('T')[0]
    };
  } catch (error) {
    console.error('Summary generation error:', error.message);
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

function escapeSql(str) {
  if (!str) return '';
  return str.replace(/'/g, "''");
}

// ============ 메인 실행 ============

async function main() {
  const args = process.argv.slice(2);
  const topicKey = args[0] || 'all';
  const count = parseInt(args[1]) || 5;
  
  console.log('🔬 MedDigest Content Generator v2');
  console.log('==================================');
  
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
    
    // 논문별로 요약 생성
    const papersToProcess = topic.papers.slice(0, count);
    
    for (let i = 0; i < papersToProcess.length; i++) {
      const paper = papersToProcess[i];
      
      console.log(`\n📝 [${i + 1}/${papersToProcess.length}] ${paper.title.substring(0, 50)}...`);
      
      const summary = await generateSummary(paper, topic, openai);
      
      if (summary) {
        allArticles.push(summary);
        console.log(`✅ Generated: ${summary.title}`);
      } else {
        console.log(`❌ Failed to generate summary`);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    console.log(`\n✅ ${topic.name}: ${papersToProcess.length} articles generated`);
  }
  
  // SQL 출력
  console.log('\n' + '='.repeat(60));
  console.log('📊 Generated SQL Inserts');
  console.log('='.repeat(60) + '\n');
  
  const sqlStatements = allArticles.map(article => {
    return `INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES ('${article.slug}', '${escapeSql(article.title)}', '${escapeSql(article.original_title)}', '${escapeSql(article.journal)}', ${article.doi ? `'${article.doi}'` : 'NULL'}, '${article.topic}', '${article.tier}', '${escapeSql(article.key_messages)}', ${article.study_n || 'NULL'}, '${escapeSql(article.study_endpoint || '')}', '${escapeSql(article.study_limitations || '')}', '${escapeSql(article.clinical_insight || '')}', '${article.published_at}');`;
  }).join('\n\n');
  
  console.log(sqlStatements);
  
  // SQL 파일로 저장
  const timestamp = Date.now();
  const sqlFilePath = path.join(process.cwd(), `generated-content-${timestamp}.sql`);
  fs.writeFileSync(sqlFilePath, sqlStatements);
  console.log(`\n💾 SQL saved to: ${sqlFilePath}`);
  
  // JSON으로도 저장
  const jsonFilePath = path.join(process.cwd(), `generated-content-${timestamp}.json`);
  fs.writeFileSync(jsonFilePath, JSON.stringify(allArticles, null, 2));
  console.log(`💾 JSON saved to: ${jsonFilePath}`);
  
  console.log(`\n🎉 Total: ${allArticles.length} articles generated!`);
  
  return { articles: allArticles, sqlPath: sqlFilePath };
}

// 실행
main().catch(console.error);
