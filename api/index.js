const crypto = require('crypto');

// ── In-memory stores (demo mode) ──
const users = {};
const sessions = {};

// ── Articles from longevity-lab.io ──
const ARTICLES = [
  {
    id: 1, slug: 'nct07144293',
    title: '노화 세포 제거, HIV 환자의 건강한 노년에 새로운 희망이 될까요?',
    title_en: 'Can Senolytic Therapy Bring New Hope for Healthy Aging in HIV Patients?',
    source: 'ClinicalTrials.gov', topic: '노화', topic_en: 'Aging',
    published_at: '2026-02-13',
    original_url: 'https://longevity-lab.io/articles/nct07144293',
    key_messages: [
      'Dasatinib+Quercetin 병용 요법의 HIV 환자 신체 기능 개선 효과 평가 (Phase II)',
      '50세 이상 HIV 감염 10년 이상, 노쇠/전노쇠 환자 80명 대상 RCT',
      '12주 치료 + 12주 추적관찰, 간헐 투여 프로토콜'
    ],
    key_messages_en: [
      'Phase II RCT evaluating Dasatinib+Quercetin for physical function improvement in HIV patients',
      'Targeting 80 patients aged 50+, HIV-positive 10+ years, with frailty/prefrailty',
      '12-week treatment + 12-week follow-up with intermittent dosing protocol'
    ],
    clinical_insight: '만성 HIV 감염자의 조기 노화와 신체 쇠약에 세놀리틱 치료가 새로운 접근법이 될 수 있습니다.',
    clinical_insight_en: 'Senolytic therapy could offer a novel approach to premature aging and physical decline in chronic HIV patients.'
  },
  {
    id: 2, slug: 'nct06475456',
    title: '심장 쇼크 환자의 골든타임, 의료 협력으로 지킬 수 있을까요?',
    title_en: 'Can Medical Collaboration Save the Golden Hour for Cardiogenic Shock Patients?',
    source: 'ClinicalTrials.gov', topic: '심혈관', topic_en: 'Cardiovascular',
    published_at: '2026-02-13',
    original_url: 'https://longevity-lab.io/articles/nct06475456',
    key_messages: [
      '심인성 쇼크 환자의 초기 대응 프로토콜 최적화 연구',
      '다기관 협력 치료 모델의 임상적 효과 평가',
      '골든타임 내 적극적 개입의 생존율 개선 가능성'
    ],
    key_messages_en: [
      'Study optimizing initial response protocols for cardiogenic shock patients',
      'Evaluating clinical effectiveness of multi-center collaborative treatment models',
      'Potential survival improvement through aggressive intervention within the golden hour'
    ],
    clinical_insight: '심인성 쇼크에서 체계적인 다기관 협력 치료가 환자 예후를 크게 개선할 수 있습니다.',
    clinical_insight_en: 'Systematic multi-center collaborative treatment in cardiogenic shock can significantly improve patient outcomes.'
  },
  {
    id: 3, slug: 'nct05758246',
    title: '노화가 불러오는 감염 취약성, 노화 세포가 열쇠일까요?',
    title_en: 'Aging-Induced Infection Vulnerability: Are Senescent Cells the Key?',
    source: 'ClinicalTrials.gov', topic: '감염/면역', topic_en: 'Infection',
    published_at: '2026-02-13',
    original_url: 'https://longevity-lab.io/articles/nct05758246',
    key_messages: [
      '노화 세포 제거(세놀리틱스)가 고령자 패혈증 취약성을 감소시킬 수 있는지 평가 (Phase II)',
      '노화 세포 축적이 면역 기능 저하와 감염 취약성의 핵심 기전',
      'Dasatinib+Quercetin 간헐 투여의 안전성 및 효능 평가'
    ],
    key_messages_en: [
      'Phase II trial evaluating if senolytics can reduce sepsis vulnerability in elderly',
      'Senescent cell accumulation as key mechanism in immune decline and infection susceptibility',
      'Safety and efficacy assessment of intermittent Dasatinib+Quercetin dosing'
    ],
    clinical_insight: '노년층 패혈증 예방을 위한 세놀리틱 치료의 가능성을 탐색하는 혁신적 접근입니다.',
    clinical_insight_en: 'An innovative approach exploring senolytic therapy for sepsis prevention in the elderly.'
  },
  {
    id: 4, slug: '10-64898-2026-01-15-26344224',
    title: '미토콘드리아 유전자 변이, 파킨슨병 위험과 깊은 연관성을 보입니다',
    title_en: 'Mitochondrial Genetic Variants Show Deep Association with Parkinson\'s Disease Risk',
    source: 'medRxiv (preprint)', topic: '신경과학', topic_en: 'Neuroscience',
    published_at: '2026-02-13',
    original_url: 'https://longevity-lab.io/articles/10-64898-2026-01-15-26344224',
    key_messages: [
      '브라질 아마존 지역 인구 기반 미토콘드리아 DNA 변이 분석',
      '특정 mtDNA 하플로그룹이 파킨슨병 위험과 유의하게 연관',
      '미토콘드리아 기능 이상이 신경퇴행성 질환의 핵심 기전일 가능성'
    ],
    key_messages_en: [
      'Population-based mitochondrial DNA variant analysis from the Brazilian Amazon region',
      'Specific mtDNA haplogroups significantly associated with Parkinson\'s disease risk',
      'Mitochondrial dysfunction may be a core mechanism in neurodegenerative diseases'
    ],
    clinical_insight: 'mtDNA 변이 분석이 파킨슨병 위험 예측 및 개인화 의료의 새로운 도구가 될 수 있습니다.',
    clinical_insight_en: 'mtDNA variant analysis could become a new tool for Parkinson\'s risk prediction and personalized medicine.'
  },
  {
    id: 5, slug: '10-1101-2024-06-26-600909',
    title: '암세포 에너지 대사의 새로운 비밀: LDH의 복합적 역할 규명',
    title_en: 'New Secrets of Cancer Cell Energy Metabolism: Unraveling the Complex Role of LDH',
    source: 'bioRxiv (preprint)', topic: '암', topic_en: 'Cancer',
    published_at: '2026-02-13',
    original_url: 'https://longevity-lab.io/articles/10-1101-2024-06-26-600909',
    key_messages: [
      'LDH(젖산 탈수소효소)의 암세포 대사에서의 다면적 역할 규명',
      'LDH가 암세포의 에너지 생산과 성장에 복합적으로 기여',
      '새로운 대사 표적 항암 전략의 가능성 제시'
    ],
    key_messages_en: [
      'Elucidation of multifaceted role of LDH in cancer cell metabolism',
      'LDH contributes to cancer cell energy production and growth in complex ways',
      'Suggests potential for new metabolic-targeted anti-cancer strategies'
    ],
    clinical_insight: 'LDH를 표적으로 한 새로운 대사 항암 치료 전략 개발의 근거를 제시합니다.',
    clinical_insight_en: 'Provides rationale for developing new metabolic anti-cancer treatment strategies targeting LDH.'
  },
  {
    id: 6, slug: '10-64898-2026-01-12-26343913',
    title: '헌팅턴병, 증상 발현 전 뇌 에너지 변화를 읽어낼 수 있을까요?',
    title_en: 'Can We Detect Brain Energy Changes Before Huntington\'s Disease Symptoms Appear?',
    source: 'medRxiv (preprint)', topic: '신경과학', topic_en: 'Neuroscience',
    published_at: '2026-02-12',
    original_url: 'https://longevity-lab.io/articles/10-64898-2026-01-12-26343913',
    key_messages: [
      '헌팅턴병 유전자 보인자의 증상 전 단계에서 뇌 에너지 대사 변화 관찰',
      '뇌 영상을 통한 조기 바이오마커 발견 가능성',
      '증상 발현 이전에 치료적 개입이 가능할 수 있는 근거 제시'
    ],
    key_messages_en: [
      'Brain energy metabolism changes observed in pre-symptomatic Huntington\'s gene carriers',
      'Potential for early biomarker discovery through brain imaging',
      'Evidence that therapeutic intervention may be possible before symptom onset'
    ],
    clinical_insight: '헌팅턴병의 전증상기 진단과 조기 개입을 위한 새로운 바이오마커 후보입니다.',
    clinical_insight_en: 'A new biomarker candidate for pre-symptomatic diagnosis and early intervention in Huntington\'s disease.'
  },
  {
    id: 7, slug: '10-1101-2023-01-11-523642',
    title: '노화 세포의 놀라운 생존 전략: 우리 몸에 어떤 영향을 줄까요?',
    title_en: 'The Surprising Survival Strategy of Senescent Cells: What Impact on Our Bodies?',
    source: 'bioRxiv (preprint)', topic: '노화', topic_en: 'Aging',
    published_at: '2026-02-12',
    original_url: 'https://longevity-lab.io/articles/10-1101-2023-01-11-523642',
    key_messages: [
      '노화 세포가 SCAFs(세포 조각)를 방출하여 주변 세포에 영향을 미침',
      '노화 세포의 새로운 비자율적 생존 메커니즘 발견',
      'SCAFs가 조직 미세환경에서 면역 반응과 염증에 기여'
    ],
    key_messages_en: [
      'Senescent cells release SCAFs (cell fragments) affecting surrounding cells',
      'Discovery of novel non-autonomous survival mechanism in senescent cells',
      'SCAFs contribute to immune response and inflammation in the tissue microenvironment'
    ],
    clinical_insight: '노화 세포 제거 외에도 SCAFs를 표적으로 한 새로운 항노화 전략이 필요할 수 있습니다.',
    clinical_insight_en: 'Beyond senescent cell elimination, new anti-aging strategies targeting SCAFs may be needed.'
  },
  {
    id: 8, slug: '10-1101-2024-11-12-623261',
    title: '피부 노화, mRNA로 되돌릴 수 있을까요?',
    title_en: 'Can Skin Aging Be Reversed with mRNA Therapy?',
    source: 'bioRxiv (preprint)', topic: '노화', topic_en: 'Aging',
    published_at: '2026-02-10',
    original_url: 'https://longevity-lab.io/articles/10-1101-2024-11-12-623261',
    key_messages: [
      'mRNA 기술을 활용한 피부 노화 역전 가능성 연구',
      '특정 성장인자를 코딩하는 mRNA 전달로 피부 재생 촉진',
      '비침습적 피부 재생 치료의 새로운 패러다임 제시'
    ],
    key_messages_en: [
      'Research on the possibility of reversing skin aging using mRNA technology',
      'Promoting skin regeneration through delivery of mRNA encoding specific growth factors',
      'Presenting a new paradigm for non-invasive skin regeneration treatment'
    ],
    clinical_insight: 'mRNA 기반 피부 재생 기술은 미래 안티에이징 의료의 핵심 기술이 될 전망입니다.',
    clinical_insight_en: 'mRNA-based skin regeneration technology is expected to become a core technology in future anti-aging medicine.'
  },
  {
    id: 9, slug: '10-1007-s10495-025-02251-5',
    title: '췌장암 치료의 새로운 희망: PARP 억제제와 노화세포 제거의 시너지 효과',
    title_en: 'New Hope for Pancreatic Cancer: Synergy Between PARP Inhibitors and Senolytic Therapy',
    source: 'PubMed', topic: '암', topic_en: 'Cancer',
    published_at: '2026-02-10',
    original_url: 'https://longevity-lab.io/articles/10-1007-s10495-025-02251-5',
    key_messages: [
      'PARP 억제제가 암세포의 노화를 유도하여 치료 효과 발휘',
      '세놀리틱스와 병용 시 시너지 효과로 치료 반응 극대화',
      '치료 저항성 췌장암에 대한 새로운 전략 제시'
    ],
    key_messages_en: [
      'PARP inhibitors induce cancer cell senescence for therapeutic effect',
      'Synergistic response maximization when combined with senolytics',
      'New strategy for treatment-resistant pancreatic cancer'
    ],
    clinical_insight: 'PARP 억제제와 세놀리틱스 병용은 췌장암 치료의 새로운 가능성을 열 수 있습니다.',
    clinical_insight_en: 'PARP inhibitor and senolytic combination could open new possibilities for pancreatic cancer treatment.'
  },
  {
    id: 10, slug: '10-1007-s00018-025-05999-w',
    title: 'RGS12, 건강한 임신을 위한 태반 미토콘드리아의 새로운 조절자',
    title_en: 'RGS12: A Novel Regulator of Placental Mitochondria for Healthy Pregnancy',
    source: 'PubMed', topic: '대사', topic_en: 'Metabolism',
    published_at: '2026-02-10',
    original_url: 'https://longevity-lab.io/articles/10-1007-s00018-025-05999-w',
    key_messages: [
      'RGS12 단백질이 태반 미토콘드리아 기능 조절에 핵심 역할',
      '태반 미토콘드리아 기능 이상이 임신 합병증과 연관',
      '건강한 임신을 위한 새로운 분자 표적 발견'
    ],
    key_messages_en: [
      'RGS12 protein plays a key role in regulating placental mitochondrial function',
      'Placental mitochondrial dysfunction linked to pregnancy complications',
      'Discovery of new molecular target for healthy pregnancy'
    ],
    clinical_insight: 'RGS12가 임신 합병증 예방을 위한 새로운 치료 표적이 될 수 있습니다.',
    clinical_insight_en: 'RGS12 could become a new therapeutic target for preventing pregnancy complications.'
  },
  {
    id: 11, slug: 'nct06824285',
    title: '뇌 건강, 젊음을 유지하는 열쇠는? 뇌 노화 바이오마커 연구',
    title_en: 'The Key to Maintaining Brain Youth? Brain Aging Biomarker Study',
    source: 'ClinicalTrials.gov', topic: '신경과학', topic_en: 'Neuroscience',
    published_at: '2026-02-08',
    original_url: 'https://longevity-lab.io/articles/nct06824285',
    key_messages: [
      'EEG 기반 뇌 노화 바이오마커 개발 연구',
      '뇌파 분석을 통한 개인별 뇌 나이 추정 기술',
      '인지 저하 조기 예측 및 맞춤형 개입 가능성'
    ],
    key_messages_en: [
      'Research on EEG-based brain aging biomarker development',
      'Technology for estimating individual brain age through brainwave analysis',
      'Potential for early prediction of cognitive decline and personalized intervention'
    ],
    clinical_insight: 'EEG 기반 뇌 나이 추정은 인지 저하 조기 발견의 비침습적 도구가 될 수 있습니다.',
    clinical_insight_en: 'EEG-based brain age estimation could become a non-invasive tool for early detection of cognitive decline.'
  },
  {
    id: 12, slug: '10-1038-s41574-025-01187-9',
    title: '대사 질환, 노화 세포가 핵심 열쇠가 될 수 있을까요?',
    title_en: 'Could Senescent Cells Be the Key to Metabolic Disease?',
    source: 'PubMed', topic: '대사', topic_en: 'Metabolism',
    published_at: '2026-02-08',
    original_url: 'https://longevity-lab.io/articles/10-1038-s41574-025-01187-9',
    key_messages: [
      '노화 세포 축적이 인슐린 저항성, 비만, 당뇨 등 대사 질환의 핵심 원인',
      '세놀리틱 치료로 대사 기능 개선 가능성 제시',
      '노화 세포-대사 질환 축의 새로운 치료 패러다임'
    ],
    key_messages_en: [
      'Senescent cell accumulation as core cause of insulin resistance, obesity, and diabetes',
      'Senolytic therapy shows potential for metabolic function improvement',
      'New therapeutic paradigm for the senescent cell-metabolic disease axis'
    ],
    clinical_insight: '노화 세포 제거가 대사 증후군의 근본적 치료 전략이 될 수 있습니다.',
    clinical_insight_en: 'Senescent cell elimination could become a fundamental treatment strategy for metabolic syndrome.'
  },
  {
    id: 13, slug: '10-64898-2026-01-06-26343442',
    title: '파킨슨병과 조현병, 놀라운 유전적 연결고리가 밝혀지다',
    title_en: 'Surprising Genetic Link Between Parkinson\'s Disease and Schizophrenia Revealed',
    source: 'medRxiv (preprint)', topic: '신경과학', topic_en: 'Neuroscience',
    published_at: '2026-02-07',
    original_url: 'https://longevity-lab.io/articles/10-64898-2026-01-06-26343442',
    key_messages: [
      '파킨슨병과 조현병 사이의 공유 유전적 위험 변이 발견',
      '도파민 경로의 유전적 교차점이 두 질환을 연결',
      '약물 재목적화 가능성과 새로운 치료 전략 시사'
    ],
    key_messages_en: [
      'Shared genetic risk variants between Parkinson\'s disease and schizophrenia discovered',
      'Genetic intersection of dopamine pathways links both diseases',
      'Implications for drug repurposing and new therapeutic strategies'
    ],
    clinical_insight: '두 신경정신질환의 공유 유전체 기반은 약물 재목적화의 새로운 기회를 제공합니다.',
    clinical_insight_en: 'The shared genomic basis of these neuropsychiatric diseases provides new opportunities for drug repurposing.'
  },
  {
    id: 14, slug: '10-1111-acel-70368',
    title: '태반 줄기세포, 노화 세포를 젊게 되돌릴 수 있을까요?',
    title_en: 'Can Placental Stem Cells Rejuvenate Senescent Cells?',
    source: 'PubMed', topic: '노화', topic_en: 'Aging',
    published_at: '2026-02-06',
    original_url: 'https://longevity-lab.io/articles/10-1111-acel-70368',
    key_messages: [
      '태반 유래 줄기세포가 노화 세포의 기능을 부분적으로 회복',
      '줄기세포 분비체(secretome)의 항노화 효과 확인',
      '세포 재프로그래밍 없이 노화 역전 가능성 제시'
    ],
    key_messages_en: [
      'Placenta-derived stem cells partially restore senescent cell function',
      'Anti-aging effects of stem cell secretome confirmed',
      'Possibility of aging reversal without cell reprogramming'
    ],
    clinical_insight: '줄기세포 분비체 기반 항노화 치료는 안전하고 효과적인 접근법이 될 수 있습니다.',
    clinical_insight_en: 'Stem cell secretome-based anti-aging therapy could be a safe and effective approach.'
  },
  {
    id: 15, slug: '10-1111-1744-7917-70191',
    title: '누에가 알려주는 장수의 비밀: NAD+와 니코틴산의 놀라운 효능',
    title_en: 'Secrets of Longevity from Silkworms: The Remarkable Effects of NAD+ and Nicotinic Acid',
    source: 'PubMed', topic: '노화', topic_en: 'Aging',
    published_at: '2026-02-06',
    original_url: 'https://longevity-lab.io/articles/10-1111-1744-7917-70191',
    key_messages: [
      '누에 모델에서 NAD+ 전구체 보충이 수명 연장 효과 확인',
      '니코틴산(비타민 B3)이 NAD+ 수준을 효과적으로 회복',
      '미토콘드리아 기능 개선과 산화 스트레스 감소 확인'
    ],
    key_messages_en: [
      'NAD+ precursor supplementation extends lifespan in silkworm model',
      'Nicotinic acid (vitamin B3) effectively restores NAD+ levels',
      'Improved mitochondrial function and reduced oxidative stress confirmed'
    ],
    clinical_insight: 'NAD+ 보충 요법의 항노화 효과에 대한 추가적인 전임상 근거를 제시합니다.',
    clinical_insight_en: 'Provides additional preclinical evidence for anti-aging effects of NAD+ supplementation therapy.'
  },
  {
    id: 16, slug: '10-1101-2024-08-05-606704',
    title: '미토콘드리아 건강, 칼슘 신호에 달렸다! Mfn2의 숨겨진 역할',
    title_en: 'Mitochondrial Health Depends on Calcium Signaling: The Hidden Role of Mfn2',
    source: 'bioRxiv (preprint)', topic: '대사', topic_en: 'Metabolism',
    published_at: '2026-02-06',
    original_url: 'https://longevity-lab.io/articles/10-1101-2024-08-05-606704',
    key_messages: [
      'Mfn2(Mitofusin-2)가 미토콘드리아 칼슘 신호 조절에 핵심 역할',
      '미토콘드리아-소포체(ER) 접촉점에서의 칼슘 전달 메커니즘 규명',
      'Mfn2 기능 이상이 대사 질환과 신경퇴행성 질환에 기여'
    ],
    key_messages_en: [
      'Mfn2 (Mitofusin-2) plays a key role in mitochondrial calcium signaling regulation',
      'Elucidation of calcium transfer mechanism at mitochondria-ER contact sites',
      'Mfn2 dysfunction contributes to metabolic and neurodegenerative diseases'
    ],
    clinical_insight: 'Mfn2를 표적으로 한 미토콘드리아 기능 조절이 다양한 질환의 새로운 치료 전략이 될 수 있습니다.',
    clinical_insight_en: 'Mitochondrial function modulation targeting Mfn2 could become a new therapeutic strategy for various diseases.'
  },
  {
    id: 17, slug: '10-1177-11206721261419640',
    title: '녹내장, 비타민과 영양제로 시력을 지킬 수 있을까요?',
    title_en: 'Can Vitamins and Supplements Protect Vision in Glaucoma?',
    source: 'PubMed', topic: '대사', topic_en: 'Metabolism',
    published_at: '2026-02-05',
    original_url: 'https://longevity-lab.io/articles/10-1177-11206721261419640',
    key_messages: [
      '항산화 영양소의 녹내장 진행 억제 효과 메타분석',
      '비타민 C, E, 아연 등 특정 미량영양소의 안압 조절 기여',
      '보조적 영양 요법이 기존 약물 치료를 보완할 가능성'
    ],
    key_messages_en: [
      'Meta-analysis of antioxidant nutrients in inhibiting glaucoma progression',
      'Specific micronutrients (vitamin C, E, zinc) contribute to intraocular pressure regulation',
      'Supplementary nutritional therapy may complement existing drug treatments'
    ],
    clinical_insight: '영양 보충은 녹내장 관리의 보조 전략으로 고려할 수 있습니다.',
    clinical_insight_en: 'Nutritional supplementation can be considered as an adjunct strategy for glaucoma management.'
  },
  {
    id: 18, slug: '10-1016-j-ejphar-2026-178620',
    title: '나이가 들수록 숨쉬기 힘든 이유, 해답은 자연에서 찾을 수 있을까요?',
    title_en: 'Why Breathing Gets Harder with Age: Could Nature Hold the Answer?',
    source: 'PubMed', topic: '노화', topic_en: 'Aging',
    published_at: '2026-02-05',
    original_url: 'https://longevity-lab.io/articles/10-1016-j-ejphar-2026-178620',
    key_messages: [
      '노화 관련 호흡기 질환의 분자 메커니즘 종합 리뷰',
      '천연 유래 화합물의 폐 조직 보호 및 재생 효과 평가',
      '항산화 및 항염증 천연물의 호흡기 질환 치료 가능성'
    ],
    key_messages_en: [
      'Comprehensive review of molecular mechanisms in aging-related respiratory diseases',
      'Evaluation of natural compound protective and regenerative effects on lung tissue',
      'Therapeutic potential of antioxidant and anti-inflammatory natural products for respiratory diseases'
    ],
    clinical_insight: '천연 유래 항노화 화합물이 호흡기 건강 유지에 유망한 보조 요법이 될 수 있습니다.',
    clinical_insight_en: 'Natural anti-aging compounds could become promising adjunct therapy for respiratory health maintenance.'
  },
  {
    id: 19, slug: 'nct04623593',
    title: '목 디스크 수술, 장기적으로 더 현명한 선택은 무엇일까요?',
    title_en: 'Cervical Disc Surgery: What Is the Wiser Long-term Choice?',
    source: 'ClinicalTrials.gov', topic: '심혈관', topic_en: 'Cardiovascular',
    published_at: '2026-02-12',
    original_url: 'https://longevity-lab.io/articles/nct04623593',
    key_messages: [
      'CACES 임상 연구: 경추 디스크 치료법 비용-효과 장기 비교',
      '수술적 치료 vs 보존적 치료의 5년 이상 장기 추적 결과',
      '환자 삶의 질과 경제적 부담의 균형 평가'
    ],
    key_messages_en: [
      'CACES Trial: Long-term cost-effectiveness comparison of cervical disc treatments',
      '5+ year follow-up results of surgical vs. conservative treatment',
      'Evaluating the balance between patient quality of life and economic burden'
    ],
    clinical_insight: '경추 디스크 치료법 선택 시 장기적 비용-효과 데이터가 의사결정에 중요한 근거를 제공합니다.',
    clinical_insight_en: 'Long-term cost-effectiveness data is crucial for decision-making in cervical disc treatment selection.'
  },
  {
    id: 20, slug: '10-1002-ddr-70221',
    title: '피부 질환, 미토콘드리아 기능 이상과 관련 있다?!',
    title_en: 'Skin Disease Linked to Mitochondrial Dysfunction?!',
    source: 'PubMed', topic: '대사', topic_en: 'Metabolism',
    published_at: '2026-02-05',
    original_url: 'https://longevity-lab.io/articles/10-1002-ddr-70221',
    key_messages: [
      '미토콘드리아 기능 이상이 다양한 피부 질환의 공통 병리기전',
      '산화 스트레스와 에너지 대사 장애가 피부 노화와 질환을 촉진',
      '미토콘드리아 표적 치료의 피부과적 적용 가능성'
    ],
    key_messages_en: [
      'Mitochondrial dysfunction as a common pathomechanism in various skin diseases',
      'Oxidative stress and energy metabolism disorders promote skin aging and disease',
      'Dermatological application potential of mitochondria-targeted therapy'
    ],
    clinical_insight: '미토콘드리아 기능 회복을 표적으로 한 피부 치료가 새로운 접근법이 될 수 있습니다.',
    clinical_insight_en: 'Skin treatments targeting mitochondrial function recovery could become a novel approach.'
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

function parseCookies(req) {
  const cookies = {};
  (req.headers.cookie || '').split(';').forEach(c => {
    const [name, ...rest] = c.trim().split('=');
    if (name) cookies[name] = decodeURIComponent(rest.join('='));
  });
  return cookies;
}

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions[token] = { user, created: Date.now() };
  return token;
}

function getSessionUser(req) {
  const cookies = parseCookies(req);
  const token = cookies.session;
  if (!token || !sessions[token]) return null;
  return sessions[token].user;
}

function parseUrl(req) {
  return new URL(req.url, `https://${req.headers.host || 'localhost'}`);
}

// ── Main handler ──
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

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
        status: 'ok', app: 'PaperMind', platform: 'Vercel',
        features: ['WebGPU AI Chat', 'Longevity Lab Articles', 'Bilingual EN/KO'],
        timestamp: new Date().toISOString()
      });
    }

    // ── /api/auth/signup ──
    if (path === '/api/auth/signup' && req.method === 'POST') {
      const { email, password, nickname } = await parseBody(req);
      if (!email || !password || !nickname) return json(res, { error: 'All fields are required / 모든 필드를 입력해주세요.' }, 400);
      if (password.length < 6) return json(res, { error: 'Password must be 6+ chars / 비밀번호는 6자 이상이어야 합니다.' }, 400);
      if (users[email]) return json(res, { error: 'Email already registered / 이미 등록된 이메일입니다.' }, 400);

      const user = { email, nickname };
      users[email] = { ...user, passwordHash: crypto.createHash('sha256').update(password).digest('hex') };
      const token = createSession(user);
      setCookieHeader(res, 'session', token, { path: '/', httpOnly: true, sameSite: 'Lax', maxAge: 86400 * 7 });
      return json(res, { success: true, user });
    }

    // ── /api/auth/login ──
    if (path === '/api/auth/login' && req.method === 'POST') {
      const { email, password } = await parseBody(req);
      if (!email || !password) return json(res, { error: 'Email and password required / 이메일과 비밀번호를 입력해주세요.' }, 400);

      // Demo mode: accept any credentials
      const nickname = users[email]?.nickname || email.split('@')[0];
      const user = { email, nickname };
      if (!users[email]) users[email] = { ...user, passwordHash: crypto.createHash('sha256').update(password).digest('hex') };
      const token = createSession(user);
      setCookieHeader(res, 'session', token, { path: '/', httpOnly: true, sameSite: 'Lax', maxAge: 86400 * 7 });
      return json(res, { success: true, user });
    }

    // ── /api/auth/logout ──
    if (path === '/api/auth/logout' && req.method === 'POST') {
      const cookies = parseCookies(req);
      if (cookies.session) delete sessions[cookies.session];
      setCookieHeader(res, 'session', '', { path: '/', maxAge: 0 });
      return json(res, { success: true });
    }

    // ── /api/me ──
    if (path === '/api/me') {
      const user = getSessionUser(req);
      return json(res, { user: user || null });
    }

    // ── /api/articles ──
    if (path === '/api/articles' && req.method === 'GET') {
      const topic = url.searchParams.get('topic');
      let articles = ARTICLES.map(a => ({
        id: a.id, slug: a.slug,
        title: a.title, title_en: a.title_en,
        source: a.source, topic: a.topic, topic_en: a.topic_en,
        key_messages: a.key_messages, key_messages_en: a.key_messages_en,
        published_at: a.published_at, original_url: a.original_url
      }));

      if (topic) {
        articles = articles.filter(a => a.topic === topic || a.topic_en === topic);
      }

      return json(res, { articles });
    }

    // ── /api/articles/:slug ──
    const articleMatch = path.match(/^\/api\/articles\/([^/]+)$/);
    if (articleMatch && req.method === 'GET') {
      const slug = decodeURIComponent(articleMatch[1]);
      const article = ARTICLES.find(a => a.slug === slug);
      if (!article) return json(res, { error: 'Article not found' }, 404);
      return json(res, { article });
    }

    // ── /api/newsletter/subscribe ──
    if (path === '/api/newsletter/subscribe' && req.method === 'POST') {
      const { email } = await parseBody(req);
      if (!email) return json(res, { error: 'Email required' }, 400);
      return json(res, { success: true, message: 'Subscribed successfully! / 뉴스레터 구독이 완료되었습니다!' });
    }

    // ── 404 ──
    return json(res, { error: 'Not found', path }, 404);

  } catch (err) {
    console.error('API Error:', err);
    return json(res, { error: 'Internal server error' }, 500);
  }
};
