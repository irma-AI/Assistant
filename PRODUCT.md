# Product

<!-- impeccable:product-schema 1 -->

Redo is Swedish bookkeeping, app-first: iOS, Android and the web. Login is Swedish BankID only, and the UI is Swedish only.

## Platform

web

One design for every platform, made for the phone first and scaled up to fit the web. The iOS and Android apps run the same web code in a WebView (Capacitor).

## Users

The owner of a small Swedish aktiebolag who does their own books, without an accountant, mostly from their phone.

## Product Purpose

Let a small-company owner keep their company's books correct and up to date without becoming a bookkeeper or hiring one.

## Positioning

- App-first: built for the phone from the start, not a desktop accounting tool squeezed onto a small screen.
- The assistant does the work: it drafts the bookkeeping and the owner reviews and approves it. Nothing is booked or sent without the owner.

## Operating Context

- Sign-in with BankID on the same phone or by QR code from another device.
- One person can belong to several organisations, with members and roles in each.
- Agents reach the books through a read-only MCP endpoint behind the web session; they act only with the person's permissions.
- App Store and Play reviewers use the "Demokonto" login (`docs/demo-account.md`), which cannot cause any outside effect.

## Capabilities and Constraints

- Confirmed: BankID login, organisations, members and roles, data export, account deletion, demo account, read-only MCP endpoint, scheduled background jobs.
- Personal data is handled under GDPR; see `docs/privacy/` and the public pages `/integritetspolicy`, `/villkor` and `/personuppgiftsbitradesavtal`.
- Open: pricing, support for enskild firma, and access for accountants or accounting firms.
- Open: the repository and landing page are still called "Assistant"; the product name is Redo.

## Brand Commitments

- Redo must be visibly distinct from the Swedish bookkeeping brands, which own these colours on their own sites (sampled 2026-10-25): Fortnox green `#007533`/`#00DB33`, Dooer green `#22C55E`, Bokio blue `#1259EF`, Spiris purple `#441774`, Visma crimson `#E60641`, Björn Lundén orange `#F39C12`. Green, saturated blue, purple, crimson and bright orange are off limits as the brand colour.
- Serious and trustworthy, modern and minimal, Swedish without flags or clichés.
- The look takes the colours and type of the owner's Voice app (voice.petterannerwall.se): deep navy, white, one warm sand accent, Newsreader over Schibsted Grotesk. Its navy and white were chosen over the earlier "never black and white"; pure black stays out. Details in DESIGN.md, Look.
- Deadlines are shown as dates (Datumblock), not as progress bars or timelines; Redo has no sense of time passing the way a live call does.

## Evidence on Hand

- Demo organisation "Demobolaget AB" with made-up people and data (`seeds/`, `src/server/demo-snapshot.json`).
- No customers, testimonials, reviews, benchmarks or published prices exist. Do not invent them.

## Product Principles

1. The phone is the main place the work happens; wider screens get more room, never more functions.
2. The assistant drafts and the owner decides: every suggestion shows its evidence and needs one action to accept, correct or reject.
3. Money and the books demand trust: be exact, honest about cost and risk, and show what will be recorded before it is.
4. Plain Swedish for someone who is not an accountant; explain each term the first time it appears.

## Accessibility & Inclusion

WCAG 2.2 AA, plain Swedish at CEFR B2 or simpler, and system text size up to 200 % on iOS and Android. Details are in `DESIGN.md`.
