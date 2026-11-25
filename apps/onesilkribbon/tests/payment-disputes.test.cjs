const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { PGlite } = require('@electric-sql/pglite')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

function loadShapes() {
  const source = read('lib/dispute-shapes.js').replace(/^export (?=const |function |async function)/gm, '')
  return new Function(source + ';return { isResolvedDispute, mapStripeDispute, mapPayPalDispute }')()
}

function loadDisputes(bindings) {
  const source = read('lib/payment-disputes.js')
    .replace(/^import .*$/gm, '')
    .replace(/^export \{.*\} from .*$/gm, '')
    .replace(/^export (?=const |function |async function)/gm, '')
  return new Function(...Object.keys(bindings), source + ';return { recordPaymentDispute, recordAndNotifyDispute }')(...Object.values(bindings))
}

function mockDisputeDb(existing) {
  const upserts = []
  const supabaseAdmin = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: existing, error: null }) }),
        }),
      }),
      upsert: row => ({
        select: () => ({
          single: async () => { upserts.push(row); return { data: { ...row, id: 'd1' }, error: null } },
        }),
      }),
    }),
  }
  return { supabaseAdmin, upserts }
}

const shapes = loadShapes()
let db

before(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
    create or replace function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
  `)
  await db.exec(read('supabase/schema.sql'))
  await db.exec(read('supabase/migrations/2026-11-25-payment-disputes.sql'))
})

after(async () => { await db?.close() })

test('Stripe dispute maps identity, amount, currency and evidence deadline', () => {
  const mapped = shapes.mapStripeDispute({
    id: 'dp_123',
    payment_intent: 'pi_123',
    status: 'needs_response',
    amount: 2599,
    currency: 'gbp',
    reason: 'fraudulent',
    metadata: { orderNumber: 'OSR-1001' },
    evidence_details: { due_by: 1764547200 },
  })
  assert.equal(mapped.provider, 'stripe')
  assert.equal(mapped.disputeId, 'dp_123')
  assert.equal(mapped.paymentId, 'pi_123')
  assert.equal(mapped.orderNumber, 'OSR-1001')
  assert.equal(mapped.amountPence, 2599)
  assert.equal(mapped.currency, 'GBP')
  assert.equal(mapped.evidenceDueBy, new Date(1764547200 * 1000).toISOString())
})

test('Stripe dispute tolerates missing/zero amounts without inventing money', () => {
  const mapped = shapes.mapStripeDispute({ id: 'dp_2', payment_intent: { id: 'pi_2' }, amount: 0, evidence_details: {} })
  assert.equal(mapped.paymentId, 'pi_2')
  assert.equal(mapped.amountPence, null)
  assert.equal(mapped.evidenceDueBy, null)
  assert.equal(mapped.status, 'needs_response')
})

test('PayPal dispute maps the seller transaction and dispute amount', () => {
  const mapped = shapes.mapPayPalDispute({
    dispute_id: 'PP-D-1',
    status: 'WAITING_FOR_SELLER_RESPONSE',
    reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
    dispute_amount: { currency_code: 'GBP', value: '25.99' },
    disputed_transactions: [{ seller_transaction_id: 'CAPTURE-1' }],
    seller_response_due_date: '2026-12-01T00:00:00.000Z',
  }, 'WH-1')
  assert.equal(mapped.provider, 'paypal')
  assert.equal(mapped.disputeId, 'PP-D-1')
  assert.equal(mapped.paymentId, 'CAPTURE-1')
  assert.equal(mapped.amountPence, 2599)
  assert.equal(mapped.currency, 'GBP')
  assert.equal(mapped.status, 'WAITING_FOR_SELLER_RESPONSE')
  assert.equal(mapped.evidenceDueBy, '2026-12-01T00:00:00.000Z')
})

test('resolved statuses are recognised for both providers', () => {
  for (const status of ['won', 'LOST', 'warning_closed', 'resolved', 'cancelled', 'charge_refunded', 'prevented']) {
    assert.equal(shapes.isResolvedDispute(status), true, status)
  }
  for (const status of ['needs_response', 'under_review', 'OPEN', 'WAITING_FOR_SELLER_RESPONSE']) {
    assert.equal(shapes.isResolvedDispute(status), false, status)
  }
})

test('a resolved dispute is not reopened by a late or replayed webhook', async () => {
  const existing = {
    id: 'd1', status: 'won', order_number: 'O1', payment_id: 'pi_1',
    reason: 'fraudulent', amount_pence: 1000, currency: 'GBP',
    evidence_due_by: null, resolved_at: '2026-01-01T00:00:00.000Z',
  }
  const { supabaseAdmin, upserts } = mockDisputeDb(existing)
  const { recordPaymentDispute } = loadDisputes({
    supabaseAdmin, escapeHtml: value => value, OWNER_EMAIL: 'owner@example.test',
    sendEmail: async () => {}, isResolvedDispute: shapes.isResolvedDispute,
  })
  const result = await recordPaymentDispute({
    provider: 'stripe', disputeId: 'dp_1', status: 'under_review',
    orderNumber: 'O1', paymentId: null, reason: null, amountPence: null, currency: null, evidenceDueBy: null,
  })
  assert.equal(result.ignored, true)
  assert.equal(upserts.length, 0)
})

test('a duplicate resolved event keeps the original resolution time and existing details', async () => {
  const existing = {
    id: 'd1', status: 'won', order_number: 'O1', payment_id: 'pi_1',
    reason: 'fraudulent', amount_pence: 1000, currency: 'GBP',
    evidence_due_by: '2026-02-01T00:00:00.000Z', resolved_at: '2026-01-01T00:00:00.000Z',
  }
  const { supabaseAdmin, upserts } = mockDisputeDb(existing)
  const { recordPaymentDispute } = loadDisputes({
    supabaseAdmin, escapeHtml: value => value, OWNER_EMAIL: 'owner@example.test',
    sendEmail: async () => {}, isResolvedDispute: shapes.isResolvedDispute,
  })
  await recordPaymentDispute({
    provider: 'stripe', disputeId: 'dp_1', status: 'won',
    orderNumber: null, paymentId: null, reason: null, amountPence: null, currency: null, evidenceDueBy: null,
  })
  assert.equal(upserts.length, 1)
  assert.equal(upserts[0].resolved_at, existing.resolved_at)
  assert.equal(upserts[0].payment_id, 'pi_1')
  assert.equal(upserts[0].amount_pence, 1000)
  assert.equal(upserts[0].reason, 'fraudulent')
  assert.equal(upserts[0].currency, 'GBP')
  assert.equal(upserts[0].evidence_due_by, existing.evidence_due_by)
})

test('payment_disputes table is idempotent per provider + dispute id', async () => {
  await db.query(`insert into orders(order_number,customer_email,status,subtotal_gbp,total_gbp,
      shipping_name,shipping_line1,shipping_city,shipping_postcode)
    values('DP-1','buyer@example.com','paid',10,10,'Buyer','1 St','London','A1 1AA')`)
  await db.query(`insert into payment_disputes(provider,dispute_id,order_number,status,amount_pence,currency)
    values('stripe','dp_1','DP-1','needs_response',1000,'GBP')`)
  await db.query(`insert into payment_disputes(provider,dispute_id,order_number,status,amount_pence,currency)
    values('stripe','dp_1','DP-1','won',1000,'GBP')
    on conflict (provider,dispute_id) do update set status=excluded.status`)
  const rows = (await db.query("select status,amount_pence from payment_disputes where provider='stripe' and dispute_id='dp_1'")).rows
  assert.equal(rows.length, 1)
  assert.equal(rows[0].status, 'won')
  assert.equal(rows[0].amount_pence, 1000)
})
