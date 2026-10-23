#!/usr/bin/env bash
# The synthetic-data generator (guardrails 2.8) exists before any migration stores people, so tests, seeds
# and screenshots never need real personal data. Usage: synthetic-data.sh [ROOT]
# It errs toward tripping: a false hit only means building the generator sooner.
set -euo pipefail
cd "${1:-.}"
gen=src/server/synthetic.server.ts
# Column words that may carry a suffix (user_email, phone_number, home_address), English and Swedish.
prefix='e-?mail|epost|phone|telefon|mobil|msisdn|surname|f(o|ö)rnamn|efternamn|personn(umme)?r|personal_?(id|number)|ssn|national_?id|street|gatu|address|adress|postal|postnummer|zip|birth|f(o|ö)dd|linkedin|resume|(first|last|full|given|family|middle|display|candidate|contact|user)_?name'
# Short words that only count whole (tel, not telemetry), and tables that hold people.
whole='tel|cell|cv|dob|create table( if not exists)? "?([a-z_]+\.)?(candidates?|persons?|people|users?|applicants?|contacts?|employees?|members?|customers?|profiles?|kandidat(er)?|personer|anvandare|kontakter)'
hits=$(for f in migrations/*.sql; do
  [ -e "$f" ] || continue
  # SQL comments store nothing; a -- inside a string literal (after a quote) is kept.
  sed -E 's/(^|[[:space:]])--.*//' "$f" | grep -noiE "(^|[^a-z0-9])($prefix)|(^|[^a-z0-9])($whole)([^a-z0-9]|$)" | sed "s|^|$f:|" || true
done)
scanned=$(ls migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')
if [ -n "$hits" ] && ! grep -q 'example\.com' "$gen" 2>/dev/null; then
  echo "::error::synthetic-data: migrations store personal data, but $gen doesn't exist or makes no example.com addresses:"
  echo "$hits"
  echo "Fix: build the synthetic-data generator first (guardrails 2.8): example domains, reserved phone numbers, deterministic people for tests, seeds and screenshots."
  exit 1
fi
echo "synthetic-data: scanned $scanned"
