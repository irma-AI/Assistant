import { sql } from 'kysely'
import { expect, test, vi } from 'vitest'
import { collect } from './auth/bankid.server'
import { begin, db, poll, post, useDatabase } from './login.fixture'
import { extendLogin } from './login.order.server'
import { pollLogin } from './login.server'

vi.stubEnv('PUBLIC_URL', 'https://app.example')
useDatabase()

// BankID's QR rules (docs/plans/IRM-161.md): new 30-second orders for five minutes, and "Mer tid" resets it.
const set = (
  id: string,
  values: Partial<Record<'order_at' | 'qr_until' | 'created_at', string>>,
) =>
  db
    .updateTable('login_attempts')
    .set(
      Object.fromEntries(
        Object.entries(values).map(([k, v]) => [
          k,
          sql<Date>`now() + ${v}::interval`,
        ]),
      ),
    )
    .where('id', '=', id)
    .execute()

const orderOf = async (id: string) =>
  (
    await db
      .selectFrom('login_attempts')
      .select('order_ref')
      .where('id', '=', id)
      .executeTakeFirstOrThrow()
  ).order_ref

const left = async (id: string) =>
  (
    await db
      .selectFrom('login_attempts')
      .select('id')
      .where('id', '=', id)
      .execute()
  ).length

test('a QR login shows the QR code for five minutes', async () => {
  const { login, id } = await begin('203.0.113.7')
  const first = await poll(login, id)
  expect(first.body).toMatchObject({ status: 'pending', remaining: 300 })
  expect(first.body.qr).toMatch(/^bankid\.[\w-]+\.0\./)
})

test('an unscanned order about to end is replaced by a new one, and the old one is cancelled', async () => {
  const { login, id } = await begin('203.0.113.7')
  const old = await orderOf(id)
  await set(id, { order_at: '-26 seconds' })
  const next = await poll(login, id)
  expect(next.body).toMatchObject({ status: 'pending', remaining: 300 })
  expect(next.body.qr).toMatch(/^bankid\.[\w-]+\.0\./)
  expect(await orderOf(id)).not.toBe(old)
  await expect(collect(old, false)).rejects.toThrow()
  expect(await left(id)).toBe(1)
})

test('an order that is being finished is never replaced, however old', async () => {
  const { login, id } = await begin('203.0.113.7')
  await poll(login, id)
  await set(id, { order_at: '-29 seconds' })
  expect((await poll(login, id)).body).toEqual({ status: 'complete' })
  expect(await left(id)).toBe(0)
})

test('when the five minutes run out, the QR code goes and the unscanned login ends', async () => {
  const { login, id } = await begin('203.0.113.7')
  await set(id, { qr_until: '-1 second' })
  await db
    .updateTable('login_attempts')
    .set({ last_collect_at: sql<Date>`now()` })
    .where('id', '=', id)
    .execute()
  const throttled = await pollLogin(post({ cookie: login }), db)
  const quiet: unknown = await throttled.json()
  expect(quiet).toEqual({ status: 'pending', message: '' })
  const done = await poll(login, id)
  expect(done.body).toEqual({
    status: 'failed',
    message:
      'Misslyckades att läsa av QR-koden. Starta BankID-appen och läs av QR-koden.',
  })
  expect(await left(id)).toBe(0)
})

test('"Mer tid" resets the QR display to five minutes, within the 30 minutes an attempt lives', async () => {
  const { login, id } = await begin('203.0.113.7')
  await set(id, { qr_until: '10 seconds' })
  const extended = await extendLogin(post({ cookie: login }), db)
  expect(await extended.json()).toEqual({ remaining: 300 })
  await set(id, { created_at: '-28 minutes' })
  const capped: unknown = await (
    await extendLogin(post({ cookie: login }), db)
  ).json()
  expect(capped).toEqual({ remaining: 120 })
})

test('"Mer tid" has nothing to extend for a same-device login or without an attempt', async () => {
  const { login } = await begin('203.0.113.7', true)
  expect((await extendLogin(post({ cookie: login }), db)).status).toBe(404)
  expect((await extendLogin(post({}), db)).status).toBe(404)
})
