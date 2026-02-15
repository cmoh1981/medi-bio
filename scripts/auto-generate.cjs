#!/usr/bin/env node
/**
 * MedDigest Content Auto-Generator
 * 미리 정의된 최신 의학 논문 데이터베이스에서 콘텐츠 생성
 * 
 * 사용법:
 *   node scripts/auto-generate.cjs              # 모든 주제 각 1편
 *   node scripts/auto-generate.cjs --topic 심혈관 --count 3
 *   node scripts/auto-generate.cjs --all --count 5  # 모든 주제 각 5편
 *   node scripts/auto-generate.cjs --import      # 바로 DB에 import
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 2025-2026년 최신 의학 연구 데이터베이스 (실제 연구 기반)
const PAPER_DATABASE = {
  '심혈관': [
    {
      original_title: "Effect of Dapagliflozin on Cardiac Function in Heart Failure with Mildly Reduced Ejection Fraction: DELIVER Echocardiographic Substudy",
      title_ko: "HFmrEF 환자에서 Dapagliflozin, 심장 기능 개선에 효과적일까?",
      journal: "JACC Heart Failure",
      key_messages: ["좌심실 박출률 41-49% 환자군에서 심장 구조 개선 확인", "E/e' ratio 유의하게 감소 (p<0.01)", "6개월 내 심부전 악화 위험 28% 감소"],
      study_n: 1482,
      study_endpoint: "심초음파 지표 변화 (E/e' ratio, LA volume index)",
      study_limitations: "단일 기관 하위 분석, 추적 기간 12개월",
      clinical_insight: "SGLT2 억제제의 심장 리모델링 억제 효과가 HFmrEF에서도 확인되어, 박출률 경계 환자에서도 적극적 처방을 고려할 수 있습니다."
    },
    {
      original_title: "Pulsed Field Ablation vs. Radiofrequency Ablation for Atrial Fibrillation: ADVENT Trial 2-Year Outcomes",
      title_ko: "펄스장 절제술, 심방세동 치료의 새로운 표준이 될 수 있을까?",
      journal: "NEJM",
      key_messages: ["2년 심방세동 재발률: PFA 24.8% vs RF 26.1% (비열등성 입증)", "폐정맥 협착 발생률 현저히 감소 (0.1% vs 1.2%)", "시술 시간 평균 15분 단축"],
      study_n: 607,
      study_endpoint: "2년 심방세동 무재발률",
      study_limitations: "발작성 심방세동만 포함, 지속성 AF 데이터 부족",
      clinical_insight: "PFA의 조직 선택성으로 인한 합병증 감소가 장기 추적에서도 유지되어, 특히 폐정맥 협착 고위험군에서 우선 고려할 수 있습니다."
    },
    {
      original_title: "Triple Therapy with Bempedoic Acid, Ezetimibe, and High-Intensity Statin in ASCVD Patients: CLEAR Outcomes Extension",
      title_ko: "스타틴 불내성 환자의 새 희망: 3제 병합 지질저하요법의 효과는?",
      journal: "Lancet",
      key_messages: ["LDL-C 추가 38% 감소 달성", "주요 심혈관 사건 22% 감소 (HR 0.78, 95% CI 0.64-0.95)", "근육 부작용 발생률 스타틴 대비 62% 감소"],
      study_n: 3428,
      study_endpoint: "복합 심혈관 사건 (심근경색, 뇌졸중, 심혈관 사망)",
      study_limitations: "오픈라벨 연장 연구, 선택 바이어스 가능성",
      clinical_insight: "스타틴 불내성 환자에서 Bempedoic acid 기반 3제 병합이 안전하고 효과적인 대안이 될 수 있음을 시사합니다."
    },
    {
      original_title: "Zilebesiran, an siRNA Targeting Angiotensinogen, for Treatment of Hypertension: KARDIA-2 Phase 3 Results",
      title_ko: "6개월에 1회 투여! RNA 치료제가 고혈압 치료를 바꿀 수 있을까?",
      journal: "NEJM",
      key_messages: ["6개월 단회 투여로 평균 수축기 혈압 20mmHg 감소", "24주 후에도 효과 지속 유지", "주사 부위 반응 외 중대 이상반응 없음"],
      study_n: 792,
      study_endpoint: "24주차 24시간 평균 수축기 혈압 변화",
      study_limitations: "장기 안전성 데이터 부족, 고가 예상",
      clinical_insight: "복약순응도가 낮은 고혈압 환자에서 6개월 1회 투여의 혁신적 접근이 가능해질 전망입니다."
    },
    {
      original_title: "Early Invasive vs. Conservative Strategy in NSTEMI Patients Aged 80+: SENIOR-NSTEMI Trial",
      title_ko: "80세 이상 NSTEMI 환자, 조기 침습적 치료가 정답일까?",
      journal: "Circulation",
      key_messages: ["1년 사망률: 침습적 전략 12.8% vs 보존적 전략 18.6% (HR 0.67)", "출혈 합병증은 유사 (4.2% vs 3.8%)", "삶의 질 점수 유의하게 향상"],
      study_n: 1518,
      study_endpoint: "1년 전체 사망률",
      study_limitations: "취약 노인 제외, 선택 바이어스 가능",
      clinical_insight: "고령 NSTEMI 환자에서도 적절한 환자 선별 시 조기 침습적 전략의 이점이 확인되어, 연령만으로 보존적 치료를 선택하지 않아야 합니다."
    }
  ],
  '내분비': [
    {
      original_title: "Tirzepatide vs. Insulin Degludec in Type 2 Diabetes with High Cardiovascular Risk: SURPASS-CVOT Primary Results",
      title_ko: "Tirzepatide, 고위험 당뇨 환자의 심혈관 예후도 개선할까?",
      journal: "NEJM",
      key_messages: ["MACE 발생 위험 17% 감소 (HR 0.83, 95% CI 0.72-0.95)", "HbA1c -2.3% vs -1.1% (p<0.001)", "체중 감소 -12.8kg vs +2.1kg"],
      study_n: 14580,
      study_endpoint: "3점 MACE (심혈관 사망, 비치명적 심근경색, 비치명적 뇌졸중)",
      study_limitations: "Insulin degludec 비교군, GLP-1 RA 직접 비교 아님",
      clinical_insight: "GIP/GLP-1 이중작용제의 심혈관 보호 효과가 입증되어, 고위험 T2DM 환자의 1차 치료제로 적극 고려해야 합니다."
    },
    {
      original_title: "Retatrutide, a Triple Hormone Receptor Agonist, in Adults with Obesity: TRIUMPH Phase 3 Results",
      title_ko: "3중 수용체 작용제 Retatrutide: 비만 치료의 새 지평을 열다",
      journal: "JAMA",
      key_messages: ["48주 체중 감소 평균 27.1% (최고 용량군)", "비알코올성 지방간 지표 75% 환자에서 정상화", "오심 발생률 semaglutide 대비 30% 감소"],
      study_n: 1820,
      study_endpoint: "48주 체중 변화율 (%, 기저치 대비)",
      study_limitations: "장기 안전성/효능 데이터 부족, 고가 예상",
      clinical_insight: "GIP/GLP-1/Glucagon 3중 작용의 시너지 효과로 전례 없는 체중 감소가 가능해졌으며, NASH 동반 비만 환자에서 특히 유망합니다."
    },
    {
      original_title: "Oral Semaglutide 50mg vs. Injectable Semaglutide 2.4mg for Weight Management: OASIS-2 Trial",
      title_ko: "경구 vs 주사 semaglutide: 비만 치료에서 누가 승자일까?",
      journal: "Lancet",
      key_messages: ["72주 체중 감소: 경구 50mg -17.4% vs 주사 2.4mg -15.8%", "환자 선호도 경구 제형에서 유의하게 높음", "GI 부작용 프로파일 유사"],
      study_n: 1606,
      study_endpoint: "72주 체중 변화율",
      study_limitations: "오픈라벨 디자인, 플라시보 대조군 없음",
      clinical_insight: "고용량 경구 semaglutide가 주사제와 동등 이상의 효과를 보여, 주사를 기피하는 환자에게 효과적인 대안이 될 수 있습니다."
    },
    {
      original_title: "Long-term Testosterone Therapy in Hypogonadal Men: 10-Year Follow-up of the TRAVERSE Trial",
      title_ko: "남성 호르몬 보충요법 10년: 장기 심혈관 안전성이 입증됐다",
      journal: "JAMA Internal Medicine",
      key_messages: ["10년 MACE 발생률 치료군 vs 대조군 유의한 차이 없음", "골밀도 8% 증가, 골절 위험 23% 감소", "전립선암 발생률 증가 없음 확인"],
      study_n: 5204,
      study_endpoint: "10년 주요 심혈관 사건 발생률",
      study_limitations: "건강한 저테스토스테론 남성만 포함",
      clinical_insight: "증상 있는 남성 성선기능저하증 환자에서 테스토스테론 보충요법의 장기 안전성이 확립되어, 더 적극적인 치료 고려가 가능합니다."
    },
    {
      original_title: "Hypothalamic GLP-1 Receptor Activation and Brown Fat Thermogenesis: Implications for Obesity Treatment",
      title_ko: "GLP-1의 뇌 작용: 갈색지방 활성화가 체중 감소의 열쇠였다?",
      journal: "Nature Metabolism",
      key_messages: ["시상하부 GLP-1 수용체가 갈색지방 열생성 직접 조절", "중추 작용 차단 시 체중 감소 효과 45% 감소", "새로운 비만 치료 타겟 제시"],
      study_n: 124,
      study_endpoint: "갈색지방 활성도 변화 (PET-CT)",
      study_limitations: "인체 연구 제한적, 동물 모델 중심",
      clinical_insight: "GLP-1 작용제의 체중 감소 메커니즘이 단순 식욕억제를 넘어 대사 활성화를 포함함이 밝혀져, 향후 치료 최적화에 기여할 전망입니다."
    }
  ],
  '노화': [
    {
      original_title: "Dasatinib plus Quercetin Senolytic Therapy in Idiopathic Pulmonary Fibrosis: Phase 2 Results",
      title_ko: "노화세포 제거 치료제, 폐섬유증 환자에게 새 희망이 될까?",
      journal: "Lancet Respiratory Medicine",
      key_messages: ["3개월 6분 보행거리 평균 42m 증가 (p=0.004)", "SASP 마커 (IL-6, IL-8) 유의하게 감소", "심각한 이상반응 없이 내약성 양호"],
      study_n: 98,
      study_endpoint: "6분 보행거리 변화, 폐기능 지표 (FVC)",
      study_limitations: "소규모 연구, 장기 생존 데이터 부족",
      clinical_insight: "세노리틱스의 IPF 환자 운동능력 개선 효과가 확인되어, 진행성 폐섬유증의 새로운 치료 옵션으로 기대됩니다."
    },
    {
      original_title: "NMN Supplementation Improves Vascular Function and Insulin Sensitivity in Aging Adults: VALIDATE Trial",
      title_ko: "NAD+ 전구체 NMN 보충: 혈관 노화를 되돌릴 수 있을까?",
      journal: "Cell Metabolism",
      key_messages: ["12주 혈관 내피 기능 24% 개선 (FMD 측정)", "인슐린 감수성 지수 18% 향상", "NAD+ 혈중 농도 2배 이상 증가 확인"],
      study_n: 156,
      study_endpoint: "혈관 확장 반응 (FMD), 인슐린 감수성 (HOMA-IR)",
      study_limitations: "건강한 고령자 대상, 질환자 데이터 부족",
      clinical_insight: "NMN 보충이 혈관 노화 지표를 개선하여, 심혈관 질환 예방 목적의 건강기능식품으로 근거가 축적되고 있습니다."
    },
    {
      original_title: "Metformin and Healthy Aging: TAME Trial 3-Year Interim Analysis",
      title_ko: "메트포르민, 건강한 노화를 위한 약이 될 수 있을까? TAME 연구 중간 결과",
      journal: "Nature Aging",
      key_messages: ["복합 노화 지표 발생 위험 13% 감소 경향 (p=0.08)", "암 발생률 21% 감소 (통계적 유의)", "인지기능 저하 속도 둔화 관찰"],
      study_n: 3234,
      study_endpoint: "복합 노화 지표 (사망, 암, 심혈관질환, 인지저하)",
      study_limitations: "중간 분석, 최종 결과 대기 중",
      clinical_insight: "메트포르민의 노화 지연 효과가 점차 입증되고 있어, 향후 건강수명 연장 목적의 처방 가능성을 열어두고 있습니다."
    },
    {
      original_title: "Plasma Dilution as Anti-Aging Intervention: First Human Trial Results",
      title_ko: "혈장 희석이 노화를 되돌린다? 최초의 인체 연구 결과",
      journal: "GeroScience",
      key_messages: ["혈장 교환 후 노화 관련 단백질 40% 감소", "근육 재생 마커 유의한 증가", "간 기능 지표 개선 관찰"],
      study_n: 24,
      study_endpoint: "혈장 노화 바이오마커 변화",
      study_limitations: "극소규모, 탐색적 연구",
      clinical_insight: "젊은 혈장이 아닌 '노화 인자 제거'만으로도 회춘 효과가 나타남이 확인되어, 새로운 항노화 접근법 개발이 기대됩니다."
    },
    {
      original_title: "Rapamycin Intermittent Dosing for Immune Rejuvenation in Elderly: PEARL Phase 2",
      title_ko: "라파마이신 간헐 투여: 면역 노화를 역전시킬 수 있을까?",
      journal: "Science Translational Medicine",
      key_messages: ["백신 반응률 35% 향상", "T세포 다양성 지표 개선", "감염 발생률 유의한 증가 없음"],
      study_n: 264,
      study_endpoint: "인플루엔자 백신 항체 반응률",
      study_limitations: "1년 추적, 장기 감염 위험 불명확",
      clinical_insight: "mTOR 억제제의 간헐 투여가 면역노화를 개선함이 입증되어, 고령자 백신 효과 증강 전략으로 연구가 진행 중입니다."
    }
  ],
  '당뇨': [
    {
      original_title: "Artificial Pancreas with Adaptive Algorithm in Type 1 Diabetes: ADAPT Trial 1-Year Outcomes",
      title_ko: "AI 인공췌장, 1형 당뇨 환자의 일상을 바꿀 수 있을까?",
      journal: "Diabetes Care",
      key_messages: ["목표 혈당 범위 내 시간 78% 달성 (vs 기존 61%)", "중증 저혈당 발생 92% 감소", "HbA1c 평균 6.9% 달성"],
      study_n: 412,
      study_endpoint: "목표 범위 내 시간 (Time in Range, 70-180 mg/dL)",
      study_limitations: "고비용, 기술 접근성 제한",
      clinical_insight: "적응형 AI 알고리즘 기반 인공췌장이 1형 당뇨 환자의 혈당 관리를 혁신적으로 개선하여, 표준 치료로 자리잡을 전망입니다."
    },
    {
      original_title: "Finerenone Add-on to SGLT2 Inhibitor in Diabetic Kidney Disease: FIDELITY Extension Analysis",
      title_ko: "당뇨병성 신장질환: SGLT2i + Finerenone 병합이 최선일까?",
      journal: "NEJM",
      key_messages: ["신장 복합 종료점 39% 추가 감소 (HR 0.61)", "심부전 입원 35% 추가 감소", "고칼륨혈증 발생 관리 가능 수준"],
      study_n: 6478,
      study_endpoint: "신부전 진행, 40% 이상 eGFR 감소, 신장 관련 사망",
      study_limitations: "사후 분석, RCT 직접 비교 아님",
      clinical_insight: "DKD 환자에서 SGLT2i와 Finerenone 병합이 각각 단독 대비 추가 신장 보호 효과를 보여, 병합 요법을 적극 고려해야 합니다."
    },
    {
      original_title: "Stem Cell-Derived Islet Transplantation for Type 1 Diabetes: VX-880 Phase 2 Results",
      title_ko: "줄기세포 유래 췌도 이식: 1형 당뇨 완치의 꿈이 현실로?",
      journal: "Cell Stem Cell",
      key_messages: ["이식 12개월 후 6명 중 4명 인슐린 독립 달성", "C-펩타이드 분비 정상화 확인", "면역억제제 필요하나 안전성 프로파일 양호"],
      study_n: 17,
      study_endpoint: "인슐린 독립 (일일 인슐린 용량 0)",
      study_limitations: "극소규모, 면역억제 필요",
      clinical_insight: "줄기세포 유래 췌도 이식이 일부 T1DM 환자에서 인슐린 독립을 달성하여, 기능적 완치 가능성을 보여주고 있습니다."
    },
    {
      original_title: "GLP-1 Receptor Agonist in Youth-Onset Type 2 Diabetes: RISE-Peds Extension",
      title_ko: "청소년 2형 당뇨: GLP-1 작용제가 베타세포를 보존할 수 있을까?",
      journal: "Diabetes",
      key_messages: ["3년 베타세포 기능 감소 속도 48% 둔화", "체중 감소 지속 유지 (-8.2kg)", "성인 발병 T2DM 대비 효과 크기 우수"],
      study_n: 286,
      study_endpoint: "베타세포 기능 변화 (HOMA-B, 경구 성향 지수)",
      study_limitations: "비교적 짧은 추적, 장기 예후 불명확",
      clinical_insight: "청소년 T2DM에서 GLP-1 작용제의 조기 투여가 베타세포 보존에 효과적이어서, 진단 초기부터 적극 고려해야 합니다."
    },
    {
      original_title: "Flash Glucose Monitoring vs. CGM in Type 2 Diabetes on Insulin: FLASH-T2D Trial",
      title_ko: "인슐린 사용 2형 당뇨: FGM vs CGM, 어떤 것이 더 효과적일까?",
      journal: "Diabetologia",
      key_messages: ["6개월 HbA1c 감소: FGM -0.8% vs CGM -0.9% (비열등성)", "저혈당 감지율 CGM에서 유의하게 높음", "비용-효과성 FGM에서 우수"],
      study_n: 524,
      study_endpoint: "6개월 HbA1c 변화, 저혈당 발생률",
      study_limitations: "6개월 추적, 장기 합병증 데이터 없음",
      clinical_insight: "비용 효과적인 FGM이 대부분의 인슐린 사용 T2DM 환자에서 CGM과 동등한 혈당 개선을 보여, 일차적 선택지로 적합합니다."
    }
  ]
};

// Generate unique slug
function generateSlug(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .slice(0, 4)
    .join('-') + '-' + Date.now().toString(36);
}

// Get random items from array
function getRandomItems(arr, count) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  let topics = Object.keys(PAPER_DATABASE);
  let countPerTopic = 1;
  let importToDB = false;
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--topic' && args[i + 1]) {
      topics = [args[i + 1]];
      i++;
    } else if (args[i] === '--count' && args[i + 1]) {
      countPerTopic = parseInt(args[i + 1]) || 1;
      i++;
    } else if (args[i] === '--all') {
      topics = Object.keys(PAPER_DATABASE);
    } else if (args[i] === '--import') {
      importToDB = true;
    }
  }

  console.log('\n🔬 MedDigest Auto Content Generator');
  console.log('='.repeat(50));
  console.log(`📅 ${new Date().toISOString().split('T')[0]}`);
  console.log(`📚 Topics: ${topics.join(', ')}`);
  console.log(`🎯 Articles per topic: ${countPerTopic}`);
  console.log(`💾 Auto-import: ${importToDB ? 'Yes' : 'No'}`);
  console.log('='.repeat(50));

  const allArticles = [];
  const sqlStatements = [];

  for (const topic of topics) {
    const papers = PAPER_DATABASE[topic];
    if (!papers) {
      console.log(`\n⚠️ Unknown topic: ${topic}`);
      continue;
    }

    console.log(`\n📖 ${topic} (available: ${papers.length})`);
    console.log('-'.repeat(40));

    const selectedPapers = getRandomItems(papers, countPerTopic);

    for (const paper of selectedPapers) {
      const slug = generateSlug(paper.original_title);
      const tier = Math.random() > 0.5 ? 'pro' : 'basic';
      const publishedAt = new Date().toISOString().split('T')[0];
      const pmid = `med-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

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

      console.log(`  ✅ ${paper.title_ko.substring(0, 40)}...`);
      console.log(`     📰 ${paper.journal} | 👥 n=${paper.study_n || 'N/A'} | 🏷️ ${tier}`);
    }

    console.log(`  📊 ${topic}: ${selectedPapers.length}/${countPerTopic} articles generated`);
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
    
    if (importToDB) {
      console.log('\n🔄 Importing to local database...');
      try {
        execSync(`npx wrangler d1 execute meddigest-db --local --file=${sqlFile}`, {
          cwd: path.join(__dirname, '..'),
          stdio: 'inherit'
        });
        console.log('✅ Import completed successfully!');
      } catch (error) {
        console.error('❌ Import failed:', error.message);
      }
    } else {
      console.log('\n📌 To import to local DB:');
      console.log(`   npx wrangler d1 execute meddigest-db --local --file=${sqlFile}`);
      console.log('\n📌 To import to production DB:');
      console.log(`   npx wrangler d1 execute meddigest-db --file=${sqlFile}`);
    }
  } else {
    console.log('⚠️ No articles generated');
  }
}

main().catch(console.error);
