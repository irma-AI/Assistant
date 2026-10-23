#!/usr/bin/env bash
# The synthetic-data generator (guardrails 2.8) exists before any migration stores people, so tests, seeds
# and screenshots never need real personal data. Usage: synthetic-data.sh [ROOT]
# It errs toward tripping: a false hit only means building the generator sooner.
set -euo pipefail
# Bytes, not characters: a file that isn't UTF-8 must still be read, never skipped as binary.
export LC_ALL=C
cd "${1:-.}"
gen=src/server/synthetic.server.ts
# Column words that may carry a suffix (user_email, phone_number, home_address), English and Swedish.
prefix='e-?mail|epost|phone|telefon|mobil|msisdn|surname|f(o|ö)rnamn|efternamn|personn(umme)?r|personal_?(id|number)|ssn|national_?id|street|gatu|address|adress|postal|postnummer|zip|birth|f(o|ö)dd|linkedin|resume|(first|last|full|given|family|middle|display|candidate|contact|user)_?name|vorname|nachname|voornaam|achternaam'
# Short words that only count whole (tel, not telemetry), and tables that hold people.
whole='name|namn|mail|tel|cell|cv|dob|create ((global |local )?(temp|temporary) |unlogged )?table (if not exists )?([a-z_]+\.)?(candidates?|persons?|people|users?|applicants?|respondents?|talents?|leads?|contacts?|employees?|members?|customers?|profiles?|kandidat(er)?|personer|anvandare|kontakter)'
hits="" scanned=0
for f in migrations/*.sql; do
  [ -e "$f" ] || continue
  scanned=$((scanned + 1))
  # One line per file, in lower case, without string literals, comments, quotes or repeated whitespace,
  # so a statement split across lines or a quoted schema reads like any other. Literals and comments go in
  # one pass, so whichever starts first wins: an apostrophe in a comment or -- in a block comment hides nothing.
  flat=$(perl -0777 -pe 's/\$(\w*)\$.*?\$\1\$|[eE]?\x27(?:[^\x27\\]|\x27\x27|\\.)*\x27|--[^\n]*|\/\*.*?\*\// /gs; s/"//g; s/\s+/ /g; $_ = lc' "$f")
  m=$(grep -aoiE "(^|[^a-z0-9])($prefix)|(^|[^a-z0-9])($whole)([^a-z0-9]|$)" <<<"$flat" | sed "s|^|$f: |" || true)
  hits+="$m"
done
if [ -n "$hits" ] && ! grep -q 'example\.com' "$gen" 2>/dev/null; then
  echo "::error::synthetic-data: migrations store personal data, but $gen doesn't exist or makes no example.com addresses:"
  echo "$hits"
  echo "Fix: build the synthetic-data generator first (guardrails 2.8): example domains, reserved phone numbers, deterministic people for tests, seeds and screenshots."
  exit 1
fi
echo "synthetic-data: scanned $scanned"
