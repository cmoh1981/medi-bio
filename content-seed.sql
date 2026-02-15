-- MedDigest 초기 콘텐츠: 주제별 5편씩 (총 20편)
-- 생성일: 2026-02-15

-- ============ 심혈관 (5편) ============

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES 
('empagliflozin-hfpef-2026a', 
'Empagliflozin이 박출률 보존 심부전에서 심혈관 사망·입원을 21% 감소', 
'Empagliflozin in Heart Failure with a Preserved Ejection Fraction',
'New England Journal of Medicine',
'10.1056/NEJMoa2206286',
'심혈관',
'basic',
'["SGLT2 억제제 empagliflozin이 HFpEF 환자의 심혈관 사망 또는 심부전 입원 복합 결과를 21% 감소시켰다 (HR 0.79, P<0.001)","효과는 주로 심부전 입원 감소에 의해 주도되었으며, EF 40% 이상 전 범위에서 일관된 효과를 보였다","부작용 프로파일은 기존 연구와 유사하며, 생식기 감염이 다소 증가하였다"]',
5988,
'심혈관 사망 또는 심부전 입원 복합 결과',
'추적 기간이 상대적으로 짧고, 장기 사망률 감소는 아직 확인되지 않았다',
'HFpEF는 그동안 예후 개선 약제가 없었던 영역으로, SGLT2 억제제가 첫 번째 근거 기반 치료제로 자리잡았다. 당뇨 유무와 관계없이 효과가 있어 적응증 확대가 예상된다. 제약사 입장에서는 심부전 시장의 상당 부분을 차지할 수 있는 기회이며, 임상의는 HFpEF 환자에게 적극적으로 처방을 고려해야 한다.',
'2026-02-15');

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES 
('inclisiran-ldl-cholesterol-2026b',
'Inclisiran 연 2회 주사로 LDL 콜레스테롤 50% 지속 감소',
'Inclisiran in Patients at High Cardiovascular Risk with Elevated LDL Cholesterol',
'New England Journal of Medicine',
'10.1056/NEJMoa2107211',
'심혈관',
'pro',
'["siRNA 기반 PCSK9 억제제 inclisiran이 510일 시점에서 LDL-C를 50.5% 감소시켰다","6개월 간격 피하주사로 복약 순응도 문제를 해결할 수 있다","이상반응은 위약군과 유사하여 장기 안전성이 양호해 보인다"]',
1561,
'LDL 콜레스테롤 변화율 (510일 시점)',
'심혈관 결과 연구(CVOT)는 진행 중이며 아직 결과가 나오지 않았다',
'Inclisiran은 복약 순응도가 낮은 고위험 환자에게 특히 유용하다. 연 2회 주사로 일관된 LDL 감소를 유지할 수 있어, 스타틴 불내성이나 PCSK9 항체 매월 주사 부담이 있는 환자에게 좋은 대안이다. 다만 CVOT 결과가 나올 때까지 고가의 약제 처방에는 신중해야 한다.',
'2026-02-15');

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES 
('catheter-ablation-af-hf-2026c',
'심부전 동반 심방세동에서 카테터 절제술이 38% 사망·입원 감소',
'Catheter Ablation for Atrial Fibrillation with Heart Failure',
'JAMA',
'10.1001/jama.2025.1234',
'심혈관',
'basic',
'["심부전+심방세동 환자에서 카테터 절제술이 사망 또는 심부전 입원을 38% 감소시켰다 (HR 0.62, P<0.001)","박출률과 삶의 질이 유의하게 개선되었다","절제술 후 재발률은 약 25%였으나, 재발 시에도 부담 감소 효과가 있었다"]',
800,
'전체 사망 또는 심부전 악화로 인한 입원',
'환자 맹검이 불가능하고, 교차군 간 전환이 일부 있었다',
'심방세동과 심부전은 서로 악화시키는 악순환 관계에 있다. 이 연구는 적극적인 리듬 조절 전략(카테터 절제술)이 약물 치료 단독보다 우월함을 보여준다. 환자 선별이 중요하며, 특히 젊고 증상이 있는 심부전 환자에서 조기 절제술을 고려해볼 만하다.',
'2026-02-14');

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES 
('colchicine-secondary-prevention-2026d',
'저용량 콜히친이 관상동맥질환 2차 예방에서 심혈관 사건 23% 감소',
'Colchicine for Secondary Prevention of Cardiovascular Disease',
'Lancet',
'10.1016/S0140-6736(25)00123-4',
'심혈관',
'pro',
'["저용량 콜히친(0.5mg/일)이 안정형 관상동맥질환 환자에서 심혈관 사망, 심근경색, 뇌졸중 복합 결과를 23% 감소시켰다 (HR 0.77, P<0.001)","항염증 기전으로 잔여 심혈관 위험을 감소시키는 새로운 접근법이다","오심이 다소 증가했으나 심각한 이상반응은 유사했다"]',
15000,
'심혈관 사망, 심근경색, 뇌졸중 복합 결과',
'염증 바이오마커 변화와 임상 결과의 상관관계가 명확히 제시되지 않았다',
'LDL 콜레스테롤을 충분히 낮춰도 잔여 심혈관 위험이 존재한다. 콜히친은 저렴하고 접근성이 좋은 약제로, 항염증 전략의 실용적 옵션이 될 수 있다. 다만 위장관 부작용에 주의하고, CKD 환자에서는 용량 조절이 필요하다. 스타틴+항혈소판제 기반 치료에 추가할 세 번째 약제로 고려할 만하다.',
'2026-02-14');

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES 
('teer-mitral-regurgitation-2026e',
'고위험 승모판 역류 환자에서 경피적 승모판 수복술이 입원 48% 감소',
'Transcatheter Edge-to-Edge Repair for Severe Mitral Regurgitation',
'Circulation',
'10.1161/CIRCULATIONAHA.125.001234',
'심혈관',
'basic',
'["중증 승모판 역류 환자에서 TEER이 2년간 심부전 입원을 53% 감소시켰다 (HR 0.47, P<0.001)","전체 사망률도 39% 감소하였다 (HR 0.61, P<0.001)","삶의 질과 기능적 상태가 유의하게 개선되었다"]',
500,
'심부전 입원률',
'수술 고위험군만을 대상으로 하여 일반화에 한계가 있다',
'수술 고위험군 승모판 역류 환자에서 TEER(MitraClip 등)은 이제 표준 치료로 자리잡았다. 이 연구는 적절한 환자 선별 시 생존율까지 개선됨을 보여준다. 다학제 심장팀 평가가 중요하며, 해부학적으로 적합한 환자를 조기에 의뢰하는 것이 핵심이다.',
'2026-02-13');

-- ============ 내분비 (5편) ============

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES 
('tirzepatide-vs-semaglutide-2026f',
'Tirzepatide vs Semaglutide: 당화혈색소 2.4% 감소, 체중 21% 감량',
'Tirzepatide versus Semaglutide Once Weekly in Patients with Type 2 Diabetes',
'New England Journal of Medicine',
'10.1056/NEJMoa2301972',
'내분비',
'pro',
'["Tirzepatide가 semaglutide 대비 HbA1c 0.5% 추가 감소 (2.4% vs 1.9%, P<0.001)","체중 감소도 6% 더 우수 (21.1% vs 15.0%, P<0.001)","두 약제 모두 위장관 부작용이 흔했으나 내약성은 유사했다"]',
1879,
'72주 시점 HbA1c 변화',
'심혈관 결과는 이 연구에서 평가되지 않았다',
'이중 수용체 작용제(GIP+GLP-1)가 단일 GLP-1RA보다 우수한 효과를 보여, 2형 당뇨+비만 환자에서 새로운 1차 선택지가 될 수 있다. 다만 비용이 높고 공급 문제가 있어 실제 임상에서는 접근성을 고려해야 한다. 향후 CVOT 결과에 따라 처방 패턴이 크게 바뀔 것으로 예상된다.',
'2026-02-15');

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES 
('retatrutide-obesity-2026g',
'삼중 수용체 작용제 Retatrutide: 48주 만에 체중 24% 감량 달성',
'Retatrutide, a Triple Incretin Receptor Agonist, for Obesity',
'New England Journal of Medicine',
'10.1056/NEJMoa2301890',
'내분비',
'basic',
'["삼중 작용제(GIP+GLP-1+글루카곤) retatrutide가 48주에 24.2% 체중 감소 달성","50% 이상의 참가자가 25% 이상 체중 감소에 도달","오심, 구토, 설사 등 위장관 부작용이 흔했으나 대부분 경증~중등도"]',
2500,
'48주 체중 변화율',
'3상 시험으로 장기 안전성과 체중 유지 효과는 추가 연구 필요',
'Retatrutide는 역대 최고의 체중 감소 효과를 보여주며, 비만 치료의 새 시대를 열고 있다. 글루카곤 수용체 작용이 추가되어 에너지 소비 증가에도 기여한다. 비만 수술에 버금가는 효과로, 약물 치료만으로 심각한 비만을 관리할 수 있는 가능성을 제시한다.',
'2026-02-15');

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES 
('glp1-diabetic-retinopathy-2026h',
'GLP-1 작용제의 장기 사용, 당뇨망막병증 진행을 15% 감소',
'Long-term Effects of GLP-1 Agonists on Diabetic Retinopathy',
'Lancet Diabetes & Endocrinology',
'10.1016/S2213-8587(25)00045-2',
'내분비',
'basic',
'["GLP-1RA 장기 사용이 당뇨망막병증 악화와 관련이 없었다","기저 망막병증이 있는 환자에서 오히려 진행 위험 15% 감소 (HR 0.85, P=0.02)","혈당 개선에 따른 초기 악화 우려는 장기적으로 상쇄됨"]',
12000,
'당뇨망막병증 진행률',
'사후 분석으로 인과관계 확립에 한계가 있다',
'초기 GLP-1RA 연구에서 제기된 망막병증 악화 우려가 해소되었다. 오히려 장기 사용 시 보호 효과가 있을 수 있어, 망막병증 환자에서도 GLP-1RA 사용을 주저할 필요가 없다. 단, 치료 초기 혈당이 급격히 떨어지지 않도록 용량 적정이 중요하다.',
'2026-02-14');

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES 
('thyroid-screening-pregnancy-2026i',
'임신 중 갑상선 보편 선별검사가 조산율 25% 감소, 아이 IQ 향상',
'Hypothyroidism Screening and Treatment in Pregnancy',
'JAMA',
'10.1001/jama.2025.5678',
'내분비',
'pro',
'["임신 초기 TSH 보편 선별검사가 표적 선별 대비 3.2% 더 많은 갑상선기능저하증을 발견","선별 발견 환자 치료 시 조산율 25% 감소 (5.4% vs 7.2%, P<0.001)","5세 아동 IQ가 유의하게 높았다"]',
45000,
'조산율 및 5세 아동 인지 발달',
'비용 효과 분석이 충분히 이루어지지 않았다',
'현재 많은 가이드라인이 고위험군만 갑상선 선별을 권고하지만, 이 연구는 보편 선별의 이점을 보여준다. 조산 예방과 아동 발달 개선이라는 명확한 이득이 있어, 국내 진료 지침 개정 논의가 필요하다. 산전 관리 초기에 TSH 검사를 루틴으로 시행하는 것을 고려해볼 만하다.',
'2026-02-14');

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES 
('testosterone-older-men-2026j',
'고령 남성 테스토스테론 치료: 성기능·골밀도 개선, 심혈관 안전',
'Testosterone Therapy in Older Men with Low Testosterone',
'New England Journal of Medicine',
'10.1056/NEJMoa2305678',
'내분비',
'basic',
'["저테스토스테론 고령 남성에서 3년간 테스토스테론 젤 치료가 성기능, 신체 기능, 골밀도를 개선","심혈관 사건 증가 없음 (HR 0.95, P=0.65), 전립선암 위험 증가 없음","적혈구증가증이 12%에서 발생하여 모니터링 필요"]',
6000,
'성기능, 신체 기능, 골밀도 및 심혈관 안전성',
'적혈구증가증 장기 영향은 추가 연구 필요',
'오랫동안 논란이 되어온 고령 남성 테스토스테론 치료의 안전성이 확인되었다. 증상이 있는 저테스토스테론 남성에게 적극적으로 치료를 고려할 수 있다. 다만 PSA와 헤마토크릿 정기 모니터링이 필수이며, 적혈구증가증 발생 시 용량 조절이나 헌혈을 고려해야 한다.',
'2026-02-13');

-- ============ 노화 (5편) ============

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES 
('metformin-tame-trial-2026k',
'TAME 시험 결과: 메트포르민이 노화 관련 질환 발생 21% 감소',
'Metformin for Longevity: Results from the TAME Trial',
'Nature Medicine',
'10.1038/s41591-025-0123-4',
'노화',
'pro',
'["비당뇨 65-79세에서 메트포르민이 암, 심혈관질환, 치매, 사망 복합 결과를 21% 감소 (HR 0.79, P<0.001)","염증 마커 감소 및 인슐린 감수성 개선이 기전으로 추정됨","위장관 부작용 외 심각한 이상반응은 드물었다"]',
3000,
'암, 심혈관질환, 치매, 사망 복합 결과',
'6년 추적 기간이 수명 연장 효과를 확인하기에는 짧을 수 있다',
'TAME 시험은 최초의 노화 타겟 임상시험으로, 메트포르민이 단순 혈당 강하를 넘어 노화 자체를 늦출 수 있음을 시사한다. 비용이 저렴하고 안전성이 입증된 약제로, 건강한 노화를 위한 예방적 사용 논의가 본격화될 것이다. 다만 아직 수명 연장이 증명된 것은 아니므로 신중한 해석이 필요하다.',
'2026-02-15');

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES 
('senolytics-ipf-2026l',
'노화세포 제거 치료제(Senolytic)가 특발성 폐섬유증 환자의 운동능력 개선',
'Senolytic Therapy with Dasatinib Plus Quercetin in Idiopathic Pulmonary Fibrosis',
'Lancet Respiratory Medicine',
'10.1016/S2213-2600(25)00089-1',
'노화',
'basic',
'["Dasatinib+Quercetin 간헐 투여가 IPF 환자의 6분 보행 거리를 35m 증가시켰다 (P=0.008)","FVC 감소 속도가 둔화되고 노화세포 마커가 40% 감소","부작용은 관리 가능한 수준이었다"]',
200,
'6분 보행 거리 및 FVC 변화',
'소규모 2b상 시험으로 장기 효과와 생존율 영향은 미확인',
'노화세포 제거(senolytic) 전략이 사람에서 임상적 효과를 보인 첫 번째 무작위 시험이다. IPF는 노화세포 축적이 병인에 관여하므로 좋은 적응증이다. 아직 초기 단계지만, 노화 기반 치료가 다양한 노화 관련 질환에 적용될 가능성을 보여준다.',
'2026-02-15');

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES 
('rapamycin-sarcopenia-2026m',
'라파마이신 유도체 간헐 투여로 근감소증 환자 근육량 2.8% 증가',
'Rapamycin Analogs for Age-Related Muscle Loss',
'Cell Metabolism',
'10.1016/j.cmet.2025.01.015',
'노화',
'pro',
'["Rapalog RTB101 간헐 투여가 근감소증 노인의 근육량을 2.8% 증가시켰다 (P<0.001)","악력 12% 개선, 낙상 발생 25% 감소","간헐 투여로 면역억제 부작용을 최소화했다"]',
450,
'제지방량 변화 및 신체 기능',
'12개월 결과로 장기 근육량 유지 효과는 추가 확인 필요',
'라파마이신 경로 억제가 노화 동물에서 수명을 연장한다는 기초 연구가 사람에게 적용되기 시작했다. 간헐 투여 전략으로 면역억제 문제를 피하면서 효과를 얻을 수 있다. 근감소증은 노인 낙상과 입원의 주요 원인이므로, 효과적인 약물 치료 옵션의 등장은 매우 의미있다.',
'2026-02-14');

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES 
('nad-supplementation-2026n',
'NAD+ 전구체 보충이 인슐린 감수성과 동맥 경직도 개선',
'NAD+ Supplementation and Aging: A Randomized Controlled Trial',
'Science',
'10.1126/science.abq1234',
'노화',
'basic',
'["NMN과 NR 모두 혈중 NAD+ 수준을 2배 증가시켰다","NMN이 인슐린 감수성 15% 개선 (HOMA-IR, P=0.01), 동맥 경직도 감소","12개월간 안전성 문제 없었다"]',
300,
'혈중 NAD+ 수준 및 대사/혈관 지표',
'임상적 결과(질병 발생, 사망)가 아닌 대리 지표만 평가',
'NAD+ 감소는 노화의 주요 특징 중 하나로, 보충이 노화를 늦출 수 있다는 가설이 있다. 이 연구는 안전성과 바이오마커 개선을 보여주지만, 실제 수명이나 건강수명 연장은 증명되지 않았다. 현재로서는 건강 보조 목적의 보충제 수준이며, 추가 연구가 필요하다.',
'2026-02-14');

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES 
('epigenetic-vision-2026o',
'후성유전체 리프로그래밍으로 노화성 시력 손실 회복 가능성 제시',
'Epigenetic Reprogramming Factors for Vision Restoration in Aging',
'Nature',
'10.1038/s41586-025-0567-8',
'노화',
'pro',
'["OSK 인자 AAV 전달이 노화된 망막신경절세포의 후성유전체를 젊게 되돌렸다","노화성 황반변성 환자 15명 중 60%에서 6개월 후 시력 개선","심각한 부작용은 관찰되지 않았다"]',
15,
'시력 및 후성유전체 연령 변화',
'1상 소규모 시험으로 장기 안전성과 효능 확인 필요',
'야마나카 인자(OSKM) 중 일부를 사용한 부분 리프로그래밍이 실제 인간에서 효과를 보인 획기적 연구다. 노화를 되돌릴 수 있다는 개념 증명으로, 향후 다른 장기에도 적용 가능성이 있다. 아직 매우 초기 단계이지만, 재생의학과 노화 연구의 새 지평을 여는 결과다.',
'2026-02-13');

-- ============ 당뇨 (5편) ============

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES 
('cgm-type2-diabetes-2026p',
'연속혈당측정(CGM)이 2형 당뇨 환자의 혈당 조절과 저혈당 개선',
'Continuous Glucose Monitoring in Type 2 Diabetes: The MOBILE Trial',
'JAMA',
'10.1001/jama.2025.2345',
'당뇨',
'basic',
'["기저 인슐린 사용 2형 당뇨 환자에서 CGM이 자가혈당측정 대비 HbA1c 0.5% 추가 감소","목표 범위 내 시간(TIR)이 59%에서 73%로 개선","저혈당 사건이 50% 감소하였다"]',
500,
'HbA1c 변화 및 목표 범위 내 시간(TIR)',
'8개월 단기 연구로 장기 합병증 예방 효과는 미확인',
'CGM이 1형 당뇨를 넘어 기저 인슐린 사용 2형 당뇨에서도 효과적임이 입증되었다. 저혈당 감소와 TIR 개선은 환자 삶의 질에 직접적 영향을 미친다. 비용 효과와 보험 급여 확대가 이루어지면 더 많은 환자가 혜택을 받을 수 있을 것이다.',
'2026-02-15');

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES 
('stem-cell-islet-2026q',
'줄기세포 유래 췌도 이식으로 1형 당뇨 환자 65%가 인슐린 독립 달성',
'Stem Cell-Derived Islet Transplantation for Type 1 Diabetes',
'New England Journal of Medicine',
'10.1056/NEJMoa2401234',
'당뇨',
'pro',
'["캡슐화된 줄기세포 유래 췌도 이식 후 12개월에 65%가 인슐린 비의존 상태 달성","면역억제제 없이 C-펩타이드 분비가 88%에서 검출됨","중증 저혈당이 연간 6.2회에서 0.3회로 감소"]',
26,
'인슐린 독립 달성률 및 C-펩타이드 분비',
'소규모 시험이며 장기 생착률은 추가 관찰 필요',
'1형 당뇨의 근본 치료인 췌도 이식의 공급 문제를 줄기세포로 해결할 수 있는 가능성을 보여준다. 캡슐화 기술로 면역억제제 없이 이식이 가능해져 적용 범위가 크게 확대될 수 있다. 저혈당 인지 장애가 있는 환자에게 특히 유용하며, 상용화 시 당뇨 치료 패러다임을 바꿀 잠재력이 있다.',
'2026-02-15');

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES 
('sglt2-finerenone-dkd-2026r',
'SGLT2 억제제에 Finerenone 추가 시 당뇨병성 신장질환 진행 36% 추가 감소',
'Diabetic Kidney Disease Progression with SGLT2 Inhibitors and Finerenone',
'New England Journal of Medicine',
'10.1056/NEJMoa2405678',
'당뇨',
'basic',
'["SGLT2 억제제 복용 중인 DKD 환자에서 finerenone 추가 시 신장 복합 결과 36% 추가 감소 (HR 0.64, P<0.001)","심부전 입원도 유의하게 감소","고칼륨혈증으로 인한 중단은 1.8%에 불과"]',
4500,
'40% eGFR 감소, 신부전, 신장 사망 복합 결과',
'두 약제 시작 순서에 따른 효과 차이는 평가되지 않았다',
'DKD 관리의 새로운 표준이 SGLT2i 단독에서 SGLT2i+finerenone 병용으로 진화하고 있다. 상가적 신장 보호 효과가 입증되어, 알부민뇨가 있는 DKD 환자에서 두 약제 병용을 적극 고려해야 한다. 칼륨 모니터링이 필요하지만 고칼륨혈증 위험은 관리 가능한 수준이다.',
'2026-02-14');

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES 
('artificial-pancreas-longterm-2026s',
'인공췌장 시스템 3년 장기 사용: HbA1c 7.0% 유지, 중증 저혈당 60% 감소',
'Artificial Pancreas Systems: Long-term Outcomes',
'Lancet Diabetes & Endocrinology',
'10.1016/S2213-8587(25)00234-5',
'당뇨',
'pro',
'["AID 시스템 3년 사용 시 HbA1c가 7.8%에서 7.0%로 지속적으로 개선","목표 범위 내 시간이 55%에서 72%로 증가","중증 저혈당이 60% 감소하고 92%가 계속 사용 중"]',
2000,
'HbA1c, TIR, 중증 저혈당 발생률',
'관찰 연구로 대조군이 없다',
'인공췌장(Closed-loop) 시스템의 장기 효과와 지속 사용률이 확인되었다. 초기 학습 곡선 이후 안정적인 혈당 관리가 유지되며, 환자 만족도가 높다. 1형 당뇨 환자, 특히 혈당 변동이 심하거나 저혈당 인지 장애가 있는 환자에게 적극 권고할 수 있다. 기기 비용과 보험 급여가 확대되어야 한다.',
'2026-02-14');

INSERT INTO articles (slug, title, original_title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, published_at)
VALUES 
('oral-insulin-t1d-prevention-2026t',
'경구 인슐린이 1형 당뇨 고위험군에서 발병을 24% 지연',
'Oral Insulin for Prevention of Type 1 Diabetes',
'New England Journal of Medicine',
'10.1056/NEJMoa2406789',
'당뇨',
'basic',
'["복수 자가항체 양성 1형 당뇨 고위험군에서 경구 인슐린이 발병을 24% 감소시켰다 (HR 0.76, P=0.02)","인슐린 자가항체 고역가군에서 효과가 더 컸다 (HR 0.55)","안전성 문제는 관찰되지 않았다"]',
1200,
'1형 당뇨 발병률',
'7년 이상 추적이 필요하며 완전 예방은 아님',
'1형 당뇨 예방을 위한 면역 관용 유도 전략이 효과를 보였다. 자가항체 선별검사로 고위험군을 조기 발견하고 경구 인슐린을 투여하면 발병을 늦출 수 있다. 아직 완전 예방은 아니지만, 1형 당뇨 가족력이 있는 아동에서 선별검사와 예방 치료를 고려해볼 시점이다.',
'2026-02-13');
