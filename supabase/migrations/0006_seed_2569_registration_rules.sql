-- Seed the 2569 school policy. Keep lower and upper secondary independent.
-- M.1 and M.4 must sit Dhamma level ตรี; progression is optional.
with rules(education_band, grade_level, dhamma_level, required_for_grade, note) as (
  values
    ('lower_secondary', 1, 'ตรี', true,  'บังคับสอบชั้นตรีสำหรับ ม.1 ตามหลักเกณฑ์โรงเรียน'),
    ('lower_secondary', 1, 'โท',  false, 'เปิดสอบต่อระดับโทตามความสมัครใจ'),
    ('lower_secondary', 1, 'เอก', false, 'เปิดสอบต่อระดับเอกตามความสมัครใจ'),
    ('lower_secondary', 2, 'ตรี', false, 'เปิดสอบตามความสมัครใจ'),
    ('lower_secondary', 2, 'โท',  false, 'เปิดสอบตามความสมัครใจ'),
    ('lower_secondary', 2, 'เอก', false, 'เปิดสอบตามความสมัครใจ'),
    ('lower_secondary', 3, 'ตรี', false, 'เปิดสอบตามความสมัครใจ'),
    ('lower_secondary', 3, 'โท',  false, 'เปิดสอบตามความสมัครใจ'),
    ('lower_secondary', 3, 'เอก', false, 'เปิดสอบตามความสมัครใจ'),
    ('upper_secondary', 4, 'ตรี', true,  'บังคับสอบชั้นตรีสำหรับ ม.4 ตามหลักเกณฑ์โรงเรียน'),
    ('upper_secondary', 4, 'โท',  false, 'เปิดสอบต่อระดับโทตามความสมัครใจ'),
    ('upper_secondary', 4, 'เอก', false, 'เปิดสอบต่อระดับเอกตามความสมัครใจ'),
    ('upper_secondary', 5, 'ตรี', false, 'เปิดสอบตามความสมัครใจ'),
    ('upper_secondary', 5, 'โท',  false, 'เปิดสอบตามความสมัครใจ'),
    ('upper_secondary', 5, 'เอก', false, 'เปิดสอบตามความสมัครใจ'),
    ('upper_secondary', 6, 'ตรี', false, 'เปิดสอบตามความสมัครใจ'),
    ('upper_secondary', 6, 'โท',  false, 'เปิดสอบตามความสมัครใจ'),
    ('upper_secondary', 6, 'เอก', false, 'เปิดสอบตามความสมัครใจ')
)
insert into registration_rules (
  academic_year_id, education_band, grade_level, dhamma_level,
  required_for_grade, note
)
select y.id, r.education_band, r.grade_level, r.dhamma_level,
       r.required_for_grade, r.note
from rules r
cross join (select id from academic_years where year_be = '2569' limit 1) y
on conflict (academic_year_id, education_band, grade_level, dhamma_level)
do update set
  required_for_grade = excluded.required_for_grade,
  note = excluded.note,
  enabled = true;
