    -- Stores one row per physical item owned by an authenticated user.
    create table if not exists public.inventory_items (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    template_id uuid references public.templates(id) on delete set null,
    name text not null,
    status text not null default 'in_stock' check (status in ('kept', 'in_transit', 'in_stock', 'to_list', 'listed', 'sold')),
    item_type text,
    condition text,
    platform text,
    platforms text[] not null default '{}',
    purchase_date date,
    purchase_price numeric(12, 2) not null default 0 check (purchase_price >= 0),
    final_price numeric(12, 2) not null default 0 check (final_price >= 0),
    seller_to_forwarder_cost numeric(12, 2) not null default 0 check (seller_to_forwarder_cost >= 0),
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
        status text not null default 'in_stock' check (status in ('kept', 'in_transit', 'in_stock', 'to_list', 'listed', 'sold')),
        purchase_date date,
        purchase_price numeric(12, 2) not null default 0 check (purchase_price >= 0),
        seller_to_forwarder_cost numeric(12, 2) not null default 0 check (seller_to_forwarder_cost >= 0),
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
        add column if not exists final_price numeric(12, 2) not null default 0,
        add column if not exists seller_to_forwarder_cost numeric(12, 2) not null default 0,
        add column if not exists target_sale_price numeric(12, 2),
        add column if not exists sale_date date,
        add column if not exists sale_price numeric(12, 2),
        add column if not exists selling_fees numeric(12, 2) not null default 0;

    alter table public.inventory_items
        add column if not exists lot_id uuid references public.inventory_lots(id) on delete cascade;

    alter table public.inventory_items drop constraint if exists inventory_items_status_check;
    alter table public.inventory_items add constraint inventory_items_status_check check (status in ('kept', 'in_transit', 'in_stock', 'to_list', 'listed', 'sold'));

    alter table public.inventory_lots drop constraint if exists inventory_lots_status_check;
    alter table public.inventory_lots add constraint inventory_lots_status_check check (status in ('kept', 'in_transit', 'in_stock', 'to_list', 'listed', 'sold'));

    alter table public.inventory_items
        add column if not exists quantity integer not null default 1,
        add column if not exists base_purchase_price numeric(12, 2) not null default 0,
        add column if not exists final_price numeric(12, 2) not null default 0,
        add column if not exists inbound_cost numeric(12, 2) not null default 0,
        add column if not exists lot_shipping_cost numeric(12, 2) not null default 0 check (lot_shipping_cost >= 0),
        add column if not exists seller_to_forwarder_cost numeric(12, 2) not null default 0;

    update public.inventory_items
    set quantity = 1
    where quantity is null or quantity < 1;

    update public.inventory_items
    set base_purchase_price = greatest(0, purchase_price - seller_to_forwarder_cost - lot_shipping_cost - inbound_cost)
    where base_purchase_price = 0 and purchase_price <> seller_to_forwarder_cost + lot_shipping_cost + inbound_cost;

    update public.inventory_items
    set final_price = purchase_price
    where final_price = 0 and purchase_price <> 0;

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
-- Shipment mutations run in one transaction. RLS remains active for every query.
create or replace function public.inventory_workspace_snapshot()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(i order by i.created_at desc) from public.inventory_items i where i.user_id = auth.uid()), '[]'::jsonb),
    'lots', coalesce((select jsonb_agg(l order by l.created_at desc) from public.inventory_lots l where l.user_id = auth.uid()), '[]'::jsonb),
    'shipments', coalesce((select jsonb_agg(s order by s.shipment_date desc, s.created_at desc) from public.inventory_shipments s where s.user_id = auth.uid()), '[]'::jsonb),
    'allocations', coalesce((select jsonb_agg(a) from public.inventory_shipment_allocations a join public.inventory_shipments s on s.id = a.shipment_id where s.user_id = auth.uid()), '[]'::jsonb)
  );
$$;

create or replace function public.save_inventory_shipment(draft jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  saved_id uuid;
  row_data jsonb;
  inventory_item public.inventory_items%rowtype;
  selected_quantity numeric;
  selected_value numeric := 0;
  allocated_total numeric := 0;
  shipment_total numeric;
  vat numeric := 0;
  vat_mode text := coalesce(draft->>'vat_mode', 'none');
  touched_ids uuid[] := '{}';
  touched_lots uuid[] := '{}';
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  -- Serialize shipment operations for this account, including concurrent browser tabs.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text, 0));
  if nullif(btrim(draft->>'name'), '') is null then raise exception 'Shipment name is required'; end if;
  if jsonb_typeof(draft->'allocations') is distinct from 'array' then raise exception 'Select inventory items'; end if;
  if jsonb_array_length(draft->'allocations') = 0 then raise exception 'Select inventory items'; end if;

  for row_data in select value from jsonb_array_elements(draft->'allocations') order by value->>'item_id'
  loop
    select * into inventory_item from public.inventory_items i
      where i.id = (row_data->>'item_id')::uuid and i.user_id = owner_id for update;
    if not found then raise exception 'Inventory item not found or not owned by this account'; end if;
    if inventory_item.id = any(touched_ids) then raise exception 'Duplicate inventory item'; end if;
    selected_quantity := (row_data->>'quantity')::numeric;
    if selected_quantity is null or selected_quantity <= 0 or selected_quantity <> trunc(selected_quantity)
      or selected_quantity > inventory_item.quantity then raise exception 'Invalid physical quantity'; end if;
    if (row_data->>'allocated_cost')::numeric is null or (row_data->>'allocated_cost')::numeric < 0 then
      raise exception 'Invalid allocated cost';
    end if;
    if (row_data->>'allocated_cost')::numeric <> round((row_data->>'allocated_cost')::numeric, 2) then
      raise exception 'Allocated costs must be expressed in cents';
    end if;
    allocated_total := allocated_total + (row_data->>'allocated_cost')::numeric;
    selected_value := selected_value + inventory_item.base_purchase_price * selected_quantity / inventory_item.quantity;
    touched_ids := array_append(touched_ids, inventory_item.id);
    if inventory_item.lot_id is not null then touched_lots := array_append(touched_lots, inventory_item.lot_id); end if;
  end loop;

  vat := case vat_mode
    when 'none' then 0
    when 'automatic' then round(coalesce(nullif(draft->>'vat_base', '')::numeric, selected_value)
      * coalesce(nullif(draft->>'vat_rate', '')::numeric, 0) / 100, 2)
    else coalesce(nullif(draft->>'vat_amount', '')::numeric, 0)
  end;
  insert into public.inventory_shipments (
    user_id, name, shipment_date, store_to_forwarder, forwarder_to_home, extra_cost,
    monthly_subscription, vat_mode, vat_amount, vat_rate, vat_base, include_vat_in_cost, allocation_method, notes
  ) values (
    owner_id, btrim(draft->>'name'), coalesce(nullif(draft->>'shipment_date', '')::date, current_date),
    coalesce(nullif(draft->>'store_to_forwarder', '')::numeric, 0),
    coalesce(nullif(draft->>'forwarder_to_home', '')::numeric, 0),
    coalesce(nullif(draft->>'extra_cost', '')::numeric, 0),
    coalesce(nullif(draft->>'monthly_subscription', '')::numeric, 0),
    vat_mode, vat, nullif(draft->>'vat_rate', '')::numeric, nullif(draft->>'vat_base', '')::numeric,
    coalesce((draft->>'include_vat_in_cost')::boolean, true), coalesce(draft->>'allocation_method', 'value'), nullif(draft->>'notes', '')
  ) returning id, store_to_forwarder + forwarder_to_home + extra_cost + monthly_subscription
    + case when include_vat_in_cost then vat_amount else 0 end into saved_id, shipment_total;
  if round(allocated_total, 2) <> round(shipment_total, 2) then raise exception 'Allocated costs must equal the shipment total'; end if;

  insert into public.inventory_shipment_allocations (shipment_id, item_id, quantity, allocated_cost)
    select saved_id, (r->>'item_id')::uuid, (r->>'quantity')::numeric, (r->>'allocated_cost')::numeric
    from jsonb_array_elements(draft->'allocations') r;

  update public.inventory_items i set
    inbound_cost = i.inbound_cost + a.allocated_cost,
    purchase_price = i.base_purchase_price + i.seller_to_forwarder_cost + i.lot_shipping_cost + i.inbound_cost + a.allocated_cost,
    final_price = i.base_purchase_price + i.seller_to_forwarder_cost + i.lot_shipping_cost + i.inbound_cost + a.allocated_cost,
    updated_at = now()
  from public.inventory_shipment_allocations a
  where a.shipment_id = saved_id and a.item_id = i.id and i.user_id = owner_id;

  update public.inventory_lots l set
    purchase_price = coalesce((select sum(i.purchase_price) from public.inventory_items i where i.lot_id = l.id and i.user_id = owner_id), 0),
    final_price = coalesce((select sum(i.purchase_price) from public.inventory_items i where i.lot_id = l.id and i.user_id = owner_id), 0),
    updated_at = now()
  where l.id = any(touched_lots) and l.user_id = owner_id;
  return public.inventory_workspace_snapshot();
end;
$$;

create or replace function public.delete_inventory_shipment(shipment_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  touched_lots uuid[];
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text, 0));
  perform 1 from public.inventory_shipments s where s.id = shipment_id and s.user_id = owner_id for update;
  if not found then raise exception 'Shipment not found or not owned by this account'; end if;
  perform 1 from public.inventory_items i join public.inventory_shipment_allocations a on a.item_id = i.id
    where a.shipment_id = delete_inventory_shipment.shipment_id and i.user_id = owner_id order by i.id for update of i;
  select array_agg(distinct i.lot_id) into touched_lots from public.inventory_items i
    join public.inventory_shipment_allocations a on a.item_id = i.id
    where a.shipment_id = delete_inventory_shipment.shipment_id and i.user_id = owner_id;

  update public.inventory_items i set
    inbound_cost = greatest(0, i.inbound_cost - a.allocated_cost),
    purchase_price = i.base_purchase_price + i.seller_to_forwarder_cost + i.lot_shipping_cost + greatest(0, i.inbound_cost - a.allocated_cost),
    final_price = i.base_purchase_price + i.seller_to_forwarder_cost + i.lot_shipping_cost + greatest(0, i.inbound_cost - a.allocated_cost),
    updated_at = now()
  from public.inventory_shipment_allocations a
  where a.shipment_id = delete_inventory_shipment.shipment_id and a.item_id = i.id and i.user_id = owner_id;

  delete from public.inventory_shipments s where s.id = delete_inventory_shipment.shipment_id and s.user_id = owner_id;
  update public.inventory_lots l set
    purchase_price = coalesce((select sum(i.purchase_price) from public.inventory_items i where i.lot_id = l.id and i.user_id = owner_id), 0),
    final_price = coalesce((select sum(i.purchase_price) from public.inventory_items i where i.lot_id = l.id and i.user_id = owner_id), 0),
    updated_at = now()
  where l.id = any(touched_lots) and l.user_id = owner_id;
  return public.inventory_workspace_snapshot();
end;
$$;

-- An allocation must reference both an owned shipment and an owned item.
drop policy if exists "Users can create shipment allocations" on public.inventory_shipment_allocations;
create policy "Users can create shipment allocations"
on public.inventory_shipment_allocations for insert to authenticated
with check (
  exists (select 1 from public.inventory_shipments s where s.id = shipment_id and s.user_id = auth.uid())
  and exists (select 1 from public.inventory_items i where i.id = item_id and i.user_id = auth.uid())
);

revoke all on function public.inventory_workspace_snapshot() from public;
revoke all on function public.save_inventory_shipment(jsonb) from public;
revoke all on function public.delete_inventory_shipment(uuid) from public;
grant execute on function public.inventory_workspace_snapshot() to authenticated;
grant execute on function public.save_inventory_shipment(jsonb) to authenticated;
grant execute on function public.delete_inventory_shipment(uuid) to authenticated;

comment on column public.inventory_items.selling_fees is 'Total sale costs paid by the seller: marketplace commission and outbound shipping to the buyer, stored in EUR.';
comment on column public.inventory_items.seller_to_forwarder_cost is 'Acquisition shipping to the forwarder, already included in purchase_price; never a sale commission.';

-- The lot shipping total is metadata; its allocated shares belong in item costs.
-- This function runs with the caller's permissions and RLS, including when called by triggers.
create or replace function public.recalculate_inventory_lot(p_lot_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  shipping numeric;
begin
  select l.seller_to_forwarder_cost into shipping
  from public.inventory_lots l where l.id = p_lot_id for update;
  -- A cascading lot deletion has already removed the parent row.
  if not found then return; end if;

  with units as (
    select i.id,
      sum(i.quantity) over () as total_units,
      sum(i.quantity) over (order by i.created_at, i.id rows unbounded preceding) as cumulative_units,
      i.quantity
    from public.inventory_items i where i.lot_id = p_lot_id
  ), shares as (
    select id, (round(shipping * 100 * cumulative_units / total_units)
      - round(shipping * 100 * (cumulative_units - quantity) / total_units)) / 100 as cost
    from units
  )
  update public.inventory_items i set
    lot_shipping_cost = s.cost,
    purchase_price = i.base_purchase_price + i.seller_to_forwarder_cost + i.inbound_cost + s.cost,
    final_price = i.base_purchase_price + i.seller_to_forwarder_cost + i.inbound_cost + s.cost,
    updated_at = now()
  from shares s where i.id = s.id and (
    i.lot_shipping_cost is distinct from s.cost or
    i.purchase_price is distinct from i.base_purchase_price + i.seller_to_forwarder_cost + i.inbound_cost + s.cost or
    i.final_price is distinct from i.base_purchase_price + i.seller_to_forwarder_cost + i.inbound_cost + s.cost
  );

  update public.inventory_lots l set
    purchase_price = coalesce((select sum(i.purchase_price) from public.inventory_items i where i.lot_id = l.id), 0),
    final_price = coalesce((select sum(i.final_price) from public.inventory_items i where i.lot_id = l.id), 0),
    updated_at = now()
  where l.id = p_lot_id;
end;
$$;

create or replace function public.sync_inventory_item_lot_costs()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.lot_id is not null then
    perform public.recalculate_inventory_lot(old.lot_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.lot_id is not null
    and (tg_op = 'INSERT' or new.lot_id is distinct from old.lot_id) then
    perform public.recalculate_inventory_lot(new.lot_id);
  end if;
  if tg_op = 'UPDATE' and new.lot_id is null and old.lot_id is not null then
    update public.inventory_items set lot_shipping_cost = 0,
      purchase_price = base_purchase_price + seller_to_forwarder_cost + inbound_cost,
      final_price = base_purchase_price + seller_to_forwarder_cost + inbound_cost
    where id = new.id;
  end if;
  return null;
end;
$$;

create or replace function public.sync_inventory_lot_shipping()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  requested_base numeric;
  existing_base numeric;
begin
  -- Preserve the lot editor's purchase-price action, excluding shipping and shipment costs.
  select coalesce(sum(i.base_purchase_price), 0),
    new.purchase_price - new.seller_to_forwarder_cost - coalesce(sum(i.seller_to_forwarder_cost + i.inbound_cost), 0)
  into existing_base, requested_base
  from public.inventory_items i where i.lot_id = new.id;
  if new.purchase_price is not distinct from old.purchase_price then requested_base := existing_base; end if;
  if requested_base < 0 then raise exception 'Lot purchase price cannot be less than its acquisition costs'; end if;
  if requested_base <> existing_base then
    with units as (
      select i.id, i.quantity, sum(i.quantity) over () as total_units,
        sum(i.quantity) over (order by i.created_at, i.id rows unbounded preceding) as cumulative_units
      from public.inventory_items i where i.lot_id = new.id
    )
    update public.inventory_items i set base_purchase_price = (
      round(requested_base * 100 * u.cumulative_units / u.total_units)
      - round(requested_base * 100 * (u.cumulative_units - u.quantity) / u.total_units)
    ) / 100 from units u where i.id = u.id;
  end if;
  perform public.recalculate_inventory_lot(new.id);
  return null;
end;
$$;

drop trigger if exists inventory_items_sync_lot_costs on public.inventory_items;
create trigger inventory_items_sync_lot_costs
  after insert or delete or update of quantity, lot_id, base_purchase_price, seller_to_forwarder_cost, inbound_cost
  on public.inventory_items for each row execute function public.sync_inventory_item_lot_costs();

drop trigger if exists inventory_lots_sync_shipping on public.inventory_lots;
create trigger inventory_lots_sync_shipping after update of seller_to_forwarder_cost
  on public.inventory_lots for each row execute function public.sync_inventory_lot_shipping();

revoke all on function public.recalculate_inventory_lot(uuid) from public;
revoke all on function public.sync_inventory_item_lot_costs() from public;
revoke all on function public.sync_inventory_lot_shipping() from public;
grant execute on function public.recalculate_inventory_lot(uuid) to authenticated;

-- Repair existing lots once; repeating the migration recomputes shares, never adds them again.
do $$
declare lot_record record;
begin
  for lot_record in select id from public.inventory_lots order by id loop
    perform public.recalculate_inventory_lot(lot_record.id);
  end loop;
end;
$$;
comment on column public.inventory_items.lot_shipping_cost is 'Quantity-based share of the parent lot shipping total, included exactly once in purchase_price and final_price.';
