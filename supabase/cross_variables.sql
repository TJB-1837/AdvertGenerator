-- Stores reusable default values for variables shared by all templates.
create table if not exists public.cross_variables (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    variable_name text not null,
    default_value text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, variable_name)
);

alter table public.cross_variables enable row level security;

drop policy if exists "Users can view their cross variables" on public.cross_variables;
create policy "Users can view their cross variables"
on public.cross_variables for select
using (auth.uid() = user_id);

drop policy if exists "Users can create their cross variables" on public.cross_variables;
create policy "Users can create their cross variables"
on public.cross_variables for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their cross variables" on public.cross_variables;
create policy "Users can update their cross variables"
on public.cross_variables for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their cross variables" on public.cross_variables;
create policy "Users can delete their cross variables"
on public.cross_variables for delete
using (auth.uid() = user_id);

create index if not exists cross_variables_user_id_idx on public.cross_variables(user_id);