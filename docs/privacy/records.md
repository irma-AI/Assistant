# Records of processing

GDPR Art. 30 records, Art. 6 legal bases, a DPIA recommendation (Art. 35), a cookie inventory and a supplier register. Agents draft; the owner approves in review. Not legal advice.

Status: draft of 2026-10-24. **Controller: [PLACEHOLDER: legal name, organisation number, contact, filled in by the owner under IRM-54].** Rows marked *planned* describe what an open issue will build; update the row when it ships. Retention periods marked *proposed* wait for the owner's approval.

Breaches are handled under [breach.md](breach.md).

Two roles:

- **Controller** (section 1): accounts, login, sessions, security logs and backups of those.
- **Processor** (section 2): each customer organisation's bookkeeping data. The organisation is the controller and we process on its instructions under a data processing agreement (Art. 28, IRM-101).

## 1. We are the controller

| Processing | Purpose | Legal basis | Data | People | Recipients and processors | Retention | Security |
|---|---|---|---|---|---|---|---|
| Users (`users`, IRM-87) | Identify the account holder | Contract (Art. 6(1)(b)) | Name, keyed HMAC of the personal identity number (never the number), created time | Users | HostUp (server, Sweden) | Until the account is deleted (IRM-92) | HMAC key held apart from the database; TLS; access limited to the app |
| Sessions (`sessions`, IRM-87) | Keep a user logged in | Contract | Hash of the session token, user, kind (web, app, demo), created, expiry, last used, revoked | Users | HostUp | Web and app alike: 24 hours after login whatever the activity, and 1 hour without a request (NIST SP 800-63B AAL2, IRM-130); `last_used_at` moves at most once a minute; ended sessions deleted after 30 days (`deleteEndedSessions`) | Token stored only as SHA-256; cookie `HttpOnly`, `Secure`, `SameSite=Strict` |
| BankID login attempts (IRM-110) | Authenticate the user; prevent fraud | Contract for the login; legitimate interest (Art. 6(1)(f)) for abuse prevention | `endUserIp`, user agent and `deviceIdentifier` sent to BankID; order reference; outcome; time | Users and anyone attempting a login | BankID's bank, as a separate controller for its own processing; HostUp | Deleted when the order completes, fails or is cancelled, and swept within an hour at the latest | TLS to BankID; no personal identity number stored in clear |
| Traefik and container logs | Operate the service, find faults and attacks | Legitimate interest | Request path, IP address, user agent, status, timing; any personal data the app prints | Visitors and users | HostUp, Dokploy (self-hosted) | 14 days (*proposed*, awaiting the owner's approval). Traefik's access log is off, so Traefik writes no per-request IP log. Container logs (Docker `json-file`, no size or age limit of its own) for the Assistant's app and database and for Traefik are cut to the last 14 days daily at 03:17 UTC by the Dokploy schedule "Assistant: 14-day log retention", whose script is `scripts/log-retention.sh` (IRM-115). The app's own log output (`console.*`) leaves out the personal identity number, names, session and login tokens and full IP addresses; a test in `login.server.test.ts` checks this through a fake BankID login (IRM-100) | Server access limited to the owner's deploy user |
| Demo accounts (IRM-91) | Let store reviewers try the app | Legitimate interest | Made-up name, no identity number; sessions of kind `demo` | Reviewers | HostUp | Sessions as above; a persistent synthetic demo organisation, recreated from a snapshot when missing | No real person's data in a demo account |
| Account deletion (IRM-92) | Honour erasure (Art. 17) | Legal obligation (Art. 6(1)(c)) | The user and its sessions are removed; the audit log keeps an `account_deleted` event with the internal user ID, time and truncated IP | Users | HostUp | The audit event follows the audit log's retention | The person confirms with a fresh BankID login; the user and its sessions are removed in one transaction |
| Backups (*planned*, IRM-98) | Restore after loss | Legitimate interest | Copies of the tables above | As above | Backup vendor (IRM-98, to be chosen), HostUp | *Proposed:* 30 days. A deleted account leaves backups when they expire | Encrypted before leaving the server; EU storage |
| Invites (`invites`, IRM-125) | Let an admin add a person to an organisation without email | Legitimate interest (Art. 6(1)(f)) | SHA-256 of the link's token, organisation, role, creating user's internal ID, expiry, time used or revoked; no name or identity number of the invitee | Admins and invitees | HostUp | Valid 7 days, single use, revocable; rows stay until the organisation is deleted. Created, accepted and revoked events follow the audit log's retention | Token from a CSPRNG (256 bits), stored only as a hash; the invite page sends `no-referrer`; before login only the organisation's name is shown, with one answer for every bad link |
| Audit log (`audit_events`, IRM-109) | Show who logged in or out, and later exported or administered | Legitimate interest; legal obligation where a rule requires it | Internal user ID, session kind, event, time, IP truncated to /24 (IPv6 /48), no identity number or token | Users, admins | HostUp | 12 months *proposed*; `deleteExpiredAuditEvents` runs daily | Append-only by trigger, rows hash-chained to show tampering |

Transfers outside the EU or EEA: none planned. A vendor that would cause one gets a row here first.

## 2. We are the processor

| Processing | Purpose | Legal basis (the customer's) | Data | People | Sub-processors | Retention | Security |
|---|---|---|---|---|---|---|---|
| Bookkeeping data of a customer organisation (*not built yet*) | Provide the bookkeeping service | The customer decides: contract with its own customers and suppliers, and legal obligation for records the Bookkeeping Act (bokföringslagen) keeps seven years | Vouchers, invoices, counterparties' names and contact details, amounts | The customer's staff, customers, suppliers | HostUp; backup vendor (IRM-98) | The customer's instruction; at least seven years for records under the Bookkeeping Act, then deleted or returned on request | As section 1; data kept apart per organisation |

Account holders in section 1 may also appear in section 2 as the customer's staff. Section 1 rows cover their login; section 2 covers the work they do.

### Account deletion and organisations' records

"Radera mitt konto" in `/app` (and the public web address `/app/radera-konto`, which Google Play's Data safety form asks for as the account-deletion link) deletes at once the keyed hash of the personal identity number, the name, every session and every login, after a fresh BankID confirmation. This is the rule for records an organisation keeps, which features that create them must follow:

- Entries, corrections and completions reference `users.id`.
- Deleting the account keeps that row's ID and name while bookkeeping records reference it, and deletes everything else at once. The deletion code must be changed to do so when the first such record exists; today none does, so the whole row goes.
- The kept name is used only to show who made an entry, never for search, contact or analytics.
- It is purged at the end of the seventh calendar year after the last financial year whose records reference it.
- Only the organisation (an admin, or by instruction under the DPA) or the expiry purge may erase it earlier. An Art. 17 request about bookkeeping data goes to the organisation, which is its controller.

Why the name stays: BFL 5 kap. 5 § requires a correction to state "när rättelsen har skett och vem som har gjort den", and BFNAR 2013:2 p. 5.7 says the same for completions. BFL 7 kap. 2 § keeps records to the end of the seventh year after the calendar year in which the financial year closed (SFL 39 kap. 3 § with SFF 9 kap. 1 § also gives seven years). GDPR Art. 17(3)(b) exempts data kept for compliance with a legal obligation, and IMY accepts refusing erasure "för att uppfylla en rättslig förpliktelse", while the organisation may not use the data "för annat än bokföring". Not legal advice; whether a display name alone is enough for "vem" is for a lawyer (IRM-54).

## 3. Cookies and local storage

All are strictly necessary for a service the user asked for (Swedish Electronic Communications Act, LEK 9 kap. 28 §), so there is no consent banner.

| Name | Purpose | Lifetime | Status |
|---|---|---|---|
| `__Host-session` cookie (web only) | Holds the session token | 24 hours, ends after 1 hour without a request | Built (`src/server/session.server.ts`) |
| Bearer token (apps; no cookie) | Holds the session token, sent in the `Authorization` header | 24 hours, ends after 1 hour without a request | Built (`src/server/session.server.ts`) |
| Login-attempt cookie | Ties a BankID order to the browser that started it | Until the login ends | Live with IRM-110 |
| BankID device identifier | Sent to BankID to recognise the device | 365 days, in its own `__Host-device` cookie | Live with IRM-110 |

## 4. DPIA recommendation (Art. 35)

**Recommendation: do a DPIA before IRM-94 (production BankID).** The owner decides, and records the decision below.

Reasoning:

- The Swedish national identity number is a number with special protection (Swedish Data Protection Act, dataskyddslagen 3 kap. 10 §), and IMY's list of processing that needs a DPIA points to large-scale processing of such identifiers and to financial data.
- The product holds many organisations' financial records, so one breach exposes many people.
- A DPIA is cheap now: the stored data is small (a keyed hash, not the number).
- Reasons to skip: today only the HMAC is stored and the user count is small. If so, record why here.

Decision: **DPIA: yes, decided by the owner 2026-10-24.** See [dpia.md](dpia.md).

## 5. Supplier register

ISO 27001 A.5.19 to A.5.23, SOC 2 CC9.2. "Not checked" means no one has read the vendor's terms or reports for this register yet.

| Vendor | Data it sees | Location | Certificates | DPA | Exit plan |
|---|---|---|---|---|---|
| HostUp | Everything on the server: database, logs, backups on the same disk | Sweden | Not checked | Not checked | Move the container image and a database dump to another host |
| GitHub | Source code, PR text, CI logs; no production data | USA (EU data processing terms apply, not checked) | Not checked | Not checked | Repository is plain git; clone elsewhere |
| Anthropic | Source code, issue text and anything an agent reads in a session | USA | Not checked | Not checked | Agent work stays in git and Linear |
| Linear | Issue text; must not hold personal data of users | Not checked | Not checked | Not checked | Plans are copied into `docs/plans/` |
| Dokploy | Runs on our server; sees app environment variables including secrets | Our server in Sweden | Not applicable (self-hosted) | Not applicable | Replace with plain Docker |
| BankID's bank | Personal identity number, name, `endUserIp`, user agent, device identifier of the person logging in | Sweden | Not checked | Own terms; separate controller | Needed for login; no alternative chosen |
| Backup vendor (IRM-98) | Encrypted database dumps | To be chosen, EU only | To be chosen | To be signed before go-live | Restore dumps elsewhere |
