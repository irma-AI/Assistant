#!/usr/bin/env bash
# Runs as the Dokploy schedule "Assistant: 14-day log retention (IRM-115)", daily at 03:17 UTC, inside
# the Dokploy container (which has the Docker socket). Keep this file and the schedule's script the same.
# IRM-115: keep at most 14 days of container logs for the Assistant (app, database) and Traefik.
# json-file has no age limit, so lines older than the cutoff are cut out of each log in place.
DRY=${DRY:-0}
ids=$(docker ps -aq --filter name=assistant- --filter name=dokploy-traefik)
[ -n "$ids" ] || { echo "no containers"; exit 0; }
files=$(for c in $ids; do docker inspect -f '{{.LogPath}}' "$c"; done | sed 's#^/var/lib/docker/containers/##')
docker run --rm -e DRY="$DRY" -e FILES="$files" -v /var/lib/docker/containers:/c alpine:latest sh -c '
cutoff=$(date -u -d @$(( $(date +%s) - 14*86400 )) +%Y-%m-%dT%H:%M:%S)
echo "cutoff $cutoff"
for rel in $FILES; do
  f=/c/$rel; [ -f "$f" ] || continue
  n=$(awk -v c="$cutoff" '"'"'match($0,/"time":"[^"]+"/){ if (substr($0,RSTART+8,19) >= c) { print NR; exit } }'"'"' "$f")
  short=$(echo "$rel" | cut -c1-12)
  if [ -z "$n" ]; then echo "$short: all lines older, empty it"; [ "$DRY" = 1 ] || : > "$f"
  elif [ "$n" -gt 1 ]; then echo "$short: drop $((n-1)) old lines"; [ "$DRY" = 1 ] || { tail -n +"$n" "$f" > /tmp/k && cat /tmp/k > "$f"; }
  else echo "$short: nothing older than cutoff"; fi
done'
