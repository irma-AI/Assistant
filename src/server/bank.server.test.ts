import { expect, test } from 'vitest'
import { z } from 'zod'
import { bankApi } from './bank.api.server'
import {
  addMember,
  db,
  idOf,
  newOrg,
  person,
  useDatabase,
} from './orgs.fixture'
import type { Person } from './orgs.fixture'

useDatabase()

// Every file below is made up from the format facts in IRM-142; nothing here is a real account or person.
const enc = new TextEncoder()
const camt = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02"><BkToCstmrStmt><Stmt>
<Ntry><NtryRef>N1</NtryRef><Amt Ccy="SEK">1250.50</Amt><CdtDbtInd>CRDT</CdtDbtInd>
<BookgDt><Dt>2026-03-02</Dt></BookgDt><ValDt><Dt>2026-03-03</Dt></ValDt><AcctSvcrRef>REF-1</AcctSvcrRef>
<NtryDtls><TxDtls><RltdPties><Dbtr><Nm>Exempelkund AB &amp; Co</Nm></Dbtr></RltdPties>
<RmtInf><Strd><CdtrRefInf><Ref>1234567</Ref></CdtrRefInf></Strd></RmtInf></TxDtls></NtryDtls></Ntry>
<Ntry><Amt Ccy="SEK">99.00</Amt><CdtDbtInd>DBIT</CdtDbtInd><BookgDt><Dt>2026-03-04</Dt></BookgDt>
<AcctSvcrRef>REF-2</AcctSvcrRef><NtryDtls><TxDtls><RltdPties><Cdtr><Nm>Exempelleverantör</Nm></Cdtr></RltdPties>
<RmtInf><Ustrd>Faktura 7</Ustrd></RmtInf></TxDtls></NtryDtls></Ntry>
</Stmt></BkToCstmrStmt></Document>`

const samples: Record<string, { file: string; first: object }> = {
  handelsbanken: {
    file: [
      'Kontohändelser',
      'Konto;Exempelkonto',
      '',
      'Reskontradatum;Transaktionsdatum;Text;Belopp;Saldo',
      '2026-03-02;2026-03-01;Exempelkund;1 234,50;5 000,00',
      '2026-03-03;2026-03-03;Kaffe;−45,00;4 955,00',
      '2026-03-03;2026-03-03;Kaffe;−45,00;4 910,00',
    ].join('\n'),
    first: {
      amount_ore: 123450,
      booking_date: '2026-03-02',
      value_date: '2026-03-01',
      counterparty: 'Exempelkund',
    },
  },
  seb: {
    file: [
      'Bokföringsdag;Valutadag;Verifikationsnummer;Text/mottagare;Belopp;Saldo',
      '2026-03-02;2026-03-02;V100;Exempelkund;500,00;900,00',
      '2026-03-03;2026-03-03;V101;Hyra;-300,00;600,00',
    ].join('\r\n'),
    first: { bank_id: 'V100', amount_ore: 50000, counterparty: 'Exempelkund' },
  },
  'seb-transaktioner': {
    file: [
      'Bokförd;Valutadatum;Text;Typ;Insättningar;Uttag;Bokfört saldo',
      '2026-03-02;2026-03-02;Exempelkund;Insättning;1500.25;;2000.25',
      '2026-03-03;2026-03-03;Hyra;Autogiro;;300.00;1700.25',
    ].join('\n'),
    first: { amount_ore: 150025, reference: 'Insättning' },
  },
  swedbank: {
    file: [
      '* Transaktioner Period 2026-03-01 - 2026-03-31',
      'Radnr,Clnr,Kontonr,Produkt,Valuta,Bokfdag,Transdag,Valutadag,Referens,Text,Belopp,Saldo',
      '1,8000,0000000000,Företagskonto,SEK,2026-03-02,2026-03-02,2026-03-02,Exempelkund,Insättning,2500.75,3000.75',
      '2,8000,0000000000,Företagskonto,SEK,2026-03-03,2026-03-03,2026-03-03,Hyra,Autogiro,-300.00,2700.75',
    ].join('\n'),
    first: { amount_ore: 250075, counterparty: 'Exempelkund' },
  },
  nordea: {
    file: [
      'Bokföringsdag;Belopp;Avsändare;Mottagare;Namn;Rubrik;Saldo;Valuta',
      '2026/03/02;1000,00;Exempelkund;;;Betalning;2000,00;SEK',
      '2026/03/03;-250,00;;Exempelleverantör;;Faktura;1750,00;SEK',
    ].join('\n'),
    first: {
      booking_date: '2026-03-02',
      amount_ore: 100000,
      counterparty: 'Exempelkund',
      reference: 'Betalning',
    },
  },
  'nordea-b': {
    file: [
      'Bokföringsdag;Värdedag;Betalningstyp;Betalare/Mottagare;Meddelande/Referens;Belopp;Saldo',
      '2026-03-02;2026-03-02;Bankgiro;Exempelkund;12345;750,00;1000,00',
    ].join('\n'),
    first: { value_date: '2026-03-02', reference: '12345' },
  },
  lunar: {
    file: [
      'Date,Time,Title,Amount,Balance,Transaction ID',
      '2026-03-02,10:00,Exempelkund,"1 250,50","3 000,00",L1',
      '2026-03-03,11:00,Kaffe,"-45,00","2 955,00",L2',
    ].join('\n'),
    first: { bank_id: 'L1', amount_ore: 125050 },
  },
}

const body = (p: Person | undefined, b: Uint8Array<ArrayBuffer>) => ({
  method: 'POST',
  headers: p ? { authorization: `Bearer ${p.token}` } : undefined,
  body: new Blob([b]),
})
const rq = (p: Person, init: object = {}) =>
  new Request('https://api.test/api/v1/x', {
    headers: { authorization: `Bearer ${p.token}` },
    ...init,
  })
const importFile = (
  p: Person,
  org: string,
  account: string,
  bytes: Uint8Array<ArrayBuffer>,
) =>
  bankApi.import(
    new Request('https://api.test/api/v1/x?name=utdrag', body(p, bytes)),
    org,
    account,
    db,
  )
const batch = z.object({
  added: z.number(),
  skipped: z.number(),
  format: z.string(),
})
const txs = async (p: Person, org: string, account: string) =>
  z
    .object({ items: z.array(z.record(z.string(), z.unknown())) })
    .parse(await (await bankApi.transactions(rq(p), org, account, db)).json())
    .items

async function setup() {
  const owner = await person()
  const org = (await newOrg(owner)).id
  const account = idOf(
    await bankApi.createAccount(
      rq(owner, {
        method: 'POST',
        body: JSON.stringify({ title: 'Företagskonto' }),
      }),
      org,
      db,
    ),
  )
  return { owner, org, account: (await account).id }
}

test('a camt.053 file imports with amounts in öre, dates, counterparty and reference', async () => {
  const { owner, org, account } = await setup()
  const res = await importFile(owner, org, account, enc.encode(camt))
  expect(res.status).toBe(201)
  expect(batch.parse(await res.json())).toMatchObject({
    added: 2,
    skipped: 0,
    format: 'camt.053',
  })
  const rows = await txs(owner, org, account)
  expect(rows).toContainEqual(
    expect.objectContaining({
      bank_id: 'REF-1',
      amount_ore: 125050,
      booking_date: '2026-03-02',
      value_date: '2026-03-03',
      counterparty: 'Exempelkund AB & Co',
      reference: '1234567',
      source: 'file',
    }),
  )
  expect(rows).toContainEqual(
    expect.objectContaining({
      amount_ore: -9900,
      reference: 'Faktura 7',
      value_date: null,
    }),
  )
})

test.each(Object.entries(samples))(
  '%s: the CSV imports, and a second import adds nothing',
  async (_name, s) => {
    const { owner, org, account } = await setup()
    const bytes = enc.encode(s.file)
    const first = batch.parse(
      await (await importFile(owner, org, account, bytes)).json(),
    )
    const rows = await txs(owner, org, account)
    expect(first.added).toBe(rows.length)
    expect(rows).toContainEqual(expect.objectContaining(s.first))
    const again = batch.parse(
      await (await importFile(owner, org, account, bytes)).json(),
    )
    expect(again).toMatchObject({ added: 0, skipped: first.added })
    expect(await txs(owner, org, account)).toHaveLength(rows.length)
  },
)

test('a file without bank IDs keeps two identical lines, and re-importing adds none', async () => {
  const { owner, org, account } = await setup()
  const file = enc.encode(samples['handelsbanken']?.file ?? '')
  const first = batch.parse(
    await (await importFile(owner, org, account, file)).json(),
  )
  expect(first.added).toBe(3)
  expect(
    batch.parse(await (await importFile(owner, org, account, file)).json())
      .added,
  ).toBe(0)
})

test('a file in no known format is refused in Swedish and adds nothing', async () => {
  const { owner, org, account } = await setup()
  for (const junk of ['hello,world\n1,2', '<xml>nej</xml>', '%PDF-1.7']) {
    const res = await importFile(owner, org, account, enc.encode(junk))
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'unknown_format' })
  }
  const bad = await importFile(
    owner,
    org,
    account,
    enc.encode(
      'Date,Time,Title,Amount,Balance,Transaction ID\n2026-03-02,10:00,X,abc,1,L1',
    ),
  )
  expect(bad.status).toBe(422)
  expect(await txs(owner, org, account)).toHaveLength(0)
})

test('Windows-1252, a BOM, a Unicode minus and a space thousand separator parse', async () => {
  const { owner, org, account } = await setup()
  const text =
    'Reskontradatum;Transaktionsdatum;Text;Belopp;Saldo\n2026-03-02;2026-03-02;Åkeri Öst;−1 234,50;0,00'
  const latin = Uint8Array.from(Buffer.from(text.replace('−', '-'), 'latin1'))
  await importFile(owner, org, account, latin)
  const bom = Uint8Array.from([0xef, 0xbb, 0xbf, ...enc.encode(text)])
  await importFile(owner, org, account, bom)
  const rows = await txs(owner, org, account)
  // The BOM file has the Unicode minus, the Windows-1252 one a hyphen: the same line, so the second is skipped.
  expect(rows).toEqual([
    expect.objectContaining({ counterparty: 'Åkeri Öst', amount_ore: -123450 }),
  ])
})

test('only bank.manage imports; every member lists; a stranger sees nothing', async () => {
  const { owner, org, account } = await setup()
  const member = await person()
  await addMember(owner, org, member, 'Medlem')
  const stranger = await person()
  const file = enc.encode(samples['lunar']?.file ?? '')
  expect((await importFile(member, org, account, file)).status).toBe(403)
  expect(
    (
      await bankApi.createAccount(
        rq(member, { method: 'POST', body: JSON.stringify({ title: 'X' }) }),
        org,
        db,
      )
    ).status,
  ).toBe(403)
  expect((await importFile(owner, org, account, file)).status).toBe(201)
  expect(
    (await bankApi.transactions(rq(member), org, account, db)).status,
  ).toBe(200)
  expect((await bankApi.imports(rq(member), org, account, db)).status).toBe(200)
  expect(
    (await bankApi.transactions(rq(stranger), org, account, db)).status,
  ).toBe(404)
})

test('an imported transaction cannot be changed or deleted', async () => {
  const { owner, org, account } = await setup()
  await importFile(
    owner,
    org,
    account,
    enc.encode(samples['lunar']?.file ?? ''),
  )
  await expect(
    db.updateTable('bank_transactions').set({ amount_ore: 1 }).execute(),
  ).rejects.toThrow()
  await expect(db.deleteFrom('bank_transactions').execute()).rejects.toThrow()
})
