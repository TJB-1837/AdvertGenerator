    -- Stores one row per physical item owned by an authenticated user.
    create table if not exists public.inventory_items (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    template_id uuid references public.templates(id) on delete set null,
    name text not null,
    status text not null default 'in_stock' check (status in ('in_stock', 'to_list', 'listed', 'sold')),
    item_type text,
    condition text,
    platform text,
    platforms text[] not null default '{}',
    purchase_date date,
    purchase_price numeric(12, 2) not null default 0 check (purchase_price >= 0),
    target_sale_price numeric(12, 2) check (target_sale_price >= 0),
    sale_date date,
    sale_price numeric(12, 2) check (sale_price >= 0),
    selling_fees numeric(12, 2) not null default 0 check (selling_fees >= 0),
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
    );

    alter table public.inventory_items enable row level security;

    drop policy if exists "Users can view their inventory" on public.inventory_items;
    create policy "Users can view their inventory"
    on public.inventory_items for select
    using (auth.uid() = user_id);

    drop policy if exists "Users can create their inventory" on public.inventory_items;
    create policy "Users can create their inventory"
    on public.inventory_items for insert
    with check (auth.uid() = user_id);

    drop policy if exists "Users can update their inventory" on public.inventory_items;
    create policy "Users can update their inventory"
    on public.inventory_items for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

    drop policy if exists "Users can delete their inventory" on public.inventory_items;
    create policy "Users can delete their inventory"
    on public.inventory_items for delete
    using (auth.uid() = user_id);

    create index if not exists inventory_items_user_id_idx on public.inventory_items(user_id);
    create index if not exists inventory_items_status_idx on public.inventory_items(user_id, status);

    -- Keeps existing installations compatible while allowing multiple marketplaces per item.
    alter table public.inventory_items
        add column if not exists platforms text[] not null default '{}';

    update public.inventory_items
    set platforms = array[platform]
    where coalesce(array_length(platforms, 1), 0) = 0
        and platform is not null
        and platform <> '';

    -- A lot groups several physical inventory items without replacing their individual details.
    create table if not exists public.inventory_lots (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references auth.users(id) on delete cascade,
        name text not null,
        template_id uuid references public.templates(id) on delete set null,
        status text not null default 'in_stock' check (status in ('in_stock', 'to_list', 'listed', 'sold')),
        purchase_date date,
        purchase_price numeric(12, 2) not null default 0 check (purchase_price >= 0),
        target_sale_price numeric(12, 2) check (target_sale_price >= 0),
        sale_date date,
        sale_price numeric(12, 2) check (sale_price >= 0),
        selling_fees numeric(12, 2) not null default 0 check (selling_fees >= 0),
        notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
    );

    alter table public.inventory_lots
        add column if not exists template_id uuid references public.templates(id) on delete set null,
        add column if not exists status text not null default 'in_stock',
        add column if not exists purchase_date date,
        add column if not exists purchase_price numeric(12, 2) not null default 0,
        add column if not exists target_sale_price numeric(12, 2),
        add column if not exists sale_date date,
        add column if not exists sale_price numeric(12, 2),
        add column if not exists selling_fees numeric(12, 2) not null default 0;

    alter table public.inventory_items
        add column if not exists lot_id uuid references public.inventory_lots(id) on delete cascade;

    alter table public.inventory_lots enable row level security;

    drop policy if exists "Users can view their inventory lots" on public.inventory_lots;
    create policy "Users can view their inventory lots"
    on public.inventory_lots for select
    using (auth.uid() = user_id);

    drop policy if exists "Users can create their inventory lots" on public.inventory_lots;
    create policy "Users can create their inventory lots"
    on public.inventory_lots for insert
    with check (auth.uid() = user_id);

    drop policy if exists "Users can update their inventory lots" on public.inventory_lots;
    create policy "Users can update their inventory lots"
    on public.inventory_lots for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

    drop policy if exists "Users can delete their inventory lots" on public.inventory_lots;
    create policy "Users can delete their inventory lots"
    on public.inventory_lots for delete
    using (auth.uid() = user_id);

    create index if not exists inventory_lots_user_id_idx on public.inventory_lots(user_id);
    create index if not exists inventory_items_lot_id_idx on public.inventory_items(lot_id);