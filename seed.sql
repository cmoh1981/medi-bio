-- MedDigest Sample Data (Seed)
-- Sample articles for testing

INSERT OR IGNORE INTO articles (slug, title, journal, doi, topic, tier, key_messages, study_n, study_endpoint, study_limitations, clinical_insight, full_content, published_at) VALUES 
(
  'sglt2-heart-failure-2026',
  'SGLT2 억제제의 심부전 예방 효과: 대규모 RCT 결과',
  'NEJM',
  '10.1056/NEJMoa2026001',
  '심혈관',
  'basic',
  '["SGLT2 억제제가 당뇨병 환자의 심부전 입원율을 35% 감소시켰다", "eGFR 감소 속도가 위약 대비 40% 둔화되었다", "심혈관 사망률이 20% 유의하게 감소했다"]',
  12500,
  'Primary: 심부전 입원 + 심혈관 사망 복합 / Secondary: eGFR 변화율',
  '추적 기간 3년으로 장기 효과 확인 필요, 아시아인 비율 15%로 일반화 제한',
  '당뇨병 환자에서 SGLT2 억제제는 더 이상 단순 혈당 조절제가 아니다. 이번 연구는 심부전 고위험군에서 1차 예방 목적으로도 적극 고려해야 함을 시사한다. 특히 eGFR 45 이상인 환자에서 효과가 두드러졌으며, 바이오 스타트업 관점에서는 SGLT2 + GLP-1 병용 요법의 시너지 연구가 다음 타겟이 될 것이다.',
  'Full paper content here for AI analysis...',
  '2026-02-15'
),
(
  'glp1-obesity-brain-2026',
  'GLP-1 수용체 작용제의 뇌 보상회로 조절 메커니즘',
  'Nature Medicine',
  '10.1038/s41591-026-0001',
  '내분비',
  'pro',
  '["Semaglutide가 시상하부-보상회로 연결성을 직접 조절함을 fMRI로 확인", "음식 갈망(craving) 점수가 60% 감소, 이는 체중 감소와 독립적 효과", "도파민 D2 수용체 가용성 변화가 치료 반응 예측인자로 확인"]',
  480,
  'Primary: fMRI 기반 보상회로 연결성 변화 / Secondary: 음식 갈망 점수, 체중 변화',
  '소규모 연구, 6개월 추적, 장기 인지 기능 영향 미확인',
  '비만 치료의 패러다임이 바뀌고 있다. GLP-1 작용제가 단순히 식욕을 억제하는 것이 아니라, 뇌의 보상 시스템 자체를 리모델링한다는 증거다. 이는 중독 치료 영역으로의 확장 가능성을 시사하며, Companion Dx 개발 기회도 열린다. D2 수용체 PET 영상이 반응 예측에 활용될 수 있다.',
  'Detailed neuroimaging methodology and results...',
  '2026-02-14'
),
(
  'aging-clock-intervention-2026',
  'DNA 메틸화 시계 역전: 최초의 인간 개입 연구',
  'Cell',
  '10.1016/j.cell.2026.01.001',
  '노화',
  'pro',
  '["복합 개입(운동+식이+수면+보충제)이 후성유전학적 나이를 평균 3.2년 되돌렸다", "12주 개입으로 GrimAge 시계가 유의하게 감소", "효과는 개입 중단 후 6개월까지 부분적으로 유지됨"]',
  120,
  'Primary: GrimAge 후성유전학적 나이 변화 / Secondary: 생물학적 마커 패널',
  '소규모 파일럿, 대조군 없음, 각 개입의 기여도 분리 불가',
  '노화 역전이 더 이상 SF가 아니다. 이 연구는 생활습관 개입만으로도 후성유전학적 시계를 되돌릴 수 있음을 보여준다. Longevity 스타트업들에게는 중요한 PoC 데이터이며, 향후 개별 개입 요소의 효과를 분리하는 연구가 필요하다. 임상의로서는 환자 동기 부여에 강력한 근거가 될 수 있다.',
  'Epigenetic analysis protocols and lifestyle intervention details...',
  '2026-02-13'
);

-- Sample user (for testing)
INSERT OR IGNORE INTO users (kakao_id, email, nickname, profile_image, subscription_tier) VALUES 
('test_kakao_123', 'test@meddigest.com', '테스트유저', NULL, 'pro');
