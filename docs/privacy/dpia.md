# Data protection impact assessment (DPIA)

GDPR Art. 35, for BankID login and the organisations' financial records, before production BankID (IRM-94). Agents draft; the owner approves in review. Not legal advice. Records of processing: [records.md](records.md). Breaches: [breach.md](breach.md).

Status: **draft of 2026-10-25, not approved.** Decided by the owner on 2026-10-24 (IRM-54). Per IMY, a DPIA is "en pågående och dokumenterad process", not a one-off, so section 8 says when to redo it. Translations from Swedish are ours and marked *(our translation)*.

Only risks to people's rights and freedoms are assessed, not business risks (IMY, source 1). The controller's legal name is still a placeholder in records.md (IRM-54).

## 1. Systematic description (Art. 35(7)(a))

Source of every row: [records.md](records.md) sections 1 and 2. What is built is marked; the rest is planned.

| Processing | Data | People | Purpose | State |
|---|---|---|---|---|
| BankID login | Personal identity number (passes through BankID and our server during the login only), name, `endUserIp`, user agent, device identifier, order reference | Users and anyone attempting a login | Identify the account holder securely | Built (`login.server.ts`, `login_attempts`, IRM-110) |
| Keyed hash of the personal identity number | HMAC-SHA256 of the number with `PII_HASH_KEY`, in `users.pnr_hmac` | Users | Find the same user at the next login without storing the number | Built (`pii.server.ts`, IRM-87) |
| Sessions | SHA-256 of the session token, user, kind, times | Users | Keep the user logged in | Built (`session.server.ts`, `sessions`) |
| Login attempts | Order reference, QR secrets, IP, times; deleted when the order ends, swept within an hour | Users and attempters | Complete the login, prevent abuse | Built (migration 0003) |
| Audit log | Internal user ID, event, time, truncated IP | Users, admins | Show who logged in or out | Built (`audit_events`, IRM-109) |
| Logs and backups | Request data and copies of the above | As above | Operate, restore | Logs built (14-day cut, IRM-115); backups planned (IRM-98) |
| Organisations' financial records | Vouchers, invoices, counterparties' names and contact details, amounts | The customer's staff, customers and suppliers | Provide the bookkeeping service | **Not built yet** |

**Roles.** We are controller for the login rows and processor for the financial records, on the customer's instructions under a data processing agreement (Art. 28, IRM-101). BankID's bank is a separate controller for its own processing. Recipients and processors: HostUp (server in Sweden), BankID's bank, the backup vendor (IRM-98, not chosen). No transfer outside the EU or EEA is planned.

**Retention.** Web sessions 12 hours, app sessions 90 days, ended sessions 30 days, audit events 12 months *(proposed)*, logs 14 days *(proposed)*, financial records at least seven years under the Bookkeeping Act, then as the customer instructs.

**Purposes and legal bases.** Contract (Art. 6(1)(b)) for accounts and login; legitimate interest (Art. 6(1)(f)) for abuse prevention and logs; the customer's own basis for the financial records. For the personal identity number, dataskyddslagen 3 kap. 10 § allows processing without consent "när det är klart motiverat med hänsyn till ändamålet med behandlingen, vikten av en säker identifiering eller något annat beaktansvärt skäl" (source 8). We rely on *the importance of secure identification*. Whether that holds for every use is open question 3.

**Is a DPIA needed?** IMY's list and WP29 treat two criteria as the usual threshold (sources 3, 4, 7). Criteria that fit: financial data as data of a highly personal nature (4), many people if the product grows (5), and arguably new organisational solutions (8). The owner decided to do one, so this is not argued further.

## 2. Necessity and proportionality (Art. 35(7)(b))

- **Is the number needed at all?** BankID returns the number; the login cannot identify a person securely without it. We use it for the login only and store a keyed hash, not the number. Alternative rejected: storing the number in the clear or encrypted, which would let a database leak reveal who people are.
- **Data minimised.** `users` holds a hash, a name and a time. `login_attempts` rows are deleted when the order ends. The audit log truncates the IP and holds no number or token. App logs leave out the number, names, tokens and full IPs (test in `login.server.test.ts`).
- **Retention follows purpose.** Short-lived rows are swept; sessions end; the seven-year period for financial records is the legal minimum, not a choice.
- **Rights.** Erasure through account deletion (IRM-92, planned). Access and portability for login data are open question 5. For financial records, the customer answers its own data subjects and we assist (IRM-101).
- **Information.** A privacy notice is not yet written (open question 4).
- **Processors.** HostUp's and the backup vendor's agreements are "not checked" in records.md section 5; this is a measure still missing (risk R7).

## 3. Method

Likelihood and severity each Low, Medium or High; risk is the higher of the two after weighing both. "Severity" is the harm to the person (identity misuse, payment fraud, loss of confidentiality of finances), not to us. Following IMY's ten steps, 1 to 5 and 8 are done here; 6, 7, 9 and 10 are sections 6 to 8.

## 4. Risks to the people concerned (Art. 35(7)(c))

| # | Risk | Who | Likelihood | Severity | Risk before measures |
|---|---|---|---|---|---|
| R1 | Database leak (SQL injection, stolen dump, backup leak) | Users; organisations' people | Medium | High with financial records; Low for login data alone | High |
| R2 | `PII_HASH_KEY` leaks, alone or with the database, so guessed numbers can be tested against `pnr_hmac` | Users | Low | High: a number plus a name links to an identity | Medium |
| R3 | One breach exposes many organisations' financial records | Everyone in the records | Low | High | High |
| R4 | Account takeover: stolen session token, or a login started by someone else and completed by the victim | Users; the organisation they work for | Medium | Medium | Medium |
| R5 | Personal data in logs, the repository, PRs or Linear issues | Users | Medium | Medium | Medium |
| R6 | One organisation sees another's data (missing access check) | Organisations' people | Low | High | Medium |
| R7 | Processor or vendor fails: HostUp, backup vendor (no checked agreement), unencrypted backup | All | Low | High | Medium |
| R8 | Data kept longer than needed, or not erasable (backups, logs) | Users | Medium | Low | Low |
| R9 | People are not told what happens to their data, and cannot use their rights | Users; third parties in the records | Medium | Medium | Medium |

## 5. Measures and residual risk (Art. 35(7)(d))

| # | Measures that exist | Measures still to do | Residual risk |
|---|---|---|---|
| R1 | Number stored only as an HMAC (IRM-87), so a leaked database reveals no number; session tokens stored as SHA-256; TLS; database reachable only by the app; encrypted backups before they leave the server (IRM-98); breach procedure ([breach.md](breach.md)) | Financial records need their own measures when built (encryption at rest, per-organisation separation); IRM-98 | **Medium** for login data (Low severity). For financial records: **cannot be set until they are built**, open question 1 |
| R2 | Key held apart from the database in a Dokploy environment secret, read inside the function that needs it (`hashPnr`); rotation plan: try the new key, then the old one at the next login | A secrets manager (OWASP prefers one over environment variables, `docs/guardrails.md` section 7); a rehearsed rotation | **Medium, accepted by the owner on 2026-10-24** (guardrails section 7). A key plus database leak lets someone test guessed numbers, which are guessable (about 10^9 plausible numbers) |
| R3 | Breach procedure with the processor duty to tell the customer (Art. 33(2)); per-organisation data separation planned; processing agreement (IRM-101) | Separation and access tests must exist before financial records go live | **Cannot be set until built**, open question 1 |
| R4 | Cookie `__Host-session`, `HttpOnly`, `Secure`, `SameSite=Strict`; the login attempt is tied to the browser by its own cookie (IRM-110); sessions expire (12 h web, 90 d app) and can be revoked; audit log with hash chain (IRM-109); BankID's own strong authentication | Alerts on abuse (IRM-91) | **Low** |
| R5 | Log output excludes the number, names, tokens and full IPs, checked by a test (IRM-100); Traefik's access log off; logs cut to 14 days (IRM-115); Linear and the repository must hold no personal data (CLAUDE.md, public repository) | Nothing checks the schedule's copy of the script against `scripts/log-retention.sh` | **Low** |
| R6 | Every UI reaches the server through `/api/v1/**`; server-only code is isolated (`guard:layers`); real-database tests at the API seam | Per-organisation access checks and a cross-organisation test when organisations exist | **Cannot be set until built** |
| R7 | HostUp in Sweden; self-hosted Dokploy; exit plans in records.md section 5 | Read and record HostUp's and the backup vendor's terms and certificates; sign the vendor DPA before go-live | **Medium until the agreements are checked** |
| R8 | Sweeps and retention in section 1; sessions cascade with the user; deleted accounts leave backups when they expire | Account deletion (IRM-92); owner approval of the proposed periods | **Low** |
| R9 | This file and records.md | Privacy notice; a route for access and erasure requests | **Medium until the notice exists** |

## 6. Prior consultation with IMY (Art. 36)

Art. 36(1) requires consultation when the DPIA shows high risk "om inte den personuppgiftsansvarige vidtar åtgärder för att minska risken" *(our translation: unless the controller takes measures to reduce the risk)*. IMY: request it if the risk remains high despite the planned measures (sources 1, 5, 6). WP29 gives as unacceptable residual risk consequences that cannot be overcome, or a risk that will obviously occur, for example a well-known vulnerability left unpatched (source 7).

**Draft conclusion, for the owner to confirm.**

- Login only (what is built): the residual risk is Medium, and consultation is **not needed**.
- With financial records: R1, R3 and R6 cannot be rated until the records and their separation exist. This DPIA must be redone, and the consultation question decided again, **before any real organisation's financial records are stored**. If the residual risk then stays High, IMY must be consulted before the processing starts; it answers in eight weeks, extendable by six (Art. 36(2)), so plan for that.

## 7. Views of the people concerned (Art. 35(9))

None collected. IMY says to ask "när det är lämpligt" (source 1). Open question 6.

## 8. Review

Redo this DPIA when: financial records are built; the backup vendor is chosen; the key storage changes; a new vendor or data item is added; a breach happens; production BankID goes live (IRM-94). The data protection officer need not be consulted unless one is appointed (open question 7).

## Sources

All read on **2026-10-24** by the owner's interactive session and recorded in a comment on IRM-113 with verbatim quotes; this draft quotes from that comment and did not fetch the pages itself (our network policy blocked them on 2026-10-24). Pages were last updated by IMY on the dates shown.

1. IMY, Konsekvensbedömning enligt GDPR, https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/konsekvensbedomning/ (updated 2026-06-15). [SV]
2. IMY, Hur ska en konsekvensbedömning genomföras?, https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/konsekvensbedomning/hur-ska-en-konsekvensbedomning-genomforas/ (updated 2026-06-15). [SV]
3. IMY, När ska en konsekvensbedömning genomföras?, https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/konsekvensbedomning/nar-ska-en-konsekvensbedomning-genomforas/ (updated 2026-06-15). [SV]
4. Datainspektionen, Förteckning enligt artikel 35.4, dnr DI-2018-13200, 2019-01-16, https://www.imy.se/globalassets/dokument/ovrigt/forteckning---konsekvensbedomningar.pdf. [SV]
5. IMY, Förhandssamråd, https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/forhandssamrad/ (updated 2025-12-16). [SV]
6. Regulation (EU) 2016/679, Swedish text, Art. 35, 36 and 87, https://eur-lex.europa.eu/legal-content/SV/TXT/HTML/?uri=CELEX:32016R0679. [SV]
7. WP29, Guidelines on DPIA, WP 248 rev.01, last revised 2017-10-04, endorsed by the EDPB, https://ec.europa.eu/newsroom/just/document.cfm?doc_id=47711. [EN]
8. Lag (2018:218) med kompletterande bestämmelser till EU:s dataskyddsförordning, 3 kap. 10–11 §, https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2018218-med-kompletterande-bestammelser-till_sfs-2018-218/. [SV]

Not read: IMY's practical guide, template and risk spreadsheet, and WP248 Annex 2.

## Open questions for the owner or a lawyer

1. **Financial records.** They are not built. Is it right to approve this DPIA for the login now and redo it for the records, or should it wait until the records' design exists?
2. **Prior consultation.** Does the owner agree with the draft conclusion in section 6, and who decides if the later residual risk is High?
3. **Dataskyddslagen 3 kap. 10 §.** Does "vikten av en säker identifiering" cover keeping the hash for the lifetime of the account, and all uses of the number in bookkeeping (for example a person's number on an invoice)? A lawyer should confirm.
4. **Privacy notice.** Who writes it, and where does it live?
5. **Data subject requests.** Access and portability for login data: the route, and who answers.
6. **Views of the people concerned** (Art. 35(9)): are they asked, and how?
7. **Data protection officer.** Is one needed or appointed?
8. **Risk ratings.** The likelihood and severity above are the agent's judgement. The owner adjusts them.
9. **Retention periods** marked *proposed* in records.md: approve or change.
10. **Accepting R2** (key in an environment variable) was decided on 2026-10-24: does it still hold once real organisations' data is in the database?
