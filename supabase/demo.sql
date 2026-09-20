-- Operator-only: enable ONLY on a dedicated, fictional-data reviewer project.
-- No passwords or provider identities are created for these example accounts.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('10000000-0000-4000-8000-000000000001','maya@gather-demo.invalid','{"full_name":"Maya Patel"}'),
 ('10000000-0000-4000-8000-000000000002','leo@gather-demo.invalid','{"full_name":"Leo Chen"}'),
 ('10000000-0000-4000-8000-000000000003','sam@gather-demo.invalid','{"full_name":"Sam Rivera"}'),
 ('10000000-0000-4000-8000-000000000004','jordan@gather-demo.invalid','{"full_name":"Jordan Lee"}')
 on conflict(id) do nothing;
insert into private.demo_personas(name,user_id) values
 ('tutor','10000000-0000-4000-8000-000000000001'),('leo','10000000-0000-4000-8000-000000000002'),
 ('staff','10000000-0000-4000-8000-000000000003'),('pending','10000000-0000-4000-8000-000000000004') on conflict do nothing;
-- Initialize only when enabling for the first time; reruns preserve reviewer edits.
do $$ begin
 if not private.demo_enabled() then
 update public.memberships set status=case when user_id='10000000-0000-4000-8000-000000000004' then 'pending' else 'active' end,
 role=case when user_id='10000000-0000-4000-8000-000000000003' then 'staff' else 'tutor' end where user_id=any(private.demo_actor_ids());
 end if;
end $$;
insert into public.assignments(id,tutor_id,student_id,term_id,starts_on,site,usual_days,usual_times) values
 ('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','2026-07-01','Bloomfield Public Library','Tuesday & Thursday','4:00 PM'),
 ('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','2026-07-01','Bloomfield Public Library','Wednesday','5:30 PM'),
 ('40000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000001','2026-07-01','Bloomfield Public Library','Friday','3:00 PM') on conflict(id) do nothing;
insert into public.attendance_events(assignment_id,occurred_on,kind,duration_minutes,request_id,creation_payload,created_by,updated_by)
select a::uuid,d::date,'completed',mins,r::uuid,'{}','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'
from (values
 ('40000000-0000-4000-8000-000000000001','2026-09-10',90,'50000000-0000-4000-8000-000000000001'),
 ('40000000-0000-4000-8000-000000000001','2026-09-17',60,'50000000-0000-4000-8000-000000000002'),
 ('40000000-0000-4000-8000-000000000002','2026-09-10',45,'50000000-0000-4000-8000-000000000003'),
 ('40000000-0000-4000-8000-000000000002','2026-09-15',75,'50000000-0000-4000-8000-000000000004')
) as entries(a,d,mins,r) where d::date<=private.today() on conflict(created_by,request_id) do nothing;
update private.demo_settings set enabled=true where singleton;
commit;
