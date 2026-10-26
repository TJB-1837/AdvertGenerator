import { pathToFileURL } from 'node:url'
const { PGlite } = await import(
  process.env.ADRAFTEO_PGLITE_MODULE
    ? pathToFileURL(process.env.ADRAFTEO_PGLITE_MODULE).href
    : '@electric-sql/pglite'
)
import fs from 'node:fs'
import assert from 'node:assert/strict'
const db = new PGlite()
try {
  await db.exec(`create role anon;create role authenticated;create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.templates(id uuid primary key);
grant usage on schema public,auth to authenticated;grant execute on function auth.uid() to authenticated;`)
  const sql = fs.readFileSync(new URL('../supabase/inventory.sql', import.meta.url), 'utf8')
  await db.exec(sql)
  await db.exec(sql)
  console.log('PASS: migration applies twice')
  await db.exec(`grant select,insert,update,delete on all tables in schema public to authenticated;
insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
insert into public.inventory_lots(id,user_id,name,seller_to_forwarder_cost) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Lot',3);
insert into public.inventory_items(id,user_id,lot_id,name,quantity,base_purchase_price,seller_to_forwarder_cost,purchase_price,final_price) values
('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Item',2,100,10,110,110),
('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002',null,'Other user',1,25,0,25,25);
set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);`)
  const draft = {
    name: 'Shipment',
    shipment_date: '2026-10-24',
    store_to_forwarder: '',
    forwarder_to_home: 20,
    monthly_subscription: '',
    extra_cost: '',
    vat_mode: 'none',
    vat_rate: '20',
    vat_base: '',
    include_vat_in_cost: true,
    allocation_method: 'value',
    allocations: [
      { item_id: '20000000-0000-0000-0000-000000000001', quantity: 2, allocated_cost: 20 },
    ],
  }
  const save = async (d = draft) =>
    (
      await db.query('select public.save_inventory_shipment($1::jsonb) as data', [
        JSON.stringify(d),
      ])
    ).rows[0].data
  const remove = async (id) =>
    (await db.query('select public.delete_inventory_shipment($1::uuid) as data', [id])).rows[0].data
  const count = async () =>
    Number((await db.query('select count(*) from public.inventory_shipments')).rows[0].count)
  const price = async () =>
    Number(
      (await db.query('select purchase_price from public.inventory_items')).rows[0].purchase_price,
    )
  let snapshot = await save()
  assert.equal(snapshot.items.length, 1)
  assert.equal(Number(snapshot.items[0].purchase_price), 133)
  assert.equal(Number(snapshot.items[0].inbound_cost), 20)
  assert.equal(Number(snapshot.lots[0].purchase_price), 133)
  assert.equal(Number(snapshot.lots[0].final_price), 133)
  console.log('PASS: costs applied once; blank inputs accepted; snapshot isolates user')
  for (const [label, change] of [
    [
      'foreign item',
      {
        allocations: [
          { item_id: '20000000-0000-0000-0000-000000000002', quantity: 1, allocated_cost: 20 },
        ],
      },
    ],
    ['excess quantity', { allocations: [{ ...draft.allocations[0], quantity: 3 }] }],
    ['duplicate item', { allocations: [...draft.allocations, ...draft.allocations] }],
    ['incorrect total', { allocations: [{ ...draft.allocations[0], allocated_cost: 19 }] }],
    ['negative cost', { forwarder_to_home: -20 }],
  ]) {
    await assert.rejects(() => save({ ...draft, ...change }))
    assert.equal(await count(), 1)
    console.log('PASS: rejects ' + label + ' with no partial writes')
  }
  const id = snapshot.shipments[0].id
  await db.exec(`reset role;create function public.test_reject_lot_update() returns trigger language plpgsql as $$begin if current_setting('test.reject_update',true)='on' then raise exception 'Simulated late failure';end if;return new;end$$;
create trigger test_reject_lot_update before update on public.inventory_lots for each row execute function public.test_reject_lot_update();set role authenticated;select set_config('test.reject_update','on',false);`)
  await assert.rejects(() => save())
  assert.equal(await count(), 1)
  assert.equal(await price(), 133)
  await assert.rejects(() => remove(id))
  assert.equal(await count(), 1)
  assert.equal(await price(), 133)
  console.log('PASS: late errors roll back all shipment and item writes')
  await db.exec("select set_config('test.reject_update','off',false)")
  snapshot = await remove(id)
  assert.equal(snapshot.shipments.length, 0)
  assert.equal(snapshot.allocations.length, 0)
  assert.equal(Number(snapshot.items[0].purchase_price), 113)
  assert.equal(Number(snapshot.items[0].inbound_cost), 0)
  assert.equal(Number(snapshot.lots[0].final_price), 113)
  console.log('PASS: deletion exactly reverses shipment costs')
  await assert.rejects(() => remove(id))
  snapshot = await save({
    ...draft,
    vat_mode: 'automatic',
    allocations: [{ ...draft.allocations[0], allocated_cost: 40 }],
  })
  assert.equal(Number(snapshot.shipments[0].vat_amount), 20)
  console.log('PASS: automatic VAT uses selected acquisition value')
  await remove(snapshot.shipments[0].id)
  snapshot = await save({
    ...draft,
    vat_mode: 'automatic',
    vat_base: '0',
    allocations: [{ ...draft.allocations[0], allocated_cost: 20 }],
  })
  assert.equal(Number(snapshot.shipments[0].vat_amount), 0)
  console.log('PASS: explicit zero VAT base respected')
  await db.exec(
    "select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false)",
  )
  await assert.rejects(() => remove(snapshot.shipments[0].id))
  console.log('PASS: other account cannot delete shipment')
  await db.exec(
    "select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false)",
  )
  const lotId = '10000000-0000-0000-0000-000000000003'
  const itemA = '30000000-0000-0000-0000-000000000001'
  const itemB = '30000000-0000-0000-0000-000000000002'
  await db.exec(`insert into public.inventory_lots(id,user_id,name,seller_to_forwarder_cost) values
    ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','Shipping lot',10.01);
    insert into public.inventory_items(id,user_id,lot_id,name,quantity,base_purchase_price,seller_to_forwarder_cost,inbound_cost) values
    ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','Two bags',2,60,2,3),
    ('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','One bag',1,30,1,5);`)
  const lotItems = async () =>
    (await db.query('select * from public.inventory_items where lot_id=$1 order by id', [lotId]))
      .rows
  const lot = async () =>
    (await db.query('select * from public.inventory_lots where id=$1', [lotId])).rows[0]
  let children = await lotItems()
  assert.deepEqual(
    children.map((item) => Number(item.lot_shipping_cost)),
    [6.67, 3.34],
  )
  assert.deepEqual(
    children.map((item) => Number(item.final_price)),
    [71.67, 39.34],
  )
  assert.equal(Number((await lot()).final_price), 111.01)
  console.log('PASS: lot shipping distributed by quantity and included once in every final price')
  await db.query('update public.inventory_lots set seller_to_forwarder_cost=20.01 where id=$1', [
    lotId,
  ])
  children = await lotItems()
  assert.deepEqual(
    children.map((item) => Number(item.lot_shipping_cost)),
    [13.34, 6.67],
  )
  assert.equal(Number((await lot()).final_price), 121.01)
  assert.deepEqual(
    children.map((item) => Number(item.inbound_cost)),
    [3, 5],
  )
  console.log(
    'PASS: editing shipping redistributes costs without changing acquisition or shipment costs',
  )
  await db.query('update public.inventory_items set quantity=1 where id=$1', [itemA])
  assert.deepEqual(
    (await lotItems()).map((item) => Number(item.lot_shipping_cost)),
    [10.01, 10],
  )
  await db.query('delete from public.inventory_items where id=$1', [itemB])
  assert.equal(Number((await lotItems())[0].lot_shipping_cost), 20.01)
  assert.equal(Number((await lot()).final_price), 85.01)
  console.log('PASS: quantity changes and item deletion redistribute the full shipping total')
  await db.query(
    'update public.inventory_lots set seller_to_forwarder_cost=2,purchase_price=67 where id=$1',
    [lotId],
  )
  assert.equal(Number((await lotItems())[0].final_price), 67)
  await db.query(
    'update public.inventory_lots set seller_to_forwarder_cost=2,purchase_price=97 where id=$1',
    [lotId],
  )
  assert.equal(Number((await lotItems())[0].base_purchase_price), 90)
  assert.equal(Number((await lot()).final_price), 97)
  console.log('PASS: lot editing preserves purchase-price changes and shipping allocation')
  await db.exec('reset role')
  const beforeRerun = await lotItems()
  // Simulate an existing lot whose shipping is still stored only on its parent.
  await db.query(
    'update public.inventory_items set lot_shipping_cost=0, purchase_price=base_purchase_price+seller_to_forwarder_cost+inbound_cost, final_price=base_purchase_price+seller_to_forwarder_cost+inbound_cost where lot_id=$1',
    [lotId],
  )
  await db.exec(sql)
  assert.deepEqual(
    (await lotItems()).map((item) => [
      item.base_purchase_price,
      item.lot_shipping_cost,
      item.final_price,
    ]),
    beforeRerun.map((item) => [item.base_purchase_price, item.lot_shipping_cost, item.final_price]),
  )
  console.log('PASS: migration repairs legacy lot allocations')
  await db.exec(sql)
  assert.deepEqual(
    (await lotItems()).map((item) => [item.base_purchase_price, item.lot_shipping_cost, item.final_price]),
    beforeRerun.map((item) => [item.base_purchase_price, item.lot_shipping_cost, item.final_price]),
  )
  console.log('PASS: rerunning migration with existing data does not accumulate costs')
  await db.exec(
    "set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false)",
  )
  await db.query('update public.inventory_items set lot_id=null where id=$1', [itemA])
  const detached = (await db.query('select * from public.inventory_items where id=$1', [itemA]))
    .rows[0]
  assert.equal(Number(detached.lot_shipping_cost), 0)
  assert.equal(Number(detached.final_price), 95)
  console.log('PASS: removing an item from its lot removes its allocated lot shipping')
} catch (e) {
  console.error({
    message: e.message,
    detail: e.detail,
    where: e.where,
    stack: e instanceof assert.AssertionError ? e.stack : undefined,
  })
  process.exitCode = 1
} finally {
  await db.close()
}
