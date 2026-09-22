-- Creates one personal starter template for every new account.
create or replace function public.create_default_template_for_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.templates (user_id, name, title, content)
  values (
    new.id,
    'Professional sneaker resale',
    '👟 [Brand] [Model] sneakers - Size [Size]',
    E'👟 Authentic [Brand] [Model] sneakers in [Condition] condition.\n\n📏 Size: [Size]\n🎨 Colorway: [Colorway]\n✅ Condition: [Condition]\n\n✨ Features:\n- 🔍 Carefully inspected before shipping\n- 🚚 Ships within 1 business day\n- 📦 Secure packaging included\n\n📸 Please review all photos and ask any questions before purchasing. Serious buyers are welcome.'
  );

  return new;
end;
$$;

revoke all on function public.create_default_template_for_user() from public;

drop trigger if exists on_auth_user_created_add_default_template on auth.users;
create trigger on_auth_user_created_add_default_template
after insert on auth.users
for each row
execute function public.create_default_template_for_user();

-- Add the same starter template to accounts created before this migration.
insert into public.templates (user_id, name, title, content)
select
  users.id,
  'Professional sneaker resale',
  '👟 [Brand] [Model] sneakers - Size [Size]',
  E'👟 Authentic [Brand] [Model] sneakers in [Condition] condition.\n\n📏 Size: [Size]\n🎨 Colorway: [Colorway]\n✅ Condition: [Condition]\n\n✨ Features:\n- 🔍 Carefully inspected before shipping\n- 🚚 Ships within 1 business day\n- 📦 Secure packaging included\n\n📸 Please review all photos and ask any questions before purchasing. Serious buyers are welcome.'
from auth.users as users
where not exists (
  select 1
  from public.templates
  where templates.user_id = users.id
    and templates.name = 'Professional sneaker resale'
);
