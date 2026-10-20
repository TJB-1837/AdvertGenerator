    -- Stores one row per physical item owned by an authenticated user.
    create table if not exists public.inventory_items (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    template_id uuid references public.templates(id) on delete set null,
    name text not null,
    status text not null default 'in_stock' check (status in ('in_transit', 'in_stock', 'to_list', 'listed', 'sold')),
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
        status text not null default 'in_stock' check (status in ('in_transit', 'in_stock', 'to_list', 'listed', 'sold')),
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

    alter table public.inventory_items drop constraint if exists inventory_items_status_check;
    alter table public.inventory_items add constraint inventory_items_status_check check (status in ('in_transit', 'in_stock', 'to_list', 'listed', 'sold'));

    alter table public.inventory_lots drop constraint if exists inventory_lots_status_check;
    alter table public.inventory_lots add constraint inventory_lots_status_check check (status in ('in_transit', 'in_stock', 'to_list', 'listed', 'sold'));

    alter table public.inventory_items
        add column if not exists quantity integer not null default 1,
        add column if not exists base_purchase_price numeric(12, 2) not null default 0,
        add column if not exists inbound_cost numeric(12, 2) not null default 0;

    update public.inventory_items
    set quantity = 1
    where quantity is null or quantity < 1;

    update public.inventory_items
    set base_purchase_price = purchase_price
    where base_purchase_price = 0 and purchase_price <> 0 and inbound_cost = 0;

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

    create table if not exists public.inventory_shipments (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references auth.users(id) on delete cascade,
        name text not null,
        shipment_date date not null default current_date,
        store_to_forwarder numeric(12, 2) not null default 0 check (store_to_forwarder >= 0),
        forwarder_to_home numeric(12, 2) not null default 0 check (forwarder_to_home >= 0),
        vat_amount numeric(12, 2) not null default 0 check (vat_amount >= 0),
        extra_cost numeric(12, 2) not null default 0 check (extra_cost >= 0),
        monthly_subscription numeric(12, 2) not null default 0 check (monthly_subscription >= 0),
        allocation_method text not null default 'value' check (allocation_method in ('value', 'equal', 'manual')),
        vat_mode text not null default 'manual' check (vat_mode in ('none', 'manual', 'automatic')),
        vat_rate numeric(5, 2) check (vat_rate >= 0),
        vat_base numeric(12, 2) check (vat_base >= 0),
        include_vat_in_cost boolean not null default true,
        notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
    );

    create table if not exists public.inventory_shipment_allocations (
        id uuid primary key default gen_random_uuid(),
        shipment_id uuid not null references public.inventory_shipments(id) on delete cascade,
        item_id uuid not null references public.inventory_items(id) on delete cascade,
        quantity numeric(12, 3) not null check (quantity > 0),
        allocated_cost numeric(12, 2) not null check (allocated_cost >= 0),
        created_at timestamptz not null default now(),
        unique (shipment_id, item_id)
    );

    alter table public.inventory_shipments enable row level security;
    alter table public.inventory_shipment_allocations enable row level security;

    drop policy if exists "Users can view their inventory shipments" on public.inventory_shipments;
    create policy "Users can view their inventory shipments" on public.inventory_shipments for select using (auth.uid() = user_id);
    drop policy if exists "Users can create their inventory shipments" on public.inventory_shipments;
    create policy "Users can create their inventory shipments" on public.inventory_shipments for insert with check (auth.uid() = user_id);
    drop policy if exists "Users can update their inventory shipments" on public.inventory_shipments;
    create policy "Users can update their inventory shipments" on public.inventory_shipments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
    drop policy if exists "Users can delete their inventory shipments" on public.inventory_shipments;
    create policy "Users can delete their inventory shipments" on public.inventory_shipments for delete using (auth.uid() = user_id);

    drop policy if exists "Users can view shipment allocations" on public.inventory_shipment_allocations;
    create policy "Users can view shipment allocations" on public.inventory_shipment_allocations for select
    using (exists (select 1 from public.inventory_shipments s where s.id = shipment_id and s.user_id = auth.uid()));
    drop policy if exists "Users can create shipment allocations" on public.inventory_shipment_allocations;
    create policy "Users can create shipment allocations" on public.inventory_shipment_allocations for insert
    with check (exists (select 1 from public.inventory_shipments s where s.id = shipment_id and s.user_id = auth.uid()));
    drop policy if exists "Users can delete shipment allocations" on public.inventory_shipment_allocations;
    create policy "Users can delete shipment allocations" on public.inventory_shipment_allocations for delete
    using (exists (select 1 from public.inventory_shipments s where s.id = shipment_id and s.user_id = auth.uid()));

    create index if not exists inventory_shipments_user_id_idx on public.inventory_shipments(user_id);
    create index if not exists inventory_shipment_allocations_shipment_id_idx on public.inventory_shipment_allocations(shipment_id);
    create index if not exists inventory_shipment_allocations_item_id_idx on public.inventory_shipment_allocations(item_id);