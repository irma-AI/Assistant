#!/usr/bin/env bash
# Runs synthetic-data.sh on tiny repositories: ones that must pass, and ones that must fail.
set -euo pipefail
guard=$(cd "$(dirname "$0")" && pwd)/synthetic-data.sh
fail=0

# expect NAME SQL SEEDS RESULT: a migration holding SQL; SEEDS is yes (a faker seed file), stub (an empty one),
# nofaker (one without faker) or no.
expect() {
  d=$(mktemp -d "${TMPDIR:-/tmp}/synthetic.XXXXXX") && mkdir -p "$d/migrations" "$d/src/server"
  printf '%s\n' "$2" > "$d/migrations/0002_x.sql"
  mkdir -p "$d/seeds"
  [ "$3" = yes ] && printf "import { faker } from '@faker-js/faker'\nexport const email = faker.internet.exampleEmail()\n" > "$d/seeds/0001_people.ts"
  [ "$3" = stub ] && touch "$d/seeds/0001_people.ts"
  [ "$3" = locale ] && printf "import { faker } from '@faker-js/faker/locale/sv'\nexport const email = faker.internet.exampleEmail()\n" > "$d/seeds/0001_people.mts"
  [ "$3" = nofaker ] && printf "export const email = 'a@example.com'\n" > "$d/seeds/0001_people.ts"
  if "$guard" "$d" > /dev/null 2>&1; then got=pass; else got=fail; fi
  rm -rf "$d"
  if [ "$got" = "$4" ]; then echo "ok    $1"; else echo "FAIL  $1: got $got, want $4"; fail=1; fi
}

expect "no personal data" "create table status (id int, label text);" no pass
expect "personal data in a comment only" "-- later: an email column" no pass
expect "an email column without the generator" "create table person (id int, email text);" no fail
expect "a phone number without the generator" "alter table person add column phone_number text;" no fail
expect "personal data with faker seeds" "create table person (id int, first_name text, email text);" yes pass
expect "an empty seed file is not enough" "create table person (id int, email text);" stub fail
expect "a seed file without faker is not enough" "create table person (id int, email text);" nofaker fail
expect "a people table with a json column" "create table candidate (id uuid, profile jsonb);" no fail
expect "candidate_name and surname" "alter table hire add column candidate_name text, add column surname text;" no fail
expect "Swedish column names" "create table k (id int, epost text, personnr text, adress text);" no fail
expect "a whole short word" "create table k (id int, tel text);" no fail
expect "a short word inside another" "create table metric (id int, telemetry jsonb);" no pass
expect "-- inside a string is not a comment" "create table c (id int, note text default '--', email text);" no fail
expect "a people table split across lines" $'CREATE TABLE\n  candidates (id uuid);' no fail
expect "repeated spaces" "create table  users (id int);" no fail
expect "a quoted schema" 'create table "public"."users" (id int);' no fail
expect "a bare name column" "alter table interviewer add column name text;" no fail
expect "a spaced -- inside a string" "create table c (id int, note text default ' --', email text);" no fail
expect "name only in a comment" "create table status (id int, label text); -- name later" no pass
expect "an apostrophe in a comment" $'-- the talent\'s contact details\ncreate table t (id serial, email text, status text default \'new\');' no fail
expect "-- inside a block comment" $'/* author -- someone */\ncreate table t (id int);\n/* end */\nalter table t add column email text;' no fail
expect "an E-string escape" $'comment on table t is E\'it\\\'s\';\nalter table t add column email text;' no fail
expect "a dollar-quoted body with an apostrophe" $'do $$ begin raise notice \'it\'\'s\'; end $$;\nalter table t add column email text;' no fail
expect "an unlogged people table" "create unlogged table users (id int);" no fail
expect "a byte that isn't UTF-8" $'create table t (id int, note text default \'s\xf6k\', email text);' no fail
expect "DDL inside a DO block" $'do $$ begin alter table t add column email text; end $$;' no fail
expect "a plain string ending in a backslash" $'create table t (id int, path text default \'c:\\\', email text);' no fail
expect "upper-case Swedish" "create table k (id int, FÖRNAMN text);" no fail
expect "an apostrophe in a dollar-quoted string" $'comment on table t is $$it\'s$$;\nalter table t add column email text default \'x\';' no fail
expect "German and Dutch names" "create table k (id int, vorname text, nachname text, voornaam text, achternaam text);" no fail
expect "a temp people table" "create temp table respondents (id int);" no fail
expect "talent and leads" "create table talent (id int); create table leads (id int);" no fail
expect "a bare mail column" "create table k (id int, mail text);" no fail
expect "faker seeds from a locale entry point" "create table person (id int, email text);" locale pass

d=$(mktemp -d "${TMPDIR:-/tmp}/synthetic.XXXXXX") && mkdir -p "$d/migrations"
if out=$("$guard" "$d" 2>&1) && [ "$out" = "synthetic-data: scanned 0" ]; then echo "ok    an empty migrations folder"; else echo "FAIL  an empty migrations folder: $out"; fail=1; fi
rm -rf "$d"
exit $fail
