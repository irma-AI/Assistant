#!/usr/bin/env bash
# Runs synthetic-data.sh on tiny repositories: ones that must pass, and ones that must fail.
set -euo pipefail
guard=$(cd "$(dirname "$0")" && pwd)/synthetic-data.sh
fail=0

# expect NAME SQL GENERATOR RESULT: a migration holding SQL; GENERATOR is yes (a real one), stub (an empty file) or no.
expect() {
  d=$(mktemp -d "${TMPDIR:-/tmp}/synthetic.XXXXXX") && mkdir -p "$d/migrations" "$d/src/server"
  printf '%s\n' "$2" > "$d/migrations/0002_x.sql"
  [ "$3" = yes ] && echo "export const domain = 'example.com'" > "$d/src/server/synthetic.server.ts"
  [ "$3" = stub ] && touch "$d/src/server/synthetic.server.ts"
  if "$guard" "$d" > /dev/null 2>&1; then got=pass; else got=fail; fi
  rm -rf "$d"
  if [ "$got" = "$4" ]; then echo "ok    $1"; else echo "FAIL  $1: got $got, want $4"; fail=1; fi
}

expect "no personal data" "create table status (id int, name text);" no pass
expect "personal data in a comment only" "-- later: an email column" no pass
expect "an email column without the generator" "create table person (id int, email text);" no fail
expect "a phone number without the generator" "alter table person add column phone_number text;" no fail
expect "personal data with the generator" "create table person (id int, first_name text, email text);" yes pass
expect "an empty stub is not the generator" "create table person (id int, email text);" stub fail
expect "a people table with a json column" "create table candidate (id uuid, profile jsonb);" no fail
expect "candidate_name and surname" "alter table hire add column candidate_name text, add column surname text;" no fail
expect "Swedish column names" "create table k (id int, epost text, personnr text, adress text);" no fail
expect "a whole short word" "create table k (id int, tel text);" no fail
expect "a short word inside another" "create table metric (id int, telemetry jsonb);" no pass
expect "-- inside a string is not a comment" "create table c (id int, note text default '--', email text);" no fail
exit $fail
