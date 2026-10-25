# Access and portability requests

GDPR Art. 15 (access), Art. 20 (portability), Art. 12(3). Agents draft; the owner approves in review. Not legal advice. Records: [records.md](records.md).

## In the app

"Ladda ner mina uppgifter" in `/app` downloads `GET /api/v1/me/export`: the account, the user's sessions (never the token), the user's audit events, an explanation of the stored identity-number hash (never its value), the Art. 15(1)(a)-(h) information and a description of each field. A logged-in session is enough to prove identity (EDPB Guidelines 01/2022: the same credentials the person uses to log in). Each export writes a `data_exported` audit event. The copy holds only the user's own rows, so it reveals no other person's data (Art. 15(4)).

## By request

The button does not replace a manual path. A request to the contact address in records.md (still a placeholder, IRM-54) is answered within one month (Art. 12(3)), after the sender is identified, for example by logging in.

## Bookkeeping data

The organisation is the controller, so a person asking for bookkeeping data is pointed to it. Under Art. 28(3)(e) we help the organisation answer: on its request the owner exports the records it asks for, by organisation, from the database and gives them to the organisation, never directly to the requester.
