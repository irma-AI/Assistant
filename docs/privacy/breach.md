# Personal data breach procedure

GDPR Art. 33 (notify IMY within 72 hours), Art. 34 (tell the people affected), Art. 33(5) (log every breach) and, as processor, Art. 33(2) (tell the customer organisation without undue delay). Agents draft; the owner approves in review. Not legal advice. Records of what we process: [records.md](records.md).

## What counts as a breach

A breach is a security incident that destroys, loses, changes, discloses or gives access to personal data by accident or on purpose. Examples:

- a leaked key or secret: the HMAC key for identity numbers, a database password, a backup encryption key, a BankID certificate;
- a leaked or unencrypted backup or database dump;
- unauthorised access: a stolen session, a missing access check that shows one user or organisation another's data;
- data sent to the wrong person, or personal data printed into logs or a public place (the repository, a PR, a Linear issue);
- data lost with no working backup.

When in doubt, treat it as a breach and log it. Deciding it was not one is part of step 3.

## Detection

- The `deploy-failure` and audit issues (the audit log is IRM-109).
- Alerts from the rate limit of IRM-91.
- A report from the owner, a user, a customer organisation or a vendor (HostUp, BankID's bank, a backup vendor).
- An agent that notices one while working.

## Steps

The clock starts when the owner becomes aware of the breach (a processor's customer: when we become aware). An agent that finds one opens the Linear issue at once, which counts as telling the owner.

| # | Step | Who |
|---|---|---|
| 1 | Open the log entry (below) with what is known and the time of discovery | Whoever finds it; an agent opens a private Linear issue for the owner |
| 2 | Contain: rotate the key, revoke sessions, close the hole, take the data down | Owner; an agent may prepare the fix as a PR but changes no production secret |
| 3 | Assess the risk to people: what data, how many people, whether it was readable, how bad the harm could be. Decide *unlikely to result in a risk*, *risk* or *high risk*, and write the reasoning in the entry | Owner; an agent may draft |
| 4 | Risk, not "unlikely": notify IMY through its e-service within 72 hours of awareness. Later than that, say why. Facts still missing may follow in stages | Owner only |
| 5 | High risk: tell the affected people without undue delay, in plain language: what happened, likely consequences, what we did, what they can do, a contact. Not needed if the data was encrypted so it is unreadable, or later measures remove the high risk | Owner only |
| 6 | Customer organisation's data (we are the processor): tell that organisation without undue delay, with the facts above. It decides on IMY and its own people | Owner only |
| 7 | Record the outcome, then the fix that stops a repeat, as an issue | Owner; an agent may draft |

**Agents never notify IMY, users or customers themselves.** They open the Linear issue and stop.

## Breach log

One private Linear issue per breach in team IRM, labelled `breach`. The log lives outside the public repository on purpose (owner decision 2026-10-24), so no breach detail goes in git, a PR or a public issue. A PR that fixes one refers to it only as "a breach issue", never by content.

Each entry holds (Art. 33(5) and 33(3)):

- when it happened, when it was discovered, who found it;
- what happened and the categories and approximate number of people and records;
- the likely consequences;
- the risk decision from step 3 and its reasoning;
- measures taken and planned;
- IMY: notified or not, when, reference number, or why not;
- affected people: informed or not, when, how, or why not;
- customer organisations told, when;
- the follow-up issue and when the entry was closed.

Keep the entries; do not delete them.
