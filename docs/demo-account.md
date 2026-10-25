# Demo account for store reviewers

Reviewers can't use BankID, so `POST /api/v1/auth/demo` (the "Demokonto" link on the login screen) logs in as the fixed user `demo`. The demo user and organisation have fixed IDs in `src/server/demo.server.ts` and are built from `src/server/demo-snapshot.json` on a demo login when they are missing. Nothing is rebuilt otherwise, so a reviewer's changes stay.

## Settings

- `DEMO_PASSWORD_HASH` (Dokploy secret): make it with `DEMO_PASSWORD=<long random password> node seeds/demo-hash.ts`. Rotate only between store submissions. Without it the route answers 404.
- `DEMO_LOGIN_ENABLED=false`: emergency off switch, route answers 404. Leave it on while the app is listed.

## Re-seeding by hand

Delete the demo organisation, then the users, and the next demo login recreates both:

```sql
delete from organisations where id = '00000000-0000-4000-8000-0000000000d2';
delete from users where id = '00000000-0000-4000-8000-0000000000d1' or id::text like 'ffffffff-0000-4000-8000-%';
```

After changing the factory in `seeds/`, run `node seeds/demo-snapshot.ts` and commit the JSON; a test fails if they differ.

## Review notes (App Store Connect and Play Console)

> The app signs in with Swedish BankID, which needs a Swedish personal identity number. For review, tap "Demokonto" on the login screen and sign in with username `demo` and the password given in the credentials field. The demo account opens a pre-filled organisation, "Demobolaget AB", with made-up people and data only. It is isolated from every real organisation, and nothing leaves the system: no filings, payments, emails or invitations are sent. The account can be deleted from within the demo (the password confirms it) and is recreated automatically for the next login. The login is available at all times.

## Known gaps

Demo sessions are refused by `refuseDemo(kind)` (`src/server/access.server.ts`); every future feature with an outside effect (filing, payments, email, invites, BankID signing) must call it. Demo deletion is `POST /api/v1/auth/demo/delete`, reached from the "Demokonto" section of `/app/radera-konto`. `addMember` refuses the demo user as inviter or invitee; when IRM-125 adds the invite route it must still call `refuseDemo(kind)` for the session.
