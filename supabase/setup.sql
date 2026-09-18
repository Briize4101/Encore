begin;
create table if not exists public.member_inf (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text,
 followed_artists text[] not null default '{}',
 updated_at timestamptz not null default now(),
 constraint member_inf_known_artists check (followed_artists <@ array['BTS','RIIZE','&TEAM','BOYNEXTDOOR','CORTIS','ENHYPEN','NCT WISH','TXT']::text[])
);
do $$ begin
 if to_regclass('public.fan_preferences') is not null then
 execute 'insert into public.member_inf(user_id,email,followed_artists,updated_at) select p.user_id,u.email,p.followed_artists,p.updated_at from public.fan_preferences p join auth.users u on u.id=p.user_id on conflict(user_id) do nothing';
 end if;
end $$;
insert into public.member_inf(user_id,email) select id,email from auth.users
on conflict(user_id) do update set email=excluded.email;
create or replace function public.encore_member_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 select u.email into new.email from auth.users u where u.id=new.user_id;
 new.updated_at=now(); return new;
end $$;
revoke all on function public.encore_member_email() from public,anon,authenticated;
drop trigger if exists encore_member_email on public.member_inf;
create trigger encore_member_email before insert or update on public.member_inf
for each row execute function public.encore_member_email();
create or replace function public.encore_sync_member() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.member_inf(user_id,email) values(new.id,new.email)
 on conflict(user_id) do update set email=excluded.email;
 return new;
end $$;
revoke all on function public.encore_sync_member() from public,anon,authenticated;
drop trigger if exists encore_sync_member on auth.users;
create trigger encore_sync_member after insert or update of email on auth.users
for each row execute function public.encore_sync_member();
alter table public.member_inf enable row level security;
revoke all on public.member_inf from public,anon,authenticated;
grant select,insert,update on public.member_inf to authenticated;
drop policy if exists member_read_own on public.member_inf;
create policy member_read_own on public.member_inf for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists member_insert_own on public.member_inf;
create policy member_insert_own on public.member_inf for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists member_update_own on public.member_inf;
create policy member_update_own on public.member_inf for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
notify pgrst, 'reload schema';
commit;
