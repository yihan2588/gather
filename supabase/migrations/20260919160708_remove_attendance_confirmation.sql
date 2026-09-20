-- Remove the optional confirmation workflow. Attendance and achievement records are retained.
create or replace function private.create_attendance(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.assignments; e public.attendance_events; payload jsonb; d date; k text; mins integer; rid uuid;
begin
 a:=private.lock_assignment((p->>'assignment_id')::uuid);
 d:=(p->>'occurred_on')::date; k:=p->>'kind'; mins:=(p->>'duration_minutes')::integer; rid:=(p->>'request_id')::uuid;
 -- Serialize same request IDs even if a malicious retry changes the assignment.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||rid::text,0));
 payload:=jsonb_build_object('assignment_id',a.id,'occurred_on',d,'kind',k,'duration_minutes',mins);
 select * into e from public.attendance_events where created_by=auth.uid() and request_id=rid;
 if e.id is not null then
  if e.creation_payload<>payload then raise exception 'Request ID reused with different data' using errcode='40001'; end if;
  return to_jsonb(e);
 end if;
 if (p->>'duration_minutes')::numeric<>mins then raise exception 'Use whole minutes' using errcode='22023'; end if;
 perform private.valid_event(a,d,k,mins);
 insert into public.attendance_events(assignment_id,occurred_on,kind,duration_minutes,request_id,creation_payload,created_by,updated_by) values(a.id,d,k,mins,rid,payload,auth.uid(),auth.uid()) returning * into e;
 return to_jsonb(e);
end $$;

create or replace function private.edit_attendance(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.assignments; e public.attendance_events; old_date date; d date; k text; mins integer;
begin
 select * into e from public.attendance_events where id=(p->>'id')::uuid;
 a:=private.lock_assignment(e.assignment_id);
 select * into e from public.attendance_events where id=(p->>'id')::uuid for update;
 if e.version is distinct from (p->>'expected_version')::integer or e.voided_at is not null then raise exception 'This record changed. Refresh before editing.' using errcode='40001'; end if;
 if not private.staff() and e.kind<>'completed' then raise exception 'Only staff can change absence codes' using errcode='42501'; end if;
 old_date:=e.occurred_on;
 if p->>'void_reason' is not null then
  if length(trim(p->>'void_reason')) not between 1 and 300 then raise exception 'A reason is required' using errcode='22023'; end if;
  update public.attendance_events set voided_at=now(),voided_by=auth.uid(),void_reason=p->>'void_reason',updated_by=auth.uid(),updated_at=now(),version=version+1 where id=e.id returning * into e;
 else
  d:=(p->>'occurred_on')::date; k:=p->>'kind'; mins:=(p->>'duration_minutes')::integer;
  if (p->>'duration_minutes')::numeric<>mins then raise exception 'Use whole minutes' using errcode='22023'; end if;
  perform private.valid_event(a,d,k,mins);
  if e.occurred_on=d and e.kind=k and e.duration_minutes=mins then return to_jsonb(e); end if;
  update public.attendance_events set occurred_on=d,kind=k,duration_minutes=mins,updated_by=auth.uid(),updated_at=now(),version=version+1 where id=e.id returning * into e;
 end if;
 return to_jsonb(e);
end $$;

create or replace function private.save_assignment(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.assignments; old_a public.assignments; t public.terms; start_d date; end_d date; actual_end date;
begin
 if not private.active() then raise exception 'Access denied' using errcode='42501'; end if;
 if p->>'id' is null then
  if not private.staff() then raise exception 'Staff access required' using errcode='42501'; end if;
  a.id:=gen_random_uuid(); a.tutor_id:=(p->>'tutor_id')::uuid; a.student_id:=(p->>'student_id')::uuid; a.term_id:=(p->>'term_id')::uuid;
 else a:=private.lock_assignment((p->>'id')::uuid); old_a:=a;
  if a.version is distinct from (p->>'expected_version')::integer then raise exception 'Assignment changed. Refresh first.' using errcode='40001'; end if;
 end if;
 -- All assignments for a student serialize, preventing concurrent overlapping creations.
 perform 1 from public.students where id=a.student_id for update;
 select * into t from public.terms where id=a.term_id;
 start_d:=coalesce((p->>'starts_on')::date,a.starts_on); end_d:=nullif(p->>'ends_on','')::date; actual_end:=coalesce(end_d,t.ends_on);
 if not private.staff() and (start_d is distinct from a.starts_on or end_d is null or end_d>private.today()) then raise exception 'Tutors can only end their own assignment' using errcode='42501'; end if;
 if t.id is null or start_d is null or start_d<t.starts_on or actual_end>t.ends_on or actual_end<start_d then raise exception 'Assignment dates must be inside the term' using errcode='22023'; end if;
 if exists(select 1 from public.assignments x where x.id<>a.id and x.tutor_id=a.tutor_id and x.student_id=a.student_id and x.term_id=a.term_id and x.starts_on<=actual_end and coalesce(x.ends_on,t.ends_on)>=start_d) then raise exception 'This tutor already has an overlapping assignment' using errcode='22023'; end if;
 if exists(select 1 from public.attendance_events where assignment_id=a.id and voided_at is null and (occurred_on<start_d or occurred_on>actual_end)) then raise exception 'Correct attendance outside the new interval first' using errcode='22023'; end if;
 if not exists(select 1 from public.memberships where user_id=a.tutor_id and role='tutor' and status='active') and old_a.id is null then raise exception 'Choose an approved tutor' using errcode='22023'; end if;
 insert into public.assignments(id,tutor_id,student_id,term_id,starts_on,ends_on,end_reason,site,usual_days,usual_times) values(a.id,a.tutor_id,a.student_id,a.term_id,start_d,end_d,nullif(trim(p->>'end_reason'),''),coalesce(p->>'site',''),coalesce(p->>'usual_days',''),coalesce(p->>'usual_times',''))
 on conflict(id) do update set starts_on=excluded.starts_on,ends_on=excluded.ends_on,end_reason=excluded.end_reason,site=case when private.staff() then excluded.site else assignments.site end,usual_days=case when private.staff() then excluded.usual_days else assignments.usual_days end,usual_times=case when private.staff() then excluded.usual_times else assignments.usual_times end,version=assignments.version+1 returning * into a;
 return to_jsonb(a); end $$;

create or replace function public.workspace() returns jsonb language sql stable security invoker set search_path='' as $$ select jsonb_build_object(
 'memberships',(select coalesce(jsonb_agg(m),'[]') from public.memberships m),
 'terms',(select coalesce(jsonb_agg(t order by starts_on desc),'[]') from public.terms t),
 'students',(select coalesce(jsonb_agg(s order by display_name),'[]') from public.students s),
 'assignments',(select coalesce(jsonb_agg(a order by starts_on),'[]') from public.assignments a),
 'events',(select coalesce(jsonb_agg(e order by occurred_on desc,created_at desc),'[]') from public.attendance_events e),
 'goals',(select coalesce(jsonb_agg(g order by display_order),'[]') from public.goal_types g),
 'achievements',(select coalesce(jsonb_agg(g order by attained_on desc),'[]') from public.student_achievements g)
) $$;
create or replace function public.attendance_report(p jsonb) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare m date; t public.terms; result jsonb; begin
 if not private.staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 m:=(p->>'month')::date; select * into t from public.terms where id=(p->>'term_id')::uuid;
 if m is null or extract(day from m)<>1 or t.id is null or m>t.ends_on or (m+interval '1 month')::date<=t.starts_on then raise exception 'Choose a month inside the term' using errcode='22023'; end if;
 with rows as (
 select a.id as assignment_id,a.term_id,to_char(m,'YYYY-MM') as month,a.tutor_id,u.display_name as tutor_name,a.student_id,s.display_name as student_name,a.site,a.ends_on as assignment_ends_on,a.end_reason,
 count(e.id) filter(where e.kind='completed') as completed_sessions,
 coalesce(sum(e.duration_minutes) filter(where e.kind='completed'),0) as total_minutes,
 round(coalesce(sum(e.duration_minutes) filter(where e.kind='completed'),0)/60.0,2) as total_hours,
 count(e.id) filter(where e.kind='tutor_absent') as tutor_absences,count(e.id) filter(where e.kind='student_absent') as student_absences,count(e.id) filter(where e.kind='holiday') as holidays
 from public.assignments a join public.memberships u on u.user_id=a.tutor_id join public.students s on s.id=a.student_id
 left join public.attendance_events e on e.assignment_id=a.id and e.voided_at is null and e.occurred_on>=m and e.occurred_on<(m+interval '1 month')::date
 where a.term_id=t.id and a.starts_on<(m+interval '1 month')::date and coalesce(a.ends_on,t.ends_on)>=m and (nullif(p->>'tutor_id','') is null or a.tutor_id=(p->>'tutor_id')::uuid) and (nullif(p->>'student_id','') is null or a.student_id=(p->>'student_id')::uuid)
 group by a.id,u.display_name,s.display_name
 ), filtered as (select * from rows),
 details as (select e.id,e.assignment_id,r.tutor_id,r.tutor_name,r.student_id,r.student_name,e.occurred_on,e.kind,e.duration_minutes,e.created_by,e.created_at,e.updated_by,e.updated_at,e.version from public.attendance_events e join filtered r on r.assignment_id=e.assignment_id where e.voided_at is null and e.occurred_on>=m and e.occurred_on<(m+interval '1 month')::date)
 select jsonb_build_object('summary',coalesce((select jsonb_agg(r order by student_name,tutor_name,assignment_id) from filtered r),'[]'),'detail',coalesce((select jsonb_agg(d order by occurred_on,id) from details d),'[]'),'generated_at',now()) into result;
 return result; end $$;

drop function public.confirm_month(jsonb);
drop function private.confirm_month(jsonb);
drop function private.bump(uuid,date);
drop table public.attendance_months;
