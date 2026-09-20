-- Guest sessions may use fictional personas only while the demo is enabled.
-- The anonymous flag comes from Supabase Auth, never editable user metadata.
create or replace function private.demo_access() returns boolean language sql stable security definer set search_path='' as $$
 select private.demo_enabled() and auth.uid() is not null and (
  exists(select 1 from auth.users where id=auth.uid() and is_anonymous is true)
  or exists(select 1 from auth.identities where user_id=auth.uid() and provider='google')
 )
$$;
create or replace function private.actor_id() returns uuid language plpgsql stable security definer set search_path='' as $$
declare persona text; actor uuid;
begin
 if not private.demo_access() then
  if exists(select 1 from auth.users where id=auth.uid() and is_anonymous is true) then return null; end if;
  return auth.uid();
 end if;
 persona:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-gather-persona','tutor');
 select user_id into actor from private.demo_personas where name=persona;
 if actor is null then raise exception 'Unknown demo account' using errcode='42501'; end if;
 return actor;
end $$;
