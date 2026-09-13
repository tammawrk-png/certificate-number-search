-- Staff report guidance from the current roster plus reviewed legacy matches.
-- Historical Firebase records do not contain lower/upper-secondary context,
-- so the result is guidance for review, never an automatic registration.
create or replace function public.student_progress_guidance(requested_year text)
returns table (
  student_id uuid,
  student_number text,
  full_name text,
  education_band text,
  grade_level smallint,
  room_no smallint,
  advisor_1 text,
  advisor_2 text,
  match_status text,
  matched_certificate_count bigint,
  highest_legacy_level text,
  recommended_level text,
  required_for_grade boolean,
  guidance_status text,
  guidance_note text
)
language sql
stable
security definer
set search_path = public
as $$
  with current_roster as (
    select
      s.id as student_id, s.student_number, s.full_name,
      c.education_band, c.grade_level, c.room_no,
      t1.display_name as advisor_1, t2.display_name as advisor_2
    from students s
    join classrooms c on c.id = s.classroom_id and c.active
    join academic_years y on y.id = c.academic_year_id
    left join teachers t1 on t1.id = c.advisor_1_id
    left join teachers t2 on t2.id = c.advisor_2_id
    where s.status = 'active' and y.year_be = trim(requested_year)
  ),
  matched as (
    select
      cm.student_id,
      count(*) filter (where cm.status in ('auto_matched', 'confirmed')) as matched_count,
      count(*) filter (where cm.status = 'review') as review_count,
      max(case when cm.status in ('auto_matched', 'confirmed')
        then case lc.level when 'เอก' then 3 when 'โท' then 2 when 'ตรี' then 1 else 0 end
        else 0 end) as highest_level_no
    from certificate_matches cm
    join legacy_certificates lc on lc.id = cm.legacy_certificate_id
    group by cm.student_id
  ),
  shaped as (
    select
      r.*,
      coalesce(m.matched_count, 0)::bigint as matched_count,
      coalesce(m.review_count, 0)::bigint as review_count,
      m.highest_level_no,
      case m.highest_level_no when 3 then 'เอก' when 2 then 'โท' when 1 then 'ตรี' end as highest_level,
      case
        when r.grade_level in (1, 4) then 'ตรี'
        when m.highest_level_no = 1 then 'โท'
        when m.highest_level_no = 2 then 'เอก'
        when m.highest_level_no = 3 then null
        else 'ตรี'
      end as recommended,
      (r.grade_level in (1, 4)) as required
    from current_roster r
    left join matched m on m.student_id = r.student_id
  )
  select
    s.student_id, s.student_number, s.full_name, s.education_band,
    s.grade_level, s.room_no, s.advisor_1, s.advisor_2,
    case
      when s.review_count > 0 then 'review'
      when s.matched_count > 0 then 'matched'
      else 'unmatched'
    end,
    s.matched_count,
    s.highest_level,
    s.recommended,
    s.required,
    case
      when s.review_count > 0 then 'review_required'
      when s.grade_level in (1, 4) then 'required'
      when s.highest_level = 'เอก' then 'completed'
      else 'suggested'
    end,
    case
      when s.review_count > 0 then 'พบประวัติชื่อซ้ำหรือจับคู่หลายรายการ ต้องตรวจสอบก่อนใช้สิทธิ์'
      when s.grade_level in (1, 4) then 'ชั้นเริ่มสายใหม่ ต้องสมัครชั้นตรี'
      when s.matched_count = 0 then 'ยังไม่พบประวัติที่จับคู่ได้ ให้เจ้าหน้าที่ตรวจสอบ'
      when s.highest_level = 'เอก' then 'พบประวัติชั้นเอกแล้ว ไม่บังคับสมัครระดับต่อไป'
      else 'เป็นคำแนะนำจากประวัติเดิม ต้องยืนยันกับเจ้าหน้าที่ก่อนส่งรายงาน'
    end
  from shaped s
  order by s.education_band, s.grade_level, s.room_no, s.student_number;
$$;

revoke all on function public.student_progress_guidance(text) from public;
grant execute on function public.student_progress_guidance(text) to authenticated;

comment on function public.student_progress_guidance(text) is
  'Staff-only guidance report. Lower and upper secondary are separate; ambiguous historical matches remain review_required.';
