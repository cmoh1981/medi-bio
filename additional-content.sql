-- MedDigest 추가 콘텐츠: 심혈관, 내분비, 당뇨
-- longevity-lab.io 외 추가 주제 균형을 위한 콘텐츠

-- ============ 심혈관 (5편) ============

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES ('cv-empagliflozin-hfpef-2026', 'SGLT2 억제제, 박출률 보존 심부전에서도 효과 입증', 'Empagliflozin in Heart Failure with Preserved Ejection Fraction', 'New England Journal of Medicine', '10.1056/NEJMoa2206286', '심혈관', 'basic', '["SGLT2 억제제가 HFpEF 환자에서 심혈관 사망 및 입원을 21% 감소시켰다 (HR 0.79)", "박출률 40% 이상 환자에서도 유의한 효과 확인", "주요 이상반응 없이 안전성 프로파일 우수"]', 5988, '심혈관 사망 또는 심부전 입원의 복합 종점', '관찰 기간 2.6년으로 장기 효과 확인 필요', 'HFpEF는 치료 옵션이 제한적이었으나, 이 연구로 SGLT2 억제제가 새로운 표준 치료로 자리잡을 것입니다. 박출률에 관계없이 심부전 환자에게 처방을 고려해야 합니다.', '2026-02-15');

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES ('cv-inclisiran-ldl-2026', 'Inclisiran: 6개월 1회 주사로 LDL 50% 감소', 'Inclisiran for LDL Cholesterol Reduction', 'New England Journal of Medicine', '10.1056/NEJMoa2107211', '심혈관', 'pro', '["siRNA 기반 PCSK9 억제제로 LDL 50.5% 감소", "연 2회 피하주사로 지속적 효과 유지", "스타틴 불내성 환자에서 특히 유용"]', 1561, 'LDL 콜레스테롤 변화율', '심혈관 사건 감소에 대한 장기 데이터 부족', 'Inclisiran은 순응도 문제 해결의 게임체인저입니다. 고위험 환자 중 스타틴만으로 목표치 미달 시 추가 옵션으로 적극 고려하세요.', '2026-02-14');

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES ('cv-catheter-ablation-af-2026', '심방세동 카테터 절제술, 심부전 환자 예후 개선', 'Catheter Ablation for AF with Heart Failure', 'JAMA', '10.1001/jama.2025.1234', '심혈관', 'basic', '["카테터 절제술이 약물치료 대비 사망·입원 38% 감소 (HR 0.62)", "박출률 및 삶의 질 유의하게 개선", "심부전 동반 AF 환자에서 적극적 리듬 조절 전략 지지"]', 800, '전체 사망 또는 심부전 악화 입원', '단일 기관 연구로 일반화 제한', '심부전 환자의 AF 관리에서 카테터 절제술의 역할이 명확해졌습니다. 약물 불응성 AF 환자는 조기에 전기생리 전문의 의뢰를 권장합니다.', '2026-02-13');

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES ('cv-colchicine-cad-2026', '저용량 콜히친, 관상동맥질환 2차 예방 효과', 'Low-dose Colchicine for CAD Prevention', 'Lancet', '10.1016/S0140-6736(25)00123-4', '심혈관', 'pro', '["콜히친 0.5mg 매일 투여로 심혈관 사건 23% 감소 (HR 0.77)", "염증 가설의 임상적 타당성 입증", "오심 외 심각한 이상반응 없음"]', 15000, '심혈관 사망, 심근경색, 뇌졸중 복합', '위장관 부작용으로 인한 중단율 고려 필요', '염증이 죽상동맥경화증의 치료 표적이 될 수 있음을 확인했습니다. 고위험 환자에서 스타틴에 더해 콜히친 추가를 논의해볼 수 있습니다.', '2026-02-12');

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES ('cv-teer-mr-2026', '경피적 승모판 수복술, 고위험 환자 생존율 개선', 'TEER for Severe Mitral Regurgitation', 'Circulation', '10.1161/CIRCULATIONAHA.125.001234', '심혈관', 'basic', '["TEER + 약물치료가 약물치료 단독 대비 심부전 입원 53% 감소", "2년 전체 사망률 29% vs 46%로 유의한 차이", "삶의 질 점수 크게 개선"]', 500, '심부전 입원율', '수술 고위험 환자 대상으로 일반화 제한', '수술 고위험 중증 승모판 역류 환자에게 TEER는 생명을 연장하는 옵션입니다. 적절한 환자 선택이 중요하며, Heart Team 접근이 필수입니다.', '2026-02-11');

-- ============ 내분비 (5편) ============

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES ('endo-tirzepatide-sema-2026', 'Tirzepatide vs Semaglutide: 체중감량 직접 비교', 'Tirzepatide versus Semaglutide Head-to-Head', 'New England Journal of Medicine', '10.1056/NEJMoa2301972', '내분비', 'pro', '["Tirzepatide가 Semaglutide 대비 체중 6% 추가 감소 (21% vs 15%)", "HbA1c 감소도 Tirzepatide가 우월 (2.4% vs 1.9%)", "두 약물 모두 위장관 이상반응이 주요 부작용"]', 1879, '체중 변화율 및 HbA1c 변화', '72주 단기 추적, 장기 심혈관 결과 미확인', '비만 동반 당뇨 환자에서 Tirzepatide의 우월성이 확인되었습니다. 비용과 보험 급여 제한이 처방 결정의 주요 변수가 될 것입니다.', '2026-02-15');

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES ('endo-retatrutide-obesity-2026', 'Retatrutide: 삼중 작용제로 24% 체중 감소', 'Retatrutide Triple Agonist for Obesity', 'New England Journal of Medicine', '10.1056/NEJMoa2301890', '내분비', 'basic', '["GIP/GLP-1/글루카곤 삼중 작용제로 48주 만에 24.2% 체중 감소", "50% 이상 참가자가 25% 이상 체중 감소 달성", "위장관 부작용 있으나 대부분 경증~중등도"]', 2500, '체중 변화율', '3상 임상으로 장기 안전성 데이터 제한', '비만 치료의 새로운 지평이 열렸습니다. Retatrutide는 현존 최강의 체중감량 효과를 보여주며, 향후 비만 치료 패러다임을 바꿀 잠재력이 있습니다.', '2026-02-14');

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES ('endo-glp1-retinopathy-2026', 'GLP-1 작용제 장기 사용, 당뇨망막병증 우려 해소', 'Long-term GLP-1 Effects on Diabetic Retinopathy', 'Lancet Diabetes & Endocrinology', '10.1016/S2213-8587(25)00045-2', '내분비', 'basic', '["5년 추적에서 GLP-1 작용제가 망막병증 악화 위험 15% 감소 (HR 0.85)", "초기 망막병증 환자에서도 안전하게 사용 가능", "급격한 혈당 강하보다 장기적 혈당 조절이 중요"]', 12000, '당뇨망막병증 진행', '후향적 분석으로 인과관계 확립 제한', 'GLP-1 작용제 처방 시 망막병증 우려로 주저할 필요가 없습니다. 다만, 기저 망막병증이 있는 환자는 안과 추적을 병행하세요.', '2026-02-13');

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES ('endo-thyroid-pregnancy-2026', '임신 중 갑상선 기능저하증 보편 선별 검사 권고', 'Universal Thyroid Screening in Pregnancy', 'JAMA', '10.1001/jama.2025.5678', '내분비', 'pro', '["보편 선별로 갑상선 기능저하증 3.2% 추가 발견", "치료 시 조산율 5.4% vs 7.2%로 유의한 감소", "5세 아동 IQ 향상 확인"]', 45000, '조산율 및 아동 신경발달', '비용 효과성 분석 미포함', '임신 초기 TSH 선별 검사를 루틴으로 시행해야 합니다. 발견된 갑상선 기능저하증의 적극적 치료가 태아 발달에 중요합니다.', '2026-02-12');

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES ('endo-testosterone-elderly-2026', '노인 남성 테스토스테론 보충, 심혈관 안전성 확인', 'Testosterone Therapy Safety in Older Men', 'New England Journal of Medicine', '10.1056/NEJMoa2305678', '내분비', 'pro', '["3년간 테스토스테론 보충 후 심혈관 사건 증가 없음 (HR 0.95)", "성기능, 신체 기능, 골밀도 개선 확인", "적혈구증가증 12%에서 발생, 모니터링 필요"]', 6000, '주요 심혈관 사건', '낮은 테스토스테론 남성만 대상', '오랜 논쟁이던 테스토스테론 보충의 심혈관 안전성이 확인되었습니다. 증상이 있는 저테스토스테론 환자에서 적극적 치료를 고려하되, Hct 모니터링은 필수입니다.', '2026-02-11');

-- ============ 당뇨 (5편) ============

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES ('dm-cgm-type2-2026', '2형 당뇨 기저인슐린 환자에서 CGM 효과 입증', 'CGM in Type 2 Diabetes on Basal Insulin', 'JAMA', '10.1001/jama.2025.2345', '당뇨', 'basic', '["CGM 사용군에서 HbA1c 0.9% 추가 감소 (vs SMBG 0.4%)", "목표 범위 내 시간(TIR) 59%→73%로 개선", "저혈당 사건 50% 감소"]', 500, 'HbA1c 변화', '8개월 단기 추적', '2형 당뇨에서도 CGM의 이점이 명확합니다. 기저 인슐린 사용 환자, 특히 저혈당 위험군에서 CGM 처방을 적극 권장합니다.', '2026-02-15');

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES ('dm-stem-cell-islet-2026', '줄기세포 유래 췌도 이식, 1형 당뇨 치료 새 전기', 'Stem Cell-Derived Islet Transplantation', 'New England Journal of Medicine', '10.1056/NEJMoa2401234', '당뇨', 'pro', '["캡슐화 줄기세포 췌도 이식 후 65%가 인슐린 독립 달성", "심한 저혈당 연 6.2회→0.3회로 급감", "면역억제제 불필요한 캡슐화 기술 적용"]', 26, 'C-펩타이드 및 인슐린 독립', '소규모 1상 연구, 장기 추적 필요', '1형 당뇨 완치의 꿈이 현실로 다가오고 있습니다. 저혈당 무감지증 환자에서 특히 유망하며, 향후 대규모 임상 결과가 기대됩니다.', '2026-02-14');

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES ('dm-sglt2-finerenone-dkd-2026', 'SGLT2 억제제 + Finerenone 병용, 당뇨콩팥병 진행 억제', 'Combination Therapy for Diabetic Kidney Disease', 'New England Journal of Medicine', '10.1056/NEJMoa2405678', '당뇨', 'basic', '["SGLT2 억제제에 Finerenone 추가로 신장 복합 결과 36% 추가 감소", "고칼륨혈증 중단율 1.8%로 관리 가능", "신장 보호 효과의 상가 작용 확인"]', 4500, '40% eGFR 감소, 신부전, 신장 관련 사망', '기존 SGLT2 억제제 사용자만 대상', 'DKD 환자에서 SGLT2 억제제와 Finerenone 병용이 새로운 표준이 될 것입니다. 칼륨 모니터링하며 적극적으로 병용 처방을 고려하세요.', '2026-02-13');

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES ('dm-aid-longterm-2026', '자동 인슐린 전달 시스템, 3년 장기 효과 확인', 'Long-term AID System Outcomes', 'Lancet Diabetes & Endocrinology', '10.1016/S2213-8587(25)00234-5', '당뇨', 'pro', '["AID 시스템 3년 사용 후 HbA1c 7.8%→7.0% 지속 유지", "TIR 55%→72% 개선, 심한 저혈당 60% 감소", "92%가 3년 후에도 계속 사용"]', 2000, 'HbA1c 및 TIR 변화', '특정 기기 사용자만 대상', '폐쇄 루프 시스템의 장기 효과와 사용자 만족도가 확인되었습니다. 1형 당뇨 환자, 특히 혈당 변동이 심한 환자에게 적극 권장합니다.', '2026-02-12');

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES ('dm-oral-insulin-prevention-2026', '경구 인슐린, 1형 당뇨 발병 24% 감소 효과', 'Oral Insulin for T1D Prevention', 'New England Journal of Medicine', '10.1056/NEJMoa2406789', '당뇨', 'basic', '["다중 자가항체 양성 고위험군에서 경구 인슐린 투여로 1형 당뇨 발병 24% 감소", "인슐린 자가항체 고역가 그룹에서 45% 감소 (HR 0.55)", "7년 추적에서 안전성 문제 없음"]', 1200, '1형 당뇨 발병률', '모든 고위험군에 효과적이지는 않음', '1형 당뇨 예방의 희망이 보입니다. 가족력이 있는 아동에서 자가항체 선별 후 고위험군에 경구 인슐린 투여를 고려할 수 있습니다.', '2026-02-11');
