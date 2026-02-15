-- MedDigest Seed Data for Supabase

-- Insert sample articles
INSERT INTO articles (slug, title, original_title, journal, doi, pmid, topic, tier, key_messages, clinical_insight, published_at) VALUES
-- 심혈관
('empagliflozin-hfpef-2026a', 'Empagliflozin이 박출률 보존 심부전에서 심혈관 사망·입원을 21% 감소', 'Empagliflozin in Heart Failure with Preserved Ejection Fraction', 'New England Journal of Medicine', '10.1056/NEJMoa2xxxxx1', '39000001', '심혈관', 'basic', '["SGLT2 억제제 empagliflozin이 HFpEF 환자의 심혈관 사망 또는 심부전 입원 복합 결과를 21% 감소시켰다 (HR 0.79, P<0.001)", "효과는 주로 심부전 입원 감소에 의해 주도되었으며, EF 40% 이상 전 범위에서 일관된 효과를 보였다", "부작용 프로파일은 기존 연구와 유사하며, 생식기 감염이 다소 증가하였다"]', 'HFpEF 환자에서 SGLT2 억제제 사용을 적극 고려해야 한다.', CURRENT_DATE),

('inclisiran-ldl-cholesterol-2026b', 'Inclisiran 연 2회 주사로 LDL 콜레스테롤 50% 지속 감소', 'Inclisiran for LDL Cholesterol Reduction', 'New England Journal of Medicine', '10.1056/NEJMoa2xxxxx2', '39000002', '심혈관', 'pro', '["siRNA 기반 PCSK9 억제제 inclisiran이 510일 시점에서 LDL-C를 50.5% 감소시켰다", "6개월 간격 피하주사로 복약 순응도 문제를 해결할 수 있다", "이상반응은 위약군과 유사하여 장기 안전성이 양호해 보인다"]', '스타틴에 반응이 불충분하거나 순응도가 낮은 환자에게 고려할 수 있다.', CURRENT_DATE),

('catheter-ablation-af-hf-2026c', '심부전 동반 심방세동에서 카테터 절제술이 38% 사망·입원 감소', 'Catheter Ablation for AF in Heart Failure', 'JAMA', '10.1001/jama.2026.xxxxx3', '39000003', '심혈관', 'basic', '["심부전+심방세동 환자에서 카테터 절제술이 사망 또는 심부전 입원을 38% 감소시켰다 (HR 0.62, P<0.001)", "박출률과 삶의 질이 유의하게 개선되었다", "절제술 후 재발률은 약 25%였으나, 재발 시에도 부담 감소 효과가 있었다"]', '심부전 동반 AF 환자에서 리듬 조절 전략으로 절제술을 적극 고려해야 한다.', CURRENT_DATE - INTERVAL '1 day'),

('colchicine-secondary-prevention-2026d', '저용량 콜히친이 관상동맥질환 2차 예방에서 심혈관 사건 23% 감소', 'Low-dose Colchicine in Secondary Prevention', 'Lancet', '10.1016/S0140-6736(26)xxxxx4', '39000004', '심혈관', 'pro', '["저용량 콜히친(0.5mg/일)이 안정형 관상동맥질환 환자에서 심혈관 사망, 심근경색, 뇌졸중 복합 결과를 23% 감소시켰다 (HR 0.77, P<0.001)", "항염증 기전으로 잔여 심혈관 위험을 감소시키는 새로운 접근법이다", "오심이 다소 증가했으나 심각한 이상반응은 유사했다"]', '최적의 약물 치료에도 잔여 위험이 있는 환자에게 추가 고려할 수 있다.', CURRENT_DATE - INTERVAL '1 day'),

-- 내분비
('tirzepatide-vs-semaglutide-2026f', 'Tirzepatide vs Semaglutide: 당화혈색소 2.4% 감소, 체중 21% 감량', 'Tirzepatide vs Semaglutide Head-to-Head', 'New England Journal of Medicine', '10.1056/NEJMoa2xxxxx6', '39000006', '내분비', 'pro', '["Tirzepatide가 semaglutide 대비 HbA1c 0.5% 추가 감소 (2.4% vs 1.9%, P<0.001)", "체중 감소도 6% 더 우수 (21.1% vs 15.0%, P<0.001)", "두 약제 모두 위장관 부작용이 흔했으나 내약성은 유사했다"]', '비만 동반 2형 당뇨에서 tirzepatide가 우수한 효과를 보인다.', CURRENT_DATE),

('retatrutide-obesity-2026g', '삼중 수용체 작용제 Retatrutide: 48주 만에 체중 24% 감량 달성', 'Retatrutide Triple Agonist for Obesity', 'New England Journal of Medicine', '10.1056/NEJMoa2xxxxx7', '39000007', '내분비', 'basic', '["삼중 작용제(GIP+GLP-1+글루카곤) retatrutide가 48주에 24.2% 체중 감소 달성", "50% 이상의 참가자가 25% 이상 체중 감소에 도달", "오심, 구토, 설사 등 위장관 부작용이 흔했으나 대부분 경증~중등도"]', '차세대 비만 치료제로서 큰 잠재력을 보여준다.', CURRENT_DATE),

-- 노화
('metformin-tame-trial-2026k', 'TAME 시험 결과: 메트포르민이 노화 관련 질환 발생 21% 감소', 'TAME Trial: Metformin and Aging', 'Nature Medicine', '10.1038/s41591-026-xxxxx11', '39000011', '노화', 'pro', '["비당뇨 65-79세에서 메트포르민이 암, 심혈관질환, 치매, 사망 복합 결과를 21% 감소 (HR 0.79, P<0.001)", "염증 마커 감소 및 인슐린 감수성 개선이 기전으로 추정됨", "위장관 부작용 외 심각한 이상반응은 드물었다"]', '노화 관련 질환 예방을 위한 메트포르민 사용 근거가 확립되었다.', CURRENT_DATE),

('senolytics-ipf-2026l', '노화세포 제거 치료제(Senolytic)가 특발성 폐섬유증 환자의 운동능력 개선', 'Senolytics in Idiopathic Pulmonary Fibrosis', 'Lancet Respiratory Medicine', '10.1016/S2213-2600(26)xxxxx12', '39000012', '노화', 'basic', '["Dasatinib+Quercetin 간헐 투여가 IPF 환자의 6분 보행 거리를 35m 증가시켰다 (P=0.008)", "FVC 감소 속도가 둔화되고 노화세포 마커가 40% 감소", "부작용은 관리 가능한 수준이었다"]', '노화세포 타겟 치료가 IPF에서 새로운 가능성을 제시한다.', CURRENT_DATE),

-- 당뇨
('cgm-type2-diabetes-2026p', '연속혈당측정(CGM)이 2형 당뇨 환자의 혈당 조절과 저혈당 개선', 'CGM in Type 2 Diabetes Management', 'JAMA', '10.1001/jama.2026.xxxxx16', '39000016', '당뇨', 'basic', '["기저 인슐린 사용 2형 당뇨 환자에서 CGM이 자가혈당측정 대비 HbA1c 0.5% 추가 감소", "목표 범위 내 시간(TIR)이 59%에서 73%로 개선", "저혈당 사건이 50% 감소하였다"]', '인슐린 사용 2형 당뇨 환자에서 CGM 적용을 적극 권장한다.', CURRENT_DATE),

('stem-cell-islet-2026q', '줄기세포 유래 췌도 이식으로 1형 당뇨 환자 65%가 인슐린 독립 달성', 'Stem Cell-Derived Islet Transplantation', 'New England Journal of Medicine', '10.1056/NEJMoa2xxxxx17', '39000017', '당뇨', 'pro', '["캡슐화된 줄기세포 유래 췌도 이식 후 12개월에 65%가 인슐린 비의존 상태 달성", "면역억제제 없이 C-펩타이드 분비가 88%에서 검출됨", "중증 저혈당이 연간 6.2회에서 0.3회로 감소"]', '1형 당뇨의 근본적 치료 가능성을 제시하는 획기적 연구이다.', CURRENT_DATE)

ON CONFLICT (slug) DO NOTHING;
