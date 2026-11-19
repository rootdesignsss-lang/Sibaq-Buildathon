create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('candidate', 'employer')),
  full_name text not null default '',
  bio text not null default '',
  interests text[] not null default '{}',
  company_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_vacancies (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.profiles (user_id) on delete cascade,
  title text not null,
  company_name text not null default '',
  description text not null,
  category text not null,
  location text not null default 'Remote',
  employment_type text not null default 'Full-time',
  salary_range text not null default '',
  deadline timestamptz not null,
  task_title text not null,
  task_brief text not null,
  task_config jsonb not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_vacancies_task_questions check (
    jsonb_typeof(task_config -> 'questions') = 'array'
    and jsonb_array_length(task_config -> 'questions') between 1 and 10
  )
);

create table if not exists public.job_task_keys (
  vacancy_id uuid primary key references public.job_vacancies (id) on delete cascade,
  answer_key jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles (user_id) on delete cascade,
  vacancy_id uuid not null references public.job_vacancies (id) on delete cascade,
  status text not null default 'started'
    check (status in ('started', 'submitted', 'reviewing', 'shortlisted', 'rejected')),
  task_answers jsonb not null default '{}',
  result_score integer check (result_score between 0 and 100),
  result_feedback jsonb not null default '{}',
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, vacancy_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  sender_id uuid not null references public.profiles (user_id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists job_vacancies_open_deadline_idx
  on public.job_vacancies (deadline) where status = 'open';
create index if not exists job_vacancies_employer_idx
  on public.job_vacancies (employer_id);
create index if not exists applications_candidate_idx
  on public.applications (candidate_id, created_at desc);
create index if not exists applications_vacancy_score_idx
  on public.applications (vacancy_id, result_score desc);
create index if not exists messages_application_created_idx
  on public.messages (application_id, created_at);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text;
  profile_interests text[];
begin
  requested_role := case
    when new.raw_user_meta_data ->> 'role' = 'employer' then 'employer'
    else 'candidate'
  end;

  select coalesce(array_agg(value), '{}')
    into profile_interests
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(new.raw_user_meta_data -> 'interests') = 'array'
          then new.raw_user_meta_data -> 'interests'
        else '[]'::jsonb
      end
    ) as interest(value);

  insert into public.profiles (
    user_id,
    role,
    full_name,
    bio,
    interests,
    company_name
  )
  values (
    new.id,
    requested_role,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 100),
    left(coalesce(new.raw_user_meta_data ->> 'bio', ''), 600),
    profile_interests[1:10],
    left(coalesce(new.raw_user_meta_data ->> 'company_name', ''), 120)
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

insert into public.profiles (user_id, role, full_name, bio, interests, company_name)
select
  u.id,
  case when u.raw_user_meta_data ->> 'role' = 'employer' then 'employer' else 'candidate' end,
  left(coalesce(u.raw_user_meta_data ->> 'full_name', ''), 100),
  left(coalesce(u.raw_user_meta_data ->> 'bio', ''), 600),
  array(
    select value
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(u.raw_user_meta_data -> 'interests') = 'array'
          then u.raw_user_meta_data -> 'interests'
        else '[]'::jsonb
      end
    ) as interest(value)
    limit 10
  ),
  left(coalesce(u.raw_user_meta_data ->> 'company_name', ''), 120)
from auth.users as u
on conflict (user_id) do nothing;

create or replace function public.evaluate_application_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  questions jsonb;
  answer_key jsonb;
  question jsonb;
  question_count integer := 0;
  correct_count integer := 0;
  correct_answer text;
begin
  select j.task_config -> 'questions'
    into questions
    from public.job_vacancies as j
    where j.id = new.vacancy_id;

  select k.answer_key
    into answer_key
    from public.job_task_keys as k
    where k.vacancy_id = new.vacancy_id;

  if questions is null or answer_key is null then
    raise exception 'This job task is not configured for scoring.';
  end if;

  for question in select value from jsonb_array_elements(questions)
  loop
    question_count := question_count + 1;
    correct_answer := answer_key ->> (question ->> 'id');

    if correct_answer is not null
      and new.task_answers ->> (question ->> 'id') = correct_answer then
      correct_count := correct_count + 1;
    end if;
  end loop;

  if question_count = 0 then
    raise exception 'This job task has no questions.';
  end if;

  new.result_score := round(correct_count * 100.0 / question_count)::integer;
  new.result_feedback := jsonb_build_object(
    'correct', correct_count,
    'total', question_count
  );
  new.status := 'submitted';
  new.submitted_at := now();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists evaluate_application_task_before_update on public.applications;
create trigger evaluate_application_task_before_update
  before update of task_answers on public.applications
  for each row
  when (old.status = 'started')
  execute function public.evaluate_application_task();

create or replace function public.has_current_candidate_applied(p_vacancy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.applications as a
    where a.vacancy_id = p_vacancy_id
      and a.candidate_id = (select auth.uid())
  );
$$;

revoke all on function public.has_current_candidate_applied(uuid) from public, anon, authenticated;
grant execute on function public.has_current_candidate_applied(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.job_vacancies enable row level security;
alter table public.job_task_keys enable row level security;
alter table public.applications enable row level security;
alter table public.messages enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, bio, interests, company_name) on public.profiles to authenticated;

revoke all on public.job_vacancies from anon, authenticated;
grant select (
  id,
  employer_id,
  title,
  company_name,
  description,
  category,
  location,
  employment_type,
  salary_range,
  deadline,
  task_title,
  task_brief,
  task_config,
  status,
  created_at,
  updated_at
) on public.job_vacancies to anon, authenticated;
grant insert, update, delete on public.job_vacancies to authenticated;

revoke all on public.job_task_keys from anon, authenticated;
grant select, insert, update on public.job_task_keys to authenticated;

revoke all on public.applications from anon, authenticated;
grant select on public.applications to authenticated;
grant insert (candidate_id, vacancy_id) on public.applications to authenticated;
grant update (task_answers) on public.applications to authenticated;

revoke all on public.messages from anon, authenticated;
grant select, insert (application_id, sender_id, body) on public.messages to authenticated;

drop policy if exists "profiles_select_participants" on public.profiles;
create policy "profiles_select_participants"
  on public.profiles for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.applications as a
      join public.job_vacancies as j on j.id = a.vacancy_id
      where
        (a.candidate_id = profiles.user_id and j.employer_id = (select auth.uid()))
        or (j.employer_id = profiles.user_id and a.candidate_id = (select auth.uid()))
    )
  );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "job_vacancies_read_open_or_own" on public.job_vacancies;
drop policy if exists "job_vacancies_read_open" on public.job_vacancies;
create policy "job_vacancies_read_open"
  on public.job_vacancies for select
  using (status = 'open' and deadline > now());

drop policy if exists "job_vacancies_read_owner_or_applicant" on public.job_vacancies;
create policy "job_vacancies_read_owner_or_applicant"
  on public.job_vacancies for select to authenticated
  using (
    employer_id = (select auth.uid())
    or public.has_current_candidate_applied(id)
  );

drop policy if exists "job_vacancies_employer_insert" on public.job_vacancies;
create policy "job_vacancies_employer_insert"
  on public.job_vacancies for insert to authenticated
  with check (
    employer_id = (select auth.uid())
    and exists (
      select 1 from public.profiles as p
      where p.user_id = (select auth.uid()) and p.role = 'employer'
    )
  );

drop policy if exists "job_vacancies_employer_update" on public.job_vacancies;
create policy "job_vacancies_employer_update"
  on public.job_vacancies for update to authenticated
  using (employer_id = (select auth.uid()))
  with check (employer_id = (select auth.uid()));

drop policy if exists "job_vacancies_employer_delete" on public.job_vacancies;
create policy "job_vacancies_employer_delete"
  on public.job_vacancies for delete to authenticated
  using (employer_id = (select auth.uid()));

drop policy if exists "job_task_keys_employer_read" on public.job_task_keys;
create policy "job_task_keys_employer_read"
  on public.job_task_keys for select to authenticated
  using (
    exists (
      select 1 from public.job_vacancies as j
      where j.id = job_task_keys.vacancy_id and j.employer_id = (select auth.uid())
    )
  );

drop policy if exists "job_task_keys_employer_insert" on public.job_task_keys;
create policy "job_task_keys_employer_insert"
  on public.job_task_keys for insert to authenticated
  with check (
    exists (
      select 1 from public.job_vacancies as j
      where j.id = job_task_keys.vacancy_id and j.employer_id = (select auth.uid())
    )
  );

drop policy if exists "job_task_keys_employer_update" on public.job_task_keys;
create policy "job_task_keys_employer_update"
  on public.job_task_keys for update to authenticated
  using (
    exists (
      select 1 from public.job_vacancies as j
      where j.id = job_task_keys.vacancy_id and j.employer_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.job_vacancies as j
      where j.id = job_task_keys.vacancy_id and j.employer_id = (select auth.uid())
    )
  );

drop policy if exists "applications_read_participants" on public.applications;
create policy "applications_read_participants"
  on public.applications for select to authenticated
  using (
    candidate_id = (select auth.uid())
    or exists (
      select 1 from public.job_vacancies as j
      where j.id = applications.vacancy_id and j.employer_id = (select auth.uid())
    )
  );

drop policy if exists "applications_candidate_start" on public.applications;
create policy "applications_candidate_start"
  on public.applications for insert to authenticated
  with check (
    candidate_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles as p
      join public.job_vacancies as j on j.status = 'open'
      where
        p.user_id = (select auth.uid())
        and p.role = 'candidate'
        and j.id = applications.vacancy_id
        and j.deadline > now()
    )
  );

drop policy if exists "applications_candidate_submit" on public.applications;
create policy "applications_candidate_submit"
  on public.applications for update to authenticated
  using (
    candidate_id = (select auth.uid())
    and status = 'started'
    and exists (
      select 1 from public.job_vacancies as j
      where j.id = applications.vacancy_id and j.deadline > now()
    )
  )
  with check (candidate_id = (select auth.uid()));

drop policy if exists "messages_read_participants" on public.messages;
create policy "messages_read_participants"
  on public.messages for select to authenticated
  using (
    exists (
      select 1
      from public.applications as a
      join public.job_vacancies as j on j.id = a.vacancy_id
      where a.id = messages.application_id
        and (a.candidate_id = (select auth.uid()) or j.employer_id = (select auth.uid()))
    )
  );

drop policy if exists "messages_send_participant" on public.messages;
create policy "messages_send_participant"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1
      from public.applications as a
      join public.job_vacancies as j on j.id = a.vacancy_id
      where a.id = messages.application_id
        and (a.candidate_id = (select auth.uid()) or j.employer_id = (select auth.uid()))
    )
  );
