# Demo account for store reviewers

Store reviewers have no BankID, so the app has a demo login (IRM-91). It runs against production (`redo.petterannerwall.se`) and stays on for as long as the app is listed, because Google Play requires sign-in details "accessible at all times".

## Configuration (Dokploy environment)

- `DEMO_PASSWORD_HASH`: `argon2id$m=19456,t=2,p=1$<salt b64>$<key b64>`. Without it the route returns 404. Make one with a long random password: `node --input-type=module -e "import {demoPasswordHash} from './src/server/demo.server.ts'; console.log(await demoPasswordHash(process.argv[1]))" '<password>'`. Rotate it only between store submissions.
- `DEMO_LOGIN_ENABLED=false`: emergency off switch; the route returns 404.

## How it works

- `POST /api/v1/auth/demo` with `{username: "demo", password}` makes a session of kind `demo` for the fixed demo user, who is the only member and Ägare of the fixed demo organisation. Both are created from `src/server/demo-snapshot.json` when missing and never rebuilt otherwise, so reviewers' changes persist.
- Failed logins are audited and throttled to 10 per 15 minutes per network (IPv4 /24); the account is never locked. The log alert is `{"event":"demo_login_failed"}`, with no username, password or address.
- A demo session can't create organisations or invites, and the demo user can't be added to another organisation. Every action with an external effect (filing, payment, email, invites, BankID signing) must call `refuseDemo(session.kind)` first.
- "Radera mitt konto" has a password form for the demo account. It deletes the demo user and organisation together; the next demo login recreates both.

## Re-seed by hand

Delete the demo organisation and user, and the next demo login recreates them from the snapshot:

```sql
delete from organisations where id = '00000000-0000-4000-8000-000000000092';
delete from users where id = '00000000-0000-4000-8000-000000000091';
```

To change the dataset, edit `seeds/demo.ts`, run `node seeds/demo.ts` to rewrite the snapshot (a Vitest test fails when they differ), and re-seed.

## Review notes (paste into App Store Connect and Play Console)

> This app signs in with Swedish BankID, which reviewers cannot use. To review, open the login screen and tap "Demokonto". Username: `demo`. Password: `<the current password>`.
>
> The demo account is a ready-made organisation filled with made-up data. Changes you make stay for the next reviewer. Nothing leaves the system: filing with the tax authority, payments, email and invites are switched off for the demo account, and it cannot create or join other organisations. To test account deletion, open "Radera mitt konto" and use "Demokonto: radera med lösenord"; the account is recreated at the next demo login.
