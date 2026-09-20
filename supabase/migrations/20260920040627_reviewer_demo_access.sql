-- Opt-in, shared fictional walkthrough. Ordinary installations remain approval-based.
create table private.demo_settings (singleton boolean primary key default true check(singleton), enabled boolean not null default false);
insert into private.demo_settings(singleton,enabled) values(true,false);
create table private.demo_personas (name text primary key check(name in ('tutor','leo','staff','pending')), user_id uuid not null unique references public.memberships(user_id));
alter table private.demo_settings enable row level security;
alter table private.demo_personas enable row level security;
revoke all on private.demo_settings,private.demo_personas from public,anon,authenticated;

create function private.demo_enabled() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.demo_settings where enabled)
$$;
create function private.demo_access() returns boolean language sql stable security definer set search_path='' as $$
 select private.demo_enabled() and auth.uid() is not null and exists(
  select 1 from auth.identities where user_id=auth.uid() and provider='google'
 )
$$;
create function private.demo_actor_ids() returns uuid[] language sql stable security definer set search_path='' as $$
 select coalesce(array_agg(user_id),'{}'::uuid[]) from private.demo_personas
$$;
create function private.actor_id() returns uuid language plpgsql stable security definer set search_path='' as $$
declare persona text; actor uuid;
begin
 if not private.demo_access() then return auth.uid(); end if;
 persona:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-gather-persona','tutor');
 select user_id into actor from private.demo_personas where name=persona;
 if actor is null then raise exception 'Unknown demo account' using errcode='42501'; end if;
 return actor;
end $$;

-- Preserve the existing validation/authorization logic, but resolve the acting
-- identity through a controlled persona when this explicitly opted-in demo is used.
-- auth.uid() itself is unchanged and always identifies the actual OAuth caller.
do $$
declare f record; pol record;
begin
 for f in select p.oid,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname in ('active','staff','owns','current_student','lock_assignment','create_attendance','edit_attendance','save_assignment','save_achievement')
 loop execute replace(f.definition,'auth.uid()','private.actor_id()'); end loop;
 for pol in select polname,polrelid::regclass as relation,pg_get_expr(polqual,polrelid) as expression from pg_policy
  where polrelid in ('public.memberships'::regclass,'public.assignments'::regclass,'public.students'::regclass)
 loop execute format('alter policy %I on %s using (%s)',pol.polname,pol.relation,replace(pol.expression,'auth.uid()','private.actor_id()')); end loop;
end $$;

-- Reviewers operate fictional accounts, never each other's Google profiles.
create policy demo_profile_privacy on public.memberships as restrictive for select to authenticated
 using (not (select private.demo_access()) or user_id=any((select private.demo_actor_ids())::uuid[]));
create or replace function private.set_membership(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.memberships; begin
 if not private.staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 if private.demo_access() and not ((p->>'user_id')::uuid=any(private.demo_actor_ids())) then
  raise exception 'Only example accounts can be changed in this demo' using errcode='42501';
 end if;
 update public.memberships set status=p->>'status' where user_id=(p->>'user_id')::uuid and role='tutor' returning * into m;
 if m.user_id is null then raise exception 'Tutor unavailable' using errcode='22023'; end if; return to_jsonb(m);
end $$;
create function public.demo_context() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('enabled',private.demo_enabled(),'allowed',private.demo_access(),'actor_id',case when private.demo_access() then private.actor_id() else auth.uid() end)
$$;
revoke all on function private.demo_enabled(),private.demo_access(),private.demo_actor_ids(),private.actor_id(),public.demo_context() from public,anon,authenticated;
grant usage on schema private to anon;
grant execute on function private.demo_enabled(),private.demo_access(),private.actor_id(),public.demo_context() to anon,authenticated;
grant execute on function private.demo_actor_ids() to authenticated;
