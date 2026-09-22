create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text,
  email text,
  message text not null,
  created_at timestamptz not null default now(),
  constraint feedback_message_length check (char_length(message) between 1 and 5000),
  constraint feedback_name_length check (name is null or char_length(name) <= 120),
  constraint feedback_email_length check (email is null or char_length(email) <= 254)
);

alter table public.feedback enable row level security;

revoke all on table public.feedback from anon, authenticated;
grant insert on table public.feedback to anon, authenticated;

drop policy if exists "Anyone can submit feedback" on public.feedback;
create policy "Anyone can submit feedback"
on public.feedback
for insert
to anon, authenticated
with check (true);
