-- Privileged write implementations are deliberately isolated from the Data API.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create table public.memberships (
 user_id uuid primary key references auth.users(id), display_name text not null check(length(display_name) between 1 and 120),
 role text not null default 'tutor' check(role in ('tutor','staff')), status text not null default 'pending' check(status in ('pending','active','disabled'))
);
create table public.terms (id uuid primary key default gen_random_uuid(), name text not null, starts_on date not null, ends_on date not null check(ends_on>=starts_on));
create table public.students (id uuid primary key default gen_random_uuid(), display_name text not null check(length(trim(display_name)) between 1 and 120), created_at timestamptz not null default now());
create table public.assignments (
 id uuid primary key default gen_random_uuid(), tutor_id uuid not null references public.memberships(user_id), student_id uuid not null references public.students(id), term_id uuid not null references public.terms(id),
 starts_on date not null, ends_on date, end_reason text, site text not null default '', usual_days text not null default '', usual_times text not null default '', version integer not null default 1,
 check(ends_on is null or ends_on>=starts_on), check(ends_on is null or (end_reason is not null and length(trim(end_reason)) between 1 and 300)), check(length(site)<=200 and length(usual_days)<=200 and length(usual_times)<=200)
);
create index on public.assignments(tutor_id); create index on public.assignments(student_id); create index on public.assignments(term_id);
create table public.attendance_events (
 id uuid primary key default gen_random_uuid(), assignment_id uuid not null references public.assignments(id), occurred_on date not null,
 kind text not null check(kind in ('completed','tutor_absent','student_absent','holiday')), duration_minutes integer not null,
 request_id uuid not null, creation_payload jsonb not null, created_by uuid not null references public.memberships(user_id), updated_by uuid not null references public.memberships(user_id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 voided_at timestamptz, voided_by uuid references public.memberships(user_id), void_reason text,
 unique(created_by,request_id), check((kind='completed' and duration_minutes between 1 and 1440) or (kind<>'completed' and duration_minutes=0))
);
create index on public.attendance_events(assignment_id,occurred_on);
create table public.attendance_months (
 assignment_id uuid not null references public.assignments(id), month_start date not null check(extract(day from month_start)=1), revision integer not null default 0,
 confirmed_revision integer, confirmed_at timestamptz, confirmed_by uuid references public.memberships(user_id), primary key(assignment_id,month_start)
);
create table public.goal_types (id text primary key, category text not null, label text not null, display_order integer not null, source_asterisk boolean not null default false);
create table public.student_achievements (
 id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id), term_id uuid not null references public.terms(id), goal_type_id text references public.goal_types(id), custom_label text,
 attained_on date not null, recorded_by uuid not null references public.memberships(user_id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 voided_at timestamptz, voided_by uuid references public.memberships(user_id), void_reason text,
 check((goal_type_id is not null and custom_label is null) or (goal_type_id is null and length(trim(custom_label)) between 1 and 200))
);
create unique index achievement_once on public.student_achievements(student_id,term_id,goal_type_id) where voided_at is null and goal_type_id is not null;
create index on public.student_achievements(student_id); create index on public.student_achievements(term_id,attained_on);

create function private.today() returns date language sql stable set search_path='' as $$ select (now() at time zone 'America/New_York')::date $$;
create function private.active() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.memberships where user_id=auth.uid() and status='active') $$;
create function private.staff() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.memberships where user_id=auth.uid() and status='active' and role='staff') $$;
create function private.owns(aid uuid) returns boolean language sql stable security definer set search_path='' as $$ select private.active() and exists(select 1 from public.assignments where id=aid and tutor_id=auth.uid()) $$;
create function private.current_student(sid uuid) returns boolean language sql stable security definer set search_path='' as $$ select private.active() and exists(select 1 from public.assignments a join public.terms t on t.id=a.term_id where a.student_id=sid and a.tutor_id=auth.uid() and private.today() between a.starts_on and coalesce(a.ends_on,t.ends_on)) $$;
create function private.new_user() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.memberships(user_id,display_name) values(new.id,left(coalesce(nullif(new.raw_user_meta_data->>'full_name',''),new.email,'New tutor'),120)); return new; end $$;
create trigger provision_membership after insert on auth.users for each row execute function private.new_user();

alter table public.memberships enable row level security;
alter table public.terms enable row level security;
alter table public.students enable row level security;
alter table public.assignments enable row level security;
alter table public.attendance_events enable row level security;
alter table public.attendance_months enable row level security;
alter table public.goal_types enable row level security;
alter table public.student_achievements enable row level security;
create policy member_read on public.memberships for select to authenticated using(user_id=(select auth.uid()) or (select private.staff()));
create policy term_read on public.terms for select to authenticated using((select private.active()));
create policy student_read on public.students for select to authenticated using((select private.staff()) or ((select private.active()) and exists(select 1 from public.assignments where student_id=students.id and tutor_id=(select auth.uid()))));
create policy assignment_read on public.assignments for select to authenticated using((select private.staff()) or ((select private.active()) and tutor_id=(select auth.uid())));
create policy event_read on public.attendance_events for select to authenticated using((select private.staff()) or private.owns(assignment_id));
create policy month_read on public.attendance_months for select to authenticated using((select private.staff()) or private.owns(assignment_id));
create policy goal_read on public.goal_types for select to authenticated using((select private.active()));
create policy achievement_read on public.student_achievements for select to authenticated using((select private.staff()) or private.current_student(student_id));
revoke all on all tables in schema public from anon, authenticated;
grant select on public.memberships,public.terms,public.students,public.assignments,public.attendance_events,public.attendance_months,public.goal_types,public.student_achievements to authenticated;

create function private.bump(aid uuid,d date) returns void language sql set search_path='' as $$
 insert into public.attendance_months(assignment_id,month_start,revision) values(aid,date_trunc('month',d)::date,1)
 on conflict(assignment_id,month_start) do update set revision=public.attendance_months.revision+1;
$$;
create function private.lock_assignment(aid uuid) returns public.assignments language plpgsql set search_path='' as $$
declare a public.assignments; begin
 if not private.active() then raise exception 'Access denied' using errcode='42501'; end if;
 select * into a from public.assignments where id=aid for update;
 if a.id is null or not(private.staff() or a.tutor_id=auth.uid()) then raise exception 'Assignment unavailable' using errcode='42501'; end if;
 return a; end $$;
create function private.valid_event(a public.assignments,d date,k text,minutes integer) returns void language plpgsql set search_path='' as $$
begin
 if d is null or d>private.today() or d<a.starts_on or d>coalesce(a.ends_on,(select ends_on from public.terms where id=a.term_id)) then raise exception 'Choose a past or current date within this assignment' using errcode='22023'; end if;
 if k is null or k not in ('completed','tutor_absent','student_absent','holiday') or minutes is null or (k='completed' and minutes not between 1 and 1440) or (k<>'completed' and minutes<>0) then raise exception 'Invalid attendance duration or type' using errcode='22023'; end if;
 if not private.staff() and k<>'completed' then raise exception 'Only staff can record absence codes' using errcode='42501'; end if;
end $$;
create function private.create_attendance(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
 perform private.bump(a.id,d); return to_jsonb(e);
end $$;
create function private.edit_attendance(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
 perform private.bump(a.id,old_date);
 if date_trunc('month',e.occurred_on)<>date_trunc('month',old_date) then perform private.bump(a.id,e.occurred_on); end if;
 return to_jsonb(e);
end $$;
create function private.confirm_month(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.assignments; m date; r public.attendance_months;
begin
 a:=private.lock_assignment((p->>'assignment_id')::uuid); m:=(p->>'month_start')::date;
 if m is null or extract(day from m)<>1 or m>=date_trunc('month',private.today()) or m>coalesce(a.ends_on,(select ends_on from public.terms where id=a.term_id)) or (m+interval '1 month')::date<=a.starts_on then raise exception 'Choose a closed month within this assignment' using errcode='22023'; end if;
 insert into public.attendance_months(assignment_id,month_start) values(a.id,m) on conflict do nothing;
 select * into r from public.attendance_months where assignment_id=a.id and month_start=m for update;
 if r.revision is distinct from (p->>'expected_revision')::integer then raise exception 'Attendance changed. Refresh before confirming.' using errcode='40001'; end if;
 update public.attendance_months set confirmed_revision=revision,confirmed_at=now(),confirmed_by=auth.uid() where assignment_id=a.id and month_start=m returning * into r;
 return to_jsonb(r);
end $$;
create function private.save_student(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.students; begin
 if not private.staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 if p->>'id' is null then insert into public.students(display_name) values(trim(p->>'display_name')) returning * into s;
 else update public.students set display_name=trim(p->>'display_name') where id=(p->>'id')::uuid returning * into s; end if;
 return to_jsonb(s); end $$;
create function private.set_membership(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.memberships; begin
 if not private.staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 update public.memberships set status=p->>'status' where user_id=(p->>'user_id')::uuid and role='tutor' returning * into m;
 if m.user_id is null then raise exception 'Tutor unavailable' using errcode='22023'; end if; return to_jsonb(m); end $$;
create function private.save_assignment(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
 if old_a.id is not null and (a.starts_on is distinct from old_a.starts_on or a.ends_on is distinct from old_a.ends_on) then
  update public.attendance_months set revision=revision+1 where assignment_id=a.id;
 end if;
 return to_jsonb(a); end $$;
create function private.save_achievement(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.student_achievements; sid uuid; tid uuid; d date; begin
 if not private.active() then raise exception 'Access denied' using errcode='42501'; end if;
 if p->>'id' is not null then
  select * into g from public.student_achievements where id=(p->>'id')::uuid for update;
  sid:=g.student_id; tid:=g.term_id;
  if g.id is null or (not private.staff() and (g.recorded_by<>auth.uid() or not private.current_student(sid))) then raise exception 'Achievement unavailable' using errcode='42501'; end if;
  if g.version is distinct from (p->>'expected_version')::integer or g.voided_at is not null then raise exception 'Achievement changed. Refresh first.' using errcode='40001'; end if;
 else sid:=(p->>'student_id')::uuid; tid:=(p->>'term_id')::uuid;
  if not(private.staff() or private.current_student(sid)) then raise exception 'Achievement unavailable' using errcode='42501'; end if;
 end if;
 if p->>'void_reason' is not null then
  if length(trim(p->>'void_reason')) not between 1 and 300 then raise exception 'A reason is required' using errcode='22023'; end if;
  update public.student_achievements set voided_at=now(),voided_by=auth.uid(),void_reason=p->>'void_reason',updated_at=now(),version=version+1 where id=g.id returning * into g;
 else
  d:=(p->>'attained_on')::date;
  if d is null or d>private.today() or not exists(select 1 from public.terms where id=tid and d between starts_on and ends_on) then raise exception 'Choose a past or current attainment date within the term' using errcode='22023'; end if;
  if g.id is null then insert into public.student_achievements(student_id,term_id,goal_type_id,custom_label,attained_on,recorded_by) values(sid,tid,nullif(p->>'goal_type_id',''),nullif(trim(p->>'custom_label'),''),d,auth.uid()) returning * into g;
  else update public.student_achievements set goal_type_id=nullif(p->>'goal_type_id',''),custom_label=nullif(trim(p->>'custom_label'),''),attained_on=d,updated_at=now(),version=version+1 where id=g.id returning * into g; end if;
 end if; return to_jsonb(g); end $$;

-- Invoker wrappers keep private implementations out of the exposed schema.
create function public.create_attendance(p jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.create_attendance(p) $$;
create function public.edit_attendance(p jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.edit_attendance(p) $$;
create function public.confirm_month(p jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.confirm_month(p) $$;
create function public.save_student(p jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.save_student(p) $$;
create function public.set_membership(p jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.set_membership(p) $$;
create function public.save_assignment(p jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.save_assignment(p) $$;
create function public.save_achievement(p jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.save_achievement(p) $$;

create function public.workspace() returns jsonb language sql stable security invoker set search_path='' as $$ select jsonb_build_object(
 'memberships',(select coalesce(jsonb_agg(m),'[]') from public.memberships m),
 'terms',(select coalesce(jsonb_agg(t order by starts_on desc),'[]') from public.terms t),
 'students',(select coalesce(jsonb_agg(s order by display_name),'[]') from public.students s),
 'assignments',(select coalesce(jsonb_agg(a order by starts_on),'[]') from public.assignments a),
 'events',(select coalesce(jsonb_agg(e order by occurred_on desc,created_at desc),'[]') from public.attendance_events e),
 'months',(select coalesce(jsonb_agg(m),'[]') from public.attendance_months m),
 'goals',(select coalesce(jsonb_agg(g order by display_order),'[]') from public.goal_types g),
 'achievements',(select coalesce(jsonb_agg(g order by attained_on desc),'[]') from public.student_achievements g)
) $$;
create function public.attendance_report(p jsonb) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare m date; t public.terms; result jsonb; begin
 if not private.staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 m:=(p->>'month')::date; select * into t from public.terms where id=(p->>'term_id')::uuid;
 if m is null or extract(day from m)<>1 or t.id is null or m>t.ends_on or (m+interval '1 month')::date<=t.starts_on then raise exception 'Choose a month inside the term' using errcode='22023'; end if;
 with rows as (
 select a.id as assignment_id,a.term_id,to_char(m,'YYYY-MM') as month,a.tutor_id,u.display_name as tutor_name,a.student_id,s.display_name as student_name,a.site,a.ends_on as assignment_ends_on,a.end_reason,
 count(e.id) filter(where e.kind='completed') as completed_sessions,
 coalesce(sum(e.duration_minutes) filter(where e.kind='completed'),0) as total_minutes,
 round(coalesce(sum(e.duration_minutes) filter(where e.kind='completed'),0)/60.0,2) as total_hours,
 count(e.id) filter(where e.kind='tutor_absent') as tutor_absences,count(e.id) filter(where e.kind='student_absent') as student_absences,count(e.id) filter(where e.kind='holiday') as holidays,
 coalesce(am.revision,0) as revision,am.confirmed_at,am.confirmed_by,
 case when m>=date_trunc('month',private.today()) then 'in_progress' when am.confirmed_revision is null then 'not_confirmed' when am.confirmed_revision=am.revision then 'confirmed' else 'needs_confirmation' end as confirmation_status
 from public.assignments a join public.memberships u on u.user_id=a.tutor_id join public.students s on s.id=a.student_id
 left join public.attendance_events e on e.assignment_id=a.id and e.voided_at is null and e.occurred_on>=m and e.occurred_on<(m+interval '1 month')::date
 left join public.attendance_months am on am.assignment_id=a.id and am.month_start=m
 where a.term_id=t.id and a.starts_on<(m+interval '1 month')::date and coalesce(a.ends_on,t.ends_on)>=m and (nullif(p->>'tutor_id','') is null or a.tutor_id=(p->>'tutor_id')::uuid) and (nullif(p->>'student_id','') is null or a.student_id=(p->>'student_id')::uuid)
 group by a.id,u.display_name,s.display_name,am.revision,am.confirmed_revision,am.confirmed_at,am.confirmed_by
 ), filtered as (select * from rows where nullif(p->>'status','') is null or confirmation_status=p->>'status'),
 details as (select e.id,e.assignment_id,r.tutor_id,r.tutor_name,r.student_id,r.student_name,e.occurred_on,e.kind,e.duration_minutes,e.created_by,e.created_at,e.updated_by,e.updated_at,e.version from public.attendance_events e join filtered r on r.assignment_id=e.assignment_id where e.voided_at is null and e.occurred_on>=m and e.occurred_on<(m+interval '1 month')::date)
 select jsonb_build_object('summary',coalesce((select jsonb_agg(r order by student_name,tutor_name,assignment_id) from filtered r),'[]'),'detail',coalesce((select jsonb_agg(d order by occurred_on,id) from details d),'[]'),'generated_at',now()) into result;
 return result; end $$;
create function public.achievement_report(p jsonb) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare m date; t public.terms; r jsonb; begin
 if not private.staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 m:=(p->>'month')::date; select * into t from public.terms where id=(p->>'term_id')::uuid;
 if m is null or extract(day from m)<>1 or t.id is null or m>t.ends_on or (m+interval '1 month')::date<=t.starts_on then raise exception 'Choose a month inside the term' using errcode='22023'; end if;
 select coalesce(jsonb_agg(x order by attained_on,id),'[]') into r from (select a.id,a.student_id,s.display_name as student_name,a.term_id,a.goal_type_id,coalesce(g.category,'Other') as category,coalesce(g.label,a.custom_label) as label,a.attained_on,a.recorded_by from public.student_achievements a join public.students s on s.id=a.student_id left join public.goal_types g on g.id=a.goal_type_id where a.term_id=t.id and a.voided_at is null and a.attained_on>=m and a.attained_on<(m+interval '1 month')::date and (nullif(p->>'student_id','') is null or a.student_id=(p->>'student_id')::uuid)) x;
 return r; end $$;

revoke all on all functions in schema private from public,anon,authenticated;
revoke all on all functions in schema public from public,anon,authenticated;
grant execute on function private.today(),private.active(),private.staff(),private.owns(uuid),private.current_student(uuid) to authenticated;
grant execute on function private.create_attendance(jsonb),private.edit_attendance(jsonb),private.confirm_month(jsonb),private.save_student(jsonb),private.set_membership(jsonb),private.save_assignment(jsonb),private.save_achievement(jsonb) to authenticated;
grant execute on function public.workspace(),public.attendance_report(jsonb),public.achievement_report(jsonb),public.create_attendance(jsonb),public.edit_attendance(jsonb),public.confirm_month(jsonb),public.save_student(jsonb),public.set_membership(jsonb),public.save_assignment(jsonb),public.save_achievement(jsonb) to authenticated;
