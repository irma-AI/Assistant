#!/usr/bin/env bash
# Seed data comes from @faker-js/faker through kysely-ctl seed files in seeds/ (guardrails 2.8), and that setup
# exists before any migration stores people, so tests, seeds and screenshots never need real personal data.
# Usage: synthetic-data.sh [ROOT]. It errs toward tripping: a false hit only means setting up the seeds sooner.
set -euo pipefail
# Bytes, not characters: a file that isn't UTF-8 must still be read, never skipped as binary.
export LC_ALL=C
cd "${1:-.}"
# Column words that may carry a suffix (user_email, phone_number, home_address): English, Swedish, German, Dutch.
prefix='e-?mail|epost|phone|telefon|mobil|msisdn|surname|f(o|ö|Ö)rnamn|efternamn|personn(umme)?r|personal_?(id|number)|ssn|national_?id|street|gatu|address|adress|postal|postnummer|zip|birth|f(o|ö|Ö)dd|linkedin|resume|vorname|nachname|voornaam|achternaam|(first|last|full|given|family|middle|display|candidate|contact|user)_?name'
# Short words that only count whole (tel, not telemetry), and tables that hold people.
whole='name|namn|mail|tel|cell|cv|dob|create ((global |local )?(temp|temporary) |unlogged )?table (if not exists )?([a-z_]+\.)?(candidates?|persons?|people|users?|applicants?|respondents?|talents?|leads?|contacts?|employees?|members?|customers?|profiles?|kandidat(er)?|personer|anvandare|kontakter)'
hits="" scanned=0
for f in migrations/*.sql; do
  [ -e "$f" ] || continue
  scanned=$((scanned + 1))
  # One line per file, in lower case, without string literals, comments, quotes or repeated whitespace, so a
  # statement split across lines or a quoted schema reads like any other. Literals and comments go in one pass,
  # so whichever starts first wins; backslash escapes count only in E'' strings. Dollar quotes ($$, $tag$) are
  # dropped but their bodies kept, because DDL inside DO $$ ... $$ is still DDL.
  flat=$(perl -0777 -pe 's/\$\w*\$/ /g; s/[eE]\x27(?:[^\x27\\]|\x27\x27|\\.)*\x27|\x27(?:[^\x27]|\x27\x27)*\x27|--[^\n]*|\/\*.*?\*\// /gs; s/"//g; s/\s+/ /g; $_ = lc' "$f")
  m=$(grep -aoiE "(^|[^a-z0-9])($prefix)|(^|[^a-z0-9])($whole)([^a-z0-9]|$)" <<<"$flat" | sed "s|^|$f: |" || true)
  [ -n "$m" ] && hits+="$m"$'\n'
done
seeded=$(grep -lE "from ['\"]@faker-js/faker['\"]" seeds/*.ts 2>/dev/null | xargs grep -l 'exampleEmail' 2>/dev/null || true)
if [ -n "$hits" ] && [ -z "$seeded" ]; then
  echo "::error::synthetic-data: migrations store personal data, but no seed file in seeds/ imports @faker-js/faker and uses exampleEmail:"
  printf '%s' "$hits"
  echo "Fix: set up the seed data first (guardrails 2.8): a kysely-ctl seed file in seeds/ that makes people with @faker-js/faker, emails with faker.internet.exampleEmail() and phone numbers from a reserved fiction range."
  exit 1
fi
echo "synthetic-data: scanned $scanned"
